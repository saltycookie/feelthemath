// Qiang's Trip
// "Qiang drives 15 miles at an average speed of 30 miles per hour. How many additional miles will he have to drive
//  at 55 miles per hour to average 50 miles per hour for the entire trip?"
// Solved on a speed-time chart, where a distance is an area: the area the first part falls short of 50 mph (the deficit)
// must be made up above 50 mph in the second part (the surplus). 20 x 0.5 = 10, 10 / 5 = 2 h, 2 x 55 = 110 mi.

import { createDeck, onFontsLoaded, clamp } from '../../framework/deck.js';
import { createNav } from '../../framework/nav.js';
import { createBubbles } from '../../framework/bubbles.js';
import { el, text, setRect, setText, setOpacity, chip, setChip, remeasureChip, arrowPath } from '../../framework/svg.js';

const $ = s => document.querySelector(s);
const fmt = n => String(Math.round(n * 100) / 100);
const u = s => '<u>' + s + '</u>';                       // a unit after a number: 15<u>mi</u>

/* ---------- the chart's scales ---------- */
const XM = 3.5, YM = 65;          // axis ranges (hours, mph); the last grid line on each axis has no number
const XDRAG = 3, YDRAG = 55;      // how far the step-3 point may go
const M = { l: 68, r: 20, t: 8, b: 64 };
let W = 0, H = 0, pw = 0, ph = 0;
const px = t => M.l + t / XM * pw;
const py = v => M.t + (1 - v / YM) * ph;

const svg = $('#chart'), box = $('#chartbox'), F = $('#formula');
const R = {};

/* ---------- the step-3 point ---------- */
const START = { x: 1.5, y: 40 };  // where the point starts
const PART1 = { x: .5, y: 30 };   // the first part of the trip, shown on the axes from step 4 on
let U = { ...START };             // where the point is now
const EXPLORE = 2;                // index of the step with the draggable point

/* ---------- drawing ---------- */
function build() {
  R.plot = el('rect', { class: 'plot' }, svg);
  R.grid = el('g', {}, svg);
  R.xtg = el('g', {}, svg);                                   // the x-axis numbers: only while exploring; later a time shows once it is known
  R.r1 = el('rect', { class: 'rc r1', opacity: 0 }, svg);     // the point's rectangle, which becomes part 1
  R.r2 = el('rect', { class: 'rc r2', opacity: 0 }, svg);     // part 2, grows with the car
  R.avg = el('line', { class: 'avg', opacity: 0 }, svg);      // the 50 mph average
  R.brk = el('polyline', { class: 'brk', opacity: 0 }, svg);  // the bracket over part 2's time
  R.hiD = el('rect', { class: 'hi', opacity: 0 }, svg);       // bold outline in the deficit ...
  R.hiS = el('rect', { class: 'hi', opacity: 0 }, svg);       // ... and in the surplus
  R.eqA = el('path', { class: 'eqa', opacity: 0 }, svg);      // step 7: arrows from the bubble to both areas
  R.eqB = el('path', { class: 'eqa', opacity: 0 }, svg);
  // labels
  R.l1 = text(svg, 'tx c-chalk');
  R.l2q = text(svg, 'tx c-chalk', '? mi'); R.l2f = text(svg, 'tx c-chalk', '110 mi');
  R.hl1 = text(svg, 'tx c-chalk');                            // "10 mi" in the deficit (on two lines when it is narrow)
  R.hl1a = el('tspan', {}, R.hl1); R.hl1a.textContent = '10';
  R.hl1b = el('tspan', {}, R.hl1); R.hl1b.textContent = ' mi';
  R.hl2 = text(svg, 'tx c-chalk', '10 mi');                   // ... and in the surplus
  R.avgT = text(svg, 'tx c-chalk halo'); R.avgT.style.textAnchor = 'start';   // "average speed", just past the line's end
  R.avgTa = el('tspan', {}, R.avgT); R.avgTa.textContent = 'average';
  R.avgTb = el('tspan', {}, R.avgT); R.avgTb.textContent = ' speed';
  R.bq = text(svg, 'tx c-chalk', '? h'); R.bf = text(svg, 'tx c-chalk', '2 h');
  R.bq.style.fontSize = '18px'; R.bf.style.fontSize = '18px';
  R.xt = text(svg, 'atitle', 'time (hours)'); R.xt.style.textAnchor = 'middle';
  R.yt = text(svg, 'atitle', 'average speed (mph)'); R.yt.style.textAnchor = 'middle';
  // chips: known values on the axes
  R.cx = chip(svg, 'blue'); R.c25 = chip(svg, 'orange'); R.cy = chip(svg, 'blue'); R.c55 = chip(svg, 'orange'); R.c50 = chip(svg, 'chalk');
  // the small car (origin = the middle of its wheels, on the axis)
  R.car = el('g', { opacity: 0 }, svg);
  el('rect', { class: 'tcb', x: -15, y: -14, width: 30, height: 8, rx: 3 }, R.car);
  el('path', { class: 'tcb', d: 'M-7 -14 L-3.5 -21 H5 L9.5 -14 Z' }, R.car);
  el('circle', { class: 'tcw', cx: -7.5, cy: -4, r: 4 }, R.car);
  el('circle', { class: 'tcw', cx: 8, cy: -4, r: 4 }, R.car);
  // the draggable point and the area that catches the pointer
  R.h = el('g', { class: 'handle', tabindex: -1, role: 'slider', 'aria-label': 'Point: speed and time. Arrow keys move it.' }, svg);
  R.hring = el('circle', { class: 'hring', r: 20 }, R.h);
  R.hfocus = el('circle', { class: 'hfocus', r: 18 }, R.h);
  R.hcore = el('circle', { class: 'hcore', r: 11 }, R.h);
  R.hicon = el('path', { class: 'hicon', d: 'M-5 0H5M0-5V5M-2-3L0-5L2-3M-2 3L0 5L2 3M-3-2L-5 0L-3 2M3-2L5 0L3 2' }, R.h);
  R.cap = el('rect', { class: 'cap-hit' }, svg);
}

