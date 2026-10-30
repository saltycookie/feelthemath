// Two Sticks, Two Strings
// "In the figure, AB + CD = 10 cm. What is the length of AC?"  AC and BD cross at O at a right angle, AO = BO = y and OC = OD = x − y.
// The figure is rebuilt with sticks: AC and BD are both x long, AB = √2·y and CD = √2·(x − y).
// Laid end to end on a ruler they reach 10 cm, so √2·x = 10 and AC = x = 5√2 cm.

import { createDeck, onFontsLoaded } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';

/* ================= the setup (lengths in cm) ================= */
const U = 40;                         // SVG units per centimetre
const SQ2 = Math.SQRT2;
const MAT = { w: 17.4, h: 14.4 };     // the mat; it gets taller on narrow screens
const XL = 10 / SQ2;                  // AC = BD = x: picked so the thin sticks add up to exactly 10 cm (kept secret until the answer)
const YL = 2.0;                       // AO = BO = y
const ZL = XL - YL;                   // OC = OD = x − y
const FIGX = 8.7;
let FIGY = 6.7;                       // centre of the figure; worked out from the space under the words
const RUL = { x0: 1.2, top: 12.55, h: 1.45 };
let RY = RUL.top - .15;               // the thin sticks lie here, on the ruler's top edge
const TM = .13, TT = .05;             // half thickness of the main sticks and the thin sticks
const TXT_TOP = .45;                  // where the question sits at the top of the mat

// The looks. away: the four sides are moved to the pile. bdOut: BD is moved to the pile. bdIn: BD is fetched from
// the pile and laid under AC. pick: a point O is picked on AC. bdl: BD's marks and labels.
const BASE = { draw: 0, marks: 0, lift: 1, away: 1, wood: 1, bdOut: 1, bdIn: 1, pick: 1, xdim: 0, ylbl: 1, zlbl: 1, bdl: 1, cross: 1, sq: 0, thinAB: 0, t1l: 0, thinCD: 0, t2l: 0, lay: 0, eqn: 0, fade: 0, gather: 0, prompt: 0, prob: 0 };
const KEYS = Object.keys(BASE);
const PIC = { ...BASE, draw: 1, marks: 1, lift: 0, away: 0, wood: 0, bdOut: 0, bdIn: 0, pick: 0, ylbl: 0, zlbl: 0, bdl: 0, prob: 1 };
// the finished look of each part
const T = {
  1: { ...PIC },
  2: { ...PIC, prompt: 1, marks: 0, draw: 0, wood: 1, lift: 1 },
  3: { ...BASE, bdIn: 0, cross: 0, xdim: 1, bdl: 0 },
  4: { ...BASE, cross: 0, xdim: 1 },
  5: { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1 },
  6: { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1, lay: 1, eqn: 1 },
  7: { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1, lay: 1, eqn: 1, fade: 1, gather: 1 },
};
const PAUSE = 600;                    // a short rest between the parts of the Build step
// how each part plays: value -> [delay ms, duration ms]
const CHOREO = {
  2: { prompt: [0, 700], marks: [1300, 600], draw: [1400, 800], wood: [1400, 1500], lift: [1400, 1200] },
  // every stick is carried in 1280 ms (each side gets .4 of the 3200 ms "away" time), BD included
  3: { prompt: [0, 700], prob: [0, 700], away: [500, 3200], bdOut: [3300, 1280], cross: [4600, 900], xdim: [5600, 600], pick: [6300, 1500], ylbl: [7900, 600], zlbl: [8700, 600] },
  4: { bdIn: [300, 1280], bdl: [1700, 2800] },
  5: { xdim: [0, 350], cross: [200, 1500], sq: [1550, 400], thinAB: [1900, 1300], t1l: [3300, 600], thinCD: [4200, 1500], t2l: [5800, 600] },
  6: { lay: [200, 1900], eqn: [2250, 600] },
  7: { fade: [0, 800], prob: [0, 600], gather: [450, 1100] },
};
// the order the sides are moved to the pile: BC and AD first, then AB and CD
const SIDE_START = { AB: .44, BC: 0, CD: .6, DA: .16 };
// the Solve step: when each line of the solution appears (ms after the step starts)
const SOLVE_SEQ = [[2300, 'sol2'], [3400, 'strike'], [4300, 'sol3'], [5600, 'sol4'], [6900, 'sol5'], [8300, 'sol6']];
const SOLVE = { sol2: 0, strike: 0, sol3: 0, sol4: 0, sol5: 0, sol6: 0 };
const SOLVED = { sol2: 1, strike: 1, sol3: 1, sol4: 1, sol5: 1, sol6: 1 };

