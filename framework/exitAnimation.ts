import { ElementsMap, StepAnimationController, VisualElement, VisualElementPatch } from './types';

export const DEFAULT_EXIT_DURATION_MS = 250;

/**
 * Deep-clones an array of VisualElements into a fresh ElementsMap keyed by `id`.
 * Guarantees that a step's beginning state is never mutated by previous animations or user interactions.
 */
export function createCanonicalElementsMap(elements: VisualElement<any>[]): ElementsMap {
  const map: ElementsMap = {};
  for (const el of elements) {
    map[el.id] = {
      ...el,
      scale: el.scale ?? 1,
      transitionDurationMs: 0,
      state: structuredClone(el.state),
    };
  }
  return map;
}

/**
 * Checks whether an element exists in both steps and is at the exact same position.
 */
export function isSharedAtSamePosition(
  currentEl: VisualElement<any>,
  nextEl: VisualElement<any> | undefined
): boolean {
  if (!nextEl) return false;
  return (
    currentEl.type === nextEl.type &&
    currentEl.x === nextEl.x &&
    currentEl.y === nextEl.y
  );
}

/**
 * Default Exit Animation (Requirement 4):
 * - Visual elements that are shared between the current step and the next step
 *   AND are at the exact same (x, y) position remain intact.
 * - Visual elements that no longer exist in the next step (or changed position without a custom handler)
 *   dim and disappear in 250 ms.
 */
export async function runDefaultExitAnimation(
  currentElements: ElementsMap,
  nextInitialElements: ElementsMap,
  controller: StepAnimationController,
  options?: { excludeIds?: string[]; durationMs?: number }
): Promise<void> {
  const excludeSet = new Set(options?.excludeIds ?? []);
  const durationMs = options?.durationMs ?? DEFAULT_EXIT_DURATION_MS;

  const patches: Record<string, VisualElementPatch<any>> = {};
  const idsToRemove: string[] = [];

  for (const [id, currentEl] of Object.entries(currentElements)) {
    if (excludeSet.has(id)) {
      continue;
    }

    const nextEl = nextInitialElements[id];
    if (isSharedAtSamePosition(currentEl, nextEl)) {
      // Shared element at the exact same position: remains intact!
      continue;
    } else {
      // Visual element no longer exists (or is not shared at same position):
      // dim and disappear in 250ms.
      patches[id] = { opacity: 0 };
      idsToRemove.push(id);
    }
  }

  if (Object.keys(patches).length > 0) {
    await controller.animateElements(patches, {
      durationMs,
      easing: 'ease-out',
    });
    for (const id of idsToRemove) {
      await controller.removeElement(id, 0);
    }
  }
}
