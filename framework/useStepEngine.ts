import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  DemoConfig,
  Scene,
  ScenePatch,
  ScenesMap,
  StateInterpolator,
  StepAnimationController,
  StepExitContext,
} from './types';
import { createCanonicalScenesMap, runDefaultExitAnimation } from './exitAnimation';
import { resolveDemoSteps, resolveSceneRendererEntry, runStepTimeline } from './stepTimeline';
import { parseStepHash, useHashStepRouter } from './useHashStepRouter';
import { waitForBoxArrival } from './box';

export type StepLifecyclePhase = 'idle' | 'playing' | 'exiting';

function createAbortError(): Error {
  const err = new Error('Animation aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Standard easing functions used for frame-by-frame state interpolation.
 */
function applyEasing(t: number, easingName?: string): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (easingName === 'linear') {
    return clamped;
  }
  if (easingName === 'ease-in') {
    return clamped * clamped * clamped;
  }
  if (easingName === 'ease-in-out') {
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }
  // Default cubic-out (matches cubic-bezier(0.22, 1, 0.36, 1) closely)
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * Default fallback state interpolator when a scene type does not register a custom
 * `interpolateState` function:
 * - Linearly interpolates any numeric properties in `targetPatch` from `startState[key]` to `targetPatch[key]`.
 * - Immediately applies non-numeric properties (booleans, strings, objects).
 */
const defaultStateInterpolator: StateInterpolator<Record<string, any>> = (
  startState,
  targetPatch,
  progress
) => {
  const nextState: Record<string, any> = { ...startState };
  for (const [key, targetVal] of Object.entries(targetPatch)) {
    const startVal = startState[key];
    if (
      typeof targetVal === 'number' &&
      typeof startVal === 'number' &&
      Number.isFinite(targetVal) &&
      Number.isFinite(startVal)
    ) {
      nextState[key] =
        progress >= 1 ? targetVal : startVal + (targetVal - startVal) * progress;
    } else {
      nextState[key] = targetVal;
    }
  }
  return nextState;
};

/**
 * Core state-machine hook for the step-by-step math demo framework.
 *
 * Enforces all architectural invariants + custom state interpolators:
 * 1. Bottom Navigation Panel state (Back, Replay, Next, Dots, #step-X URL sync).
 * 2. Canvas active scene & title synchronization.
 * 3. Initial scene rendered immediately on step entry, followed by `play` animation
 *    (disabling Next while `play` is running, disabling Replay when step has no `play`).
 * 4. `exit` animation when clicking Next (default 250ms dim-out when switching scenes and
 *    intact preservation when staying on the same scene at the same position, or custom step `exit` function).
 * 5. Deterministic beginning state for every step regardless of whether entered via URL/#step-X,
 *    navigation dots, Back button, or Next button.
 * 6. Per-scene-type custom `interpolateState(startState, targetPatch, progress)` called via
 *    `requestAnimationFrame` during `animateScene` / `animateScenes`.
 */
const TOP_MESSAGE_DELAY_MS = 500;
const MESSAGE_FADE_MS = 250;

export function useStepEngine(demo: DemoConfig<any>) {
  const steps = useMemo(() => resolveDemoSteps(demo), [demo]);
  const totalSteps = steps.length;

  const abortControllerRef = useRef<AbortController | null>(null);
  const scenesRef = useRef<ScenesMap>({});

  const initialIdx =
    typeof window !== 'undefined'
      ? parseStepHash(window.location.hash, totalSteps) ?? 0
      : 0;

  const [scenes, setScenesState] = useState<ScenesMap>(() => {
    const map = createCanonicalScenesMap(steps[initialIdx]?.initialScenes ?? []);
    scenesRef.current = map;
    return map;
  });

  const [messageVisibility, setMessageVisibility] = useState<{
    topOpacity: number;
    bottomOpacity: number;
  }>({ topOpacity: 0, bottomOpacity: 0 });

  const [phase, setPhase] = useState<StepLifecyclePhase>(() => {
    const s = steps[initialIdx];
    return s?.play || s?.topMessage !== undefined || s?.bottomMessage !== undefined
      ? 'playing'
      : 'idle';
  });

  const updateScenes = useCallback(
    (updater: ScenesMap | ((prev: ScenesMap) => ScenesMap)) => {
      const next =
        typeof updater === 'function' ? updater(scenesRef.current) : updater;
      scenesRef.current = next;
      setScenesState(next);
    },
    []
  );

  const cancelActiveAnimation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Resolves the state interpolator for a given scene `type`:
   * 1. `demo.stateInterpolators[type]` if provided
   * 2. `demo.scenes[type].interpolateState` if attached to the renderer component
   * 3. `defaultStateInterpolator` fallback
   */
  const getInterpolatorForType = useCallback(
    (type: string): StateInterpolator<any> => {
      const entry = demo.scenes[type];
      const renderer = entry ? resolveSceneRendererEntry(entry).renderer : undefined;
      return (
        demo.stateInterpolators?.[type] ??
        renderer?.interpolateState ??
        defaultStateInterpolator
      );
    },
    [demo.stateInterpolators, demo.scenes]
  );

  /**
   * Builds a StepAnimationController bound to a specific AbortSignal.
   */
  const createController = useCallback(
    (signal: AbortSignal): StepAnimationController => {
      const wait = (ms: number): Promise<void> =>
        new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(createAbortError());
            return;
          }
          if (ms <= 0) {
            resolve();
            return;
          }
          const timer = window.setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
          }, ms);
          const onAbort = () => {
            window.clearTimeout(timer);
            reject(createAbortError());
          };
          signal.addEventListener('abort', onAbort, { once: true });
        });

      const getScenes = () => scenesRef.current;

      const updateSceneImmediate = <TState = Record<string, any>>(
        id: string,
        patch: ScenePatch<TState>
      ) => {
        if (signal.aborted) return;
        updateScenes((prev) => {
          const existing = prev[id];
          if (!existing) return prev;
          const interpolator = getInterpolatorForType(existing.type);
          return {
            ...prev,
            [id]: {
              ...existing,
              x: patch.x !== undefined ? patch.x : existing.x,
              y: patch.y !== undefined ? patch.y : existing.y,
              opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
              scale: patch.scale !== undefined ? patch.scale : existing.scale,
              transitionDurationMs: 0,
              state: patch.state
                ? interpolator(existing.state, patch.state, 1)
                : existing.state,
            },
          };
        });
      };

      const animateScenes = async (
        patches: Record<string, ScenePatch<any>>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        const durationMs = options?.durationMs ?? 450;
        const easing = options?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';

        // Snapshot starting states for scenes whose `state` is being animated
        const startStates: Record<string, any> = {};
        let hasStatePatches = false;

        for (const [id, patch] of Object.entries(patches)) {
          const existing = scenesRef.current[id];
          if (existing && patch.state) {
            startStates[id] = structuredClone(existing.state);
            hasStatePatches = true;
          }
        }

        // 1. Immediately apply outer CSS-transitioned properties (x, y, opacity, scale)
        //    and initial frame (progress = 0) of any state patches
        updateScenes((prev) => {
          const next = { ...prev };
          for (const [id, patch] of Object.entries(patches)) {
            const existing = next[id];
            if (!existing) continue;
            const interpolator = getInterpolatorForType(existing.type);
            next[id] = {
              ...existing,
              x: patch.x !== undefined ? patch.x : existing.x,
              y: patch.y !== undefined ? patch.y : existing.y,
              opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
              scale: patch.scale !== undefined ? patch.scale : existing.scale,
              transitionDurationMs: durationMs,
              transitionEasing: easing,
              state:
                patch.state && startStates[id]
                  ? interpolator(
                      startStates[id],
                      patch.state,
                      durationMs <= 0 ? 1 : 0
                    )
                  : existing.state,
            };
          }
          return next;
        });

        if (durationMs <= 0) {
          return;
        }

        // 2. If no `state` patches were provided, CSS transitions handle x/y/opacity/scale
        if (!hasStatePatches) {
          await wait(durationMs);
          return;
        }

        // 3. Otherwise, run a requestAnimationFrame loop over `durationMs` calling each
        //    scene type's `interpolateState(startState, targetPatch, easedProgress)`
        await new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
            reject(createAbortError());
            return;
          }

          let rafId = 0;
          const startTime = performance.now();

          const onAbort = () => {
            window.cancelAnimationFrame(rafId);
            reject(createAbortError());
          };

          signal.addEventListener('abort', onAbort, { once: true });

          const tick = (now: number) => {
            if (signal.aborted) return;
            const elapsed = now - startTime;
            const rawProgress = Math.min(1, elapsed / durationMs);
            const easedProgress =
              rawProgress >= 1 ? 1 : applyEasing(rawProgress, easing);

            updateScenes((prev) => {
              const next = { ...prev };
              for (const [id, patch] of Object.entries(patches)) {
                const existing = next[id];
                if (!existing || !patch.state || !startStates[id]) continue;
                const interpolator = getInterpolatorForType(existing.type);
                const interpolated = interpolator(
                  startStates[id],
                  patch.state,
                  easedProgress
                );
                const mergedState: Record<string, any> = { ...existing.state };
                for (const key of Object.keys(interpolated)) {
                  if (key in patch.state || interpolated[key] !== startStates[id][key]) {
                    mergedState[key] = interpolated[key];
                  }
                }
                next[id] = {
                  ...existing,
                  state: mergedState,
                };
              }
              return next;
            });

            if (rawProgress < 1) {
              rafId = window.requestAnimationFrame(tick);
            } else {
              signal.removeEventListener('abort', onAbort);
              resolve();
            }
          };

          rafId = window.requestAnimationFrame(tick);
        });
      };

      const animateScene = async <TState = Record<string, any>>(
        id: string,
        patch: ScenePatch<TState>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        await animateScenes({ [id]: patch }, options);
      };

      const addScene = async <TState = Record<string, any>>(
        scene: Scene<TState>,
        options?: { durationMs?: number; easing?: string }
      ): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        const durationMs = options?.durationMs ?? 400;
        const easing = options?.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
        const targetOpacity = scene.opacity ?? 1;

        if (durationMs <= 0) {
          updateScenes((prev) => ({
            ...prev,
            [scene.id]: {
              ...scene,
              opacity: targetOpacity,
              scale: scene.scale ?? 1,
              transitionDurationMs: 0,
              state: structuredClone(scene.state),
            },
          }));
          return;
        }

        // Mount with opacity 0 first, then transition to targetOpacity on next frame
        updateScenes((prev) => ({
          ...prev,
          [scene.id]: {
            ...scene,
            opacity: 0,
            scale: scene.scale ?? 1,
            transitionDurationMs: 0,
            state: structuredClone(scene.state),
          },
        }));

        await wait(25);
        await animateScene(
          scene.id,
          { opacity: targetOpacity },
          { durationMs, easing }
        );
      };

      const removeScene = async (id: string, durationMs = 250): Promise<void> => {
        if (signal.aborted) throw createAbortError();
        if (durationMs > 0 && scenesRef.current[id]) {
          await animateScene(id, { opacity: 0 }, { durationMs, easing: 'ease-out' });
        }
        if (signal.aborted) throw createAbortError();
        updateScenes((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      };

      return {
        signal,
        wait,
        getScenes,
        addScene,
        animateScene,
        animateScenes,
        updateSceneImmediate,
        removeScene,
      };
    },
    [updateScenes, getInterpolatorForType]
  );

  /**
   * Enters `targetStepIndex` by setting its deterministic canonical `initialScenes`
   * and running its message / `play` sequence:
   * - `topMessage` fades in first, followed 500ms later by `play`, then `bottomMessage`.
   */
  const enterStep = useCallback(
    async (targetStepIndex: number) => {
      cancelActiveAnimation();
      const step = steps[targetStepIndex];
      if (!step) return;

      // Always set exact canonical beginning state for the step
      const canonicalStart = createCanonicalScenesMap(step.initialScenes);
      updateScenes(canonicalStart);
      setMessageVisibility({ topOpacity: 0, bottomOpacity: 0 });

      const hasTop = step.topMessage !== undefined;
      const hasBottom = step.bottomMessage !== undefined;
      const hasPlay = Boolean(step.play);

      if (!hasTop && !hasBottom && !hasPlay) {
        setPhase('idle');
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setPhase('playing');

      try {
        const controller = createController(abortController.signal);
        const arrival = waitForBoxArrival();

        if (hasTop) {
          // Allow initial opacity: 0 frame to paint so CSS 250ms fade-in triggers cleanly
          await controller.wait(20);
          setMessageVisibility((prev) => ({ ...prev, topOpacity: 1 }));
        }

        if (arrival) {
          await arrival;
          await controller.wait(250);
        } else if (!hasTop) {
          // Small frame delay so initialScenes paint cleanly before play/bottomMessage starts
          await controller.wait(40);
        }

        if (hasTop) {
          if (hasPlay || hasBottom) {
            await controller.wait(TOP_MESSAGE_DELAY_MS);
          } else if (!arrival) {
            await controller.wait(MESSAGE_FADE_MS);
          }
        }

        if (step.play) {
          if (typeof step.play === 'function') {
            await step.play(controller);
          } else {
            await runStepTimeline(step.play, controller, demo, step.sceneId);
          }
        }

        if (hasBottom && !abortController.signal.aborted) {
          setMessageVisibility((prev) => ({ ...prev, bottomOpacity: 1 }));
          await controller.wait(MESSAGE_FADE_MS);
        }

        if (!abortController.signal.aborted) {
          setPhase('idle');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error(`Error in step ${targetStepIndex + 1} play():`, err);
        }
        // If no newer animation has replaced this abortController, ensure phase returns to idle
        if (abortControllerRef.current === abortController) {
          setPhase('idle');
        }
      }
    },
    [demo, steps, cancelActiveAnimation, updateScenes, createController]
  );

  const handleExternalHashJump = useCallback(
    (targetStepIndex: number) => {
      enterStep(targetStepIndex);
    },
    [enterStep]
  );

  const { stepIndex, setStepIndexAndHash } = useHashStepRouter(
    totalSteps,
    handleExternalHashJump
  );

  // Keep a ref of the initial stepIndex so the mount effect only runs on mount/unmount,
  // NOT on every stepIndex change.
  const initialStepIndexRef = useRef(stepIndex);
  useEffect(() => {
    enterStep(initialStepIndexRef.current);
    return () => {
      cancelActiveAnimation();
    };
  }, [enterStep, cancelActiveAnimation]);

  /**
   * Direct navigation via navigation dots or Back button.
   * Immediately enters the target step with its canonical initial state.
   */
  const goToStep = useCallback(
    (targetIndex: number, source: 'dot' | 'back' | 'direct' = 'direct') => {
      if (targetIndex < 0 || targetIndex >= totalSteps) return;
      if (targetIndex === stepIndex && source === 'dot') return;
      setStepIndexAndHash(targetIndex);
      enterStep(targetIndex);
    },
    [totalSteps, stepIndex, setStepIndexAndHash, enterStep]
  );

  /**
   * Replay button handler:
   * Resets current step to its canonical `initialScenes` and replays its message/`play` sequence.
   */
  const replayCurrentStep = useCallback(() => {
    const currentStep = steps[stepIndex];
    const hasAnim = Boolean(
      currentStep?.play ||
        currentStep?.topMessage !== undefined ||
        currentStep?.bottomMessage !== undefined
    );
    if (!hasAnim || phase !== 'idle') return;
    enterStep(stepIndex);
  }, [steps, stepIndex, phase, enterStep]);

  /**
   * Next button handler:
   * - Disabled when `phase !== 'idle'` (i.e., while `play` or `exit` is ongoing).
   * - Fades out any top/bottom messages in 250ms in parallel with the current step's
   *   `exit` function/cues (plus `runDefaultExitAnimation`).
   * - Then commits next step's canonical `initialScenes`, updates URL to `#step-(X+1)`,
   *   and runs next step's `play` animation.
   */
  const goNext = useCallback(async () => {
    if (phase !== 'idle' || stepIndex >= totalSteps - 1) return;

    const currentStep = steps[stepIndex];
    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];

    cancelActiveAnimation();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setPhase('exiting');

    const nextInitialMap = createCanonicalScenesMap(nextStep.initialScenes);
    const controller = createController(abortController.signal);
    const hasMessages = Boolean(
      currentStep.topMessage !== undefined || currentStep.bottomMessage !== undefined
    );
    if (hasMessages) {
      setMessageVisibility({ topOpacity: 0, bottomOpacity: 0 });
    }

    try {
      const runDefaultExit = (options?: { excludeIds?: string[]; durationMs?: number }) =>
        runDefaultExitAnimation(
          scenesRef.current,
          nextInitialMap,
          controller,
          options
        );

      const runSceneExit = async () => {
        if (currentStep.exit) {
          if (typeof currentStep.exit === 'function') {
            const exitContext: StepExitContext = {
              currentScenes: scenesRef.current,
              nextInitialScenes: nextInitialMap,
              controller,
              runDefaultExit,
            };
            await currentStep.exit(exitContext);
          } else {
            await runStepTimeline(currentStep.exit, controller, demo, currentStep.sceneId);
            await runDefaultExit();
          }
        } else {
          await runDefaultExit();
        }
      };

      await Promise.all([
        runSceneExit(),
        hasMessages ? controller.wait(MESSAGE_FADE_MS) : Promise.resolve(),
      ]);

      if (abortController.signal.aborted) return;

      // Advance URL hash to #step-(nextIndex+1) and enter next step with canonical initial state
      setStepIndexAndHash(nextIndex);
      await enterStep(nextIndex);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(`Error in step ${stepIndex + 1} exit():`, err);
        setStepIndexAndHash(nextIndex);
        await enterStep(nextIndex);
      }
    }
  }, [
    demo,
    phase,
    stepIndex,
    totalSteps,
    steps,
    cancelActiveAnimation,
    createController,
    setStepIndexAndHash,
    enterStep,
  ]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    goToStep(stepIndex - 1, 'back');
  }, [stepIndex, goToStep]);

  /**
   * Allows interactive canvas controls (such as the Fold/Unfold toggle switch or draggable point C)
   * to update their scene's internal state once `play` has completed.
   */
  const updateInteractiveSceneState = useCallback(
    (sceneId: string, statePatch: Record<string, any>) => {
      updateScenes((prev) => {
        const target = prev[sceneId];
        if (!target) return prev;
        const interpolator = getInterpolatorForType(target.type);
        return {
          ...prev,
          [sceneId]: {
            ...target,
            transitionDurationMs: 350,
            state: interpolator(target.state, statePatch, 1),
          },
        };
      });
    },
    [updateScenes, getInterpolatorForType]
  );

  const currentStep = steps[stepIndex];
  const hasPlayAnimation = Boolean(
    currentStep?.play ||
      currentStep?.topMessage !== undefined ||
      currentStep?.bottomMessage !== undefined
  );
  const isAnimating = phase === 'playing' || phase === 'exiting';

  return {
    currentStepIndex: stepIndex,
    currentStep,
    totalSteps,
    scenes,
    topMessageOpacity: messageVisibility.topOpacity,
    bottomMessageOpacity: messageVisibility.bottomOpacity,
    phase,
    isAnimating,
    hasPlayAnimation,
    canGoBack: stepIndex > 0 && phase !== 'exiting',
    canGoNext: stepIndex < totalSteps - 1 && !isAnimating,
    canReplay: hasPlayAnimation && !isAnimating,
    goNext,
    goBack,
    goToStep,
    replayCurrentStep,
    updateInteractiveSceneState,
  };
}