// what the board shows, for screen readers
const ALT = [
  'The homework figure on a mat, with the question written above it. AC and BD cross at O at a right angle, AO equals BO and OC equals OD.',
  'Above the ruler: Think about this, how can you recreate this figure using sticks? Then every line turns into a stick.',
  'BC and AD, then AB and CD, then BD are laid upright side by side in the top-left corner, leaving only AC. AC is labeled x, a point O is picked on it, AO is labeled y and OC x minus y. BD is taken from the corner, laid under AC and marked the same way. BD is laid across AC at a right angle at O. AB is taken from the corner and laid on top, labeled root 2 times y, then CD, labeled root 2 times x minus y. The two thin sticks are laid end to end on the ruler and reach 10 centimetres: root 2 times y plus root 2 times x minus y equals 10.',
  'The equation moves to the top of the board and is solved line by line. x equals 10 divided by root 2, which is 5 root 2, so AC is 5 root 2 centimetres.',
];

/* ================= helpers ================= */
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
function mk(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const u = v => (v * U).toFixed(2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
const add = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k });
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
const dirDeg = a => ({ x: Math.cos(a * Math.PI / 180), y: Math.sin(a * Math.PI / 180) });
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const op = (e, v) => { e.style.opacity = v <= .001 ? '0' : Math.min(1, v).toFixed(3); };
function setXY(e, p) { e.setAttribute('x', u(p.x)); e.setAttribute('y', u(p.y)); }
function setLine(e, p, q) { e.setAttribute('x1', u(p.x)); e.setAttribute('y1', u(p.y)); e.setAttribute('x2', u(q.x)); e.setAttribute('y2', u(q.y)); }
function setRect(e, x, y, w, h, r) { e.setAttribute('x', x.toFixed(2)); e.setAttribute('y', y.toFixed(2)); e.setAttribute('width', Math.max(0, w).toFixed(2)); e.setAttribute('height', Math.max(0, h).toFixed(2)); e.setAttribute('rx', (r || 0).toFixed(2)); }
function text(parent, cls, str) { const t = mk('text', { class: cls }, parent); t.textContent = str; return t; }

/* ================= the drawing (SVG) ================= */
const box = $('benchbox'), bench = $('bench'), svg = $('scene'), overlay = $('overlay');
const defs = mk('defs', null, svg);
const soft = mk('filter', { id: 'soft', x: '-30%', y: '-80%', width: '160%', height: '260%' }, defs);
mk('feGaussianBlur', { stdDeviation: '3.2' }, soft);
const softU = mk('filter', { id: 'softU', filterUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1200, height: 1200 }, defs);
mk('feGaussianBlur', { stdDeviation: '2.4' }, softU);

const matBg = mk('rect', { class: 'mat-bg', x: 2, y: 2, rx: 14 }, svg);
const gGrid = mk('g', null, svg);
const gRuler = mk('g', null, svg);
let num10 = null;

// the parts that depend on the mat's height (drawn again when the mat changes shape)
function buildStatic() {
  svg.setAttribute('viewBox', `0 0 ${MAT.w * U} ${MAT.h * U}`);
  matBg.setAttribute('width', MAT.w * U - 4); matBg.setAttribute('height', MAT.h * U - 4);
  gGrid.textContent = '';
  let g1 = '', g5 = '';
  for (let i = 1; i < MAT.w; i++) { const s = `M${i * U} 6V${MAT.h * U - 6}`; if (i % 5) g1 += s; else g5 += s; }
  for (let j = 1; j < MAT.h; j++) { const s = `M6 ${j * U}H${MAT.w * U - 6}`; if (j % 5) g1 += s; else g5 += s; }
  mk('path', { class: 'grid', d: g1 }, gGrid);
  mk('path', { class: 'grid5', d: g5 }, gGrid);
  gRuler.textContent = '';
  mk('rect', { class: 'ruler-body', x: u(RUL.x0 - .4), y: u(RUL.top), width: u(15.8), height: u(RUL.h), rx: 5 }, gRuler);
  let dt = '';
  for (let i = 0; i <= 150; i++) {
    const X0 = (RUL.x0 + i / 10) * U, len = i % 10 === 0 ? .44 : i % 5 === 0 ? .3 : .17;
    dt += `M${X0.toFixed(1)} ${u(RUL.top)}v${u(len)}`;
  }
  mk('path', { class: 'ruler-ticks', d: dt }, gRuler);
  for (let n = 0; n <= 15; n++) { const t = text(gRuler, 'ruler-num', n); setXY(t, { x: RUL.x0 + n, y: RUL.top + .74 }); if (n === 10) num10 = t; }
  setXY(text(gRuler, 'ruler-unit', 'cm'), { x: RUL.x0 - .22, y: RUL.top + 1.16 });
}

// steps 1 and 2: the homework drawing in chalk
const gMarks = mk('g', null, svg);
const drTickY = mk('path', { class: 'tick tick-y' }, gMarks);
const drTickZ = mk('path', { class: 'tick tick-z' }, gMarks);
const drSq = mk('path', { class: 'sqr' }, gMarks);
const gPrint = mk('g', null, svg);
const drLbl = {};
for (const n of ['A', 'B', 'C', 'D', 'O']) drLbl[n] = text(gPrint, 'lbl print', n);

