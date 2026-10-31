// Danny's Walk
// "Danny's home is 20 meters north of a straight river that flows from west to east. A playground is 120 meters east
//  and 10 meters north of his home. After playing at the playground, Danny wants to walk to the river bank to wash up
//  before going home. What is the shortest total distance he needs to walk?"
// The figure is drawn to scale, in metres: the river bank is the line y = 0 (east to the right, north up),
// home A = (0, 20), playground B = (120, 30), and C is a point on the bank. Danny walks B -> C -> A.
// So far: step 1 (the problem) and step 2 (the problem drawn as a figure, ending on "How short can BC + CA be?").

import { createDeck, onFontsLoaded, clamp } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';
import { el, text, setText, setOpacity } from '../../framework/svg.js';

const $ = s => document.querySelector(s);

/* ---------- the places, in metres ---------- */
const A = { x: 0, y: 20 };        // Danny's home
const B = { x: 120, y: 30 };      // the playground
const C = { x: 80, y: 0 };        // a point on the river bank (any point will do for now)
const SPAN = { w: 120, h: 30 };   // the part of the plane the figure has to show: from A to B, and from the river up to B
const MAX_K = 7.5;                // largest scale, px per metre

/* ---------- layout: the figure fits the room left under the problem text ---------- */
const slide = $('#intro'), prob = $('#problem'), box = $('#figbox'), svg = $('#fig'), ask = $('#ask');
let W = 0, H = 0, k = 0, ox = 0, oy = 0, fs = 18;      // figure size, px per metre, where (0, 0) is, label size
const X = x => ox + x * k, Y = y => oy - y * k;          // metres -> px
const P = p => [X(p.x), Y(p.y)];

/* ---------- drawing ---------- */
const R = {};
function build() {
  R.river = el('path', { class: 'river' }, svg);
  R.riverT = text(svg, 'cap river-cap', 'river');
  R.dimA = el('path', { class: 'dim' }, svg);           // A to the river: 20 m
  R.dimE = el('path', { class: 'dim' }, svg);           // A to below B: 120 m east
  R.dimN = el('path', { class: 'dim' }, svg);           // up to B: 10 m north
  R.sqA = el('path', { class: 'sq' }, svg);             // right angles: at the river, and at the corner below B
  R.sqB = el('path', { class: 'sq' }, svg);
  R.walk = el('path', { class: 'walk' }, svg);          // B -> C -> A, its dashes marching towards home
  R.pA = el('circle', { class: 'pt' }, svg);
  R.pB = el('circle', { class: 'pt' }, svg);
  R.pC = el('circle', { class: 'pt c' }, svg);
  R.lA = text(svg, 'lbl', 'A'); R.cA = text(svg, 'cap', 'home');
  R.lB = text(svg, 'lbl', 'B'); R.cB = text(svg, 'cap', 'playground');
  R.lC = text(svg, 'lbl c', 'C');
  R.tA = text(svg, 'len', '20 m');
  R.tE = text(svg, 'len', '120 m');
  R.tN = text(svg, 'len', '10 m');
}

function layout() {
  const sw = slide.clientWidth, sh = slide.clientHeight;
  if (!sw || !sh) return;
  const gap = parseFloat(getComputedStyle(slide).rowGap) || 0;
  W = Math.min(sw, 960);
  const room = sh - prob.offsetHeight - ask.offsetHeight - 2 * gap;     // the height left for the figure
  fs = clamp(Math.min(W / 48, room / 9), 12, 21);
  // room around the drawing for the labels: "20 m" on the left, "10 m" on the right, B's name above, C's below
  const m = { l: fs * 3.4, r: fs * 3.4, t: fs * 3.3, b: fs * 2 };
  k = Math.max(.5, Math.min((W - m.l - m.r) / SPAN.w, (room - m.t - m.b) / SPAN.h, MAX_K));
  H = Math.round(SPAN.h * k + m.t + m.b);
  ox = m.l + (W - m.l - m.r - SPAN.w * k) / 2;
  oy = m.t + SPAN.h * k;
  box.style.height = H + 'px';
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.style.setProperty('--fs', fs + 'px');
  deck.redraw();
}

