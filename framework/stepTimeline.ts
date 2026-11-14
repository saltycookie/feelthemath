import {
  DemoConfig,
  ElementCuePatch,
  ElementRendererComponent,
  ElementRendererEntry,
  ElementsMap,
  ResolvedStepConfig,
  StepAnimationController,
  StepCue,
  StepTimeline,
  VisualElement,
  VisualElementPatch,
} from './types';

export interface ResolvedRendererEntry<TState = any> {
  renderer: ElementRendererComponent<TState>;
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export function resolveRendererEntry<TState = any>(
  entry: ElementRendererEntry<TState>
): ResolvedRendererEntry<TState> {
  if (typeof entry === 'function') {
    return { renderer: entry, x: 0, y: 0, opacity: 1, scale: 1 };
  }
  return {
    renderer: entry.renderer,
    x: entry.x ?? 0,
    y: entry.y ?? 0,
    opacity: entry.opacity ?? 1,
    scale: entry.scale ?? 1,
  };
}

function cloneElement(el: VisualElement<any>): VisualElement<any> {
  return {
    ...el,
    scale: el.scale ?? 1,
    transitionDurationMs: 0,
    state: structuredClone(el.state),
  };
}

function getSoleElementId(demo: DemoConfig<any>): string | undefined {
  const keys = Object.keys(demo.renderers);
  return keys.length === 1 ? keys[0] : undefined;
}

function makeDefaultStateReader(demo: DemoConfig<any>): (type: string) => Record<string, any> {
  return (type: string) => {
    const entry = demo.renderers[type];
    if (!entry) return {};
    const { renderer } = resolveRendererEntry(entry);
    return structuredClone(renderer.defaultState ?? {});
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
  globalVEs: ElementsMap,
  activeIds: Set<string>,
  cue: StepCue<any>,
  soleElementId: string | undefined,
  getDefaultState: (type: string) => Record<string, any>
): void {
  if (cue.parallel) {
    for (const branch of cue.parallel) {
      foldTimeline(globalVEs, activeIds, branch, soleElementId, getDefaultState);
    }
    return;
  }

  if (cue.elements) {
    for (const [id, patch] of Object.entries(cue.elements)) {
      if (patch && activeIds.has(id)) {
        applyCuePatch(globalVEs, id, patch, getDefaultState);
      }
    }
  }

  if (soleElementId && activeIds.has(soleElementId) && (cue.set || cue.unset)) {
    applyCuePatch(
      globalVEs,
      soleElementId,
      { set: cue.set, unset: cue.unset },
      getDefaultState
    );
  }
}

function foldTimeline(
  globalVEs: ElementsMap,
  activeIds: Set<string>,
  timeline: StepTimeline<any>,
  soleElementId: string | undefined,
  getDefaultState: (type: string) => Record<string, any>
): void {
  const list = Array.isArray(timeline) ? timeline : [timeline];
  for (const cue of list) {
    foldCue(globalVEs, activeIds, cue, soleElementId, getDefaultState);
  }
}

/**
 * Resolves all steps in a `DemoConfig` synchronously at initialization:
 * - Assigns default `stepNumber` (`index + 1`).
 * - Initializes global visual elements from `demo.renderers` (`x`, `y`, `opacity`, `scale`, `defaultState`).
 * - Resolves each step's `initialElements` from `step.elements` (or the sole element when omitted)
 *   and folds declarative `play` / `exit` cues onto the global elements for subsequent steps.
 */
export function resolveDemoSteps(demo: DemoConfig<any>): ResolvedStepConfig<any>[] {
  const soleElementId = getSoleElementId(demo);
  const getDefaultState = makeDefaultStateReader(demo);

  const globalVEs: ElementsMap = {};
  for (const [id, entry] of Object.entries(demo.renderers)) {
    const { renderer, x, y, opacity, scale } = resolveRendererEntry(entry);
    globalVEs[id] = {
      id,
      type: id,
      x,
      y,
      opacity,
      scale,
      transitionDurationMs: 0,
      state: structuredClone(renderer.defaultState ?? {}),
    };
  }

  return demo.steps.map((step, index) => {
    let activeIdList: string[];
    if (step.elements !== undefined) {
      activeIdList = step.elements;
    } else if (soleElementId) {
      activeIdList = [soleElementId];
    } else {
      throw new Error(
        `Step ${index + 1} ("${step.title}") in multi-element demo "${demo.id}" must declare \`elements\`.`
      );
    }

    const initialElements: VisualElement<any>[] = activeIdList.map((id) => {
      const el = globalVEs[id];
      if (!el) {
        throw new Error(
          `Step ${index + 1} ("${step.title}") references unknown element "${id}" not declared in demo.renderers.`
        );
      }
      return cloneElement(el);
    });

    const activeIds = new Set(activeIdList);
    if (step.play && typeof step.play !== 'function') {
      foldTimeline(globalVEs, activeIds, step.play, soleElementId, getDefaultState);
    }
    if (step.exit && typeof step.exit !== 'function') {
      foldTimeline(globalVEs, activeIds, step.exit, soleElementId, getDefaultState);
    }

    return {
      ...step,
      stepNumber: step.stepNumber ?? index + 1,
      initialElements,
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

  const runTimeline = async (tl: StepTimeline<any>): Promise<void> => {
    const list = Array.isArray(tl) ? tl : [tl];
    for (const cue of list) {
      await runCue(cue);
    }
  };

  const runCue = async (cue: StepCue<any>): Promise<void> => {
    if (cue.wait && cue.wait > 0) {
      await controller.wait(cue.wait);
    }

    if (cue.parallel) {
      await Promise.all(cue.parallel.map((branch) => runTimeline(branch)));
      return;
    }

    const durationMs = resolveMs(cue);
    const easing = cue.easing;
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
        await controller.animateElements(patches, { durationMs, easing });
      }
    }
  };

  await runTimeline(timeline);
}
