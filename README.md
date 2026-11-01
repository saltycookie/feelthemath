# Feel the Math

Feel the Math is a collection of interactive demos that help students *see* why the answer to a math
problem is what it is. Each demo takes one word problem and solves it on a chalkboard, letting pictures do
most of the explaining: a car driving along a speed–time chart turns distances into areas, wooden sticks
rebuild a geometry figure and are measured on a ruler, and a sheet of paper folded along a river unfolds to straighten
the shortest walk. Learners move through the solution one small step at a time, replay any step or drag and
flip things to explore, and the arithmetic arrives only once the picture has made it feel obvious. The demos
run in any browser with nothing to install.

**Live site:** https://feelthemath.app/

| Demo | What it shows |
| --- | --- |
| [Qiang's Trip](demos/qiangs-trip/) | 15 miles at 30 mph, then 55 mph: how far to average 50 mph? Solved with areas on a speed–time chart. |
| [Two Sticks, Two Strings](demos/two-sticks/) | AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to end on a ruler. |
| [Danny's Walk](demos/dannys-walk/) | From the playground to the river and on home: how short can the walk be? A paper folded along the river unfolds, and the shortest walk becomes a straight line. |

## One framework for every demo

All the demos are built on the same small framework, StepDeck. That keeps them consistent: the same
chalkboard and handwriting, the same Back, Replay and Next, and the same step-by-step pacing, so a learner who
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
index.html                 list of demos (the site's home page)
framework/                 StepDeck, shared by every demo (see framework/README.md)
demos/<name>/              one folder per demo: index.html plus its own script and styles
demos/template/            a small example to copy when starting a new demo
tools/single_file.py       packs a demo into one HTML file (optional)
```

## One-file copies

To email a demo or open it with no server, pack it into a single HTML file:

```sh
python3 tools/single_file.py demos/qiangs-trip      # writes dist/qiangs-trip.html
```

A packed file has no front page next to it, so its home link points to the live site
(change it with `--home URL`).
