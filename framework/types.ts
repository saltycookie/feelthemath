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
 * Per-element patch inside a `StepCue` (`play` or `exit`).
 */
export interface ElementCuePatch<TState = Record<string, any>> {
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
  set?: Partial<TState>;
  unset?: (keyof TState)[];
}

type SingleStateOf<TElements extends Record<string, any>> =
  keyof TElements extends infer K
    ? K extends keyof TElements
      ? [Exclude<keyof TElements, K>] extends [never]
        ? TElements[K]
        : never
      : never
    : never;

type IsSingleElement<TElements extends Record<string, any>> =
  string extends keyof TElements
    ? true
    : [SingleStateOf<TElements>] extends [never]
      ? false
      : true;

type CueDurationArg<TElements extends Record<string, any>> =
  [SingleStateOf<TElements>] extends [never] ? ElementsMap : SingleStateOf<TElements>;

/**
 * Declarative animation cue used in a step's `play` or `exit` timeline.
 * All cues in a step are folded synchronously onto global element state so subsequent
 * steps inherit the latest values automatically.
 */
export interface StepCue<TElements extends Record<string, any> = Record<string, any>> {
  /** Wait `wait` ms before starting this cue */
  wait?: number;
  /** Duration in ms (defaults to 0 = immediate). Can be computed from live state on exit/play. */
  ms?: number | ((state: CueDurationArg<TElements>) => number);
  /** Easing name or CSS cubic-bezier (default cubic-out) */
  easing?: string;
  /** Run child cues or sequences concurrently and wait for the longest branch */
  parallel?: StepTimeline<TElements>[];
  /** Animate x/y/opacity/scale/state across one or more elements */
  elements?: { [K in keyof TElements]?: ElementCuePatch<TElements[K]> };
  /** Single-element shorthand: properties to set on the sole registered element */
  set?: [SingleStateOf<TElements>] extends [never] ? never : Partial<SingleStateOf<TElements>>;
  /** Single-element shorthand: properties to revert to `defaultState` on the sole element */
  unset?: [SingleStateOf<TElements>] extends [never]
    ? never
    : (keyof SingleStateOf<TElements>)[];
}

export type StepTimeline<TElements extends Record<string, any> = Record<string, any>> =
  | StepCue<TElements>
  | StepCue<TElements>[];

type StepElementsDeclaration<TElements extends Record<string, any>> =
  IsSingleElement<TElements> extends true
    ? {
        /** Visual elements involved in this step (optional when only one element is registered) */
        elements?: (keyof TElements & string)[];
      }
    : {
        /** Visual elements involved in this step */
        elements: (keyof TElements & string)[];
      };

/**
 * Definition of a single step in a Math Demo.
 */
export type StepConfig<TElements extends Record<string, any> = Record<string, any>> = {
  /** 1-based step number (defaults to index + 1; used for #step-X URL hash) */
  stepNumber?: number;
  /** Title displayed in the top-center of the canvas */
  title: string;
  /** Short description for accessibility / developer inspector */
  summary?: string;
  /**
   * Optional "play" animation that kicks in after the step's initial elements are rendered.
   * Accepts declarative `StepCue`s (folded into global VE state) or an async function.
   */
  play?: StepTimeline<TElements> | ((controller: StepAnimationController) => Promise<void>);
  /**
   * Optional "exit" animation executed when clicking "Next" to transition to step N+1.
   * Accepts declarative `StepCue`s (folded into global VE state) or a custom async handler.
   */
  exit?: StepTimeline<TElements> | ((context: StepExitContext) => Promise<void>);
} & StepElementsDeclaration<TElements>;

/**
 * A resolved step where `stepNumber` and `initialElements` are always populated.
 */
export type ResolvedStepConfig<TElements extends Record<string, any> = Record<string, any>> =
  StepConfig<TElements> & {
    stepNumber: number;
    initialElements: VisualElement<any>[];
  };

/**
 * Props passed to a registered VisualElement renderer component.
 */
export interface ElementRendererProps<TState = any> {
  element: VisualElement<TState>;
  /** 0-based index of the active step */
  stepIndex: number;
  isAnimating: boolean;
  /** Allows interactive controls inside the canvas (e.g., fold/unfold switch, draggable point) to update element state */
  updateState: (patch: Partial<TState>) => void;
}

/**
 * A React renderer component for a VisualElement type, with optional static
 * `defaultState` and `interpolateState`.
 */
export type ElementRendererComponent<TState = any> = React.ComponentType<
  ElementRendererProps<TState>
> & {
  defaultState?: TState;
  interpolateState?: StateInterpolator<TState>;
};

/**
 * Renderer declaration under `DemoConfig.renderers`, including optional global
 * initial `x`, `y`, `opacity`, and `scale` for that visual element.
 */
export interface ElementRendererConfig<TState = any> {
  renderer: ElementRendererComponent<TState>;
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
}

export type ElementRendererEntry<TState = any> =
  | ElementRendererComponent<TState>
  | ElementRendererConfig<TState>;

export type ElementRendererRegistry<
  TElements extends Record<string, any> = Record<string, any>,
> = {
  [K in keyof TElements]: ElementRendererEntry<TElements[K]>;
};

export type StateInterpolatorRegistry = Record<string, StateInterpolator<any>>;

/**
 * Full configuration for a step-by-step interactive math demo.
 */
export interface DemoConfig<TElements extends Record<string, any> = Record<string, any>> {
  id: string;
  name: string;
  subtitle?: string;
  steps: StepConfig<TElements>[];
  renderers: ElementRendererRegistry<TElements>;
  /**
   * Optional map of custom state interpolators per element `type`.
   * (Can also be attached directly to a renderer component as `Renderer.interpolateState`.)
   */
  stateInterpolators?: StateInterpolatorRegistry;
}
