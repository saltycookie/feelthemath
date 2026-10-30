# Feel the Math

Feel the Math is a collection of interactive demos that help students *see* why the answer to a math
problem is what it is. Each demo takes one word problem and solves it on a chalkboard, letting pictures do
most of the explaining: a car driving along a speed–time chart turns distances into areas, and wooden sticks
rebuild a geometry figure and are measured on a ruler. Learners move through the solution one small step at
a time, replay any step or drag things around to explore, and the arithmetic arrives only once the picture
has made it feel obvious. The demos run in any browser with nothing to install, and they all share one small
framework, StepDeck, so new problems are quick to add and every demo looks and behaves the same.

**Live site:** https://feelthemath.app/

| Demo | What it shows |
| --- | --- |
| [Qiang's Trip](demos/qiangs-trip/) | 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart. |
| [Two Sticks, Two Strings](demos/two-sticks/) | AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to end on a ruler. |
| [Template](demos/template/) | A three-step example to copy when starting a new demo. |

## Looking at the demos

**Online:** <https://feelthemath.app/>

**On your computer:** the demos use JavaScript modules, which browsers only load from a web server,
so double-clicking `index.html` won't work. From this folder run

```sh
python3 -m http.server
```

then open <http://localhost:8000>. Any other static server works too.

## Publishing with GitHub Pages

1. Push this repository to GitHub. On a free GitHub plan the repository has to be public.
2. In the repository's **Settings → Pages**, choose **Deploy from a branch**, then the `main` branch and the `/ (root)` folder.
3. After a minute the site is live. Every push to `main` updates it.

Nothing needs to be built first: GitHub Pages serves the files as they are.

## Folder layout

```
index.html                 list of demos (the site's home page)
framework/                 StepDeck, shared by every demo
  theme.css                colours, font, board, navigation, bubbles, chart basics
  deck.js                  animated values, steps, and moving between steps
  nav.js                   Back, step dots, Replay, Next, the arrow keys, and the home link
  bubbles.js               callout bubbles that point at things
  svg.js                   small helpers for drawing charts in SVG
demos/<name>/              one folder per demo: index.html plus its own script and styles
tools/single_file.py       packs a demo into one HTML file (optional)
```

## The theme

All colours and the font live at the top of `framework/theme.css`:

```css
--board:  #3d6856;          /* the board colour */
--chalk:  #f4f1e8;          /* white chalk for text and lines */
--blue / --orange / --pink  /* chalk pastels for marks, each with a lighter -ink twin for text */
--font-hand: "Kalam", ...;  /* the handwritten font */
```

Everything that has to match the board is worked out from `--board`: the bubble background, the outline
behind text, grid lines, the lighter middle and darker edges of the board, and the shaded fills. Change
`--board` and those follow. To change a colour for one demo only, override it on `:root` in that demo's
stylesheet.

Ready-made classes colour text in HTML and in SVG alike: `c-chalk`, `c-muted`, `c-blue`, `c-orange`, `c-pink`
(the lighter text tints) and `c-blue-main`, `c-orange-main`, `c-pink-main` (the pastels themselves).

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

`createNav` fills the empty `<nav class="nav">` with Back, the step dots, Replay and Next, and also puts a
home link (a chalk house) in the page's top-left corner that leads back to the list of demos. By default it
points to `../../`, the front page as seen from `demos/<name>/`. Pass `createNav(nav, deck, { home: 'url' })`
to send it elsewhere, or `{ home: false }` to leave it out.

### The rules every demo gets for free

- A step **begins** where the previous step finished, minus any bubble.
- **Next** carries on smoothly from there.
- **Back**, **Replay** and the **step dots** jump straight to the step's beginning, hold it for a moment, then play the step.
- Leaving a step stops its animation at once, so `play` never has to check whether it is still wanted.
- The address shows the current step, e.g. `demos/qiangs-trip/#step-5`. Opening or sharing that link starts
  the demo on step 5, played from its beginning. The steps replace the address instead of adding to the browser
  history, so the browser's own Back button leaves the demo rather than stepping back through it.

### Step fields

| Field | Meaning |
| --- | --- |
| `name` | Read out by screen readers on the step's dot. |
| `slide` | `id` of the `<section class="slide">` to show. |
| `slideClass` | A class added to that slide while the step is active, for CSS animations. Replay restarts them. |
| `set` | Values that change by the end of the step. The finished look is the beginning plus `set`. |
| `start` | Values that are different at the beginning, on top of the previous finished look. |
| `fresh` | `true` to begin from the demo's starting `state` instead of the previous finished look (a cleared board). |
| `play(s)` | Async function that animates the step. Without it, the values glide to the finished look. |
| `enter(info)`, `leave(info)` | Hooks for things that aren't animated values, such as turning dragging on and off. |
| `replay` | `false` to disable Replay on this step. |

### Inside `play(s)`

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

## Starting a new demo

1. Copy `demos/template` to `demos/<your-demo>`.
2. Write the problem into `index.html`, and the drawing and steps into `demo.js`.
3. Add a link to it in the top-level `index.html` and in the table above.

## One-file copies

To email a demo or open it with no server, pack it into a single HTML file:

```sh
python3 tools/single_file.py demos/qiangs-trip      # writes dist/qiangs-trip.html
```

A packed file has no front page next to it, so its home link points to the live site
(change it with `--home URL`).