function layout() {
  const r = box.getBoundingClientRect();
  W = Math.max(280, Math.floor(r.width)); H = Math.max(240, Math.floor(r.height));
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const narrow = W < 520;
  M.l = narrow ? 60 : 68; M.r = narrow ? 14 : 20; M.b = narrow ? 58 : 64;
  pw = W - M.l - M.r; ph = H - M.t - M.b;
  setRect(R.plot, M.l, M.t, pw, ph);
  measureOverlays();
  R.grid.textContent = ''; R.xtg.textContent = '';
  for (let v = 0; v <= YM; v += 5) {
    el('line', { class: 'gl' + (v % 10 === 0 ? ' major' : ''), x1: M.l, x2: M.l + pw, y1: py(v), y2: py(v) }, R.grid);
    const t = el('text', { class: 'tick', x: M.l - 15, y: py(v) + 4, 'text-anchor': 'end' }, R.grid);
    if (v < YM) t.textContent = v;                              // the top line (65) has no number
  }
  for (let t = .5; t <= XM + 1e-9; t += .5) {
    el('line', { class: 'gl', x1: px(t), x2: px(t), y1: M.t, y2: M.t + ph }, R.grid);
    const x = el('text', { class: 'tick', x: px(t), y: py(0) + 19, 'text-anchor': 'middle' }, R.xtg);
    if (t < XM - 1e-9) x.textContent = fmt(t);                  // the last line (3.5) has no number
  }
  el('line', { class: 'axis', x1: M.l, x2: M.l, y1: M.t, y2: M.t + ph }, R.grid);
  el('line', { class: 'axis', x1: M.l, x2: M.l + pw, y1: M.t + ph, y2: M.t + ph }, R.grid);
  R.xt.setAttribute('x', M.l + pw / 2); R.xt.setAttribute('y', H - 10); R.xt.style.fontSize = (narrow ? 18 : 21) + 'px';
  const yx = narrow ? 15 : 18, yy = M.t + ph / 2;
  R.yt.setAttribute('x', yx); R.yt.setAttribute('y', yy); R.yt.setAttribute('transform', 'rotate(-90 ' + yx + ' ' + yy + ')');
  R.yt.style.fontSize = (narrow ? 18 : 21) + 'px';
  setRect(R.cap, M.l, M.t, pw, ph);
  if (deck) deck.redraw();
}

