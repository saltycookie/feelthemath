// Danny's Walk
// "Danny's home is 20 meters north of a straight river that flows from west to east. A playground is 120 meters east
//  of his home and 30 meters north of the river. After playing at the playground, Danny wants to walk to the river bank
//  to wash up before going home. What is the shortest total distance he needs to walk?"
// The figure is drawn to scale, in metres: the river bank is the line y = 0 (east to the right, north up),
// home A = (0, 20), playground B = (120, 30), and C is a point on the bank. Danny walks B -> C -> A.
//   Step 1: the problem.  Step 2: the problem drawn as a figure, ending on "How short can BC + CA be?".
//   Step 3: the figure is on a sheet of paper folded along the river, with home on the back half. The words fade as
//   the paper fades in; the paper rises and turns to be seen from the side; then it unfolds, carrying home across the
//   river, and a switch folds and unfolds it again.
//
// For step 3 the figure lives in 3D. The paper is the plane z = 0 (z points at the viewer). Its front half, north of
// the river, stays put. Its back half turns about the river by phi: 0 is folded up behind the front half, pi is flat
// south of the river. A point of the back half x metres east and v metres from the fold is at (x, v cos phi, -v sin phi).
// `view` turns the camera from straight on (step 2: a flat drawing) to a little west of the paper. The eyes are level
// with the river and not too far away: the far (east) end looks smaller, so the paper's top and bottom edges close in
// towards it, while its upright sides stay upright and parallel, and the river stays level.

import { createDeck, onFontsLoaded, clamp } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';
import { el, text, setText, setOpacity } from '../../framework/svg.js';

const $ = s => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- the places, in metres ---------- */
const A = { x: 0, y: 20 };        // Danny's home: on the back half of the paper
const B = { x: 120, y: 30 };      // the playground: on the front half
const C = { x: 80, y: 0 };        // a point on the river bank (any point will do for now)
const SPAN = { w: 120, h: 30 };   // what the step-2 figure has to show: from A to B, and from the river up to B
const MID = 60;                   // the figure turns about the middle of the river under it, (60, 0, 0)
const MAX_K = 7.5;                // largest scale, px per metre
const CAM = { yaw: 25 * Math.PI / 180, dist: 230 };   // step 3's camera: this far round to the west, this far away (m)
const DASH = 20, MARCH = .8;      // the walk's dash pattern (px) and how long one dash takes to march along it (s): see walk.css

/* ---------- the page ---------- */
const slide = $('#board'), prob = $('#problem'), box = $('#figbox'), svg = $('#fig'), ask = $('#ask');
const fold = $('#fold'), toggle = $('#toggle'), hint = $('#hint');
const foldAll = $('#foldAll'), unfoldAll = $('#unfoldAll');
let SW = 0, SH = 0;                        // the slide, in px
let fs = 18, compact = false;              // label size; short screen: "home" and "playground" beside the letters, not above
let V2 = null, V3 = null;                  // the view in steps 1-2 (the figure under the words) and in step 3
let PAPER = { x0: -10, x1: 130, h: 40 };   // the sheet of paper, in metres (it takes in the labels around the figure)
let RIVER = [0, 120];                      // the river's ends in step 2, in metres
let gapW = 0;                              // the gap the 120 m measure leaves for its label
let hintY = 0;                             // where step 3's closing words go: under the paper

