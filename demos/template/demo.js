// A minimal StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself under it, then the answer.
// index.html has only what every demo shares (the box, the stage and the navigation); this script puts everything
// else on the stage, all of it at the start, and the animated values decide what shows.

import { createDeck, onFontsLoaded } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';
import { createBubbles } from '../../framework/bubbles.js';
import { el, text, setRect, setText } from '../../framework/svg.js';

// an HTML element with its attributes and contents (as HTML), added to parent
function tag(name, attrs, html, parent) {
  const n = document.createElement(name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (html) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}

// 0. the page: the question at the top of the stage, the drawing in the space under it
const stage = document.querySelector('.stage');
tag('p', { class: 'problem' }, 'A garden is <b class="c-blue">3 m</b> long and <b class="c-blue">2 m</b> wide. What is its area?', stage);
const box = tag('div', { class: 'box' }, '', stage);
const svg = el('svg', { id: 'pic' }, box);
let W = 0, H = 0, unit = 0, ox = 0, oy = 0;          // size of 1 m in px, and where the garden's corner is

// 1. what is drawn
const rect = el('rect', { class: 'area', opacity: 0 }, svg);
const answer = text(svg, 'big c-ink', '6 m²');

// 2. how the drawing looks for given animated values
function render(S) {
  if (!unit) return;
  setRect(rect, ox, oy, 3 * unit * S.grow, 2 * unit, S.rectOp);
  setText(answer, ox + 1.5 * unit, oy + unit + 10, S.answerOp);
  bubbles.place(S);
}
function layout() {
  const r = box.getBoundingClientRect();
  W = r.width; H = r.height;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  unit = Math.min(W / 5, H / 4); ox = (W - 3 * unit) / 2; oy = (H - 2 * unit) / 2;
  bubbles.measure();
  deck.redraw();
}

const bubbles = createBubbles(box, { bounds: () => ({ x: 0, y: 0, w: W, h: H }) });

// 3. the steps: what each one changes (set) and how it gets there (play)
const deck = createDeck({
  render, bubbles,
  state: { rectOp: 0, grow: 0, answerOp: 0 },
  steps: [
    { name: 'The question', replay: false },
    { name: 'Draw the garden',
      set: { rectOp: 1, grow: 1 },
      async play(s) {
        s.to('rectOp', 1, 0);
        await s.to('grow', 1, 1500);                                  // the rectangle grows to 3 m
        s.bubble('<b class="c-blue">3</b><u>m</u> × <b class="c-blue">2</b><u>m</u>', () => [ox + 3 * unit, oy, 'right']);
      } },
    { name: 'The answer',
      set: { answerOp: 1 },
      async play(s) { await s.wait(300); s.to('answerOp', 1, 600); } },
  ],
});
createNav(document.querySelector('.nav'), deck);

layout();
new ResizeObserver(layout).observe(box);
onFontsLoaded(layout);
deck.start();