function render(S) {
  if (!pw) return;
  const x0 = px(0), y0 = py(0);
  const P = deck.index === EXPLORE ? U : PART1;

  // the point's rectangle, which becomes part 1
  const rx = px(S.ptX), ry = py(S.ptY), w1 = rx - x0, h1 = y0 - ry;
  setRect(R.r1, x0, ry, w1, h1, S.r1Op);
  const small = w1 < 62;
  R.l1.style.fontSize = (small ? 13 : 17) + 'px';
  setText(R.l1, x0 + w1 / 2, ry + h1 / 2 + 5, S.r1Op * S.r1Lab, fmt(Math.round(S.ptX * S.ptY * 10) / 10) + ' mi');

  // chips on the axes
  const yTxt = fmt(P.y), yW = 14 + 8 * yTxt.length;
  setChip(R.cx, rx, y0 + 17, fmt(P.x), S.gxOp * S.r1Op);
  setChip(R.c25, px(2.5), y0 + 17, '2.5', S.x25);                     // the end of the trip, once the 2 h is known
  setOpacity(R.xtg, S.xtOp);
  setChip(R.cy, M.l - 4 - yW / 2, ry, yTxt, S.gdOp * S.r1Op, yW);
  setChip(R.c55, M.l - 19, py(55), '55', S.y55, 30);
  setChip(R.c50, M.l - 19, py(50), '50', clamp(S.avgP * 3, 0, 1), 30);

  // the draggable point
  R.h.setAttribute('transform', 'translate(' + rx + ' ' + ry + ')');
  setOpacity(R.h, S.hOp);
  const hr = S.hR + 2.5 * S.hov;
  R.hcore.setAttribute('r', hr); R.hfocus.setAttribute('r', hr + 6); R.hring.setAttribute('r', hr + 8);
  R.hring.style.display = S.ring > .05 ? '' : 'none';
  setOpacity(R.hicon, (S.hR - 6) / 5);

  // part 2: a plain orange rectangle that grows with the car
  const a = px(.5), b = px(XM), t55 = py(55), t50 = py(50);
  const bx = a + (b - a) * S.r2Rev;
  setRect(R.r2, a, t55, bx - a, y0 - t55, S.r2Op);
  const big = pw >= 420 ? 26 : 20;
  R.l2q.style.fontSize = big + 'px'; R.l2f.style.fontSize = big + 'px';
  setText(R.l2q, px(1.5), py(27) + 4, S.r2LabOp * (1 - S.ans));          // "? mi" ...
  setText(R.l2f, px(1.5), py(27) + 4, S.r2LabOp * S.ans);                // ... becomes "110 mi"

  // the bracket over part 2's time: "? h" until step 9 says "2 h"
  const by = py(58);
  R.brk.setAttribute('points', a + ',' + (by - 5) + ' ' + a + ',' + (by + 5) + ' ' + a + ',' + by + ' ' + bx + ',' + by + ' ' + bx + ',' + (by - 5) + ' ' + bx + ',' + (by + 5));
  setOpacity(R.brk, S.brkOp);
  setText(R.bq, px(1.5), by + 20, S.brkOp * (1 - S.lab));
  setText(R.bf, px(1.5), by + 20, S.brkOp * S.lab);

  // the 50 mph average line, drawn from left to right as far as the end of part 2 (the second rectangle)
  const ay = py(50);
  R.avg.setAttribute('x1', x0); R.avg.setAttribute('x2', x0 + S.avgP * (bx - x0));
  R.avg.setAttribute('y1', ay); R.avg.setAttribute('y2', ay);
  setOpacity(R.avg, S.avgP * 5);
  // "average speed" carries on from the line's end, in the empty space to its right
  // (on two lines, "average" over "speed", when one line would run off the chart)
  const afs = pw < 470 ? 15 : 17, ax = bx + 10;
  R.avgT.style.fontSize = afs + 'px';
  if (R.avgFs !== afs) {
    R.avgTb.removeAttribute('x'); R.avgTb.removeAttribute('dy'); R.avgTb.textContent = ' speed';
    R.avgW = R.avgT.getComputedTextLength() || afs * 6.2; R.avgFs = afs;
  }
  if (M.l + pw - 4 - ax < R.avgW) {
    R.avgTb.setAttribute('x', ax); R.avgTb.setAttribute('dy', afs * 1.1); R.avgTb.textContent = 'speed';
    setText(R.avgT, ax, ay + afs * .33 - afs * .55, (S.avgP - .75) * 4);
  } else {
    R.avgTb.removeAttribute('x'); R.avgTb.removeAttribute('dy'); R.avgTb.textContent = ' speed';
    setText(R.avgT, ax, ay + afs * .33, (S.avgP - .75) * 4);
  }

  // bold outlines a little inside the deficit (under the line, part 1) and the surplus (over the line, part 2)
  const dT = py(50), dB = py(30), dW = px(.5) - x0, dcx = x0 + dW / 2;
  const ins = Math.min(7, dW / 5);
  setRect(R.hiD, x0 + ins, dT + ins, dW - 2 * ins, (dB - dT) - 2 * ins, S.hiOp);
  setRect(R.hiS, a + ins, t55 + ins, (bx - a) - 2 * ins, (t50 - t55) - 2 * ins, S.hiOp);
  // "10 mi" inside both (stacked on two lines when the deficit is too narrow for one)
  const hlo = S.hlOp * S.hiOp, narrowH = (dW - 2 * ins) < 60, hfs = (pw < 420 ? 14 : 17) + 'px';
  R.hl1.style.fontSize = hfs; R.hl2.style.fontSize = hfs;
  setText(R.hl1, dcx, (dT + dB) / 2 + (narrowH ? -3 : 5), hlo);
  if (narrowH) { R.hl1b.setAttribute('x', dcx); R.hl1b.setAttribute('dy', 15); R.hl1b.textContent = 'mi'; }
  else { R.hl1b.removeAttribute('x'); R.hl1b.removeAttribute('dy'); R.hl1b.textContent = ' mi'; }
  setText(R.hl2, ((a + ins) + (bx - ins)) / 2, (t55 + t50) / 2 + 5, hlo);

  // the small car
  R.car.setAttribute('transform', 'translate(' + px(S.carX) + ' ' + y0 + ') scale(1.2)');
  setOpacity(R.car, S.carOp);

  // step 3: the formula rides just above the rectangle (or just inside its top edge when there is no room)
  const fx = clamp((x0 + rx) / 2 - FS.w / 2, M.l + 4, M.l + pw - 4 - FS.w);
  let fy = ry - 32 - FS.h; if (fy < M.t + 4) fy = ry + 36;
  F.style.transform = 'translate(' + fx + 'px,' + fy + 'px)';
  F.style.opacity = clamp(S.fOp, 0, 1);

  bubbles.place(S);
  placeEqualArrows(S);
}

