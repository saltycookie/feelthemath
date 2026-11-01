// Danny's Walk
// "Danny's home is 20 meters north of a straight river that flows from west to east. A playground is 120 meters east
//  of his home and 30 meters north of the river. After playing at the playground, Danny wants to walk to the river bank
//  to wash up before going home. What is the shortest total distance he needs to walk?"
// The figure is drawn to scale, in metres: the river bank is the line y = 0 (east to the right, north up),
// home A = (0, 20), playground B = (120, 30), and C is a point on the bank. Danny walks B -> C -> A.
//   Step 1: the problem.  Step 2: the problem drawn as a figure, ending on "How short can BC + CA be?".
//   Step 3: the figure is on a sheet of paper folded along the river, with home on the back half. The words fade as
//   the paper fades in; the paper rises and turns to be seen from the side; then it unfolds, carrying home across the
//   river, and a switch folds and unfolds it again. Leaving with Next folds the paper up again (however the reader
//   left it) as the closing words go: step 3 hands over a folded paper.
//   Step 4: C becomes C1, and C2, C3, C4 join it on the bank, each with its own walk from B to home in its own colour:
//   which is the shortest? (Unfolding shows it: the walk through C3 is a straight line.)
//
// For steps 3-4 the figure lives in 3D. The paper is the plane z = 0 (z points at the viewer). Its front half, north
// of the river, stays put. Its back half turns about the river by phi: 0 is folded up behind the front half, pi is flat
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
const C = { x: 80, y: 0 };        // a point on the river bank (any point will do for now); C1 from step 4 on
// Step 4's points on the bank: C1 (that is C), C2 near the foot of home's line, C3 where the straight line from B to
// home on the unfolded paper (20 m south of the river) crosses the river, and C4 near the foot of the playground's line.
const CS = [C, { x: 14, y: 0 }, { x: A.x + (B.x - A.x) * A.y / (A.y + B.y), y: 0 }, { x: 106, y: 0 }];   // C3: x = 48
const SPAN = { w: 120, h: 30 };   // what the step-2 figure has to show: from A to B, and from the river up to B
const MID = 60;                   // the figure turns about the middle of the river under it, (60, 0, 0)
const MAX_K = 7.5;                // largest scale, px per metre
const CAM = { yaw: 25 * Math.PI / 180, dist: 230 };   // step 3's camera: this far round to the west, this far away (m)
const DASH = 20, MARCH = .8;      // the walk's dash pattern (px) and how long one dash takes to march along it (s): see walk.css

/* ---------- the page ---------- */
const slide = $('#board'), prob = $('#problem'), box = $('#figbox'), svg = $('#fig'), ask = $('#ask');
const switcher = $('#switcher'), toggle = $('#toggle'), wordFold = $('#wordFold'), wordUnfold = $('#wordUnfold');
const hint3 = $('#hint3'), hint4 = $('#hint4');
let SW = 0, SH = 0;                        // the slide, in px
let fs = 18, compact = false;              // label size; short screen: "home" and "playground" beside the letters, not above
let V2 = null, V3 = null;                  // the view in steps 1-2 (the figure under the words) and in steps 3-4
let PAPER = null;                          // the sheet of paper, in metres { x0, x1, h } (it takes in the labels around the figure)
let RIVER = null;                          // the river's ends in step 2, in metres [west, east]
let gapW = 0;                              // the gap the 120 m measure leaves for its label
let hintY = 0;                             // where the words of steps 3-4 go: under the paper

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
  // the figure leaves a strip on the right for the switch of steps 3-4: it stays centred when there is room beside it
  // for the switch, and moves left when there is not
  const g = SW < 560 ? 56 : 70;                                        // (the switch and its words are 56 px wide)
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

  // steps 3-4: the paper, at every stage of the unfolding, with the words of steps 3-4 under it. The figure keeps its
  // size, unless that would not fit with the river across the middle; then the paper and the words are centred as one
  // block, which lifts the river a little above the middle and leaves room under the words.
  PAPER = { x0: -(m.l + (compact ? fs * .8 : 0)) / k, x1: SPAN.w + m.r / k, h: SPAN.h + m.t * .92 / k };   // ("home" beside A needs a bit more)
  hint3.style.width = hint4.style.width = W + 'px';
  const e = reach(), pad = fs * .6, hg = fs * .9, hh = Math.max(hint3.offsetHeight, hint4.offsetHeight), up = e.y1, down = -e.y0;
  const k3 = Math.max(.5, Math.min(k, W / (e.x1 - e.x0), (SH / 2 - pad) / up, (SH / 2 - pad - hg - hh) / down));
  const oy3 = (SH - (up + down) * k3 - hg - hh) / 2 + up * k3;        // the river
  V3 = makeView(1, k3, fx + W / 2 - k3 * (e.x0 + e.x1) / 2, oy3);
  hintY = oy3 + down * k3 + hg;                                        // just under the lowest the paper reaches
  hint3.style.left = hint4.style.left = fx + 'px';

  // the switch: in the strip right of the figure, level with the river (as far as the slide allows)
  const sy = clamp(oy3 - switcher.offsetHeight / 2, 0, Math.max(0, SH - switcher.offsetHeight));
  switcher.style.transform = 'translate(' + ((fx + W + SW) / 2 - switcher.offsetWidth / 2) + 'px,' + sy + 'px)';

  svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH);
  svg.style.setProperty('--fs', fs + 'px');
  R.cA.style.textAnchor = R.cB.style.textAnchor = compact ? 'end' : '';
  gapW = (R.tE.getComputedTextLength() || fs * 2.6) + fs * .7;
  deck.redraw();
}