// right-angle marks (under the sticks)
const gSq = mk('g', null, svg);
const sqTL = mk('path', { class: 'sqr' }, gSq);
const sqBR = mk('path', { class: 'sqr' }, gSq);

// All six sticks share one layer. Their order in it is worked out on every frame,
// so the stick that was moved last always lies on top of the others.
const gSticks = mk('g', null, svg);
function makeStick() {
  const w = mk('g', null, gSticks);
  const shadow = mk('rect', { class: 'shadow', filter: 'url(#soft)' }, w);
  const g = mk('g', null, w);
  const pencil = mk('line', { class: 'pencil', y1: 0, y2: 0 }, g);
  const body = mk('rect', { class: 'wood' }, g);
  const grain = mk('path', { class: 'grain' }, g);
  const outline = mk('rect', { class: 'stick-line' }, g);
  const omark = mk('line', { class: 'omark', x1: 0, x2: 0 }, g);
  return { w, shadow, g, pencil, body, grain, outline, omark };
}
const stAC = makeStick();
const stBD = makeStick();
// the four sides start as chalk lines, turn into thin sticks (step 2) and go to the pile (step 3);
// AB and CD are fetched from the pile again later in step 3
function makeThin() {
  const w = mk('g', null, gSticks);
  return {
    w,
    chalk: mk('line', { class: 'pencil' }, w),
    shadow: mk('line', { class: 'thin-shadow', filter: 'url(#softU)' }, w),
    edge: mk('line', { class: 'thin-edge' }, w),
    paint: mk('line', { class: 'thin thin-n' }, w),
  };
}
const TH = { AB: makeThin(), BC: makeThin(), CD: makeThin(), DA: makeThin() };
const ALL = [stAC, stBD, TH.AB, TH.BC, TH.CD, TH.DA];
let zSig = '';
function restack(z) {
  const idx = ALL.map((_, i) => i).sort((a, b) => z[a] - z[b]);
  const sig = idx.join('');
  if (sig === zSig) return;
  zSig = sig;
  for (const i of idx) gSticks.appendChild(ALL[i].w);
}

const gDim = mk('g', null, svg);
const dimAC = mk('path', { class: 'dim' }, gDim), dimBD = mk('path', { class: 'dim' }, gDim);
const guideEnds = mk('path', { class: 'guide' }, gDim);
const guideO = mk('path', { class: 'guide' }, svg);
const pickMark = mk('path', { class: 'pick' }, svg);

const lbA = text(svg, 'lbl', 'A'), lbB = text(svg, 'lbl', 'B'), lbC = text(svg, 'lbl', 'C'), lbD = text(svg, 'lbl', 'D');
const lbOa = text(svg, 'lbl', 'O'), lbOb = text(svg, 'lbl', 'O');
const readLine = mk('line', { class: 'read' }, svg);

/* ================= words and maths (HTML on top of the drawing) ================= */
const promptTxt = $('promptTxt'), probTxt = $('probTxt');
const LB = { yA: $('lyA'), yB: $('lyB'), zA: $('lzA'), zB: $('lzB'), xA: $('lxA'), xB: $('lxB'), t1: $('pT1'), plus: $('pPlus'), t2: $('pT2'), eq: $('pEq'), ten: $('pTen') };
const SZ = {};
for (const k in LB) SZ[k] = { w: 1, h: .7 };
let promptH = .7, probH = .7, promptTop = 11.6;
const solve = $('solve');
const rows = [...solve.querySelectorAll('.srow')];
const rowN = n => rows[n - 1];
const TGT = {};
let cmPx = 30, KS = 1, mode = '';

function at(el, p, a) {
  el.style.left = (p.x / MAT.w * 100).toFixed(3) + '%';
  el.style.top = (p.y / MAT.h * 100).toFixed(3) + '%';
  el.style.opacity = a <= .001 ? '0' : Math.min(1, a).toFixed(3);
}
function atTop(el, y, a) {
  el.style.top = (y / MAT.h * 100).toFixed(3) + '%';
  el.style.opacity = a <= .001 ? '0' : Math.min(1, a).toFixed(3);
}
// how far a label's centre must sit from a line so the label clears it, along unit normal n
const reach = (sz, n) => (sz.w / 2) * Math.abs(n.x) + (sz.h / 2) * Math.abs(n.y);
function besideSeg(seg, sz) {
  const [p, q] = seg, a = Math.atan2(q.y - p.y, q.x - p.x);
  const n = { x: Math.sin(a), y: -Math.cos(a) };
  return add(mid(p, q), n, reach(sz, n) + TT + .1);
}