/* ---------- views: where a point of the scene lands on the screen ---------- */
// t: 0 straight on, 1 step 3's camera. k: px per metre. (ox, oy): where the middle of the river (60, 0, 0) lands.
function makeView(t, k, ox, oy) {
  return { k, ox, oy, cy: Math.cos(CAM.yaw * t), sy: Math.sin(CAM.yaw * t), q: t / CAM.dist };   // q: 0 is no perspective
}
function proj(v, x, y, z = 0) {
  const px = x - MID;
  const x1 = px * v.cy + z * v.sy, z1 = z * v.cy - px * v.sy;      // turn about the upright axis: the west end comes nearer
  const f = 1 / (1 - z1 * v.q);                                     // nearer things look bigger (the eyes are level with the river)
  return [v.ox + v.k * x1 * f, v.oy - v.k * y * f];
}
// how far the paper reaches in step 3's view, at 1 px per metre around the middle of the river: its front half, and
// its back half all the way through the unfolding (up and down are positive and negative y)
function reach() {
  const v = makeView(1, 1, 0, 0), e = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const add = ([x, y]) => { e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.y0 = Math.min(e.y0, -y); e.y1 = Math.max(e.y1, -y); };
  for (const x of [PAPER.x0, PAPER.x1]) {
    add(proj(v, x, PAPER.h));
    for (let i = 0; i <= 12; i++) { const p = i / 12 * Math.PI; add(proj(v, x, PAPER.h * Math.cos(p), -PAPER.h * Math.sin(p))); }
  }
  return e;
}

/* ---------- layout ---------- */
function layout() {
  SW = slide.clientWidth; SH = slide.clientHeight;
  if (!SW || !SH) return;
  const gap = parseFloat(getComputedStyle(slide).rowGap) || 0;
  // the figure leaves a strip on the right for step 3's switch: it stays centred when there is room beside it for the
  // switch, and moves left when there is not
  const g = SW < 560 ? 54 : 70;
  const W = Math.min(960, SW - g), fx = Math.min((SW - W) / 2, SW - g - W);
  const room = SH - prob.offsetHeight - ask.offsetHeight - 2 * gap;     // the height left for the figure under the words
  fs = clamp(Math.min(W / 48, room / 9), 12, 21);
  // room around the drawing for the labels: "20 m" on the left, "30 m" on the right, B's name above, and below it
  // C's name and the 120 m measure
  const m = { l: fs * 3.4, r: fs * 3.4, t: fs * 3.3, b: fs * 2.9 };
  const fit = top => Math.min((W - m.l - m.r) / SPAN.w, (room - top - m.b) / SPAN.h, MAX_K);
  compact = fit(m.t) < 3 && fit(fs * 2.1) > fit(m.t);                   // short of height: save the captions' line
  if (compact) m.t = fs * 2.1;
  const k = Math.max(.5, fit(m.t));
  box.style.height = Math.round(SPAN.h * k + m.t + m.b) + 'px';
  V2 = makeView(0, k, fx + W / 2, box.offsetTop + m.t + SPAN.h * k);
  RIVER = [MID + (fx + 3 - V2.ox) / k, MID + (fx + W - 3 - V2.ox) / k];

  // step 3: the paper, at every stage of the unfolding, with the closing words ("Fold and unfold ...") under it.
  // The figure keeps its size, unless that would not fit with the river across the middle; then the paper and the
  // words are centred as one block, which lifts the river a little above the middle and leaves room under the words.
  PAPER = { x0: -(m.l + (compact ? fs * .8 : 0)) / k, x1: SPAN.w + m.r / k, h: SPAN.h + m.t * .92 / k };   // ("home" beside A needs a bit more)
  hint.style.width = W + 'px';
  const e = reach(), pad = fs * .6, hg = fs * .9, hh = hint.offsetHeight, up = e.y1, down = -e.y0;
  const k3 = Math.max(.5, Math.min(k, W / (e.x1 - e.x0), (SH / 2 - pad) / up, (SH / 2 - pad - hg - hh) / down));
  const oy3 = (SH - (up + down) * k3 - hg - hh) / 2 + up * k3;        // the river
  V3 = makeView(1, k3, fx + W / 2 - k3 * (e.x0 + e.x1) / 2, oy3);
  hintY = oy3 + down * k3 + hg;                                        // just under the lowest the paper reaches
  hint.style.left = fx + 'px';

  // the switch: in the strip right of the figure, level with the river (as far as the slide allows)
  const sy = clamp(oy3 - fold.offsetHeight / 2, 0, Math.max(0, SH - fold.offsetHeight));
  fold.style.transform = 'translate(' + ((fx + W + SW) / 2 - fold.offsetWidth / 2) + 'px,' + sy + 'px)';

  svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH);
  svg.style.setProperty('--fs', fs + 'px');
  R.cA.style.textAnchor = R.cB.style.textAnchor = compact ? 'end' : '';
  gapW = (R.tE.getComputedTextLength() || fs * 2.6) + fs * .7;
  deck.redraw();
}