// Step 7: two arrows run from the bubble to the deficit (left) and up into the surplus.
function placeEqualArrows(S) {
  const r = bubbles.rect(0), on = S.eqOp > .001 && S.bubble0 > .001 && r;
  setOpacity(R.eqA, on ? S.eqOp : 0); setOpacity(R.eqB, on ? S.eqOp : 0);
  if (!on) return;
  const [bl, bt, bw, bh] = r, x0 = px(0), a = px(.5);
  const tx = Math.max(x0 + 14, Math.min((x0 + a) / 2, a - 30));
  R.eqA.setAttribute('d', arrowPath(bl, bt + bh / 2, tx, bt + bh / 2));
  const ux = clamp(a + (px(XM) - a) * .12, bl + 16, bl + bw - 16);
  R.eqB.setAttribute('d', arrowPath(ux, bt, ux, (py(55) + py(50)) / 2));
}

/* ---------- the formula (step 3) ---------- */
const FS = { w: 0, h: 0 };
function measureOverlays() {
  if (!pw) return;
  F.style.maxWidth = (pw - 16) + 'px'; FS.w = F.offsetWidth; FS.h = F.offsetHeight;
  bubbles.measure();
}
function setFormula() {
  F.innerHTML = '<span class="w">distance = speed × time =</span> <span><b class="c-blue">' + fmt(U.y) + '</b>' + u('mph') +
    '</span> × <span><b class="c-blue">' + fmt(U.x) + '</b>' + u('h') + '</span> = <span><b class="c-blue z">' + fmt(U.x * U.y) + '</b>' + u('mi') + '</span>';
  measureOverlays();
  R.h.setAttribute('aria-valuetext', U.y + ' mph, ' + U.x + ' hours, ' + fmt(U.x * U.y) + ' miles');
}

/* ---------- bubble texts ---------- */
const SAY = {
  time1:  '<b class="c-blue">15</b>' + u('mi') + ' ÷ <b class="c-blue">30</b>' + u('mph') + ' = <b class="c-blue">0.5</b>' + u('h'),
  equal:  'The two areas<br>should be <b class="c-pink">equal</b>',
  area:   '<b class="c-pink">20</b> × <b class="c-blue">0.5</b> = <b class="c-pink">10</b>',
  time2:  '<b class="c-pink">10</b> ÷ <b class="c-pink">5</b> = <b class="c-orange">2</b>' + u('h'),
  answer: '<b class="c-orange">2</b> × <b class="c-orange">55</b> = <b class="c-orange">110</b>',
};