/* ================= rendering ================= */
// a stick carried from P1-P2 to Q1-Q2: lifted, moved, turned and set down
function rigid(P1, P2, Q1, Q2, t) {
  const m0 = mid(P1, P2), m1 = mid(Q1, Q2);
  const a0 = Math.atan2(P2.y - P1.y, P2.x - P1.x), a1 = Math.atan2(Q2.y - Q1.y, Q2.x - Q1.x);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const a = a0 + da * t, len = lerp(dist(P1, P2), dist(Q1, Q2), t);
  const c = lerp2(m0, m1, t);
  c.y -= Math.sin(Math.PI * t) * .9;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  return [add(c, d, -len / 2), add(c, d, len / 2)];
}

let P = null;                         // the deck's animated values (set on every render)

function placeStick(st, O, ang, lift, live, tick) {
  const w = P.wood, x = YL, y = ZL, L = XL;
  const h = .06 + .2 * w;
  st.g.setAttribute('transform', `translate(${u(O.x)} ${u(O.y)}) rotate(${ang.toFixed(2)})`);
  const rx = -x * U, ry = -h / 2 * U, rw = L * U, rh = h * U;
  // the outline is drawn inside the stick's true length, so end to end (round ends included) it measures exactly x
  const e = .65, bx = rx + e, by = ry + e, bw = rw - 2 * e, bh = rh - 2 * e, br = bh / 2;
  setRect(st.body, bx, by, bw, bh, br);
  op(st.body, w * 1.6);
  st.pencil.setAttribute('x1', rx.toFixed(2));
  st.pencil.setAttribute('x2', (y * U).toFixed(2));
  op(st.pencil, 1 - w);
  st.grain.setAttribute('d', `M${(rx + 9).toFixed(1)} ${(-rh * .2).toFixed(1)}H${(y * U - 14).toFixed(1)}M${(rx + 24).toFixed(1)} ${(rh * .22).toFixed(1)}H${(y * U - 8).toFixed(1)}`);
  op(st.grain, w * .5);
  setRect(st.outline, bx, by, bw, bh, br);
  op(st.outline, w);
  st.omark.setAttribute('y1', (ry - 3).toFixed(2));
  st.omark.setAttribute('y2', (-ry + 3).toFixed(2));
  op(st.omark, w * tick);
  op(st.g, live);
  st.shadow.setAttribute('transform', `translate(${u(O.x + .05 + .24 * lift)} ${u(O.y + .08 + .34 * lift)}) rotate(${ang.toFixed(2)})`);
  setRect(st.shadow, bx, by, bw, bh, br);
  op(st.shadow, w * (.32 + .2 * lift) * live);
}

const REST = { x: .05, y: .08 };       // where a thin stick's shadow falls when it lies on the mat
// A thin stick is a line with rounded ends, and each rounded end reaches CAP past the line's end point.
// Shortening the line by CAP at both ends makes the whole stick, round ends included, exactly as long as it should be.
const CAP = 3 / U;
function trimSeg(p, q) {
  const len = dist(p, q);
  if (len <= 2 * CAP) { const m = mid(p, q); return [m, m]; }
  const d = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
  return [add(p, d, CAP), add(q, d, -CAP)];
}
// how high a stick is while it is carried a fraction t of the way (0: lying on the mat, 1: in the air)
const airborne = t => clamp(Math.sin(Math.PI * clamp(t)) * 3);
// seg: where the stick is; stk: 0 = still a chalk line, 1 = a stick; rise: how high it is lifted
function placeThin(th, seg, stk, rise, alpha) {
  setLine(th.chalk, seg[0], seg[1]);
  op(th.chalk, 1 - stk);
  const [p, q] = trimSeg(seg[0], seg[1]);
  const so = { x: REST.x + .1 * rise, y: REST.y + .14 * rise };
  setLine(th.shadow, add(p, so, 1), add(q, so, 1));
  op(th.shadow, stk * (.3 + .25 * rise));
  setLine(th.edge, p, q);
  setLine(th.paint, p, q);
  op(th.edge, stk);
  op(th.paint, stk);
  op(th.w, alpha);
}

// The sticks put aside lie upright in the top-left corner, side by side with a small gap, in the order they were put there:
// where each stick's top end lies (cm) and the angle it lies at.
const PILE = { BC: [{ x: .8, y: .6 }, 90], DA: [{ x: 1.25, y: .6 }, 90], AB: [{ x: 1.7, y: .6 }, 90], CD: [{ x: 2.15, y: .6 }, 90], BD: [{ x: 2.66, y: .6 }, 90] };
// a stick's place in the pile, its ends kept the same way round as in the picture so it turns as little as possible
function pileSeg(key, fp, fq) {
  const [p, ang] = PILE[key], q = add(p, dirDeg(ang), dist(fp, fq));
  let d = ang - Math.atan2(fq.y - fp.y, fq.x - fp.x) * 180 / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d) > 90 ? [q, p] : [p, q];
}

