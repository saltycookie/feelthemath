import {
  DemoConfig,
  ElementCuePatch,
  ElementEntryDelta,
  ElementsMap,
  ResolvedStepConfig,
  StepAnimationController,
  StepCue,
  StepTimeline,
  VisualElement,
  VisualElementPatch,
} from './types';

function cloneElementsMap(map: ElementsMap): ElementsMap {
  const next: ElementsMap = {};
  for (const [id, el] of Object.entries(map)) {
    next[id] = {
      ...el,
      scale: el.scale ?? 1,
      transitionDurationMs: 0,
      state: structuredClone(el.state),
    };
  }
  return next;
}

function getSoleElementId(demo: DemoConfig<any>): string | undefined {
  const keys = Object.keys(demo.renderers);
  return keys.length === 1 ? keys[0] : undefined;
}

function makeDefaultStateReader(demo: DemoConfig<any>): (type: string) => Record<string, any> {
  return (type: string) => structuredClone(demo.renderers[type]?.defaultState ?? {});
}

function applyEntryDelta(
  map: ElementsMap,
  id: string,
  delta: ElementEntryDelta<any>,
  getDefaultState: (type: string) => Record<string, any>
): void {
  const existing = map[id];
  const type = delta.type ?? existing?.type ?? id;
  const defaultState = getDefaultState(type);

  const nextState =
    !existing || delta.reset ? { ...defaultState } : structuredClone(existing.state);

  if (delta.unset) {
    for (const key of delta.unset) {
      nextState[key as string] = structuredClone(defaultState[key as string]);
    }
  }
  if (delta.set) {
    Object.assign(nextState, structuredClone(delta.set));
  }

  map[id] = {
    id,
    type,
    x: delta.x !== undefined ? delta.x : existing?.x ?? 0,
    y: delta.y !== undefined ? delta.y : existing?.y ?? 0,
    opacity: delta.opacity !== undefined ? delta.opacity : existing?.opacity ?? 1,
    scale: delta.scale !== undefined ? delta.scale : existing?.scale ?? 1,
    transitionDurationMs: 0,
    state: nextState,
  };
}

function applyCuePatch(
  map: ElementsMap,
  id: string,
  patch: ElementCuePatch<any>,
  getDefaultState: (type: string) => Record<string, any>
): void {
  const existing = map[id];
  if (!existing) return;

  const defaultState = getDefaultState(existing.type);
  const nextState = structuredClone(existing.state);

  if (patch.unset) {
    for (const key of patch.unset) {
      nextState[key as string] = structuredClone(defaultState[key as string]);
    }
  }
  if (patch.set) {
    Object.assign(nextState, structuredClone(patch.set));
  }

  map[id] = {
    ...existing,
    x: patch.x !== undefined ? patch.x : existing.x,
    y: patch.y !== undefined ? patch.y : existing.y,
    opacity: patch.opacity !== undefined ? patch.opacity : existing.opacity,
    scale: patch.scale !== undefined ? patch.scale : existing.scale,
    state: nextState,
  };
}

function foldCue(
  map: ElementsMap,
  cue: StepCue<any>,
  soleElementId: string | undefined,
  getDefaultState: (type: string) => Record<string, any>
): void {
  if (cue.parallel) {
    for (const branch of cue.parallel) {
      foldCue(map, branch, soleElementId, getDefaultState);
    }
    return;
  }

  if (cue.add) {
    for (const [id, delta] of Object.entries(cue.add)) {
      if (delta) {
        applyEntryDelta(map, id, delta, getDefaultState);
      }
    }
  }

  if (cue.remove) {
    for (const id of cue.remove) {
      delete map[id];
    }
  }

  if (cue.elements) {
    for (const [id, patch] of Object.entries(cue.elements)) {
      if (patch) {
        applyCuePatch(map, id, patch, getDefaultState);
      }
    }
  }

  if (soleElementId && (cue.set || cue.unset)) {
    applyCuePatch(map, soleElementId, { set: cue.set, unset: cue.unset }, getDefaultState);
  }
}

function foldTimeline(
  map: ElementsMap,
  timeline: StepTimeline<any>,
  soleElementId: string | undefined,
  getDefaultState: (type: string) => Record<string, any>
): void {
  const list = Array.isArray(timeline) ? timeline : [timeline];
  for (const cue of list) {
    foldCue(map, cue, soleElementId, getDefaultState);
  }
}

/**
 * Resolves all steps in a `DemoConfig` synchronously at initialization:
 * - Assigns default `stepNumber` (`index + 1`).
 * - Resolves `initialElements` by inheriting the previous step's end state (after `play` + `exit`)
 *   and applying `reset` / `remove` / `elements` / `set` / `unset` deltas.
 */
