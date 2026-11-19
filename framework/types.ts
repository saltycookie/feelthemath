import React from 'react';

/**
 * Represents the active visual scene on the DemoCanvas.
 * Every scene has a unique `id`, a `x`/`y` position on the canvas coordinate system,
 * an `opacity` (0 to 1), an optional active transition duration (in ms),
 * and arbitrary component-specific `state` props.
 */
export interface Scene<TState = Record<string, any>> {
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

/**
 * Partial patch used when animating or updating the active Scene.
 */
export interface ScenePatch<TState = Record<string, any>> {
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
  state?: Partial<TState>;
}

/**
 * Custom state interpolator function for a Scene type.
 * Called on every animation frame (`progress` in [0, 1], after easing is applied)
 * when `animateScene` updates `scene.state`.
 *
 * @param startState The scene's `state` snapshot when `animateScene` began.
 * @param targetPatch The partial `state` patch passed to `animateScene`.
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
 * Operates directly on the step's single active scene and respects cancellation via
 * `AbortSignal` if the user navigates away via URL/dots/Back/Replay.
 */
export interface StepAnimationController {
  /** AbortSignal that trips if the user jumps to another step or replays */
  signal: AbortSignal;

  /** Wait for `ms` milliseconds (rejects if aborted) */
  wait: (ms: number) => Promise<void>;

  /** Read a snapshot of the active scene on the canvas */
  getScene: () => Scene<any> | null;

  /** Animate the active scene's position (x, y), opacity, scale, or state over `durationMs` */
  animateScene: <TState = Record<string, any>>(
    patch: ScenePatch<TState>,
    options?: { durationMs?: number; easing?: string }
  ) => Promise<void>;

  /** Immediately update the active scene without waiting */
  updateSceneImmediate: <TState = Record<string, any>>(
    patch: ScenePatch<TState>
  ) => void;
}

/**
 * Context passed to a step's `exit` animation handler when advancing to the next step.
 */
export interface StepExitContext {
  /** Current active scene on the canvas (including post-play state and any user interactive changes) */
  currentScene: Scene<any> | null;
  /** Canonical beginning scene of the destination (next) step */
  nextInitialScene: Scene<any>;
  /** Animation controller for orchestrating custom transitions */
  controller: StepAnimationController;
  /**
   * Executes the framework's default exit behavior:
   * - If the next step uses the same scene at the exact same `(x, y)` position, it remains intact.
   * - Otherwise the current scene fades out in 250ms.
   */
  runDefaultExit: (options?: { durationMs?: number }) => Promise<void>;
}

/**
 * Declarative animation cue used in a step's `play` or `exit` timeline.
 * Every step has a single active scene, so cues act directly on that scene.
 * All cues in a step are folded synchronously onto the active scene state so
 * subsequent steps on the same scene inherit the latest values automatically.
 */
export interface StepCue<TState = Record<string, any>> {
  /** Wait `wait` ms before starting this cue */
  wait?: number;
  /** Duration in ms (defaults to 0 = immediate). Can be computed from live state on exit/play. */
  ms?: number | ((state: TState) => number);
  /** Easing name or CSS cubic-bezier (default cubic-out) */
  easing?: string;
  /** Run child cues or sequences concurrently and wait for the longest branch */
  parallel?: StepTimeline<TState>[];
  /** Target x position for the step's scene */
  x?: number;
  /** Target y position for the step's scene */
  y?: number;
  /** Target opacity for the step's scene */
  opacity?: number;
  /** Target scale for the step's scene */
  scale?: number;
  /** Properties to set on the step's scene state */
  set?: Partial<TState>;
  /** Properties to revert to `defaultState` on the step's scene state */
  unset?: (keyof TState)[];
}

export type StepTimeline<TState = Record<string, any>> =
  | StepCue<TState>
  | StepCue<TState>[];

/**
 * Definition of a single step in a Math Demo.
 * Every step has one and only one active scene.
 */
export type StepConfig<TScenes extends Record<string, any> = Record<string, any>> = {
  [K in keyof TScenes & string]: {
    /** Optional title displayed in the top-center of the canvas */
    title?: string;
    /** Short description for accessibility / developer inspector */
    summary?: string;
    /**
     * Switch to this scene from this step onwards (resets to its initial config and `defaultState`).
     * Optional when only one scene is registered in `DemoConfig.scenes`, or when continuing with
     * the previous step's scene.
     */
    scene?: K;
    /**
     * Optional message displayed above the scene (bold theme orange) before `play` starts.
     */
    topMessage?: React.ReactNode;
    /**
     * Optional message displayed below the scene (bold theme orange) after `play` finishes.
     */
    bottomMessage?: React.ReactNode;
    /**
     * Optional "play" animation that kicks in after the step's initial scene is rendered.
     * Accepts declarative `StepCue`s (folded into scene state) or an async function.
     */
    play?: StepTimeline<TScenes[K]> | ((controller: StepAnimationController) => Promise<void>);
    /**
     * Optional "exit" animation executed when clicking "Next" to transition to step N+1.
     * Accepts declarative `StepCue`s (folded into scene state) or a custom async handler.
     */
    exit?: StepTimeline<TScenes[K]> | ((context: StepExitContext) => Promise<void>);
  };
}[keyof TScenes & string];

/**
 * A resolved step where `sceneId` and `initialScene` are always populated.
 */
export type ResolvedStepConfig<TScenes extends Record<string, any> = Record<string, any>> =
  StepConfig<TScenes> & {
    sceneId: string;
    initialScene: Scene<any>;
  };

/**
 * Props passed to a registered Scene renderer component.
 */
export interface SceneRendererProps<TState = any> {
  scene: Scene<TState>;
  isAnimating: boolean;
  /** Allows interactive controls inside the canvas (e.g., fold/unfold switch, draggable point) to update scene state */
  updateState: (patch: Partial<TState>) => void;
}

/**
 * A React renderer component for a Scene type, with optional static
 * `defaultState` and `interpolateState`.
 */
export type SceneRendererComponent<TState = any> = React.ComponentType<
  SceneRendererProps<TState>
> & {
  defaultState?: TState;
  interpolateState?: StateInterpolator<TState>;
};

/**
 * Renderer declaration under `DemoConfig.scenes`, including optional initial
 * `x`, `y`, `opacity`, and `scale` for that scene.
 */
export interface SceneRendererConfig<TState = any> {
  renderer: SceneRendererComponent<TState>;
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
}

export type SceneRendererEntry<TState = any> =
  | SceneRendererComponent<TState>
  | SceneRendererConfig<TState>;

export type SceneRendererRegistry<
  TScenes extends Record<string, any> = Record<string, any>,
> = {
  [K in keyof TScenes]: SceneRendererEntry<TScenes[K]>;
};

export type StateInterpolatorRegistry = Record<string, StateInterpolator<any>>;

/**
 * Full configuration for a step-by-step interactive math demo.
 */
export interface DemoConfig<TScenes extends Record<string, any> = Record<string, any>> {
  id: string;
  name: string;
  subtitle?: string;
  steps: StepConfig<TScenes>[];
  scenes: SceneRendererRegistry<TScenes>;
  /**
   * Optional map of custom state interpolators per scene `type`.
   * (Can also be attached directly to a renderer component as `Renderer.interpolateState`.)
   */
  stateInterpolators?: StateInterpolatorRegistry;
}