/* ---------- drawing ---------- */
// The walks are numbered by their point on the bank: walk 1 goes through C (C1), walks 2-4 through C2-C4. Each walk is
// two pieces: B -> Ci on the front half, then Ci -> A on the back half (R.walkB[i] and R.walkA[i], i counting from 0).
const R = {};
function build() {
  // the back half of the paper and what is on it (home), first, so that the front half covers it
  R.back = el('g', {}, svg);
  R.sheetB = el('path', { class: 'sheet back' }, R.back);
  R.dimA = el('path', { class: 'dim' }, R.back);         // A to the river: 20 m
  R.sqA = el('path', { class: 'sq' }, R.back);
  R.walkA = CS.map((_, i) => el('path', { class: 'walk w' + (i + 1) }, R.back));   // Ci -> A; their dashes march towards home
  R.pA = el('circle', { class: 'pt' }, R.back);
  R.lA = text(R.back, 'lbl', 'A'); R.cA = text(R.back, 'cap', 'home');
  R.tA = text(R.back, 'len', '20 m');
  // the front half and what is on it (the playground)
  R.front = el('g', {}, svg);
  R.sheetF = el('path', { class: 'sheet' }, R.front);
  R.dimB = el('path', { class: 'dim' }, R.front);        // B to the river: 30 m
  R.sqB = el('path', { class: 'sq' }, R.front);
  R.walkB = CS.map((_, i) => el('path', { class: 'walk w' + (i + 1) }, R.front));  // B -> Ci
  R.pB = el('circle', { class: 'pt' }, R.front);
  R.lB = text(R.front, 'lbl', 'B'); R.cB = text(R.front, 'cap', 'playground');
  R.tB = text(R.front, 'len', '30 m');
  // the river (in steps 3-4, the fold), the points on it, and the 120 m measure under it
  R.river = el('path', { class: 'river' }, svg);
  R.riverT = text(svg, 'cap river-cap', 'river');
  R.pC = el('circle', { class: 'pt c' }, svg);            // C, until it becomes C1 (in its walk's colour) in step 4
  R.lC = text(svg, 'lbl c', 'C');
  R.pCs = CS.map((_, i) => el('circle', { class: 'pt w' + (i + 1) }, svg));
  R.lCs = CS.map((_, i) => subText(svg, 'lbl w' + (i + 1), 'C', String(i + 1)));
  R.ext = el('path', { class: 'ext' }, svg);             // where A's and B's lines meet the river, carried down
  R.dimE = el('path', { class: 'dim' }, svg);            // along the river, between those two points: 120 m
  R.tE = text(svg, 'len', '120 m');
}

