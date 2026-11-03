# StepDeck

StepDeck is the small framework that every Feel the Math demo is built on. It gives each demo the same look (a
sheet of paper in a paper box on a wooden desk), the same handwriting, the same title band and navigation (Back,
the step dots, Replay and Next), and the same way of moving through a solution one animated step at a time. A demo
only describes its own drawing and its steps; everything else comes from here, so the demos look and behave alike,
and a fix or improvement made here reaches all of them.

It is plain JavaScript modules and CSS, with no dependencies and nothing to build.

## Files

```
theme.css      colours, font, the desk, the box and the paper, navigation, bubbles, chart basics
wood.webp      the wooden desk, a picture that tiles without seams (made by tools/wood.py)
lid-wood.webp  the front page's lid, stained pine like a treasure chest's (made by tools/wood.py --lid)
deck.js        animated values, steps, and moving between steps
nav.js         Back, step dots, Replay, Next (Finish on the last step), the arrow keys, and the home link
lid.js         the front page's lid, opened going into a demo and closed coming back
box.js         the demo's side of it: the paper sinking into the box and rising from it
bubbles.js     callout bubbles that point at things
svg.js         small helpers for drawing in SVG
```

## The theme

All colours and the font live at the top of `theme.css`:

```css
--paper:  #fefdfa;          /* the paper in the box */
--paper-aged: #b9772c;      /* the yellowed brown towards the edges of the demo's old sheet */
--ink:    #263248;          /* blue-black ink for text and lines */
--blue / --orange / --pink  /* coloured pens for marks, each with a darker -ink twin for text */
--wood / --wood-ink         /* the desk (under wood.webp), and the brown of shadows on it */
--lid-wood / --lid-burn     /* the lid (under lid-wood.webp), and its darkened edges and groove */
--rim: 6px;                 /* how thick the box's paper walls look from above */
--paper-max: 1000px;        /* the widest the paper gets: wider screens show more of the desk */
--lift-peek: 3px;           /* a demo's paper is raised above the walls: this much of them shows around it */
--lid-split / --lid-time /  /* opening the box: the lid splits (.4s), its flaps roll open (2s) while the writing */
--lid-fade / --box-rise     /*   on them fades (1.2s), the paper rises (.8s); closing, the same backwards */
--box-gap                   /* down at the bottom of the box, the paper is this far inside its walls, seen from above */
--box-dark: .38;            /* how light it is inside the box under the closed lid (1: as light as outside) */
--lid-thick: 14px;          /* how thick the lid is: it shows on the flaps' cut edges as they turn */
--font-hand: "Kalam", ...;  /* the handwritten font */
```

Everything that has to match the paper is worked out from `--paper` and `--ink`: the bubble background, the
outline behind text, grid lines, muted text and the shaded fills. Change them and those follow. To change a colour
for one demo only, override it on `:root` in that demo's stylesheet.

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

`createNav` fills the empty `<nav class="nav">` with Back, the step dots, Replay and Next. It also adds a title
band above the `.stage`, which shows each step's `title` (and stays as empty space when a step has none), and puts
a home link (a house and "All demos"; just the house on narrow screens) at the band's left end, which leads back
to the list of demos. The demo's `.deck` is the box, and its paper is raised a little above the box's walls: the title band, the drawing
and the navigation are all written on the paper. The home link points by default to `../../`, the front page as seen from
`demos/<name>/`. Pass `createNav(nav, deck, { home: 'url' })` to send it elsewhere, or `{ home: false }` to leave
it out.

On the last step, Next becomes **Finish**. Like Next, it waits (dimmed) until the step has finished
animating; then it takes the reader to the same place as the home link, and the box's lid closes over the demo. With `{ home: false }` there is no
Finish, and Next is simply disabled on the last step. The arrow keys never leave the demo: only Finish does.

### Opening and closing the box

The front page is the box with its lid on, and a demo is the same box open, on the same spot of the desk, with its
sheet of paper (old, and yellowed towards its edges) raised a little above the box's walls. Going into a demo, one
thing after another:

1. the lid splits along the middle;
2. its two flaps roll open, like a cardboard box's, and the writing on them fades as they turn: the top flap rolls up
   over the box's top edge and the bottom flap down over its bottom edge, rising towards the reader in 3D and showing
   the lid's thickness on their cut edges, until they stand upright on the box's edges, out of sight. The light comes
   into the box as they open, and the demo's paper is uncovered, down at the bottom of the box, well inside its walls
   (`--box-gap`), whose inner sides show around it in perspective;
3. the paper rises above the walls. Down in the box it is in the walls' shade, and it comes fully into the light only
   as it passes their tops.

Coming back, by the home link, Finish or the browser's Back button, it all happens backwards: the paper sinks to the
bottom of the box, into the walls' shade, the flaps roll closed with the writing coming back on them and the box
going dark, and meet at the split, and the split goes.

This is a cross-document view transition: the browser takes a picture of the page it leaves and of the page it
opens, and animates them with CSS (`theme.css`, "opening and closing the box"). A picture can't be cut up or given a
thickness, so the pieces are built just before the pictures are taken, and taken away when the transition is over.
`lid.js` builds the front page's: the split, and the two flaps, each made of four pictures (a blank half of the lid,
the writing on it, its cut edge and its underside). The blank half is the lid itself: its wood, and anything marked
`class="inlay"`, such as the front page's stars, so those stay while the writing fades. The front page loads it in its `<head>`:
`<script src="framework/lid.js"></script>`. `box.js` builds the demo's: the inside of the box (the inner sides of
its walls, under the paper), the walls' shade on the paper, which rises with it, and the tops of the walls, over the
paper while it is in the box. `createDeck()` sets that up, so every demo has it.

What a demo needs for it:

- Its script is loaded with `blocking="render"`, as in the template:
  `<script type="module" src="demo.js" blocking="render"></script>`. The page then waits for the script before its
  first frame, so the drawing, the title band and the navigation are already there when the lid opens.
- Nothing else. The deck waits until the paper has risen before it plays the first step, and holds a step's CSS
  animations (`slideClass`) until then too, so nothing plays unseen.

It works in browsers with cross-document view transitions (Chrome and Edge 126+, Safari 18.2+). Elsewhere, and for a
reader who asks for reduced motion, the page simply changes. Typing an address, a bookmark or a reload never animates.

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