export function resolveDemoSteps(demo: DemoConfig<any>): ResolvedStepConfig<any>[] {
  const soleElementId = getSoleElementId(demo);
  const getDefaultState = makeDefaultStateReader(demo);
  let prevEndMap: ElementsMap = {};

  return demo.steps.map((step, index) => {
    let initialMap: ElementsMap;

    if (step.initialElements) {
      initialMap = {};
      for (const el of step.initialElements) {
        initialMap[el.id] = {
          ...el,
          scale: el.scale ?? 1,
          transitionDurationMs: 0,
          state: structuredClone(el.state),
        };
      }
    } else {
      initialMap = step.reset ? {} : cloneElementsMap(prevEndMap);

      if (step.remove) {
        for (const id of step.remove) {
          delete initialMap[id];
        }
      }

      if (step.elements) {
        for (const [id, delta] of Object.entries(step.elements)) {
          if (delta) {
            applyEntryDelta(initialMap, id, delta, getDefaultState);
          }
        }
      }

      if (soleElementId && (step.set || step.unset)) {
        applyEntryDelta(
          initialMap,
          soleElementId,
          { set: step.set, unset: step.unset },
          getDefaultState
        );
      }
    }

    const endMap = cloneElementsMap(initialMap);
    if (step.play && typeof step.play !== 'function') {
      foldTimeline(endMap, step.play, soleElementId, getDefaultState);
    }
    if (step.exit && typeof step.exit !== 'function') {
      foldTimeline(endMap, step.exit, soleElementId, getDefaultState);
    }
    prevEndMap = endMap;

    return {
      ...step,
      stepNumber: step.stepNumber ?? index + 1,
      initialElements: Object.values(initialMap),
    };
  });
}

function buildVisualElementPatch(
  id: string,
  patch: ElementCuePatch<any>,
  controller: StepAnimationController,
  getDefaultState: (type: string) => Record<string, any>
): VisualElementPatch<any> | undefined {
  const existing = controller.getElements()[id];
  if (!existing) return undefined;

  const defaultState = getDefaultState(existing.type);
  const statePatch: Record<string, any> = {};
  let hasStatePatch = false;

  if (patch.unset) {
    for (const key of patch.unset) {
      statePatch[key as string] = structuredClone(defaultState[key as string]);
      hasStatePatch = true;
    }
  }
  if (patch.set) {
    Object.assign(statePatch, structuredClone(patch.set));
    hasStatePatch = true;
  }

  return {
    x: patch.x,
    y: patch.y,
    opacity: patch.opacity,
    scale: patch.scale,
    state: hasStatePatch ? statePatch : undefined,
  };
}

function ignoreAbortError(promise: Promise<void>): void {
  promise.catch((err: unknown) => {
    if ((err as { name?: string } | null)?.name !== 'AbortError') {
      console.error('Error in a forked cue:', err);
    }
  });
}

/**
 * Executes a declarative `StepTimeline` (`StepCue` or `StepCue[]`) against a `StepAnimationController`.
 */
export async function runStepTimeline(
  timeline: StepTimeline<any>,
  controller: StepAnimationController,
  demo: DemoConfig<any>
): Promise<void> {
  const soleElementId = getSoleElementId(demo);
  const getDefaultState = makeDefaultStateReader(demo);

  const resolveMs = (cue: StepCue<any>): number => {
    if (cue.ms === undefined) return 0;
    if (typeof cue.ms === 'number') return cue.ms;
    const els = controller.getElements();
    const arg = soleElementId ? els[soleElementId]?.state ?? getDefaultState(soleElementId) : els;
    return Math.max(0, cue.ms(arg));
  };

  const runCue = async (cue: StepCue<any>): Promise<void> => {
    if (cue.wait && cue.wait > 0) {
      await controller.wait(cue.wait);
    }

    const executeBody = async (): Promise<void> => {
      if (cue.parallel) {
        await Promise.all(cue.parallel.map((branch) => runCue(branch)));
        return;
      }

      const durationMs = resolveMs(cue);
      const easing = cue.easing;
      const tasks: Promise<void>[] = [];

      if (cue.add) {
        for (const [id, delta] of Object.entries(cue.add)) {
          if (!delta) continue;
          const temp: ElementsMap = {};
          applyEntryDelta(temp, id, delta, getDefaultState);
          const element: VisualElement<any> = temp[id];
          tasks.push(controller.addElement(element, { durationMs, easing }));
        }
      }

      if (cue.remove) {
        for (const id of cue.remove) {
          tasks.push(
            controller.removeElement(id, cue.ms === undefined ? undefined : durationMs)
          );
        }
      }

      const patches: Record<string, VisualElementPatch<any>> = {};
      if (cue.elements) {
        for (const [id, patch] of Object.entries(cue.elements)) {
          if (!patch) continue;
          const built = buildVisualElementPatch(id, patch, controller, getDefaultState);
          if (built) {
            patches[id] = built;
          }
        }
      }

      if (soleElementId && (cue.set || cue.unset)) {
        const built = buildVisualElementPatch(
          soleElementId,
          { set: cue.set, unset: cue.unset },
          controller,
          getDefaultState
        );
        if (built) {
          const prev = patches[soleElementId];
          patches[soleElementId] = prev
            ? {
                ...prev,
                ...built,
                state:
                  prev.state || built.state
                    ? { ...(prev.state ?? {}), ...(built.state ?? {}) }
                    : undefined,
              }
            : built;
        }
      }

      const patchEntries = Object.entries(patches);
      if (patchEntries.length > 0) {
        if (durationMs <= 0) {
          for (const [id, patch] of patchEntries) {
            controller.updateElementImmediate(id, patch);
          }
        } else {
          tasks.push(controller.animateElements(patches, { durationMs, easing }));
        }
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    };

    if (cue.fork) {
      ignoreAbortError(executeBody());
    } else {
      await executeBody();
    }
  };

  const list = Array.isArray(timeline) ? timeline : [timeline];
  for (const cue of list) {
    await runCue(cue);
  }
}