function render(S) {
  P = S;
  if (!mode) return;
  const k = KS, X = XL, Y = YL, Z = ZL;
  const left = FIGX - X / 2, top = FIGY - X / 2;
  const c = P.cross, live = 1 - P.fade;
  const Oc = { x: left + Y, y: top + Y };
  const gap = 1.3 * k;
  const Oac = lerp2({ x: left + Y, y: FIGY - gap }, Oc, c);
  const Ac = { x: left, y: top + Y }, Bc = { x: left + Y, y: top }, Cc = { x: left + X, y: top + Y }, Dc = { x: left + Y, y: top + X };
  // BD: carried from the picture to the pile, fetched from the pile and laid under AC, then laid across AC
  const placed = P.bdOut >= .999 && P.bdIn >= .999;
  let Obd, aBD, liftBD;
  if (placed) {
    Obd = lerp2({ x: left + Y, y: FIGY + gap }, Oc, c);
    aBD = 90 * c;
    liftBD = 4 * c * (1 - c);
  } else {
    const pileBD = pileSeg('BD', Bc, Dc);
    let seg, t;
    if (P.bdOut < .999) { t = P.bdOut; seg = t > 0 ? rigid(Bc, Dc, pileBD[0], pileBD[1], t) : [Bc, Dc]; }
    else { t = P.bdIn; seg = t > 0 ? rigid(pileBD[0], pileBD[1], { x: left, y: FIGY + gap }, { x: left + X, y: FIGY + gap }, t) : pileBD; }
    const d = { x: (seg[1].x - seg[0].x) / X, y: (seg[1].y - seg[0].y) / X };
    Obd = add(seg[0], d, Y);
    aBD = Math.atan2(d.y, d.x) * 180 / Math.PI;
    liftBD = airborne(t);
  }
  const tickO = clamp((P.pick - .8) / .2);
  const bl = P.bdl, on = placed ? 1 : 0;
  const nameBD = P.bdOut < .999 ? 1 - clamp(P.bdOut * 5) : clamp(bl / .2) * on;
  const tickBD = clamp((bl - .2) / .15) * on;
  const dA = { x: 1, y: 0 }, dB = dirDeg(aBD), nB = { x: dB.y, y: -dB.x }, nBneg = { x: -nB.x, y: -nB.y };
  const A = add(Oac, dA, -Y), C = add(Oac, dA, Z), B = add(Obd, dB, -Y), D = add(Obd, dB, Z);

  // --- words at the top of the mat
  atTop(promptTxt, promptTop + .25 * (1 - P.prompt), P.prompt);
  atTop(probTxt, TXT_TOP, P.prob);

  op(gGrid, live);
  op(gRuler, live);
  placeStick(stAC, Oac, 0, 4 * c * (1 - c), live, tickO);
  placeStick(stBD, Obd, aBD, liftBD, live, tickBD);

  // --- the homework marks and printed letters
  op(gMarks, P.marks);
  op(gPrint, P.draw);
  if (P.marks > .001 || P.draw > .001) {
    const t = .2;
    const mAO = { x: left + Y / 2, y: Oc.y }, mBO = { x: Oc.x, y: top + Y / 2 };
    const mOC = { x: Oc.x + Z / 2, y: Oc.y }, mOD = { x: Oc.x, y: Oc.y + Z / 2 };
    drTickY.setAttribute('d', `M${u(mAO.x)} ${u(mAO.y - t)}V${u(mAO.y + t)}M${u(mBO.x - t)} ${u(mBO.y)}H${u(mBO.x + t)}`);
    drTickZ.setAttribute('d',
      `M${u(mOC.x - .09)} ${u(mOC.y - t)}V${u(mOC.y + t)}M${u(mOC.x + .09)} ${u(mOC.y - t)}V${u(mOC.y + t)}` +
      `M${u(mOD.x - t)} ${u(mOD.y - .09)}H${u(mOD.x + t)}M${u(mOD.x - t)} ${u(mOD.y + .09)}H${u(mOD.x + t)}`);
    const s = .42;
    drSq.setAttribute('d', `M${u(Oc.x)} ${u(Oc.y - s)}H${u(Oc.x + s)}V${u(Oc.y)}`);
    setXY(drLbl.A, { x: Ac.x - .6 * k, y: Ac.y });
    setXY(drLbl.B, { x: Bc.x, y: Bc.y - .6 * k });
    setXY(drLbl.C, { x: Cc.x + .6 * k, y: Cc.y });
    setXY(drLbl.D, { x: Dc.x, y: Dc.y + .62 * k });
    setXY(drLbl.O, { x: Oc.x - .45 * k, y: Oc.y + .5 * k });
  }

  // --- the four thin sticks. Each one is in the picture, in the pile, back in the picture or on the ruler,
  //     and is carried between those places like a real stick: lifted, moved, turned and set down.
  const figT = { AB: [Ac, Bc], BC: [Bc, Cc], CD: [Cc, Dc], DA: [Dc, Ac] };
  const aT = {}, segT = {}, riseT = {}, pileT = {};
  for (const key in figT) {
    const f = figT[key], pile = pileT[key] = pileSeg(key, f[0], f[1]);
    const a = aT[key] = ease(clamp((P.away - SIDE_START[key]) / .4));
    segT[key] = a > 0 ? rigid(f[0], f[1], pile[0], pile[1], a) : f;
    riseT[key] = airborne(a);
  }
  const ab = SQ2 * Y, cd = SQ2 * Z;
  const tAB = ease(clamp(P.lay / .6)), tCD = ease(clamp((P.lay - .4) / .6));
  const Q0 = { x: RUL.x0, y: RY }, Q1 = { x: RUL.x0 + ab, y: RY }, Q2 = { x: RUL.x0 + ab + cd, y: RY };
  if (tAB > 0) { segT.AB = rigid(A, B, Q0, Q1, tAB); riseT.AB = airborne(tAB); }
  else if (P.thinAB > 0) { segT.AB = rigid(pileT.AB[0], pileT.AB[1], A, B, P.thinAB); riseT.AB = airborne(P.thinAB); }
  if (tCD > 0) { segT.CD = rigid(C, D, Q1, Q2, tCD); riseT.CD = airborne(tCD); }
  else if (P.thinCD > 0) { segT.CD = rigid(pileT.CD[0], pileT.CD[1], C, D, P.thinCD); riseT.CD = airborne(P.thinCD); }
  for (const key in TH) placeThin(TH[key], segT[key], P.lift, riseT[key], live);
  const segAB = segT.AB, segCD = segT.CD;
  // In the picture AC lies at the bottom, then BD, then AB and CD, with BC and AD on top.
  // After that, the stick moved most recently lies on top. (order of the list: AC, BD, AB, BC, CD, DA)
  restack([
    0,
    P.bdOut >= .999 && P.bdIn > 0 ? 16 : P.bdOut > 0 ? 14 : 1,
    tAB > 0 ? 21 : P.thinAB > 0 ? 19 : aT.AB > 0 ? 12 : 2,
    aT.BC > 0 ? 10 : 4,
    tCD > 0 ? 22 : P.thinCD > 0 ? 20 : aT.CD > 0 ? 13 : 3,
    aT.DA > 0 ? 11 : 5,
  ]);

  // --- point letters on the sticks (they take over from the printed ones)
  const pl = (1 - P.draw) * live;
  setXY(lbA, add(A, dA, -.6 * k)); setXY(lbC, add(C, dA, .6 * k));
  setXY(lbB, add(B, dB, -.6 * k)); setXY(lbD, add(D, dB, .62 * k));
  op(lbA, pl); op(lbC, pl);
  op(lbB, pl * nameBD); op(lbD, pl * nameBD);
  // O: first the crossing point of the picture, then the point picked on AC
  setXY(lbOa, add(Oac, lerp2({ x: 0, y: .56 * k }, { x: -.46 * k, y: .52 * k }, c), 1));
  op(lbOa, pl * Math.max(P.wood * (1 - clamp(P.bdOut * 2)), tickO));
  setXY(lbOb, { x: Obd.x, y: Obd.y - .56 * k });
  op(lbOb, pl * tickBD * (1 - c));

  // --- picking O: a marker runs along AC, overshoots a little, settles, and O is marked there
  const pk = P.pick;
  const pxk = pk < .5 ? lerp(.35, 1.4 * Y, ease(pk / .5)) : lerp(1.4 * Y, Y, ease(clamp((pk - .5) / .3)));
  const tip = { x: A.x + pxk, y: Oac.y - TM - .07 };
  pickMark.setAttribute('d', `M${u(tip.x)} ${u(tip.y)}l${u(-.17)} ${u(-.32)}h${u(.34)}Z`);
  op(pickMark, clamp(pk / .08) * (1 - clamp((pk - .85) / .15)) * live);

  // --- y and x − y on the pieces. The two y labels change sides when the sticks cross,
  //     so they stay outside the small triangle; they dip out of sight while they switch.
  const my = P.ylbl, mz = P.zlbl, cl = TM + .09;
  const bxl = clamp((bl - .4) / .2) * on, byl = clamp((bl - .6) / .2) * on, bzl = clamp((bl - .8) / .2) * on;
  const flip = clamp(Math.abs(c - .5) * 4);
  const up = { x: 0, y: -1 }, sideYA = c < .5 ? up : { x: 0, y: 1 }, sideYB = c < .5 ? nBneg : nB;
  const alongYA = c < .5 ? Y / 2 : Math.min(Y - SZ.yA.w / 2 - .05, Math.max(Y / 2, .46 * k + .25 * k + SZ.yA.w / 2 + .35));
  at(LB.yA, add(add(Oac, dA, -alongYA), sideYA, reach(SZ.yA, sideYA) + cl), my * flip * live);
  at(LB.zA, add(add(Oac, dA, Z / 2), up, reach(SZ.zA, up) + cl), mz * live);
  at(LB.yB, add(add(Obd, dB, -Y / 2), sideYB, reach(SZ.yB, sideYB) + cl), byl * flip * live);
  at(LB.zB, add(add(Obd, dB, Z / 2), nBneg, reach(SZ.zB, nBneg) + cl), bzl * live);

  // --- both sticks are x long
  const xa = P.xdim * (1 - c) * live;
  const ya = Oac.y - (cl + SZ.yA.h + .14), yb = Obd.y + (cl + SZ.yB.h + .14);
  dimAC.setAttribute('d', `M${u(left)} ${u(ya + .16)}V${u(ya)}H${u(left + X)}V${u(ya + .16)}`);
  dimBD.setAttribute('d', `M${u(left)} ${u(yb - .16)}V${u(yb)}H${u(left + X)}V${u(yb - .16)}`);
  guideEnds.setAttribute('d', `M${u(left)} ${u(Oac.y - .3)}V${u(Obd.y + .3)}M${u(left + X)} ${u(Oac.y - .3)}V${u(Obd.y + .3)}`);
  op(dimAC, xa);
  op(dimBD, xa * bxl);
  op(guideEnds, clamp((bl - .05) / .2) * on * (1 - c) * live);
  at(LB.xA, { x: left + X / 2, y: ya - .08 - SZ.xA.h / 2 }, xa);
  at(LB.xB, { x: left + X / 2, y: yb + .08 + SZ.xB.h / 2 }, xa * bxl);
  guideO.setAttribute('d', `M${u(Oac.x)} ${u(Oac.y + .26)}V${u(Obd.y - .26)}`);
  op(guideO, clamp((bl - .12) / .15) * on * tickO * (1 - c) * .9 * live);

  // --- right angles
  const s = Math.min(.5, Y * .25, Z * .25);
  sqTL.setAttribute('d', `M${u(Oc.x - s)} ${u(Oc.y)}V${u(Oc.y - s)}H${u(Oc.x)}`);
  sqBR.setAttribute('d', `M${u(Oc.x + s)} ${u(Oc.y)}V${u(Oc.y + s)}H${u(Oc.x)}`);
  op(gSq, P.sq * c * live);

  // --- the labels ride with the thin sticks, become the equation on the ruler,
  //     then gather into the first line of the solution
  const g = P.gather, swap = g >= .999;
  const G = (p, key) => (TGT[key] ? lerp2(p, TGT[key], g) : p);
  const rowY = RY - (SZ.t1.h / 2 + TT + .1);
  const pPlus = { x: Math.max(RUL.x0 + ab, RUL.x0 + ab / 2 + SZ.t1.w / 2 + .15 + SZ.plus.w / 2), y: rowY };
  const pEq = { x: RUL.x0 + 10 + .3 + SZ.eq.w / 2, y: rowY };
  const pTen = { x: pEq.x + SZ.eq.w / 2 + .2 + SZ.ten.w / 2, y: rowY };
  const hide = swap ? 0 : 1;
  at(LB.t1, G(besideSeg(tAB > 0 ? segAB : [A, B], SZ.t1), 't1'), P.t1l * hide);
  at(LB.t2, G(besideSeg(tCD > 0 ? segCD : [C, D], SZ.t2), 't2'), P.t2l * hide);
  at(LB.plus, G(pPlus, 'plus'), P.eqn * hide);
  at(LB.eq, G(pEq, 'eq'), P.eqn * hide);
  at(LB.ten, G(pTen, 'ten'), P.eqn * hide);

  // --- the solution lines (step 4)
  rows[0].classList.toggle('on', swap);
  for (let n = 2; n <= 6; n++) rowN(n).classList.toggle('on', P['sol' + n] > .5);
  rowN(2).classList.toggle('struck', P.strike > .5);

  // --- the ruler reading: 10 cm
  setLine(readLine, { x: RUL.x0 + 10, y: RY - .42 }, { x: RUL.x0 + 10, y: RUL.top + .56 });
  op(readLine, P.eqn * live);
  if (num10) num10.classList.toggle('hot', P.eqn * live > .5);
}

