import { Scene, ScenePatch, ScenesMap, StepAnimationController } from './types';

export const DEFAULT_EXIT_DURATION_MS = 250;

/**
 * Deep-clones an array of Scenes into a fresh ScenesMap keyed by `id`.
 * Guarantees that a step's beginning state is never mutated by previous animations or user interactions.
 */
export function createCanonicalScenesMap(scenes: Scene<any>[]): ScenesMap {
  const map: ScenesMap = {};
  for (const sc of scenes) {
    map[sc.id] = {
      ...sc,
      scale: sc.scale ?? 1,
      transitionDurationMs: 0,
      state: structuredClone(sc.state),
    };
  }
  return map;
}

/**
 * Checks whether a scene exists in both steps and is at the exact same position.
 */
export function isSharedAtSamePosition(
  currentScene: Scene<any>,
  nextScene: Scene<any> | undefined
): boolean {
  if (!nextScene) return false;
  return (
    currentScene.type === nextScene.type &&
    currentScene.x === nextScene.x &&
    currentScene.y === nextScene.y
  );
}

/**
 * Default Exit Animation (Requirement 4):
 * - Scenes that are shared between the current step and the next step
 *   AND are at the exact same (x, y) position remain intact.
 * - Scenes that no longer exist in the next step (or changed position without a custom handler)
 *   dim and disappear in 250 ms.
 */
export async function runDefaultExitAnimation(
  currentScenes: ScenesMap,
  nextInitialScenes: ScenesMap,
  controller: StepAnimationController,
  options?: { excludeIds?: string[]; durationMs?: number }
): Promise<void> {
  const excludeSet = new Set(options?.excludeIds ?? []);
  const durationMs = options?.durationMs ?? DEFAULT_EXIT_DURATION_MS;

  const patches: Record<string, ScenePatch<any>> = {};
  const idsToRemove: string[] = [];

  for (const [id, currentScene] of Object.entries(currentScenes)) {
    if (excludeSet.has(id)) {
      continue;
    }

    const nextScene = nextInitialScenes[id];
    if (isSharedAtSamePosition(currentScene, nextScene)) {
      // Shared scene at the exact same position: remains intact!
      continue;
    } else {
      // Scene no longer exists (or is not shared at same position):
      // dim and disappear in 250ms.
      patches[id] = { opacity: 0 };
      idsToRemove.push(id);
    }
  }

  if (Object.keys(patches).length > 0) {
    await controller.animateScenes(patches, {
      durationMs,
      easing: 'ease-out',
    });
    for (const id of idsToRemove) {
      await controller.removeScene(id, 0);
    }
  }
}
