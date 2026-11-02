# StepDeck

StepDeck is the small framework that every Feel the Math demo is built on. It gives each demo the same
look (a sheet of paper in a paper box on a wooden desk), the same handwriting, the same title band and navigation (Back, the step dots, Replay and
Next), and the same way of moving through a solution one animated step at a time. A demo only describes its
own drawing and its steps; everything else comes from here, so the demos look and behave alike, and a fix or
improvement made here reaches all of them.

It is plain JavaScript modules and CSS, with no dependencies and nothing to build.

## Files

```
theme.css      colours, font, the desk, the box and the paper, navigation, bubbles, chart basics
wood.webp      the wooden desk, a picture that tiles without seams (made by tools/wood.py)
deck.js        animated values, steps, and moving between steps
nav.js         Back, step dots, Replay, Next (Finish on the last step), the arrow keys, and the home link
bubbles.js     callout bubbles that point at things
svg.js         small helpers for drawing in SVG
```

## The theme

All colours and the font live at the top of `theme.css`:

```css
--paper:  #fefdfa;          /* the paper in the box */
--ink:    #263248;          /* blue-black ink for text and lines */
--blue / --orange / --pink  /* coloured pens for marks, each with a darker -ink twin for text */
--wood / --wood-ink         /* the desk (under wood.webp), and the brown of shadows on it */
--rim: 6px;                 /* how thick the box's paper walls look from above */
--paper-max: 1000px;        /* the widest the paper gets: wider screens show more of the desk */
--font-hand: "Kalam", ...;  /* the handwritten font */
```

Everything that has to match the paper is worked out from `--paper` and `--ink`: the bubble background, the
outline behind text, grid lines, muted text and the shaded fills. Change them
and those follow. To change a colour for one demo only, override it on `:root` in that demo's
stylesheet.

Ready-made classes colour text in HTML and in SVG alike: `c-ink`, `c-muted`, `c-blue`, `c-orange`, `c-pink`
(the darker text tints) and `c-blue-main`, `c-orange-main`, `c-pink-main` (the pen colours themselves).

A few pieces of writing are shared too, so the demos don't each keep a copy: `.problem` (the word problem on the
first step; a demo may change its size), `.rad` (a square root in the handwriting:
`<span class="rad"><span>2</span></span>`), `.sr-only` (text for screen readers only), and `--ink-dim` (measuring
lines and small notes beside the working).

Each page loads Kalam from Google Fonts. Without a connection the text falls back to another casual font.

## How a demo works

A demo gives `createDeck()` three things:

- **`state`**: every animated value with its starting number, e.g. `{ rectOp: 0, grow: 0 }`.
- **`render(S)`**: draws the page from those values. It runs on every animation frame while anything moves.
- **`steps`**: what each step changes and how it gets there.

```js
const deck = createDeck({
  render, bubbles,
  state: { rectOp: 0, grow: 0, answerOp: 0 },
  steps: [
    { name: 'The question', slide: 'question', replay: false },
    { name: 'Draw the garden', slide: 'drawing',
      set: { rectOp: 1, grow: 1 },              // the finished look of this step
      async play(s) {                           // how to get there from the step's beginning
        s.to('rectOp', 1, 0);
        await s.to('grow', 1, 1500);
        s.bubble('3 × 2', () => [x, y, 'right']);
      } },
    { name: 'The answer', slide: 'drawing', set: { answerOp: 1 } },   // no play: the values simply glide to `set`
  ],
});
createNav(document.querySelector('.nav'), deck);
deck.start();
```

`createNav` fills the empty `<nav class="nav">` with Back, the step dots, Replay and Next. It also adds a
title band above the `.stage`, which shows each step's `title` (and stays as empty space when a step has none),
and puts a home link (a house and "All demos"; just the house on narrow screens) at the band's left end, which
leads back to the list of demos. The demo's `.deck` is the box, and the paper fills it: the title band, the
drawing and the navigation are all written on the paper. The home link points by default to `../../`, the front page as seen from `demos/<name>/`. Pass
`createNav(nav, deck, { home: 'url' })` to send it elsewhere, or `{ home: false }` to leave it out.