/* ================= sizing ================= */
function measureSolve() {
  solve.classList.remove('stack');
  solve.style.maxWidth = 'none';
  const natural = solve.offsetWidth;
  solve.style.maxWidth = '';
  if (natural > bench.clientWidth * .96) solve.classList.add('stack');
  const or = overlay.getBoundingClientRect();
  const ans = rowN(6), ar = ans.getBoundingClientRect();
  ans.style.setProperty('--bx-l', (ans.querySelector('.sl').getBoundingClientRect().left - ar.left).toFixed(1) + 'px');
  ans.style.setProperty('--bx-r', (ar.right - ans.querySelector('.sr').getBoundingClientRect().right).toFixed(1) + 'px');
  rows[0].querySelectorAll('[data-p]').forEach(ph => {
    const r = ph.getBoundingClientRect();
    TGT[ph.dataset.p] = { x: (r.left + r.width / 2 - or.left) / cmPx, y: (r.top + r.height / 2 - or.top) / cmPx };
  });
}
// Fit the mat into the space above the navigation, as large as it goes. A narrow space gets a taller mat.
// When the mat would reach the top-left corner, it keeps clear of the home link there.
function layout() {
  const r = box.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const m = r.width / r.height < 1.12 ? 'narrow' : 'wide';
  if (m !== mode) {
    mode = m;
    MAT.h = m === 'narrow' ? 17.0 : 14.4;
    RUL.top = MAT.h - 1.85;
    RY = RUL.top - .15;
    buildStatic();
  }
  const ar = MAT.w / MAT.h;
  let top = 0, H = r.height, w = Math.min(r.width, H * ar);
  if ((r.width - w) / 2 < 48 && (H - w / ar) / 2 < 40) { top = 40; H -= 40; w = Math.min(r.width, H * ar); }
  const h = w / ar;
  bench.style.width = w + 'px'; bench.style.height = h + 'px';
  bench.style.left = (r.width - w) / 2 + 'px'; bench.style.top = top + (H - h) / 2 + 'px';

  cmPx = w / MAT.w;
  KS = clamp(27 / cmPx, 1, 1.45);
  const KT = clamp(15 / (.48 * cmPx), 1, 1.6);
  bench.style.setProperty('--cm', cmPx.toFixed(3) + 'px');
  bench.style.setProperty('--k', KS.toFixed(3));
  bench.style.setProperty('--kt', KT.toFixed(3));
  for (const key in LB) SZ[key] = { w: LB[key].offsetWidth / cmPx, h: LB[key].offsetHeight / cmPx };
  promptH = promptTxt.offsetHeight / cmPx;
  probH = probTxt.offsetHeight / cmPx;
  // centre the figure in the space between the words and the ruler
  promptTop = RUL.top - .3 - promptH;
  const regionTop = TXT_TOP + probH + .25;
  const regionBot = Math.min(RY - (SZ.t1.h + TT + .1), promptTop) - .2;
  FIGY = (regionTop + regionBot) / 2;
  measureSolve();
  deck.redraw();
}