/* ---------- helpers ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const fadeIn = (t, from = .6) => clamp((t - from) / (1 - from), 0, 1);     // a label appears as its line finishes
// a measuring line from p to q, drawn up to fraction t
function measure(n, p, q, t) {
  n.setAttribute('d', t > 0 ? 'M' + p[0] + ' ' + p[1] + 'L' + lerp(p[0], q[0], t) + ' ' + lerp(p[1], q[1], t) : '');
}
// a small right-angle mark at corner c, between the directions (dx1, dy1) and (dx2, dy2)
function corner(n, c, d1, d2, op) {
  const s = fs * .6, [x, y] = c;
  n.setAttribute('d', 'M' + (x + d1[0] * s) + ' ' + (y + d1[1] * s) + 'L' + (x + (d1[0] + d2[0]) * s) + ' ' + (y + (d1[1] + d2[1]) * s) +
    'L' + (x + d2[0] * s) + ' ' + (y + d2[1] * s));
  setOpacity(n, op);
}
function point(n, p, op) {
  n.setAttribute('cx', p[0]); n.setAttribute('cy', p[1]);
  n.setAttribute('r', fs * .34 * (.4 + .6 * op));
  setOpacity(n, op);
}

/* ---------- render: the figure for given animated values ---------- */
function render(S) {
  if (!k) return;
  const a = P(A), b = P(B), c = P(C), foot = [X(A.x), oy], turn = [X(B.x), Y(A.y)];

  // the river, drawn from west to east across the whole figure
  const r0 = 3, r1 = W - 3;
  R.river.setAttribute('d', S.river > 0 ? 'M' + r0 + ' ' + oy + 'L' + lerp(r0, r1, S.river) + ' ' + oy : '');
  setText(R.riverT, W - fs * 1.9, oy + fs * 1.05, fadeIn(S.river, .7));

  // Danny's home, A, and its 20 m to the river
  point(R.pA, a, S.a);
  setText(R.lA, a[0], a[1] - fs * 1.05, S.a);
  setText(R.cA, a[0], a[1] - fs * 2.2, S.a);
  measure(R.dimA, a, foot, S.aDim);
  corner(R.sqA, foot, [1, 0], [0, -1], fadeIn(S.aDim));
  setText(R.tA, foot[0] - fs * 1.75, (a[1] + oy) / 2, fadeIn(S.aDim));

  // the playground, B: 120 m east of A, then 10 m north
  point(R.pB, b, S.b);
  setText(R.lB, b[0], b[1] - fs * 1.05, S.b);
  setText(R.cB, b[0], b[1] - fs * 2.2, S.b);
  measure(R.dimE, a, turn, S.bEast);
  setText(R.tE, (a[0] + turn[0]) / 2, turn[1] - fs * .85, fadeIn(S.bEast));
  measure(R.dimN, turn, b, S.bNorth);
  corner(R.sqB, turn, [-1, 0], [0, -1], fadeIn(S.bNorth));
  setText(R.tN, turn[0] + fs * 1.75, (turn[1] + b[1]) / 2, fadeIn(S.bNorth));

  // a point C on the bank
  point(R.pC, c, S.c);
  setText(R.lC, c[0], oy + fs * 1.15, S.c);

  // Danny's walk: B to C, then C to A, drawn at an even pace
  const bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const d = S.walk * (bc + ca);
  let path = '';
  if (d > 0) {
    path = 'M' + b[0] + ' ' + b[1];
    if (d <= bc) path += 'L' + lerp(b[0], c[0], d / bc) + ' ' + lerp(b[1], c[1], d / bc);
    else path += 'L' + c[0] + ' ' + c[1] + 'L' + lerp(c[0], a[0], (d - bc) / ca) + ' ' + lerp(c[1], a[1], (d - bc) / ca);
  }
  R.walk.setAttribute('d', path);

  // the question
  ask.style.opacity = clamp(S.ask, 0, 1);
  ask.style.transform = 'translateY(' + (1 - S.ask) * 10 + 'px)';
}

/* ---------- the steps ---------- */
build();
let deck = null;
deck = createDeck({
  render,
  state: { river: 0, a: 0, aDim: 0, b: 0, bEast: 0, bNorth: 0, c: 0, walk: 0, ask: 0 },
  linear: ['walk'],
  steps: [
    { name: 'The problem', title: 'Problem Description', slide: 'intro', replay: false },

    { name: 'The problem as a figure', title: 'Problem Description', slide: 'intro',
      set: { river: 1, a: 1, aDim: 1, b: 1, bEast: 1, bNorth: 1, c: 1, walk: 1, ask: 1 },
      async play(s) {
        await s.to('river', 1, 1000);           // the river, from west to east
        await s.to('a', 1, 450, 250);           // Danny's home, A ...
        await s.to('aDim', 1, 700, 100);        // ... 20 m north of the river
        await s.to('b', 1, 450, 400);           // the playground, B ...
        await s.to('bEast', 1, 1100, 100);      // ... 120 m east of A ...
        await s.to('bNorth', 1, 500);           // ... and 10 m north
        await s.to('c', 1, 450, 400);           // a point C on the bank
        await s.to('walk', 1, 2600, 300);       // the walk: B to C, then C to A
        await s.to('ask', 1, 600, 350);         // how short can it be?
      } },
  ],
});
createNav($('.nav'), deck);
deck.onChange(i => { if (i === 0) svg.setAttribute('aria-hidden', 'true'); else svg.removeAttribute('aria-hidden'); });

/* ---------- start ---------- */
layout();
onFontsLoaded(layout);
if (window.ResizeObserver) new ResizeObserver(layout).observe($('.stage')); else window.addEventListener('resize', layout);
deck.start();
