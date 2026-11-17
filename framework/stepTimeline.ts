import {
  DemoConfig,
  ResolvedStepConfig,
  Scene,
  ScenePatch,
  SceneRendererComponent,
  SceneRendererEntry,
  StepAnimationController,
  StepCue,
  StepTimeline,
} from './types';

export interface ResolvedSceneRendererEntry<TState = any> {
  renderer: SceneRendererComponent<TState>;
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export function resolveSceneRendererEntry<TState = any>(
  entry: SceneRendererEntry<TState>
): ResolvedSceneRendererEntry<TState> {
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

function cloneScene(scene: Scene<any>): Scene<any> {
  return {
    ...scene,
    scale: scene.scale ?? 1,
    transitionDurationMs: 0,
    state: structuredClone(scene.state),
  };
}

function makeDefaultStateReader(demo: DemoConfig<any>): (type: string) => Record<string, any> {
  return (type: string) => {
    const entry = demo.scenes[type];
    if (!entry) return {};
    const { renderer } = resolveSceneRendererEntry(entry);
    return structuredClone(renderer.defaultState ?? {});
  };
}

function createInitialScene(demo: DemoConfig<any>, id: string): Scene<any> {
  const entry = demo.scenes[id];
  const { renderer, x, y, opacity, scale } = resolveSceneRendererEntry(entry);
  return {
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

function applyCueToScene(
  scene: Scene<any>,
  cue: StepCue<any>,
  defaultState: Record<string, any>
): Scene<any> {
  const nextState = structuredClone(scene.state);

  if (cue.unset) {
    for (const key of cue.unset) {
      nextState[key as string] = structuredClone(defaultState[key as string]);
    }
  }
  if (cue.set) {
    Object.assign(nextState, structuredClone(cue.set));
  }

  return {
    ...scene,
    x: cue.x !== undefined ? cue.x : scene.x,
    y: cue.y !== undefined ? cue.y : scene.y,
    opacity: cue.opacity !== undefined ? cue.opacity : scene.opacity,
    scale: cue.scale !== undefined ? cue.scale : scene.scale,
    state: nextState,
  };
}

function foldCue(
  scene: Scene<any>,
  cue: StepCue<any>,
  defaultState: Record<string, any>
): Scene<any> {
  if (cue.parallel) {
    let current = scene;
    for (const branch of cue.parallel) {
      current = foldTimeline(current, branch, defaultState);
    }
    return current;
  }

  return applyCueToScene(scene, cue, defaultState);
}

function foldTimeline(
  scene: Scene<any>,
  timeline: StepTimeline<any>,
  defaultState: Record<string, any>
): Scene<any> {
  const list = Array.isArray(timeline) ? timeline : [timeline];
  let current = scene;
  for (const cue of list) {
    current = foldCue(current, cue, defaultState);
  }
  return current;
}

/**
 * Resolves all steps in a `DemoConfig` synchronously at initialization:
 * - Assigns default `stepNumber` (`index + 1`).
 * - Each step has one and only one active scene.
 * - If `demo.scenes` has a single entry, `step.scene` may be omitted on all steps.
 * - When `step.scene` switches to a different scene, that scene starts fresh from
 *   `demo.scenes[id]` (`x`, `y`, `opacity`, `scale`, `defaultState`).
 * - Otherwise the previous step's scene continues, inheriting folded `play` / `exit` cues.
 */
export function resolveDemoSteps(demo: DemoConfig<any>): ResolvedStepConfig<any>[] {
  const sceneKeys = Object.keys(demo.scenes);
  const soleSceneId = sceneKeys.length === 1 ? sceneKeys[0] : undefined;
  const getDefaultState = makeDefaultStateReader(demo);

  let currentSceneId: string | undefined = soleSceneId;
  let currentScene: Scene<any> | undefined = soleSceneId
    ? createInitialScene(demo, soleSceneId)
    : undefined;

  return demo.steps.map((step, index) => {
    if (step.scene !== undefined) {
      if (!(step.scene in demo.scenes)) {
        throw new Error(
          `Step ${index + 1} ("${step.title}") references unknown scene "${step.scene}" not declared in demo.scenes.`
        );
      }
      if (step.scene !== currentSceneId || !currentScene) {
        currentSceneId = step.scene;
        currentScene = createInitialScene(demo, currentSceneId);
      }
    } else if (!currentSceneId || !currentScene) {
      throw new Error(
        `Step ${index + 1} ("${step.title}") in multi-scene demo "${demo.id}" must declare \`scene\`.`
      );
    }

    const initialScene = cloneScene(currentScene);
    const defaultState = getDefaultState(currentSceneId);

    if (step.play && typeof step.play !== 'function') {
      currentScene = foldTimeline(currentScene, step.play, defaultState);
    }
    if (step.exit && typeof step.exit !== 'function') {
      currentScene = foldTimeline(currentScene, step.exit, defaultState);
    }

    return {
      ...step,
      stepNumber: step.stepNumber ?? index + 1,
      sceneId: currentSceneId,
      initialScenes: [initialScene],
    };
  });
}

function buildScenePatch(
  cue: StepCue<any>,
  defaultState: Record<string, any>
): ScenePatch<any> | undefined {
  const statePatch: Record<string, any> = {};
  let hasStatePatch = false;

  if (cue.unset) {
    for (const key of cue.unset) {
      statePatch[key as string] = structuredClone(defaultState[key as string]);
      hasStatePatch = true;
    }
  }
  if (cue.set) {
    Object.assign(statePatch, structuredClone(cue.set));
    hasStatePatch = true;
  }

  if (
    cue.x === undefined &&
    cue.y === undefined &&
    cue.opacity === undefined &&
    cue.scale === undefined &&
    !hasStatePatch
  ) {
    return undefined;
  }

  return {
    x: cue.x,
    y: cue.y,
    opacity: cue.opacity,
    scale: cue.scale,
    state: hasStatePatch ? statePatch : undefined,
  };
}

/**
 * Executes a declarative `StepTimeline` (`StepCue` or `StepCue[]`) for a step's single active scene.
 */
export async function runStepTimeline(
  timeline: StepTimeline<any>,
  controller: StepAnimationController,
  demo: DemoConfig<any>,
  sceneId: string
): Promise<void> {
  const getDefaultState = makeDefaultStateReader(demo);
  const defaultState = getDefaultState(sceneId);

  const resolveMs = (cue: StepCue<any>): number => {
    if (cue.ms === undefined) return 0;
    if (typeof cue.ms === 'number') return cue.ms;
    const activeScene = controller.getScenes()[sceneId];
    return Math.max(0, cue.ms(activeScene?.state ?? defaultState));
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
    const patch = buildScenePatch(cue, defaultState);

    if (patch) {
      if (durationMs <= 0) {
        controller.updateSceneImmediate(sceneId, patch);
      } else {
        await controller.animateScene(sceneId, patch, { durationMs, easing });
      }
    }
  };

  await runTimeline(timeline);
}