/* ---------- drawing ---------- */
const R = {};
function build() {
  // the back half of the paper and what is on it (home), first, so that the front half covers it
  R.back = el('g', {}, svg);
  R.sheetB = el('path', { class: 'sheet back' }, R.back);
  R.dimA = el('path', { class: 'dim' }, R.back);         // A to the river: 20 m
  R.sqA = el('path', { class: 'sq' }, R.back);
  R.walkCA = el('path', { class: 'walk' }, R.back);      // C -> A, the second part of the walk
  R.pA = el('circle', { class: 'pt' }, R.back);
  R.lA = text(R.back, 'lbl', 'A'); R.cA = text(R.back, 'cap', 'home');
  R.tA = text(R.back, 'len', '20 m');
  // the front half and what is on it (the playground)
  R.front = el('g', {}, svg);
  R.sheetF = el('path', { class: 'sheet' }, R.front);
  R.dimB = el('path', { class: 'dim' }, R.front);        // B to the river: 30 m
  R.sqB = el('path', { class: 'sq' }, R.front);
  R.walkBC = el('path', { class: 'walk' }, R.front);     // B -> C, the first part of the walk; its dashes march towards home
  R.pB = el('circle', { class: 'pt' }, R.front);
  R.lB = text(R.front, 'lbl', 'B'); R.cB = text(R.front, 'cap', 'playground');
  R.tB = text(R.front, 'len', '30 m');
  // the river (in step 3, the fold), C on it, and step 2's 120 m measure under it
  R.river = el('path', { class: 'river' }, svg);
  R.riverT = text(svg, 'cap river-cap', 'river');
  R.pC = el('circle', { class: 'pt c' }, svg);
  R.lC = text(svg, 'lbl c', 'C');
  R.ext = el('path', { class: 'ext' }, svg);             // where A's and B's lines meet the river, carried down
  R.dimE = el('path', { class: 'dim' }, svg);            // along the river, between those two points: 120 m
  R.tE = text(svg, 'len', '120 m');
}

