// A minimal StepDeck demo to copy when starting a new one.
// Three steps: the question, a rectangle that draws itself, then the answer.

import { createDeck, onFontsLoaded } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';
import { createBubbles } from '../../framework/bubbles.js';
import { el, text, setRect, setText } from '../../framework/svg.js';

const svg = document.querySelector('#pic'), box = document.querySelector('#box');
let W = 0, H = 0, unit = 0, ox = 0, oy = 0;          // size of 1 m in px, and where the garden's corner is

// 1. what is drawn
const rect = el('rect', { class: 'area', opacity: 0 }, svg);
const answer = text(svg, 'big c-chalk', '6 m²');

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
    { name: 'The question', slide: 'question', replay: false },
    { name: 'Draw the garden', slide: 'drawing',
      set: { rectOp: 1, grow: 1 },
      async play(s) {
        s.to('rectOp', 1, 0);
        await s.to('grow', 1, 1500);                                  // the rectangle grows to 3 m
        s.bubble('<b class="c-blue">3</b><u>m</u> × <b class="c-blue">2</b><u>m</u>', () => [ox + 3 * unit, oy, 'right']);
      } },
    { name: 'The answer', slide: 'drawing',
      set: { answerOp: 1 },
      async play(s) { await s.wait(300); s.to('answerOp', 1, 600); } },
  ],
});
createNav(document.querySelector('.nav'), deck);

layout();
new ResizeObserver(layout).observe(box);
onFontsLoaded(layout);
deck.start();