On the last step, Next becomes **Finish**. Like Next, it waits (dimmed) until the step has finished
animating; then it takes the reader to the same place as the home link. With `{ home: false }` there is no
Finish, and Next is simply disabled on the last step. The arrow keys never leave the demo: only Finish does.

### The rules every demo gets for free

- A step **begins** where the previous step finished, minus any bubble.
- **Next** carries on smoothly from there. If the step being left has a `leave` animation, Next plays it first.
- **Back**, **Replay** and the **step dots** jump straight to the step's beginning, hold it for a moment, then play the step.
- Leaving a step stops its animation at once, so `play` never has to check whether it is still wanted.
- **Next** waits (dimmed) until the current step has finished animating, so nobody skips past an explanation
  half-way. Back, Replay, the step dots and the address still go anywhere at any time.
- The address shows the current step, e.g. `demos/qiangs-trip/#step-5`. Opening or sharing that link starts
  the demo on step 5, played from its beginning. The steps replace the address instead of adding to the browser
  history, so the browser's own Back button leaves the demo rather than stepping back through it.

### Step fields

| Field | Meaning |
| --- | --- |
| `name` | Read out by screen readers on the step's dot. |
| `title` | Shown in the title band at the top of the paper, in orange, as soon as the step is entered. Leave it out for an empty band. |
| `slide` | `id` of the `<section class="slide">` to show. |
| `slideClass` | A class added to that slide while the step is active, for CSS animations. Replay restarts them. |
| `set` | Values that have changed by the time the step is left with Next: usually where `play` ends, or where `leave` ends when it animates. The finished look is the beginning plus `set`. |
| `start` | Values that are different at the beginning, on top of the previous finished look. |
| `fresh` | `true` to begin from the demo's starting `state` instead of the previous finished look (a blank page). |
| `play(s)` | Async function that animates the step. Without it, the values glide to the finished look. |
| `enter(info)`, `leave(info, s)` | Hooks for things that aren't animated values, such as turning dragging on and off. `leave` may also animate, with the same `s` as `play`, to tidy up what the reader changed (a switch, a drag) into the finished look. An async `leave` is waited for when leaving with Next; any other move cuts it short. |
| `replay` | `false` to disable Replay on this step. |

### Inside `play(s)` (and an animating `leave(info, s)`)

| Call | Does |
| --- | --- |
| `s.to('key', value, ms, delay)` | Animate one value. Also `s.to({ a: 1, b: 0 }, ms, delay)`. Returns a promise. |
| `await s.wait(ms)` | Pause. |
| `s.apply(look, { skip })` | Animate to a whole set of values, using the deck's `durations` and `delays`. |
| `s.bubble(html, anchor, { delay })` | Show a callout bubble. `anchor()` returns `[x, y, side]`, where side is `right`, `left`, `above`, `below` or `mid`. |
| `s.end`, `s.start` | The step's finished look and beginning. |

Options of `createDeck` besides `state`, `render` and `steps`: `bubbles` (from `createBubbles`),
`transient` (values that belong to a bubble and are reset with it), `durations` and `delays`
(per-value defaults for `s.apply`), and `linear` (values that animate at an even pace instead of easing in and out).

### For tools

The page shows which step is on, and whether it is still animating, on its `<html>` element:
`<html data-step="5" data-step-busy>` while step 5 plays, and `<html data-step="5">` once it has finished.
Tools that need a step's finished look wait for that, for example `tools/thumbnail.py`, which screenshots a step
for the home page: open `#step-5`, then wait for `html[data-step="5"]:not([data-step-busy])`.

## Starting a new demo

[`demos/template`](../demos/template/) is a three-step example to copy: the question, a rectangle that draws
itself, then the answer.

1. Copy `demos/template` to `demos/<your-demo>`.
2. Write the problem into `index.html`, and the drawing and steps into `demo.js`.
3. Add a link to it in the site's front page (the top-level `index.html`) and in the table of demos in the
   [top-level README](../README.md).
4. Give it a thumbnail for the front page: put `<meta name="thumbnail" content="step=N">` in its `index.html`,
   with the step whose finished look shows the demo best, and run `python3 tools/thumbnail.py demos/<your-demo>`
   (see [Thumbnails on the home page](../README.md#thumbnails-on-the-home-page)).