/* ---------- the steps ---------- */
build();
const bubbles = createBubbles(box, { bounds: () => ({ x: M.l, y: M.t, w: pw, h: ph }) });
let deck = null;

function setDrag(on) {
  R.cap.classList.toggle('on', on);
  R.cap.style.pointerEvents = on ? 'all' : 'none';
  R.h.setAttribute('tabindex', on ? '0' : '-1');
}

deck = createDeck({
  render, bubbles,
  state: {
    ptX: START.x, ptY: START.y, hR: 11, hOp: 0, ring: 0, hov: 0,   // the point
    fOp: 0, xtOp: 1,                                                 // formula, x-axis numbers
    r1Op: 0, r1Lab: 0, gdOp: 0, gxOp: 0,                             // part 1 and its chips
    carOp: 0, carX: .5,                                              // the car
    r2Op: 0, r2Rev: 0, r2LabOp: 0, y55: 0, brkOp: 0,                 // part 2 (r2Rev: how far it has grown)
    avgP: 0, hiOp: 0, eqOp: 0, hlOp: 0,                              // average line, outlines, arrows, "10 mi"
    lab: 0, x25: 0, ans: 0,                                          // "2 h", 2.5 on the axis, "110 mi"
  },
  transient: ['eqOp'],                                               // the arrows belong to the step-6 bubble
  durations: { avgP: 1000, ptX: 900, ptY: 900, hR: 600 },
  delays: { r2LabOp: 350, brkOp: 350, y55: 250 },
  steps: [
    { name: 'The problem', title: 'Problem Description', slide: 'intro', replay: false },

    { name: 'The trip as a road', title: 'Problem Description', slide: 'intro', slideClass: 'play' },

    { name: 'Distance is an area', title: 'Use Area to Represent Distance', slide: 'graph', fresh: true,
      set: { hOp: 1, ring: 1, r1Op: 1, r1Lab: 1, gdOp: 1, gxOp: 1, fOp: 1 },
      enter() { U = { ...START }; setFormula(); setDrag(true); },
      leave() { setDrag(false); } },

    { name: 'Part 1: 0.5 hours', title: "Let's Use Area to Describe the Problem", slide: 'graph', fresh: true,
      start: { ptX: 0, ptY: PART1.y, hR: 5, carX: 0, xtOp: 0 },      // an empty board, the car parked at (0, 0)
      set: { ptX: PART1.x, carX: PART1.x, r1Op: 1, r1Lab: 1, gdOp: 1, gxOp: 1, carOp: 1 },
      async play(s) {
        s.to('r1Op', 1, 0);                                          // a zero-width rectangle draws nothing yet
        s.to('carOp', 1, 350); s.to('gdOp', 1, 400, 200);
        await s.wait(1100);
        s.to('carX', .5, 1500); await s.to('ptX', .5, 1500);         // the car drives and the rectangle grows with it
        s.to('r1Lab', 1, 500, 150);                                  // the distance
        await s.bubble(SAY.time1, () => [px(.5) + 20, py(0) - 12, 'right'], { delay: 300 });   // 15 ÷ 30 = 0.5 h, by the car
        s.to('gxOp', 1, 400);                                        // then 0.5 on the time axis
      } },

    { name: 'Part 2: unknown time', title: "Let's Use Area to Describe the Problem", slide: 'graph',
      set: { r2Op: 1, r2Rev: 2 / 3, r2LabOp: 1, y55: 1, brkOp: 1, carX: 2.5 },   // the car stops where the trip ends (2.5 h, unlabelled)
      async play(s) {
        s.to('y55', 1, 400); s.to('r2Op', 1, 0);
        await s.wait(1000);
        s.to('carX', 2.5, 2000); await s.to('r2Rev', 2 / 3, 2000);
        s.to('r2LabOp', 1, 500); s.to('brkOp', 1, 500, 150);
      } },

    { name: 'The average speed', title: "Let's Use Area to Describe the Problem", slide: 'graph',
      set: { avgP: 1, carOp: 0 } },                                  // the 50 mph line draws itself, the car goes

    { name: 'The two areas must be equal', title: 'Solve the Problem', slide: 'graph',
      set: { hiOp: 1 },
      async play(s) {
        await s.wait(300);
        s.to('hiOp', 1, 600);                                        // bold outlines in the deficit and the surplus
        await s.wait(1100);
        s.bubble(SAY.equal, () => [px(.5) + 36 + bubbles.size(0).w / 2, py(40), 'mid']);
        s.to('eqOp', 1, 450);
      } },

    { name: 'The deficit is 10 miles', title: 'Solve the Problem', slide: 'graph',
      set: { hlOp: 1 },
      async play(s) {
        await s.wait(300);
        s.bubble(SAY.area, () => [px(.5), py(40), 'right']);
        await s.wait(1000);
        s.to('hlOp', 1, 500);                                        // "10 mi" in both outlines
      } },

    { name: 'Part 2 takes 2 hours', title: 'Solve the Problem', slide: 'graph',
      set: { lab: 1, x25: 1 },
      async play(s) {
        await s.wait(300);
        s.bubble(SAY.time2, () => [px(1.5), py(58) + 3, 'above']);  // above "? h"
        await s.wait(1500);
        s.to('lab', 1, 500); s.to('x25', 1, 500);                    // "? h" becomes "2 h", and 2.5 shows on the axis
      } },

    { name: 'The answer: 110 miles', title: 'Solve the Problem', slide: 'graph',
      set: { ans: 1 },
      async play(s) {
        await s.wait(300);
        s.bubble(SAY.answer, () => [px(1.5), py(27) + 16, 'below']);
        await s.wait(1200);
        s.to('ans', 1, 500);                                         // "? mi" becomes "110 mi"
      } },
  ],
});
createNav($('.nav'), deck);