/* ---------- helpers (positions are screen points [x, y]) ---------- */
const fadeIn = (t, from = .6) => clamp((t - from) / (1 - from), 0, 1);     // a label appears as its line finishes
function line(n, p, q, on) { n.setAttribute('d', on ? 'M' + p + 'L' + q : ''); }
// a letter with a small number below it: C1, C2, ...
function subText(parent, cls, main, sub) {
  const t = text(parent, cls, main);
  el('tspan', { class: 'sub', dy: '.35em' }, t).textContent = sub;
  return t;
}
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
// words under the paper (steps 3-4): they fade in rising a little
function under(n, op) {
  n.style.opacity = clamp(op, 0, 1);
  n.style.transform = 'translateY(' + (hintY + (1 - op) * 10) + 'px)';
}

/* ---------- render: the figure for given animated values ---------- */
const lagNow = CS.map(() => 0);
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
  under(hint3, S.hint3);
  under(hint4, S.hint4);

  // the paper, folded along the river: it fades in over the figure; later its back half swings down behind
  sheet(R.sheetB, back, PAPER.h, S.paper);
  sheet(R.sheetF, front, PAPER.h, S.paper);
  setOpacity(R.back, 1 - .45 * S.paper * clamp(.5 + cf, 0, 1));    // home shows dimly through the front half while behind it

  // the river, drawn from west to east; in steps 3-4 it is the fold, as wide as the paper
  const xa = lerp(RIVER[0], PAPER.x0, S.paper), xb = lerp(RIVER[1], PAPER.x1, S.paper), end = front(xb, 0);
  line(R.river, front(xa, 0), front(lerp(xa, xb, S.river), 0), S.river > 0);
  // its name near the east end, but east of B's line (where the paper is small, C4's name would be in the way)
  setText(R.riverT, Math.max(end[0] - fs * 1.9 + 3, (front(B.x, 0)[0] + end[0]) / 2), end[1] + fs * 1.05, fadeIn(S.river, .7));

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
  // (and 120 m east of A: drawn after the walks, below)

  // the points on the bank: C (pink), which in step 4 becomes C1 in its walk's colour, and C2-C4
  const cs = CS.map(p => front(p.x, p.y)), shown = [S.c * S.sub, S.c2, S.c3, S.c4];
  point(R.pC, cs[0], S.c); setOpacity(R.pC, S.c * (1 - S.sub));
  setText(R.lC, cs[0][0], cs[0][1] + fs * 1.15, S.c * (1 - S.sub));
  cs.forEach((q, i) => {
    point(R.pCs[i], q, i ? shown[i] : S.c); setOpacity(R.pCs[i], shown[i]);     // (C1 keeps C's size as it changes colour)
    setText(R.lCs[i], q[0], q[1] + fs * 1.15, shown[i]);
  });

  // the walks: B to Ci on the front half, then Ci to A on the back half, each drawn at an even pace
  const drawn = [S.walk, S.w2, S.w3, S.w4];
  let u1 = 0;                                                // how far walk 1's second piece is drawn
  CS.forEach((p, i) => {
    const bc = Math.hypot(B.x - p.x, B.y - p.y), ca = Math.hypot(A.x - p.x, A.y - p.y), d = drawn[i] * (bc + ca);
    const t1 = clamp(d / bc, 0, 1), t2 = clamp((d - bc) / ca, 0, 1);
    line(R.walkB[i], b, front(lerp(B.x, p.x, t1), lerp(B.y, p.y, t1)), d > 0);
    line(R.walkA[i], cs[i], back(lerp(p.x, A.x, t2), lerp(p.y, A.y, t2)), t2 > 0);
    // the dashes run on from one piece into the next: the second piece's march lags by the first piece's length
    const lag = (Math.hypot(b[0] - cs[i][0], b[1] - cs[i][1]) % DASH) / DASH * MARCH - MARCH;
    if (Math.abs(lag - lagNow[i]) > .004) { R.walkA[i].style.animationDelay = lag + 's'; lagNow[i] = lag; }
    if (!i) u1 = t2;
  });

  // the playground is also 120 m east of A, measured along the river, under the points' names. The measure lies on the
  // paper's plane, so it is seen in the same perspective as the river: its far end looks smaller. Its label sits in a
  // gap, in the middle unless a walk crosses the measure there (once the paper is unfolded): then it moves east, just
  // clear of the crossing. In steps 2-3 it keeps clear of walk 1 as it is at the moment; in step 4 it keeps clear of
  // all four walks as they lie on the unfolded paper, so it stays put while the paper folds and unfolds.
  // its depth under the river is set at B's end, the far end, where a metre looks smallest: under the points' names everywhere
  const fB = (front(B.x, -1)[1] - front(B.x, 0)[1]) / v.k;
  const dm = fs * 2.3 / (v.k * fB), om = fs * .4 / v.k, hm = fs * .45 / v.k;   // metres: depth under the river, overhang, arrowhead
  const p0 = front(A.x, -dm), p1 = front(B.x, -dm), len2 = (p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 || 1, len = Math.sqrt(len2);
  const at = q => ((q[0] - p0[0]) * (p1[0] - p0[0]) + (q[1] - p0[1]) * (p1[1] - p0[1])) / len2;   // screen point -> fraction
  const P = f => [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];                                      // fraction -> screen point
  R.ext.setAttribute('d', 'M' + front(A.x, -om) + 'L' + front(A.x, -dm - om) + 'M' + front(B.x, -om) + 'L' + front(B.x, -dm - om));
  setOpacity(R.ext, clamp(S.bEast * 5, 0, 1));
  const half = gapW / 2 / len, room = half + fs * .25 / len, fmid = at(front((A.x + B.x) / 2, -dm));
  // where a walk from q0 to q1 passes the label's height (the label is about one label size tall): a range of fractions
  // along the measure (a walk crossing at a shallow slant covers a wide range), or null if it does not pass
  const band = fs * .5, up = q => [q[0], q[1] - band], dn = q => [q[0], q[1] + band];
  const passes = (q0, q1) => {
    const f1 = crossAt(up(p0), up(p1), q0, q1), f2 = crossAt(dn(p0), dn(p1), q0, q1);
    return f1 === null && f2 === null ? null : [Math.min(f1 ?? f2, f2 ?? f1), Math.max(f1 ?? f2, f2 ?? f1)];
  };
  // the label's place: the middle, or just east of the walks that pass where it would be
  const clearOf = walks => {
    let f = fmid;
    const ranges = walks.map(([q0, q1]) => passes(q0, q1)).filter(Boolean).sort((r1, r2) => r1[0] - r2[0]);
    for (const [lo, hi] of ranges) if (f - room < hi && f + room > lo) f = hi + room;
    return clamp(f, fmid, 1 - half);
  };
  const fNow = clearOf(u1 > 0 ? [[cs[0], back(lerp(C.x, A.x, u1), lerp(C.y, A.y, u1))]] : []);
  const homeOpen = front(A.x, -A.y);                                    // home on the unfolded paper
  const fl = lerp(fNow, clearOf(cs.map(q => [q, homeOpen])), S.lab4);
  if (S.bEast > 0) {
    const tx = lerp(A.x, B.x, S.bEast), ft = at(front(tx, -dm));
    const head = (x, dir) => 'M' + front(x - dir * hm, -dm + .55 * hm) + 'L' + front(x, -dm) + 'L' + front(x - dir * hm, -dm - .55 * hm);
    let d = 'M' + p0 + 'L' + P(Math.min(ft, fl - half));
    if (ft > fl + half) d += 'M' + P(fl + half) + 'L' + P(ft);
    R.dimE.setAttribute('d', d + head(A.x, -1) + head(tx, 1));
  } else R.dimE.setAttribute('d', '');
  const lp = P(fl);
  setText(R.tE, lp[0], lp[1], fadeIn(S.bEast));

  // the switch of steps 3-4
  switcher.style.opacity = S.sw;
}

