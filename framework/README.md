# StepDeck (React Math Interactive Demo Framework)

StepDeck is the React + TypeScript framework that every Feel the Math demo is built on. It gives each demo the same look (a sheet of paper in a paper box on a wooden desk), the same handwriting, the same title band and navigation (`Back`, the step dots, `Replay`, and `Next` / `Finish`), and the same deterministic step lifecycle (`initialElements`, `play`, and `exit`). A demo only describes its own visual element renderers and its steps; everything else comes from here, so the demos look and behave alike, and a fix or improvement made here reaches all of them.

The project compiles via Vite (`npm run build`) into purely static HTML/CSS/JS files in `dist/` suitable for deployment on GitHub Pages (`github.io` / `feelthemath.app`) with no backend server.

## Files

```
theme.css                      colours, font, the desk, the box and the paper, navigation, bubbles, chart basics
wood.webp                      the wooden desk, a picture that tiles without seams (made by tools/wood.py)
lid-wood.webp                  the front page's lid, stained pine like a treasure chest's (made by tools/wood.py --lid)
index.ts                       barrel exports for the React framework and math helpers
types.ts                       TypeScript interfaces (DemoConfig, StepConfig, StepCue, VisualElement, ...)
stepTimeline.ts                resolves step end-state inheritance and executes declarative StepCue timelines
useStepEngine.ts               core step lifecycle state machine (initialElements -> play -> idle -> exit)
useHashStepRouter.ts           #step-X URL hash parser and synchronization hook
exitAnimation.ts               canonical state cloning and default 250ms exit animation
useMeasure.ts                  reads sizes from the page for a renderer to draw from (see "Drawing a scene" below)
useTween.ts                    moves a value over a few frames in answer to the reader (a switch, a dragged point)
math.ts                        clamp, clamp01, lerp and easing curves
svg.ts                         textAt and rectAt: attributes for SVG marks placed from a drawing's numbers
paths.ts                       path data for SVG drawings (arrowPath)
mount.tsx                      mountDemo: renders a demo's MathDemoPlayer into the page's #deck element
components/MathDemoPlayer.tsx  top-level player component wiring useStepEngine, DemoCanvas, NavigationPanel, and box.ts
components/DemoCanvas.tsx      renders TitleBar and .stage with VisualElement wrappers
components/TitleBar.tsx        top title bar with the "All demos" home link and centered step title
components/NavigationPanel.tsx bottom navigation bar with Back, step dots, Replay, and Next / Finish
components/Bubble.tsx          callout bubbles that point at things (Bubble, and placeBubble to work out where they go)
components/Chip.tsx            a small label marking a known value on a chart's axis
lid.js                         the front page's lid, opened going into a demo and closed coming back
box.ts                         the demo's side of it: the paper sinking into the box and rising from it
```

## How a demo works

A demo defines a `DemoConfig` object and calls `mountDemo(demoConfig)`, which renders `<MathDemoPlayer demo={demoConfig} />` into `<div class="deck" id="deck"></div>`. Each renderer attaches its baseline `defaultState` (the off/empty state), and each step inherits the previous step's end state (after `play` and `exit`) with only a delta:

```tsx
import { mountDemo, type DemoConfig } from '../../framework';
import { GardenRenderer, type GardenState } from './GardenScene';

export const myDemo: DemoConfig<{ garden: GardenState }> = {
  id: 'my-demo',
  name: 'My Demo',
  renderers: {
    garden: GardenRenderer, // GardenRenderer.defaultState = BASE_STATE
  },
  steps: [
    {
      title: 'The question',
      elements: { garden: {} },
    },
    {
      title: 'Draw the garden',
      set: { rectOp: 1 },
      play: [
        { ms: 1500, set: { grow: 1 } },
        { ms: 260, set: { bubbleOp: 1 } },
      ],
      exit: { ms: 220, unset: ['bubbleOp'] },
    },
    {
      title: 'The answer',
      // Inherits { rectOp: 1, grow: 1, bubbleOp: 0 } from Step 2's exit automatically
      play: { wait: 300, ms: 600, set: { answerOp: 1 } },
    },
  ],
};

mountDemo(myDemo);
```

### The step language

Every step starts from the previous step's end `ElementsMap` (computed synchronously once at startup by folding `play` and `exit` cues forward):

- **Entry deltas on `StepConfig`:**
  - `elements: { id: { type?, reset?, x?, y?, opacity?, scale?, set?, unset? } }` — add new elements or patch/reset existing ones on entry. (`unset` reverts listed keys back to `Renderer.defaultState`.)
  - `remove: ['id']` — drop elements on entry (on `Next`, `runDefaultExitAnimation` dims and removes them in `250ms`).
  - `reset: true` — clear all inherited elements before applying `elements` (or reset the sole element when combined with `set`/`unset`).
  - **Single-element shorthand:** when `renderers` has a single entry, `set` and `unset` can be written directly on the step or cue without wrapping in `elements: { id: ... }`.