/* ================= the steps ================= */
let pulseTimer = 0;
function pulseMarks() {                // the homework's equal-length marks throb a few times
  gMarks.classList.remove('pulse');
  requestAnimationFrame(() => {
    gMarks.classList.add('pulse');
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => gMarks.classList.remove('pulse'), 3600);
  });
}
// After Back, Replay or a dot, the solution lines switch at once instead of fading (their fades are CSS transitions).
function snapLines(info) {
  if (info.glide) return;
  solve.classList.add('snap');
  requestAnimationFrame(() => requestAnimationFrame(() => solve.classList.remove('snap')));
}
// Play parts of the story one after another, each starting where the one before it ended.
async function playParts(s, parts) {
  let from = s.start;
  for (let i = 0; i < parts.length; i++) {
    const to = T[parts[i]], plan = CHOREO[parts[i]] || {};
    let end = 0;
    for (const key of KEYS) {
      if (Math.abs(from[key] - to[key]) < 1e-4) continue;
      const [delay, dur] = plan[key] || [0, 600];
      s.to(key, to[key], dur, delay);
      end = Math.max(end, delay + dur);
    }
    from = to;
    await s.wait(end + (i < parts.length - 1 ? PAUSE : 0));
  }
}

const deck = createDeck({
  render,
  state: { ...T[1], ...SOLVE },
  // these run at an even pace, because each piece inside them (one stick, one label) has its own easing
  linear: ['away', 'lay', 'pick', 'bdl'],
  steps: [
    { name: 'The problem', slide: 'mat', enter: snapLines,
      async play() { pulseMarks(); } },
    { name: 'Think', slide: 'mat', set: T[2], enter: snapLines,
      play: s => playParts(s, [2]) },
    { name: 'Build', slide: 'mat', set: T[6], enter: snapLines,
      play: s => playParts(s, [3, 4, 5, 6]) },
    { name: 'Solve', slide: 'mat', set: { ...T[7], ...SOLVED }, enter: snapLines,
      async play(s) {
        for (const [t, key] of SOLVE_SEQ) s.to(key, 1, 1, t);         // the solution, one line at a time
        await playParts(s, [7]);                                       // while the equation moves to the top
      } },
  ],
});
createNav(document.querySelector('.nav'), deck);
deck.onChange(i => svg.setAttribute('aria-label', `The board, step ${i + 1} of ${deck.count}. ${ALT[i]}`));

layout();
onFontsLoaded(layout);
new ResizeObserver(layout).observe(box);
deck.start();
