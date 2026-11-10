import React from 'react';

/**
 * Represents a single visual element on the DemoCanvas.
 * Every element has a unique `id`, a `x`/`y` position on the canvas coordinate system,
 * an `opacity` (0 to 1), an optional active transition duration (in ms),
 * and arbitrary component-specific `state` props.
 */
export interface VisualElement<TState = Record<string, any>> {
  id: string;
  type: string;
  x: number;
  y: number;
  opacity: number;
  scale?: number;
  transitionDurationMs?: number;
  transitionEasing?: string;
  state: TState;
}

export type ElementsMap = Record<string, VisualElement<any>>;

/**
 * Partial patch used when animating or updating a VisualElement.
 */
export interface VisualElementPatch<TState = Record<string, any>> {
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
  state?: Partial<TState>;
}

/**
 * Custom state interpolator function for a VisualElement type (Option A).
 * Called on every animation frame (`progress` in [0, 1], after easing is applied)
 * when `animateElement` or `animateElements` updates `element.state`.
 *
 * @param startState The element's `state` snapshot when `animateElement` began.
 * @param targetPatch The partial `state` patch passed to `animateElement`.
 * @param progress Eased progress value in `[0, 1]` (guaranteed to end at `1`).
 * @returns The interpolated `state` for the current frame.
 */
export type StateInterpolator<TState = Record<string, any>> = (
  startState: TState,
  targetPatch: Partial<TState>,
  progress: number
) => TState;

/**
 * Imperative animation controller provided to a step's `play` and `exit` functions.
 * All methods respect cancellation via AbortSignal if the user navigates away via URL/dots.
 */
export interface StepAnimationController {
  /** AbortSignal that trips if the user jumps to another step or replays */
  signal: AbortSignal;

  /** Wait for `ms` milliseconds (rejects if aborted) */
  wait: (ms: number) => Promise<void>;

  /** Read a snapshot of the current visual elements on the canvas */
  getElements: () => ElementsMap;

  /** Add a new visual element to the canvas (optionally fading it in over `durationMs`) */
  addElement: <TState = Record<string, any>>(
    element: VisualElement<TState>,
    options?: { durationMs?: number; easing?: string }
  ) => Promise<void>;

  /** Animate an existing element's position (x, y), opacity, scale, or state over `durationMs` */
  animateElement: <TState = Record<string, any>>(
    id: string,
    patch: VisualElementPatch<TState>,
    options?: { durationMs?: number; easing?: string }
  ) => Promise<void>;

  /** Animate multiple elements in parallel over `durationMs` */
  animateElements: (
    patches: Record<string, VisualElementPatch<any>>,
    options?: { durationMs?: number; easing?: string }
  ) => Promise<void>;

  /** Immediately update an element without waiting */
  updateElementImmediate: <TState = Record<string, any>>(
    id: string,
    patch: VisualElementPatch<TState>
  ) => void;

  /** Dim and remove an element over `durationMs` (defaults to 250ms) */
  removeElement: (id: string, durationMs?: number) => Promise<void>;
}

/**
 * Context passed to a step's `exit` animation handler when advancing to the next step.
 */
export interface StepExitContext {
  /** Current elements on the canvas (including post-play state and any user interactive changes) */
  currentElements: ElementsMap;
  /** Canonical beginning elements of the destination (next) step */
  nextInitialElements: ElementsMap;
  /** Animation controller for orchestrating custom transitions */
  controller: StepAnimationController;
  /**
   * Executes the framework's default exit behavior:
   * - Shared elements at the exact same (x, y) position remain intact.
   * - Elements that no longer exist in `nextInitialElements` dim and disappear in 250ms.
   * Can optionally pass `excludeIds` for elements the custom exit handler is animating itself.
   */
  runDefaultExit: (options?: { excludeIds?: string[]; durationMs?: number }) => Promise<void>;
}

/**
 * Definition of a single step in a Math Demo.
 */
export interface StepConfig {
  /** 1-based step number or slug (used for #step-X URL hash) */
  stepNumber: number;
  /** Title displayed in the top-center of the canvas */
  title: string;
  /** Short description for accessibility / developer inspector */
  summary?: string;
  /**
   * Canonical beginning visual elements shown immediately when entering this step
   * (whether via URL #step-X, clicking a navigation dot, or clicking Next/Back).
   */
  initialElements: VisualElement<any>[];
  /**
   * Optional "play" animation that kicks in after the step's initial elements are rendered.
   * - While running, the "Next" button is disabled.
   * - Can be re-triggered via the "Replay" button (which resets to `initialElements` first).
   * - If omitted/undefined, the "Replay" button is grayed out and "Next" is immediately enabled.
   */
  play?: (controller: StepAnimationController) => Promise<void>;
  /**
   * Optional custom "exit" animation executed when clicking "Next" to transition to step N+1.
   * - If omitted, the framework runs `defaultExitAnimation` (shared elements at the same
   *   position remain intact; disappearing elements dim & fade out in 250ms).
   * - Demos can register their own `exit` function to handle moved charts, switch toggles, etc.
   */
  exit?: (context: StepExitContext) => Promise<void>;
}

/**
 * Props passed to a registered VisualElement renderer component.
 */
export interface ElementRendererProps<TState = any> {
  element: VisualElement<TState>;
  isAnimating: boolean;
  /** Allows interactive controls inside the canvas (e.g., fold/unfold switch, draggable point) to update element state */
  updateState: (patch: Partial<TState>) => void;
}

/**
 * A React renderer component for a VisualElement type, with an optional static
 * `interpolateState` function for custom frame-by-frame state transitions.
 */
export type ElementRendererComponent<TState = any> = React.ComponentType<
  ElementRendererProps<TState>
> & {
  interpolateState?: StateInterpolator<TState>;
};

export type ElementRendererRegistry = Record<string, ElementRendererComponent<any>>;

export type StateInterpolatorRegistry = Record<string, StateInterpolator<any>>;

/**
 * Full configuration for a step-by-step interactive math demo.
 */
export interface DemoConfig {
  id: string;
  name: string;
  subtitle?: string;
  steps: StepConfig[];
  renderers: ElementRendererRegistry;
  /**
   * Optional map of custom state interpolators per element `type`.
   * (Can also be attached directly to a renderer component as `Renderer.interpolateState`.)
   */
  stateInterpolators?: StateInterpolatorRegistry;
}