- **Timeline cues (`play` / `exit`):** a single `StepCue` or an array of sequential `StepCue`s:
  - `wait`: delay in `ms` before starting this cue.
  - `ms`: duration in `ms` (defaults to `0` = immediate), or `(state) => number` when timing depends on live interactive state.
  - `easing`: `'linear'`, `'ease-in'`, `'ease-in-out'`, or default cubic-out.
  - `parallel: [...]`: run child cues or cue arrays concurrently (each with its own `wait`, `ms`, `easing`) and wait for the longest branch.
  - `add` / `remove` / `elements` (or `set` / `unset` in single-element demos): the state/element changes to animate.
  - *(For unusual steps that cannot be expressed declaratively, `play` and `exit` also still accept async functions.)*

### Step lifecycle rules

1. **Bottom Navigation Panel (`NavigationPanel.tsx`)**:
   - Left: `← Back` button to return to the previous step.
   - Center: Navigation dots (`#step-1` .. `#step-N`). Users can click any dot to jump directly to that step.
   - Right: `↺ Replay` button (on the left of `Next`) and `Next →` button (which becomes `Finish` on the final step and returns to `../../`).
   - Each step is synchronized with `#step-X` in the URL hash via `useHashStepRouter`.
2. **Canvas & Title Area (`DemoCanvas.tsx` & `TitleBar.tsx`)**:
   - Renders the `.titlebar` with the "All demos" home link on the left and the current step's title centered in the middle, and `.stage` below containing the active `VisualElement`s (passing `stepIndex` into each renderer).
3. **Initial Visual Elements & `play` Animation**:
   - Entering a step immediately renders its resolved canonical `initialElements`.
   - If the step defines `play`, it runs automatically on entry. While `play` is running, `Next` is disabled.
   - Clicking `Replay` resets the step to its resolved `initialElements` and replays `play`. If a step has no `play`, `Replay` is disabled.
4. **`exit` Animation on `Next`**:
   - Clicking `Next` runs the step's `exit` cues followed by `runDefaultExitAnimation` (or a custom `exit(context)` handler if provided), which keeps shared elements at the same `(x, y)` position intact and dims/removes disappearing elements in `250ms`, before advancing to `#step-(X+1)` and entering the next step.
5. **Deterministic Step Entry**:
   - Every step has a deterministic beginning state (`initialElements`) resolved synchronously at startup regardless of whether the user arrives via URL `#step-X`, clicking a navigation dot, clicking `Back`, or clicking `Next`.

### For tools

`<MathDemoPlayer />` updates the `<html>` element with `data-step="N"` and toggles `data-step-busy` while `play` or `exit` is animating:
`<html data-step="5" data-step-busy>` while step 5 plays, and `<html data-step="5">` once it has finished.

## Drawing a scene

Each demo keeps its scene in a file of its own (`TripScene.tsx`, `SticksScene.tsx`, `WalkScene.tsx`, and the example's
`GardenScene.tsx`): the state and the renderer that draws it. The steps are in the file `index.html` loads.

A renderer draws its scene as JSX, worked out from `element.state` on every render. It does not build or change the
DOM by hand. Its code falls into three parts:

1. **Measure.** Whatever the drawing needs to know about the page (how big the paper is, how wide a line of text came
   out, how tall a bubble is) it reads with `useMeasure(ref, measure, initial, deps)`. `measure` only reads the DOM and
   returns plain numbers; it runs in a layout effect, again whenever the element in `ref` changes size or the fonts
   finish loading, and the renderer draws from its result before the browser paints. Point `ref` at an element whose
   size changes along with what `measure` reads (the paper the words are written on, say): while the window is being
   resized, a read made straight after a render can still see the old layout, and that element's resizing brings the
   measurement up to date.
   - When one size depends on another that is only known once drawn (the working's height once its font size is
     chosen), use one `useMeasure` per pass, each listing the one before it in its `deps`. Danny's Walk does this.
   - To learn how big something would be without a limit on it (the working's natural width), draw an unseen copy of
     it (`visibility: hidden`, `aria-hidden`) and measure that. Two Sticks and Danny's Walk do this.
2. **Draw.** Plain calculations from the state and the measurements, then JSX. Shared pieces: `<Bubble>` with
   `placeBubble`, `<Chip>`, `arrowPath`, `textAt` and `rectAt`, and `clamp`, `clamp01`, `lerp` and the easing curves.
   Give the scene's root element the class `fw-scene`, which makes it fill the stage.
3. **Interact.** Pointer and key handling as JSX event handlers (`onPointerDown`, `onKeyDown`, `onClick`), which change
   the element's state with `updateState`. To move a value over a few frames in answer to the reader, rather than at
   once, use `useTween`.

Reaching into the DOM from an effect is kept for the rare thing React does not express: Danny's Walk sets the phase of
its marching dashes that way, so that tiny changes do not restart them.

## Starting a new demo

[`demos/example`](../demos/example/) is a three-step example to copy: the question, a rectangle that draws itself, then the answer.

1. Copy `demos/example` to `demos/<your-demo>`.
2. Add the new HTML entry to `vite.config.ts` under `build.rollupOptions.input`.
3. Give it its title in `index.html`'s `<title>`. Write its scene in `GardenScene.tsx` (rename it to fit): the state
   and the renderer that draws it. Write its steps (the `DemoConfig`) in `demo.tsx`, which `index.html` loads.
4. Add a link to it in the site's front page (`index.html`) and in the table of demos in the [top-level README](../README.md).
