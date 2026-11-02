# Feel the Math

Feel the Math is a collection of interactive demos that help students *see* why the answer to a math
problem is what it is. Each demo takes one word problem and solves it in a small book, one page per step, letting
pictures do most of the explaining: a car driving along a speed–time chart turns distances into areas, wooden sticks
rebuild a geometry figure and are measured on a ruler, and a sheet of paper folded along a river unfolds to straighten
the shortest walk. Learners move through the solution one small step at a time, replay any step or drag and
flip things to explore, and the arithmetic arrives only once the picture has made it feel obvious. The demos
run in any browser with nothing to install.

**Live site:** https://feelthemath.app/

| Demo | What it shows |
| --- | --- |
| [Qiang's Trip](demos/qiangs-trip/) | 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart. |
| [Two Perpendicular Sticks](demos/two-sticks/) | AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to end on a ruler. |
| [Danny's Walk](demos/dannys-walk/) | From the playground to the river and on home: how short can the walk be? A paper folded along the river unfolds, and the shortest walk becomes a straight line. |

## One framework for every demo

All the demos are built on the same small framework, StepDeck. That keeps them consistent: the same
book pages on a wooden desk, the same handwriting, the same Back, Replay and Next, and the same step-by-step pacing, so a learner who
has used one demo already knows how to use the next. It also makes them easier to maintain: a demo only
describes its own drawing and steps, and a fix or improvement to the framework reaches every demo at once.

How the framework works, and how to start a new demo: [framework/README.md](framework/README.md).

## Looking at the demos

**Online:** <https://feelthemath.app/>

**On your computer:** the demos use JavaScript modules, which browsers only load from a web server,
so double-clicking `index.html` won't work. From this folder run

```sh
python3 -m http.server
```

then open <http://localhost:8000>. Any other static server works too.

## Folder layout

```
index.html                 the site's home page: the book's title page and contents, one chapter per demo
favicon.svg                the site icon, shown in browser tabs (see "The site icon" below)
favicon.ico                the same icon for older browsers, made from favicon.svg by tools/icons.py
apple-touch-icon.png       the same icon for iPhone and iPad home screens, made the same way
framework/                 StepDeck, shared by every demo (see framework/README.md)
demos/<name>/              one folder per demo: index.html plus its own script and styles,
                           and thumbnail.png / thumbnail@2x.png, its picture on the home page
demos/template/            a small example to copy when starting a new demo
tools/thumbnail.py         makes a demo's home-page thumbnail from a screenshot (see below)
tools/wood.py              makes framework/wood.webp, the wooden desk the book lies on
tools/single_file.py       packs a demo into one HTML file (optional)
tools/icons.py             makes favicon.ico and apple-touch-icon.png from favicon.svg
```

## Thumbnails on the home page

Each demo on the home page has a 120 × 120 picture: its workspace (the drawing on the page only, without the title
band, the home link or Back/Next) at the end of one chosen step. `tools/thumbnail.py` makes them. Once:

```sh
pip install playwright pillow
playwright install chromium
```

Then, from this folder:

```sh
python3 tools/thumbnail.py demos/*                       # remake every demo's thumbnail
python3 tools/thumbnail.py demos/qiangs-trip             # just one
python3 tools/thumbnail.py demos/qiangs-trip --step 8    # try another step (the demo's setting stays as it is)
```

Which step a demo shows is kept in the demo's own `index.html`, so running the tool again always gives the same
picture:

```html
<meta name="thumbnail" content="step=7">
```

The tool starts its own local server, opens the demo at `#step-N` in a headless browser, waits until the step has
finished animating, and screenshots the workspace. The window is 860 pixels wide and exactly as tall as it takes
to make the workspace square, so the whole drawing fits in the square picture. It writes
`demos/<name>/thumbnail.png` (120 × 120) and `thumbnail@2x.png` (240 × 240, which sharp screens pick up through
the `srcset` in `index.html`).

| Option | What it does |
| --- | --- |
| `--step N` | The step to show, counting from 1. |
| `--zoom Z`, `--focus X,Y` | Show part of the drawing larger: cut a square 1/Z as wide, from where X,Y say (each 0 to 1: `0,0` top left, `.5,.5` the middle, `1,1` bottom right). |
| `--fit contain` | Keep all of a workspace that isn't square, padded out with the colour of the paper, instead of cutting a square out of it. |
| `--viewport WIDTH[xHEIGHT]` | The browser window. A width alone (default 860) makes the window as tall as a square workspace needs. |
| `--raw DIR` | Also keep the full-size screenshot, to see what the square was cut from. |
| `--size`, `--no-2x`, `-o FILE` | Picture size (default 120), leave out the @2x copy, write somewhere else (one demo at a time). |

`step`, `viewport`, `fit`, `focus` and `zoom` can all go in the meta tag, e.g.
`<meta name="thumbnail" content="step=3 zoom=1.2 focus=.5,.4">`; options typed on the command line win.
`python3 tools/thumbnail.py --help` lists everything.

The demos load their handwritten font from Google Fonts, so run the tool online; it warns if the font did not
load. It knows a step has finished because StepDeck marks the page while a step animates (see
[framework/README.md](framework/README.md#for-tools)).

**Putting a new demo on the home page:** add the meta tag to the demo's `index.html`, run the tool on the demo,
and copy one of the `<li>` entries in the top-level `index.html`, changing its links, picture, title and text, and
its `--pages`: the demo's number of steps. Every step is a page of the book, so the contents works out from these
which page each chapter starts on.

## The site icon

The logo is a touch point on a rising curve, with ripples around it: the moment the math clicks, felt rather than
read. The curve is drawn like an italic f, a straight, steep stem with a round hook at each end, so the logo doubles
as the F of the name. It appears twice:

- **At the top of the home page**, drawn inline in `index.html` in the theme's colours, standing in for the F of
  the title: the logo, then "eel the Math" in orange, set close enough that they read as one word.
- **As the site icon** in browser tabs, bookmarks and home screens: `favicon.svg`, the same drawing on a chalkboard
  tile, with slightly thicker lines so it still reads at 16 pixels. Every page links to it in its `<head>`, the
  demos as `../../favicon.svg`; `demos/template` has the links too, so a new demo copied from it gets them.

Modern browsers use `favicon.svg` directly. `favicon.ico` (for older browsers) and `apple-touch-icon.png` (a 180 ×
180 square for iPhones and iPads; iOS rounds the corners itself) are made from it. After changing `favicon.svg`,
remake them (needs the same `playwright` and `pillow` as the thumbnail tool):

```sh
python3 tools/icons.py
```

## One-file copies

To email a demo or open it with no server, pack it into a single HTML file:

```sh
python3 tools/single_file.py demos/qiangs-trip      # writes dist/qiangs-trip.html
```

A packed file has no front page next to it, so its home link points to the live site
(change it with `--home URL`), and its site icon is taken from the live site too.
