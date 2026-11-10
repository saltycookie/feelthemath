import type { StepAnimationController } from './types';

/**
 * Starts an animation without waiting for it, so that the next one can overlap it:
 *
 *   background(scene.to(c, { carOp: 1 }, 350));
 *   await c.wait(200);
 *
 * Leaving the step (Next, Back, a dot, Replay) rejects every animation still running with an AbortError; a
 * promise nobody awaits would report that as an unhandled rejection, so it is dropped here. Any other error is
 * logged.
 */
export function background(animation: Promise<void>): void {
  animation.catch((err: unknown) => {
    if ((err as { name?: string } | null)?.name !== 'AbortError') {
      console.error('Error in a background animation:', err);
    }
  });
}

/**
 * A step file's shorthand for animating one element's state, checked against its state type: a mistyped key or a
 * value of the wrong type does not compile.
 *
 *   const scene = elementControls<WalkState>('walk-scene');
 *
 *   await scene.to(c, { river: 1 }, 1000);   // animate, and wait for it
 *   scene.set(c, { controlsOn: true });      // change at once
 *   scene.state(c)?.unf                      // read what is on the canvas now
 */
export function elementControls<TState>(id: string) {
  return {
    id,
    /** Animates `state` over `durationMs`; resolves when it is done. */
    to(
      controller: StepAnimationController,
      state: Partial<TState>,
      durationMs: number,
      easing?: string
    ): Promise<void> {
      return controller.animateElement<TState>(id, { state }, { durationMs, easing });
    },
    /** Changes `state` at once. */
    set(controller: StepAnimationController, state: Partial<TState>): void {
      controller.updateElementImmediate<TState>(id, { state });
    },
    /** The element's state as it is on the canvas now, or undefined if the element is not there. */
    state(controller: StepAnimationController): TState | undefined {
      return controller.getElements()[id]?.state as TState | undefined;
    },
  };
}