/* ---------- helpers (positions are screen points [x, y]) ---------- */
const fadeIn = (t, from = .6) => clamp((t - from) / (1 - from), 0, 1);     // a label appears as its line finishes
function line(n, p, q, on) { n.setAttribute('d', on ? 'M' + p + 'L' + q : ''); }
// where the screen segments p0-p1 and q0-q1 cross, as a fraction of the way from p0 to p1 (null if they do not)
function crossAt(p0, p1, q0, q1) {
  const rx = p1[0] - p0[0], ry = p1[1] - p0[1], sx = q1[0] - q0[0], sy = q1[1] - q0[1], den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = q0[0] - p0[0], qy = q0[1] - p0[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null;
}
// the sheet of paper h metres tall, on the half that map(x, y) places
function sheet(n, map, h, op) {
  n.setAttribute('d', h > 0 ? 'M' + map(PAPER.x0, 0) + 'L' + map(PAPER.x1, 0) + 'L' + map(PAPER.x1, h) + 'L' + map(PAPER.x0, h) + 'Z' : '');
  setOpacity(n, op);
}
// a small right-angle mark (s metres) at (x, y) on the half that map places, between the directions d1 and d2
function corner(n, map, x, y, d1, d2, s, op) {
  n.setAttribute('d', 'M' + map(x + d1[0] * s, y + d1[1] * s) + 'L' + map(x + (d1[0] + d2[0]) * s, y + (d1[1] + d2[1]) * s) +
    'L' + map(x + d2[0] * s, y + d2[1] * s));
  setOpacity(n, op);
}
// a label written on the paper: (dx, dy) label sizes from the point (x, y) of the half that map places, so that it
// moves with that half (on the back half it ends up below its point once unfolded); the words stay upright
function label(n, map, x, y, dx, dy, op, k) {
  const [px, py] = map(x + dx * fs / k, y + dy * fs / k);
  setText(n, px, py, op);
}
// a point's letter just above it, and "home" / "playground" above the letter, or to its left on a short screen
function names(lt, cap, map, p, op, k) {
  label(lt, map, p.x, p.y, 0, 1.05, op, k);
  if (compact) label(cap, map, p.x, p.y, -.75, 1.05, op, k);
  else label(cap, map, p.x, p.y, 0, 2.2, op, k);
}
function point(n, p, op) {
  n.setAttribute('cx', p[0]); n.setAttribute('cy', p[1]);
  n.setAttribute('r', fs * .34 * (.4 + .6 * op));
  setOpacity(n, op);
}

/* ---------- render: the figure for given animated values ---------- */
let lagNow = 0;
function render(S) {
  if (!V2) return;
  const t = S.view, v = makeView(t, lerp(V2.k, V3.k, t), lerp(V2.ox, V3.ox, t), lerp(V2.oy, V3.oy, t));
  const phi = Math.PI * S.unf, cf = Math.cos(phi), sf = Math.sin(phi);     // 0: folded flat behind the front half; pi: unfolded
  const front = (x, y) => proj(v, x, y);
  const back = (x, y) => proj(v, x, y * cf, -y * sf);       // y: how far from the fold, on the back half
  const s = fs * .6 / v.k;                                   // the right-angle marks, in metres

  // the words
  prob.style.opacity = S.txt;
  ask.style.opacity = clamp(S.ask, 0, 1);
  ask.style.transform = 'translateY(' + (1 - S.ask) * 10 + 'px)';
  hint.style.opacity = clamp(S.hint, 0, 1);
  hint.style.transform = 'translateY(' + (hintY + (1 - S.hint) * 10) + 'px)';

  // the paper, folded along the river: it fades in over the figure; later its back half swings down behind
  sheet(R.sheetB, back, PAPER.h, S.paper);
  sheet(R.sheetF, front, PAPER.h, S.paper);
  setOpacity(R.back, 1 - .45 * S.paper * clamp(.5 + cf, 0, 1));    // home shows dimly through the front half while behind it

  // the river, drawn from west to east; in step 3 it is the fold, as wide as the paper
  const xa = lerp(RIVER[0], PAPER.x0, S.paper), xb = lerp(RIVER[1], PAPER.x1, S.paper), end = front(xb, 0);
  line(R.river, front(xa, 0), front(lerp(xa, xb, S.river), 0), S.river > 0);
  setText(R.riverT, end[0] - fs * 1.9 + 3, end[1] + fs * 1.05, fadeIn(S.river, .7));

  // Danny's home, A, on the back half, and its 20 m to the river
  const a = back(A.x, A.y);
  point(R.pA, a, S.a);
  names(R.lA, R.cA, back, A, S.a, v.k);
  line(R.dimA, a, back(A.x, A.y * (1 - S.aDim)), S.aDim > 0);
  corner(R.sqA, back, A.x, 0, [1, 0], [0, 1], s, fadeIn(S.aDim));
  label(R.tA, back, A.x, A.y / 2, -1.75, 0, fadeIn(S.aDim), v.k);

  // the playground, B, on the front half: 30 m north of the river ...
  const b = front(B.x, B.y);
  point(R.pB, b, S.b);
  names(R.lB, R.cB, front, B, S.b, v.k);
  line(R.dimB, b, front(B.x, B.y * (1 - S.bRiver)), S.bRiver > 0);
  corner(R.sqB, front, B.x, 0, [-1, 0], [0, 1], s, fadeIn(S.bRiver));
  label(R.tB, front, B.x, B.y / 2, 1.75, 0, fadeIn(S.bRiver), v.k);
  // (and 120 m east of A: drawn after the walk, below)

  // a point C on the bank
  const c = front(C.x, C.y);
  point(R.pC, c, S.c);
  setText(R.lC, c[0], c[1] + fs * 1.15, S.c);

  // Danny's walk: B to C on the front half, then C to A on the back half, drawn at an even pace
  const bc = Math.hypot(B.x - C.x, B.y - C.y), ca = Math.hypot(A.x - C.x, A.y - C.y), d = S.walk * (bc + ca);
  const u1 = clamp(d / bc, 0, 1), u2 = clamp((d - bc) / ca, 0, 1);
  line(R.walkBC, b, front(lerp(B.x, C.x, u1), lerp(B.y, C.y, u1)), d > 0);
  line(R.walkCA, c, back(lerp(C.x, A.x, u2), lerp(C.y, A.y, u2)), u2 > 0);
  // the dashes run on from one part into the next: the second part's march lags by the first part's length
  const lag = (Math.hypot(b[0] - c[0], b[1] - c[1]) % DASH) / DASH * MARCH - MARCH;
  if (Math.abs(lag - lagNow) > .004) { R.walkCA.style.animationDelay = lag + 's'; lagNow = lag; }

  // the playground is also 120 m east of A, measured along the river, under C's name. The measure lies on the
  // paper's plane, so it is seen in the same perspective as the river: its far end looks smaller. Its label sits in a
  // gap at the measure's middle; once the paper unfolds, the walk from C to home crosses the measure, and the label
  // then slides east along it, just clear of the crossing.
  const dm = fs * 2.15 / v.k, om = fs * .4 / v.k, hm = fs * .45 / v.k;   // metres: depth under the river, overhang, arrowhead
  const p0 = front(A.x, -dm), p1 = front(B.x, -dm), len2 = (p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 || 1;
  const at = q => ((q[0] - p0[0]) * (p1[0] - p0[0]) + (q[1] - p0[1]) * (p1[1] - p0[1])) / len2;   // screen point -> fraction
  const P = f => [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];                                      // fraction -> screen point
  R.ext.setAttribute('d', 'M' + front(A.x, -om) + 'L' + front(A.x, -dm - om) + 'M' + front(B.x, -om) + 'L' + front(B.x, -dm - om));
  setOpacity(R.ext, clamp(S.bEast * 5, 0, 1));
  const half = gapW / 2 / Math.sqrt(len2);
  let fl = at(front((A.x + B.x) / 2, -dm));
  const fc = u2 > 0 ? crossAt(p0, p1, c, back(lerp(C.x, A.x, u2), lerp(C.y, A.y, u2))) : null;
  if (fc !== null) fl = clamp(Math.max(fl, fc + half + fs * .25 / Math.sqrt(len2)), fl, 1 - half);
  if (S.bEast > 0) {
    const tx = lerp(A.x, B.x, S.bEast), ft = at(front(tx, -dm));
    const head = (x, dir) => 'M' + front(x - dir * hm, -dm + .55 * hm) + 'L' + front(x, -dm) + 'L' + front(x - dir * hm, -dm - .55 * hm);
    let d = 'M' + p0 + 'L' + P(Math.min(ft, fl - half));
    if (ft > fl + half) d += 'M' + P(fl + half) + 'L' + P(ft);
    R.dimE.setAttribute('d', d + head(A.x, -1) + head(tx, 1));
  } else R.dimE.setAttribute('d', '');
  const lp = P(fl);
  setText(R.tE, lp[0], lp[1], fadeIn(S.bEast));

  // step 3's switch
  fold.style.opacity = S.sw;
}

/* ---------- the steps ---------- */
const FOLD = 2;                     // the step with the switch
let touched = false;                // the switch has been used since the step began
const ALT = [
  '',
  "A straight river running from west to east. Danny's home, A, is 20 meters north of it. The playground, B, is 120 meters " +
    "east of A and 30 meters north of the river. C is a point on the river bank, and Danny's walk goes from B to C and then from C to A.",
  'The same figure on a sheet of see-through paper folded along the river, seen a little from the side. Home, A, is on the ' +
    "back half, behind the playground's half. The paper unfolds: the back half swings down, carrying home and the walk from " +
    'C to A with it, until home is 20 meters south of the river.',
];

build();
let deck = null;
deck = createDeck({
  render,
  state: {
    river: 0, a: 0, aDim: 0, b: 0, bRiver: 0, bEast: 0, c: 0, walk: 0, ask: 0,   // step 2: the figure, drawn bit by bit
    txt: 1, view: 0, paper: 0, unf: 0, sw: 0, hint: 0,                            // step 3: words, camera, paper, unfolding, switch, closing words
  },
  linear: ['walk'],
  steps: [
    { name: 'The problem', title: 'Problem Description', slide: 'board', replay: false },

    { name: 'The problem as a figure', title: 'Problem Description', slide: 'board',
      set: { river: 1, a: 1, aDim: 1, b: 1, bRiver: 1, bEast: 1, c: 1, walk: 1, ask: 1 },
      async play(s) {
        await s.to('river', 1, 1000);           // the river, from west to east
        await s.to('a', 1, 450, 250);           // Danny's home, A ...
        await s.to('aDim', 1, 700, 100);        // ... 20 m north of the river
        await s.to('b', 1, 450, 400);           // the playground, B ...
        await s.to('bRiver', 1, 800, 100);      // ... 30 m north of the river ...
        await s.to('bEast', 1, 1100, 150);      // ... and 120 m east of A, along the river
        await s.to('c', 1, 450, 400);           // a point C on the bank
        await s.to('walk', 1, 2600, 300);       // the walk: B to C, then C to A
        await s.to('ask', 1, 600, 350);         // how short can it be?
      } },

    { name: 'The folded paper', title: 'Imagine Danny Living on a Folded Paper', slide: 'board',
      set: { txt: 0, ask: 0, view: 1, paper: 1, unf: 1, sw: 1, hint: 1 },
      enter() { touched = false; setSwitch(false); setControls(true); },    // the step begins folded
      leave() { setControls(false); },
      async play(s) {
        s.to({ txt: 0, ask: 0 }, 1200);         // the words fade out ...
        await s.to('paper', 1, 1200);           // ... as the paper fades in over the figure, folded along the river: home is on its back half
        await s.wait(400);
        s.to('sw', 1, 500, 1000);               // the switch
        await s.to('view', 1, 1700);            // the paper rises until the river is across the middle, and is seen from the side
        await s.wait(700);
        if (!touched) {                         // unfold: the back half swings down, carrying home across the river
          setSwitch(true);
          await s.to('unf', 1, 3000);
        }
        await s.to('hint', 1, 600, 400);        // now your turn: fold and unfold it
      } },
  ],
});
createNav($('.nav'), deck);
deck.onChange(i => {
  if (i === 0) svg.setAttribute('aria-hidden', 'true'); else svg.removeAttribute('aria-hidden');
  svg.setAttribute('aria-label', ALT[i] || ALT[1]);
  prob.setAttribute('aria-hidden', i >= FOLD ? 'true' : 'false');
});

/* ---------- step 3: a switch folds and unfolds the paper ---------- */
// Flipping it plays the fold or the unfold, from wherever the paper is. "fold" and "unfold" beside it can be tapped too.
let open = false;                   // where the switch points: false folded, true unfolded
function setSwitch(on) {
  open = on;
  toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  foldAll.classList.toggle('now', !on);
  unfoldAll.classList.toggle('now', on);
}
function setControls(on) {
  fold.classList.toggle('on', on);
  toggle.tabIndex = on ? 0 : -1;
  if (on) toggle.removeAttribute('aria-disabled'); else toggle.setAttribute('aria-disabled', 'true');
}
function flip(on) {
  if (deck.index !== FOLD) return;
  touched = true;
  setSwitch(on);
  const to = on ? 1 : 0;
  deck.tween('unf', to, Math.max(400, 2600 * Math.abs(to - deck.S.unf)));
}
toggle.addEventListener('click', () => flip(!open));
foldAll.addEventListener('click', () => flip(false));
unfoldAll.addEventListener('click', () => flip(true));

/* ---------- start ---------- */
layout();
onFontsLoaded(layout);
if (window.ResizeObserver) new ResizeObserver(layout).observe($('.stage')); else window.addEventListener('resize', layout);
deck.start();