/* ---------- the steps ---------- */
const FOLD = 2, PATHS = 3;          // the steps with the switch: the folded paper, and which path is the shortest
let touched = false;                // the switch has been used since step 3 began
const ALT = [
  '',
  "A straight river running from west to east. Danny's home, A, is 20 meters north of it. The playground, B, is 120 meters " +
    "east of A and 30 meters north of the river. C is a point on the river bank, and Danny's walk goes from B to C and then from C to A.",
  'The same figure on a sheet of see-through paper folded along the river, seen a little from the side. Home, A, is on the ' +
    "back half, behind the playground's half. The paper unfolds: the back half swings down, carrying home and the walk from " +
    'C to A with it, until home is 20 meters south of the river.',
  'The paper folded again. Four points on the river bank: C2 near home, C3, C1, and C4 near the playground. Four walks, ' +
    'each in its own colour, go from the playground B to one of the points and on to home A. Which one is the shortest? ' +
    'Unfolding the paper shows it.',
];

build();
const deck = createDeck({
  render,
  state: {
    river: 0, a: 0, aDim: 0, b: 0, bRiver: 0, bEast: 0, c: 0, walk: 0, ask: 0,   // step 2: the figure, drawn bit by bit
    txt: 1, view: 0, paper: 0, unf: 0, sw: 0, hint3: 0,                           // step 3: words, camera, paper, unfolding, switch, closing words
    sub: 0, c2: 0, c3: 0, c4: 0, w2: 0, w3: 0, w4: 0, lab4: 0, hint4: 0,          // step 4: C -> C1, C2-C4, walks 2-4, the 120 m label, question
  },
  linear: ['walk', 'w2', 'w3', 'w4'],
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

    // (its finished look, the look it hands over: the paper folded again and the closing words gone; leave() gets there)
    { name: 'The folded paper', title: 'Imagine Danny Living on a Folded Paper', slide: 'board',
      set: { txt: 0, ask: 0, view: 1, paper: 1, unf: 0, sw: 1, hint3: 0 },
      enter() { touched = false; setSwitch(false); setControls(true); },    // the step begins folded
      async leave(info, s) {                    // on Next: fold the paper up again, from wherever the reader left it, as the words go
        setControls(false);
        setSwitch(false);
        await Promise.all([s.to('hint3', 0, 600 * s.S.hint3), s.to('unf', 0, 2600 * s.S.unf)]);   // (no time if already so)
      },
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
        await s.to('hint3', 1, 600, 400);       // now your turn: fold and unfold it
      } },

    { name: 'Four walks', title: 'Which Path Is the Shortest?', slide: 'board',     // (begins folded: see step 3)
      set: { sub: 1, c2: 1, c3: 1, c4: 1, w2: 1, w3: 1, w4: 1, lab4: 1, hint4: 1 },
      enter() { setSwitch(false); setControls(true); },
      leave() { setControls(false); },
      async play(s) {
        s.to('lab4', 1, 900);                   // the 120 m label moves to where no walk will cross it, as ...
        await s.to('sub', 1, 600);              // ... C becomes C1 ...
        await s.to('c2', 1, 450, 200);          // ... and C2, C3, C4 join it on the bank
        await s.to('c3', 1, 450, 150);
        await s.to('c4', 1, 450, 150);
        await s.to('w2', 1, 1500, 300);         // a walk through each of them, in its own colour
        await s.to('w3', 1, 1500, 200);
        await s.to('w4', 1, 1500, 200);
        await s.to('hint4', 1, 600, 400);       // which one is the shortest? unfold to find out
      } },
  ],
});
createNav($('.nav'), deck);
deck.onChange(i => {
  if (i === 0) svg.setAttribute('aria-hidden', 'true'); else svg.removeAttribute('aria-hidden');
  svg.setAttribute('aria-label', ALT[i] || ALT[1]);
  prob.setAttribute('aria-hidden', i >= FOLD ? 'true' : 'false');
});