/* ---------- step 3: drag the point (or use the arrow keys) ---------- */
let drag = false;
function setPoint(x, y) {
  if (x === U.x && y === U.y) return;
  U = { x, y };
  deck.tween('ptX', x, 140); deck.tween('ptY', y, 140);
  setFormula();
}
// is the pointer on the point? (a bigger target for fingers than for a mouse)
function onPoint(e) {
  const b = svg.getBoundingClientRect(), r = e.pointerType === 'mouse' ? 28 : 40;
  const dx = e.clientX - b.left - px(deck.S.ptX), dy = e.clientY - b.top - py(deck.S.ptY);
  return dx * dx + dy * dy < r * r;
}
function moveTo(e) {
  const b = svg.getBoundingClientRect();
  const t = (e.clientX - b.left - M.l) / pw * XM, v = (1 - (e.clientY - b.top - M.t) / ph) * YM;
  setPoint(clamp(Math.round(t / .5) * .5, .5, XDRAG), clamp(Math.round(v / 5) * 5, 5, YDRAG));
}
// only the point itself can be picked up: pressing elsewhere on the chart does nothing
R.cap.addEventListener('pointerdown', e => {
  if (deck.index !== EXPLORE || !onPoint(e)) return;
  e.preventDefault(); drag = true; R.cap.classList.add('drag');
  try { R.cap.setPointerCapture(e.pointerId); } catch (_) {}
  deck.tween('hov', 1, 100);
});
R.cap.addEventListener('pointermove', e => {
  if (deck.index !== EXPLORE) return;
  if (drag) { moveTo(e); return; }
  const near = onPoint(e);
  R.cap.classList.toggle('near', near);
  deck.tween('hov', near ? 1 : 0, 140);
});
R.cap.addEventListener('pointerleave', () => { R.cap.classList.remove('near'); if (!drag) deck.tween('hov', 0, 140); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => R.cap.addEventListener(ev, () => { drag = false; R.cap.classList.remove('drag'); }));
R.h.addEventListener('keydown', e => {
  if (deck.index !== EXPLORE) return;
  let { x, y } = U;
  switch (e.key) {
    case 'ArrowLeft': x -= .5; break; case 'ArrowRight': x += .5; break;
    case 'ArrowUp': y += 5; break;    case 'ArrowDown': y -= 5; break;
    default: return;
  }
  e.preventDefault();                                                // keeps the arrow keys from changing step
  setPoint(clamp(x, .5, XDRAG), clamp(y, 5, YDRAG));
});

/* ---------- start ---------- */
setDrag(false);
setFormula();
layout();
onFontsLoaded(() => { [R.cx, R.cy, R.c55, R.c50, R.c25].forEach(remeasureChip); R.avgFs = 0; layout(); });
if (window.ResizeObserver) new ResizeObserver(layout).observe(box); else window.addEventListener('resize', layout);
deck.start();
