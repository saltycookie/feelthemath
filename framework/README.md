# StepDeck (React Math Interactive Demo Framework)

StepDeck is the React + TypeScript framework that every Feel the Math demo is built on. It gives each demo the same look (a sheet of paper in a paper box on a wooden desk), the same handwriting, the same title band and navigation (`Back`, the step dots, `Replay`, and `Next` / `Finish`), and the same deterministic step lifecycle (`initialElements`, `play`, and `exit`). A demo only describes its own visual element renderers and its steps; everything else comes from here, so the demos look and behave alike, and a fix or improvement made here reaches all of them.

The project compiles via Vite (`npm run build`) into purely static HTML/CSS/JS files in `dist/` suitable for deployment on GitHub Pages (`github.io` / `feelthemath.app`) with no backend server.

## Files

```
theme.css                      colours, font, the desk, the box and the paper, navigation, bubbles, chart basics
wood.webp                      the wooden desk, a picture that tiles without seams (made by tools/wood.py)
lid-wood.webp                  the front page's lid, stained pine like a treasure chest's (made by tools/wood.py --lid)
index.ts                       barrel exports for the React framework and math helpers
types.ts                       TypeScript interfaces (DemoConfig, StepConfig, VisualElement, StepAnimationController, ...)
useStepEngine.ts               core step lifecycle state machine (initialElements -> play -> idle -> exit)
useHashStepRouter.ts           #step-X URL hash parser and synchronization hook
exitAnimation.ts               canonical state cloning and default 250ms exit animation
components/MathDemoPlayer.tsx  top-level player component wiring useStepEngine, DemoCanvas, NavigationPanel, and box.js
components/DemoCanvas.tsx      renders TitleBar and .stage with VisualElement wrappers
components/TitleBar.tsx        top title bar with the "All demos" home link and centered step title
components/NavigationPanel.tsx bottom navigation bar with Back, step dots, Replay, and Next / Finish
lid.js                         the front page's lid, opened going into a demo and closed coming back
box.js                         the demo's side of it: the paper sinking into the box and rising from it
bubbles.js                     callout bubbles that point at things
svg.js                         small helpers for drawing in SVG
```

## How a demo works

A demo defines a `DemoConfig` object and renders `<MathDemoPlayer demo={demoConfig} />` into `<div class="deck" id="deck"></div>`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DemoConfig, MathDemoPlayer } from '../../framework';

export const myDemo: DemoConfig = {
  id: 'my-demo',
  name: 'My Demo',
  renderers: {
    garden: GardenRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'The question',
      initialElements: [
        { id: 'garden', type: 'garden', x: 0, y: 0, opacity: 1, state: { rectOp: 0, grow: 0, answerOp: 0 } },
      ],
    },
    {
      stepNumber: 2,
      title: 'Draw the garden',
      initialElements: [
        { id: 'garden', type: 'garden', x: 0, y: 0, opacity: 1, state: { rectOp: 1, grow: 0, answerOp: 0 } },
      ],
      async play(c) {
        await c.animateElement('garden', { state: { grow: 1 } }, { durationMs: 1500 });
      },
    },
    {
      stepNumber: 3,
      title: 'The answer',
      initialElements: [
        { id: 'garden', type: 'garden', x: 0, y: 0, opacity: 1, state: { rectOp: 1, grow: 1, answerOp: 0 } },
      ],
      async play(c) {
        await c.wait(300);
        await c.animateElement('garden', { state: { answerOp: 1 } }, { durationMs: 600 });
      },
    },
  ],
};

createRoot(document.getElementById('deck')!).render(<MathDemoPlayer demo={myDemo} />);
```

### Step lifecycle rules

1. **Bottom Navigation Panel (`NavigationPanel.tsx`)**:
   - Left: `← Back` button to return to the previous step.
   - Center: Navigation dots (`#step-1` .. `#step-N`). Users can click any dot to jump directly to that step.
   - Right: `↺ Replay` button (on the left of `Next`) and `Next →` button (which becomes `Finish` on the final step and returns to `../../`).
   - Each step is synchronized with `#step-X` in the URL hash via `useHashStepRouter`.
2. **Canvas & Title Area (`DemoCanvas.tsx` & `TitleBar.tsx`)**:
   - Renders the `.titlebar` with the "All demos" home link on the left and the current step's title centered in the middle, and `.stage` below containing the active `VisualElement`s.
3. **Initial Visual Elements & `play` Animation**:
   - Entering a step immediately renders its canonical `initialElements`.
   - If the step defines `play(controller)`, it runs automatically on entry. While `play` is running, `Next` is disabled.
   - Clicking `Replay` resets the step to its `initialElements` and replays `play(controller)`. If a step has no `play` function, `Replay` is disabled.
4. **`exit` Animation on `Next`**:
   - Clicking `Next` runs the step's custom `exit(context)` handler if provided, or `runDefaultExitAnimation` (which keeps shared elements at the same `(x, y)` position intact and dims/removes disappearing elements in `250ms`), before advancing to `#step-(X+1)` and entering the next step.
5. **Deterministic Step Entry**:
   - Every step has a deterministic beginning state (`initialElements`) regardless of whether the user arrives via URL `#step-X`, clicking a navigation dot, clicking `Back`, or clicking `Next`.

### For tools

`<MathDemoPlayer />` updates the `<html>` element with `data-step="N"` and toggles `data-step-busy` while `play` or `exit` is animating:
`<html data-step="5" data-step-busy>` while step 5 plays, and `<html data-step="5">` once it has finished.

## Starting a new demo

[`demos/template`](../demos/template/) is a three-step example to copy: the question, a rectangle that draws itself, then the answer.

1. Copy `demos/template` to `demos/<your-demo>`.
2. Add the new HTML entry to `vite.config.ts` under `build.rollupOptions.input`.
3. Give it its title in `index.html`'s `<title>`, and write its `DemoConfig` and renderers in `demo.tsx`.
4. Add a link to it in the site's front page (`index.html`) and in the table of demos in the [top-level README](../README.md).