/* ---------- steps 3-4: a switch folds and unfolds the paper ---------- */
// Flipping it plays the fold or the unfold, from wherever the paper is. The words "fold" and "unfold" can be tapped too.
let open = false;                   // where the switch points: false folded, true unfolded
function setSwitch(on) {
  open = on;
  toggle.setAttribute('aria-checked', on ? 'true' : 'false');
  wordFold.classList.toggle('now', !on);
  wordUnfold.classList.toggle('now', on);
}
function setControls(on) {
  switcher.classList.toggle('on', on);
  toggle.tabIndex = on ? 0 : -1;
  if (on) toggle.removeAttribute('aria-disabled'); else toggle.setAttribute('aria-disabled', 'true');
}
function flip(on) {
  if (deck.index !== FOLD && deck.index !== PATHS) return;
  touched = true;
  setSwitch(on);
  const to = on ? 1 : 0;
  deck.tween('unf', to, Math.max(400, 2600 * Math.abs(to - deck.S.unf)));
}
toggle.addEventListener('click', () => flip(!open));
wordFold.addEventListener('click', () => flip(false));
wordUnfold.addEventListener('click', () => flip(true));

/* ---------- start ---------- */
layout();
onFontsLoaded(layout);
if (window.ResizeObserver) new ResizeObserver(layout).observe($('.stage')); else window.addEventListener('resize', layout);
deck.start();
