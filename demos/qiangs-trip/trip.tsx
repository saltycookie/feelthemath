// Qiang's Trip — migrated to the React MathDemoPlayer framework while preserving all content, style, animation, and wording.

import React, { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  ElementRendererComponent,
  MathDemoPlayer,
  VisualElement,
  clamp,
  easeOut as stdEaseOut,
  lerp,
} from '../../framework';
import { createBubbles } from '../../framework/bubbles.js';
import {
  el,
  text,
  setRect,
  setText,
  setOpacity,
  chip,
  setChip,
  remeasureChip,
  arrowPath,
} from '../../framework/svg.js';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const u = (s: string) => '<u>' + s + '</u>';

function tag(
  name: string,
  attrs: Record<string, any>,
  html: string,
  parent?: HTMLElement
): HTMLElement {
  const n = document.createElement(name);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (html) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}

const XM = 3.5,
  YM = 65;
const XDRAG = 3,
  YDRAG = 55;
const START = { x: 1.5, y: 40 };
const PART1 = { x: 0.5, y: 30 };
const EXPLORE = 2; // 0-based index of step 3

const ROAD_MS = 6450;
const ROAD: Record<string, [number, number]> = {
  show: [0, 500],
  speed1: [200, 450],
  drive1: [800, 1200],
  dist1: [2100, 450],
  speed2: [2600, 450],
  drive2: [3200, 2000],
  dist2: [5300, 450],
  whole: [6000, 450],
};

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, uVal: number) =>
    3 * a * uVal * (1 - uVal) ** 2 + 3 * b * uVal * uVal * (1 - uVal) + uVal ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const roadEaseOut = bezier(0, 0, 0.58, 1);
const driving = bezier(0.5, 0, 0.3, 1);

const SAY = {
  none: '',
  time1:
    '<b class="c-blue">15</b>' +
    u('mi') +
    ' ÷ <b class="c-blue">30</b>' +
    u('mph') +
    ' = <b class="c-blue">0.5</b>' +
    u('h'),
  equal: 'The two areas<br>should be <b class="c-pink">equal</b>',
  area: '<b class="c-pink">20</b> × <b class="c-blue">0.5</b> = <b class="c-pink">10</b>',
  time2:
    '<b class="c-pink">10</b> ÷ <b class="c-pink">5</b> = <b class="c-orange">2</b>' +
    u('h'),
  answer:
    '<b class="c-orange">2</b> × <b class="c-orange">55</b> = <b class="c-orange">110</b>',
};

export type BubbleKey = keyof typeof SAY;

export interface TripState {
  stepIdx: number;
  view: number;
  road: number;
  ptX: number;
  ptY: number;
  uX: number;
  uY: number;
  dragOn: boolean;
  hR: number;
  hOp: number;
  ring: number;
  hov: number;
  fOp: number;
  xtOp: number;
  r1Op: number;
  r1Lab: number;
  gdOp: number;
  gxOp: number;
  carOp: number;
  carX: number;
  r2Op: number;
  r2Rev: number;
  r2LabOp: number;
  y55: number;
  brkOp: number;
  avgP: number;
  hiOp: number;
  eqOp: number;
  hlOp: number;
  lab: number;
  x25: number;
  ans: number;
  bubbleKey: BubbleKey;
  bubble0: number;
}

const BASE_STATE: TripState = {
  stepIdx: 0,
  view: 0,
  road: 0,
  ptX: START.x,
  ptY: START.y,
  uX: START.x,
  uY: START.y,
  dragOn: false,
  hR: 11,
  hOp: 0,
  ring: 0,
  hov: 0,
  fOp: 0,
  xtOp: 1,
  r1Op: 0,
  r1Lab: 0,
  gdOp: 0,
  gxOp: 0,
  carOp: 0,
  carX: 0.5,
  r2Op: 0,
  r2Rev: 0,
  r2LabOp: 0,
  y55: 0,
  brkOp: 0,
  avgP: 0,
  hiOp: 0,
  eqOp: 0,
  hlOp: 0,
  lab: 0,
  x25: 0,
  ans: 0,
  bubbleKey: 'none',
  bubble0: 0,
};

const TripSceneRenderer: ElementRendererComponent<TripState> = ({
  element,
  updateState,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TripState>(element.state);
  stateRef.current = element.state;
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;
  const renderFnRef = useRef<((s: TripState) => void) | null>(null);
  const tweenRafRef = useRef<number>(0);

  useLayoutEffect(() => {
    const stage = hostRef.current;
    if (!stage) return;
    stage.innerHTML = '';

    const M = { l: 68, r: 20, t: 8, b: 64 };
    let W = 0,
      H = 0,
      pw = 0,
      ph = 0;
    const px = (t: number) => M.l + (t / XM) * pw;
    const py = (v: number) => M.t + (1 - v / YM) * ph;

    const intro = tag('div', { class: 'layer intro' }, '', stage);
    tag(
      'p',
      { class: 'problem' },
      'Qiang drives <b class="c-blue">15 miles</b> at an average speed of ' +
        '<b class="c-blue">30 miles per hour</b>. How many additional miles will he have to drive at ' +
        '<b class="c-orange">55 miles per hour</b> to average <b class="c-ink">50 miles per hour</b> for the entire trip?',
      intro
    );
    const road = el(
      'svg',
      {
        class: 'road',
        viewBox: '0 0 800 244',
        role: 'img',
        'aria-label':
          'A road in two parts: 15 miles at 30 mph, then an unknown distance at 55 mph, with an overall average of 50 mph',
      },
      intro
    ) as unknown as SVGSVGElement;

    const box = tag('div', { class: 'layer' }, '', stage);
    const svg = el(
      'svg',
      {
        id: 'chart',
        role: 'img',
        'aria-label': 'Average speed in mph against time in hours',
      },
      box
    ) as unknown as SVGSVGElement;
    const F = tag('div', { class: 'formula', 'aria-live': 'polite' }, '', box);

    const gradB = el(
      'linearGradient',
      {
        id: 'gRoadB',
        gradientUnits: 'userSpaceOnUse',
        x1: 290,
        y1: 0,
        x2: 760,
        y2: 0,
      },
      el('defs', {}, road)
    );
    el('stop', { offset: 0, style: 'stop-color:var(--orange)' }, gradB);
    el(
      'stop',
      { offset: 1, style: 'stop-color:var(--orange);stop-opacity:.22' },
      gradB
    );
    el(
      'line',
      { class: 'rline road-base', x1: 40, y1: 110, x2: 760, y2: 110 },
      road
    );
    const part1 = el(
      'line',
      {
        class: 'rline drawn',
        pathLength: 1,
        x1: 40,
        y1: 110,
        x2: 290,
        y2: 110,
        style: 'stroke:var(--blue)',
      },
      road
    ) as unknown as SVGLineElement;
    const part2 = el(
      'line',
      {
        class: 'rline drawn',
        pathLength: 1,
        x1: 290,
        y1: 110,
        x2: 760,
        y2: 110,
        stroke: 'url(#gRoadB)',
      },
      road
    ) as unknown as SVGLineElement;
    const car = el('g', {}, road);
    const carBody = el('g', { transform: 'translate(40 99)' }, car);
    el(
      'rect',
      { class: 'car-body', x: -27, y: -24, width: 54, height: 16, rx: 5 },
      carBody
    );
    el('path', { class: 'car-body', d: 'M-15 -23 L-8 -37 H12 L21 -23 Z' }, carBody);
    el('circle', { class: 'car-wheel', cx: -14, cy: -8, r: 6.5 }, carBody);
    el('circle', { class: 'car-wheel', cx: 14, cy: -8, r: 6.5 }, carBody);

    function roadLabel(cls: string, x: number, y: number, str: string) {
      const g = el('g', {}, road);
      el('text', { class: 'rt ' + cls, x, y }, g).textContent = str;
      return g;
    }
    const LABELS: Record<string, Element> = {
      dist1: roadLabel('big c-blue', 165, 48, '15 mi'),
      speed1: roadLabel('sm c-blue', 165, 158, '30 mph'),
      dist2: roadLabel('big c-orange', 525, 48, '? mi'),
      speed2: roadLabel('sm c-orange', 525, 158, '55 mph'),
      whole: roadLabel('sm c-ink', 400, 236, '50 mph average'),
    };
    LABELS.whole.prepend(
      el('path', { class: 'brace', d: 'M40 184 v12 H760 v-12' })
    );

    const lineLen = (n: SVGLineElement) =>
      n.x2.baseVal.value - n.x1.baseVal.value;

    function drawRoad(r: number) {
      const at = (key: string) =>
        clamp((r * ROAD_MS - ROAD[key][0]) / ROAD[key][1], 0, 1);
      road.style.opacity = String(roadEaseOut(at('show')));
      const d1 = driving(at('drive1')),
        d2 = driving(at('drive2'));
      part1.setAttribute('stroke-dashoffset', String(1 - d1));
      part2.setAttribute('stroke-dashoffset', String(1 - d2));
      car.setAttribute(
        'transform',
        'translate(' + (d1 * lineLen(part1) + d2 * lineLen(part2)) + ' 0)'
      );
      for (const key in LABELS) {
        const p = roadEaseOut(at(key));
        setOpacity(LABELS[key], p);
        LABELS[key].setAttribute('transform', 'translate(0 ' + 8 * (1 - p) + ')');
      }
    }

    function showLayer(n: HTMLElement, op: number) {
      n.style.opacity = String(clamp(op, 0, 1));
      n.style.visibility = op > 0 ? '' : 'hidden';
    }

    const R: Record<string, any> = {};
    R.plot = el('rect', { class: 'plot' }, svg);
    R.grid = el('g', {}, svg);
    R.xtg = el('g', {}, svg);
    R.r1 = el('rect', { class: 'rc r1', opacity: 0 }, svg);
    R.r2 = el('rect', { class: 'rc r2', opacity: 0 }, svg);
    R.avg = el('line', { class: 'avg', opacity: 0 }, svg);
    R.brk = el('polyline', { class: 'brk', opacity: 0 }, svg);
    R.hiD = el('rect', { class: 'hi', opacity: 0 }, svg);
    R.hiS = el('rect', { class: 'hi', opacity: 0 }, svg);
    R.eqA = el('path', { class: 'eqa', opacity: 0 }, svg);
    R.eqB = el('path', { class: 'eqa', opacity: 0 }, svg);

    R.l1 = text(svg, 'tx c-ink');
    R.l2q = text(svg, 'tx c-ink', '? mi');
    R.l2f = text(svg, 'tx c-ink', '110 mi');
    R.hl1 = text(svg, 'tx c-ink');
    R.hl1a = el('tspan', {}, R.hl1);
    R.hl1a.textContent = '10';
    R.hl1b = el('tspan', {}, R.hl1);
    R.hl1b.textContent = ' mi';
    R.hl2 = text(svg, 'tx c-ink', '10 mi');
    R.avgT = text(svg, 'tx c-ink halo');
    R.avgT.style.textAnchor = 'start';
    R.avgTa = el('tspan', {}, R.avgT);
    R.avgTa.textContent = 'average';
    R.avgTb = el('tspan', {}, R.avgT);
    R.avgTb.textContent = ' speed';
    R.bq = text(svg, 'tx c-ink', '? h');
    R.bf = text(svg, 'tx c-ink', '2 h');
    R.bq.style.fontSize = '18px';
    R.bf.style.fontSize = '18px';
    R.xt = text(svg, 'atitle', 'time (hours)');
    R.xt.style.textAnchor = 'middle';
    R.yt = text(svg, 'atitle', 'average speed (mph)');
    R.yt.style.textAnchor = 'middle';

    R.cx = chip(svg, 'blue');
    R.c25 = chip(svg, 'orange');
    R.cy = chip(svg, 'blue');
    R.c55 = chip(svg, 'orange');
    R.c50 = chip(svg, 'ink');

    R.car = el('g', { opacity: 0 }, svg);
    el(
      'rect',
      { class: 'tcb', x: -15, y: -14, width: 30, height: 8, rx: 3 },
      R.car
    );
    el('path', { class: 'tcb', d: 'M-7 -14 L-3.5 -21 H5 L9.5 -14 Z' }, R.car);
    el('circle', { class: 'tcw', cx: -7.5, cy: -4, r: 4 }, R.car);
    el('circle', { class: 'tcw', cx: 8, cy: -4, r: 4 }, R.car);

    R.h = el(
      'g',
      {
        class: 'handle',
        tabindex: -1,
        role: 'slider',
        'aria-label': 'Point: speed and time. Arrow keys move it.',
      },
      svg
    );
    R.hring = el('circle', { class: 'hring', r: 20 }, R.h);
    R.hfocus = el('circle', { class: 'hfocus', r: 18 }, R.h);
    R.hcore = el('circle', { class: 'hcore', r: 11 }, R.h);
    R.hicon = el(
      'path',
      {
        class: 'hicon',
        d: 'M-5 0H5M0-5V5M-2-3L0-5L2-3M-2 3L0 5L2 3M-3-2L-5 0L-3 2M3-2L5 0L3 2',
      },
      R.h
    );
    R.cap = el('rect', { class: 'cap-hit' }, svg);

    const bubbles = createBubbles(box, {
      bounds: () => ({ x: M.l, y: M.t, w: pw, h: ph }),
    });
    let currentBubbleKey: BubbleKey = 'none';

    const FS = { w: 0, h: 0 };
    let lastUx = -1,
      lastUy = -1;

    function measureOverlays() {
      if (!pw) return;
      F.style.maxWidth = pw - 16 + 'px';
      FS.w = F.offsetWidth;
      FS.h = F.offsetHeight;
      bubbles.measure();
    }

    function syncFormula(uX: number, uY: number) {
      if (uX === lastUx && uY === lastUy) return;
      lastUx = uX;
      lastUy = uY;
      F.innerHTML =
        '<span class="w">distance = speed × time =</span> <span><b class="c-blue">' +
        fmt(uY) +
        '</b>' +
        u('mph') +
        '</span> × <span><b class="c-blue">' +
        fmt(uX) +
        '</b>' +
        u('h') +
        '</span> = <span><b class="c-blue z">' +
        fmt(uX * uY) +
        '</b>' +
        u('mi') +
        '</span>';
      measureOverlays();
      R.h.setAttribute(
        'aria-valuetext',
        uY + ' mph, ' + uX + ' hours, ' + fmt(uX * uY) + ' miles'
      );
    }

    function syncBubble(key: BubbleKey) {
      if (key === currentBubbleKey) return;
      currentBubbleKey = key;
      if (key === 'time1') {
        bubbles.set(0, SAY.time1, () => [px(0.5) + 20, py(0) - 12, 'right']);
      } else if (key === 'equal') {
        bubbles.set(0, SAY.equal, () => [
          px(0.5) + 36 + bubbles.size(0).w / 2,
          py(40),
          'mid',
        ]);
      } else if (key === 'area') {
        bubbles.set(0, SAY.area, () => [px(0.5), py(40), 'right']);
      } else if (key === 'time2') {
        bubbles.set(0, SAY.time2, () => [px(1.5), py(58) + 3, 'above']);
      } else if (key === 'answer') {
        bubbles.set(0, SAY.answer, () => [px(1.5), py(27) + 16, 'below']);
      }
    }

    function placeEqualArrows(S: TripState) {
      const r = bubbles.rect(0);
      const on = S.eqOp > 0.001 && S.bubble0 > 0.001 && r;
      setOpacity(R.eqA, on ? S.eqOp : 0);
      setOpacity(R.eqB, on ? S.eqOp : 0);
      if (!on || !r) return;
      const [bl, bt, bw, bh] = r;
      const x0 = px(0),
        a = px(0.5);
      const tx = Math.max(x0 + 14, Math.min((x0 + a) / 2, a - 30));
      R.eqA.setAttribute('d', arrowPath(bl, bt + bh / 2, tx, bt + bh / 2));
      const ux = clamp(a + (px(XM) - a) * 0.12, bl + 16, bl + bw - 16);
      R.eqB.setAttribute('d', arrowPath(ux, bt, ux, (py(55) + py(50)) / 2));
    }

    function render(S: TripState) {
      showLayer(intro, 1 - 2 * S.view);
      showLayer(box, 2 * S.view - 1);
      drawRoad(S.road);

      if (!pw) return;

      R.cap.classList.toggle('on', S.dragOn);
      R.cap.style.pointerEvents = S.dragOn ? 'all' : 'none';
      R.h.setAttribute('tabindex', S.dragOn ? '0' : '-1');

      syncFormula(S.uX, S.uY);
      syncBubble(S.bubbleKey);

      const x0 = px(0),
        y0 = py(0);
      const P = S.stepIdx === EXPLORE ? { x: S.uX, y: S.uY } : PART1;

      const rx = px(S.ptX),
        ry = py(S.ptY),
        w1 = rx - x0,
        h1 = y0 - ry;
      setRect(R.r1, x0, ry, w1, h1, S.r1Op);
      const small = w1 < 62;
      R.l1.style.fontSize = (small ? 13 : 17) + 'px';
      setText(
        R.l1,
        x0 + w1 / 2,
        ry + h1 / 2 + 5,
        S.r1Op * S.r1Lab,
        fmt(Math.round(S.ptX * S.ptY * 10) / 10) + ' mi'
      );

      const yTxt = fmt(P.y),
        yW = 14 + 8 * yTxt.length;
      setChip(R.cx, rx, y0 + 17, fmt(P.x), S.gxOp * S.r1Op);
      setChip(R.c25, px(2.5), y0 + 17, '2.5', S.x25);
      setOpacity(R.xtg, S.xtOp);
      setChip(R.cy, M.l - 4 - yW / 2, ry, yTxt, S.gdOp * S.r1Op, yW);
      setChip(R.c55, M.l - 19, py(55), '55', S.y55, 30);
      setChip(R.c50, M.l - 19, py(50), '50', clamp(S.avgP * 3, 0, 1), 30);

      R.h.setAttribute('transform', 'translate(' + rx + ' ' + ry + ')');
      setOpacity(R.h, S.hOp);
      const hr = S.hR + 2.5 * S.hov;
      R.hcore.setAttribute('r', String(hr));
      R.hfocus.setAttribute('r', String(hr + 6));
      R.hring.setAttribute('r', String(hr + 8));
      R.hring.style.display = S.ring > 0.05 ? '' : 'none';
      setOpacity(R.hicon, (S.hR - 6) / 5);

      const a = px(0.5),
        b = px(XM),
        t55 = py(55),
        t50 = py(50);
      const bx = a + (b - a) * S.r2Rev;
      setRect(R.r2, a, t55, bx - a, y0 - t55, S.r2Op);
      const big = pw >= 420 ? 26 : 20;
      R.l2q.style.fontSize = big + 'px';
      R.l2f.style.fontSize = big + 'px';
      setText(R.l2q, px(1.5), py(27) + 4, S.r2LabOp * (1 - S.ans));
      setText(R.l2f, px(1.5), py(27) + 4, S.r2LabOp * S.ans);

      const by = py(58);
      R.brk.setAttribute(
        'points',
        a +
          ',' +
          (by - 5) +
          ' ' +
          a +
          ',' +
          (by + 5) +
          ' ' +
          a +
          ',' +
          by +
          ' ' +
          bx +
          ',' +
          by +
          ' ' +
          bx +
          ',' +
          (by - 5) +
          ' ' +
          bx +
          ',' +
          (by + 5)
      );
      setOpacity(R.brk, S.brkOp);
      setText(R.bq, px(1.5), by + 20, S.brkOp * (1 - S.lab));
      setText(R.bf, px(1.5), by + 20, S.brkOp * S.lab);

      const ay = py(50);
      R.avg.setAttribute('x1', String(x0));
      R.avg.setAttribute('x2', String(x0 + S.avgP * (bx - x0)));
      R.avg.setAttribute('y1', String(ay));
      R.avg.setAttribute('y2', String(ay));
      setOpacity(R.avg, S.avgP * 5);
      const afs = pw < 470 ? 15 : 17,
        ax = bx + 10;
      R.avgT.style.fontSize = afs + 'px';
      if (R.avgFs !== afs) {
        R.avgTb.removeAttribute('x');
        R.avgTb.removeAttribute('dy');
        R.avgTb.textContent = ' speed';
        R.avgW = R.avgT.getComputedTextLength() || afs * 6.2;
        R.avgFs = afs;
      }
      if (M.l + pw - 4 - ax < R.avgW) {
        R.avgTb.setAttribute('x', String(ax));
        R.avgTb.setAttribute('dy', String(afs * 1.1));
        R.avgTb.textContent = 'speed';
        setText(
          R.avgT,
          ax,
          ay + afs * 0.33 - afs * 0.55,
          (S.avgP - 0.75) * 4
        );
      } else {
        R.avgTb.removeAttribute('x');
        R.avgTb.removeAttribute('dy');
        R.avgTb.textContent = ' speed';
        setText(R.avgT, ax, ay + afs * 0.33, (S.avgP - 0.75) * 4);
      }

      const dT = py(50),
        dB = py(30),
        dW = px(0.5) - x0,
        dcx = x0 + dW / 2;
      const ins = Math.min(7, dW / 5);
      setRect(
        R.hiD,
        x0 + ins,
        dT + ins,
        dW - 2 * ins,
        dB - dT - 2 * ins,
        S.hiOp
      );
      setRect(
        R.hiS,
        a + ins,
        t55 + ins,
        bx - a - 2 * ins,
        t50 - t55 - 2 * ins,
        S.hiOp
      );
      const hlo = S.hlOp * S.hiOp,
        narrowH = dW - 2 * ins < 60,
        hfs = (pw < 420 ? 14 : 17) + 'px';
      R.hl1.style.fontSize = hfs;
      R.hl2.style.fontSize = hfs;
      setText(R.hl1, dcx, (dT + dB) / 2 + (narrowH ? -3 : 5), hlo);
      if (narrowH) {
        R.hl1b.setAttribute('x', String(dcx));
        R.hl1b.setAttribute('dy', '15');
        R.hl1b.textContent = 'mi';
      } else {
        R.hl1b.removeAttribute('x');
        R.hl1b.removeAttribute('dy');
        R.hl1b.textContent = ' mi';
      }
      setText(R.hl2, (a + ins + (bx - ins)) / 2, (t55 + t50) / 2 + 5, hlo);

      R.car.setAttribute(
        'transform',
        'translate(' + px(S.carX) + ' ' + y0 + ') scale(1.2)'
      );
      setOpacity(R.car, S.carOp);

      const fx = clamp((x0 + rx) / 2 - FS.w / 2, M.l + 4, M.l + pw - 4 - FS.w);
      let fy = ry - 32 - FS.h;
      if (fy < M.t + 4) fy = ry + 36;
      F.style.transform = 'translate(' + fx + 'px,' + fy + 'px)';
      F.style.opacity = String(clamp(S.fOp, 0, 1));

      bubbles.place(S);
      placeEqualArrows(S);
    }

    function layout() {
      const r = box.getBoundingClientRect();
      W = Math.max(280, Math.floor(r.width));
      H = Math.max(240, Math.floor(r.height));
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(H));
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const narrow = W < 520;
      M.l = narrow ? 60 : 68;
      M.r = narrow ? 14 : 20;
      M.b = narrow ? 58 : 64;
      pw = W - M.l - M.r;
      ph = H - M.t - M.b;
      setRect(R.plot, M.l, M.t, pw, ph);
      measureOverlays();
      R.grid.textContent = '';
      R.xtg.textContent = '';
      for (let v = 0; v <= YM; v += 5) {
        el(
          'line',
          {
            class: 'gl' + (v % 10 === 0 ? ' major' : ''),
            x1: M.l,
            x2: M.l + pw,
            y1: py(v),
            y2: py(v),
          },
          R.grid
        );
        const t = el(
          'text',
          { class: 'tick', x: M.l - 15, y: py(v) + 4, 'text-anchor': 'end' },
          R.grid
        );
        if (v < YM) t.textContent = String(v);
      }
      for (let t = 0.5; t <= XM + 1e-9; t += 0.5) {
        el(
          'line',
          { class: 'gl', x1: px(t), x2: px(t), y1: M.t, y2: M.t + ph },
          R.grid
        );
        const x = el(
          'text',
          {
            class: 'tick',
            x: px(t),
            y: py(0) + 19,
            'text-anchor': 'middle',
          },
          R.xtg
        );
        if (t < XM - 1e-9) x.textContent = fmt(t);
      }
      el(
        'line',
        { class: 'axis', x1: M.l, x2: M.l, y1: M.t, y2: M.t + ph },
        R.grid
      );
      el(
        'line',
        { class: 'axis', x1: M.l, x2: M.l + pw, y1: M.t + ph, y2: M.t + ph },
        R.grid
      );
      R.xt.setAttribute('x', String(M.l + pw / 2));
      R.xt.setAttribute('y', String(H - 10));
      R.xt.style.fontSize = (narrow ? 18 : 21) + 'px';
      const yx = narrow ? 15 : 18,
        yy = M.t + ph / 2;
      R.yt.setAttribute('x', String(yx));
      R.yt.setAttribute('y', String(yy));
      R.yt.setAttribute('transform', 'rotate(-90 ' + yx + ' ' + yy + ')');
      R.yt.style.fontSize = (narrow ? 18 : 21) + 'px';
      setRect(R.cap, M.l, M.t, pw, ph);
      render(stateRef.current);
    }

    // Interactive dragging and arrow keys on step 3
    let drag = false;
    function animatePointTo(x: number, y: number) {
      const cur = stateRef.current;
      if (x === cur.uX && y === cur.uY) return;
      window.cancelAnimationFrame(tweenRafRef.current);
      const fromX = cur.ptX,
        fromY = cur.ptY;
      const t0 = performance.now();
      const dur = 140;
      updateStateRef.current({ uX: x, uY: y });
      const tick = (now: number) => {
        const uVal = Math.min(1, (now - t0) / dur);
        const eased = uVal >= 1 ? 1 : stdEaseOut(uVal);
        updateStateRef.current({
          ptX: lerp(fromX, x, eased),
          ptY: lerp(fromY, y, eased),
          uX: x,
          uY: y,
        });
        if (uVal < 1) {
          tweenRafRef.current = window.requestAnimationFrame(tick);
        }
      };
      tweenRafRef.current = window.requestAnimationFrame(tick);
    }

    function onPoint(e: PointerEvent) {
      const b = svg.getBoundingClientRect(),
        r = e.pointerType === 'mouse' ? 28 : 40;
      const dx = e.clientX - b.left - px(stateRef.current.ptX),
        dy = e.clientY - b.top - py(stateRef.current.ptY);
      return dx * dx + dy * dy < r * r;
    }

    function moveTo(e: PointerEvent) {
      const b = svg.getBoundingClientRect();
      const t = ((e.clientX - b.left - M.l) / pw) * XM,
        v = (1 - (e.clientY - b.top - M.t) / ph) * YM;
      animatePointTo(
        clamp(Math.round(t / 0.5) * 0.5, 0.5, XDRAG),
        clamp(Math.round(v / 5) * 5, 5, YDRAG)
      );
    }

    R.cap.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!stateRef.current.dragOn || !onPoint(e)) return;
      e.preventDefault();
      drag = true;
      R.cap.classList.add('drag');
      try {
        R.cap.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateStateRef.current({ hov: 1 });
    });

    R.cap.addEventListener('pointermove', (e: PointerEvent) => {
      if (!stateRef.current.dragOn) return;
      if (drag) {
        moveTo(e);
        return;
      }
      const near = onPoint(e);
      R.cap.classList.toggle('near', near);
      if ((stateRef.current.hov > 0.5) !== near) {
        updateStateRef.current({ hov: near ? 1 : 0 });
      }
    });

    R.cap.addEventListener('pointerleave', () => {
      R.cap.classList.remove('near');
      if (!drag && stateRef.current.hov !== 0) {
        updateStateRef.current({ hov: 0 });
      }
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) =>
      R.cap.addEventListener(ev, () => {
        drag = false;
        R.cap.classList.remove('drag');
      })
    );

    R.h.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!stateRef.current.dragOn) return;
      let x = stateRef.current.uX,
        y = stateRef.current.uY;
      switch (e.key) {
        case 'ArrowLeft':
          x -= 0.5;
          break;
        case 'ArrowRight':
          x += 0.5;
          break;
        case 'ArrowUp':
          y += 5;
          break;
        case 'ArrowDown':
          y -= 5;
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
      animatePointTo(clamp(x, 0.5, XDRAG), clamp(y, 5, YDRAG));
    });

    renderFnRef.current = render;
    layout();
    document.fonts?.ready?.then(() => {
      [R.cx, R.cy, R.c55, R.c50, R.c25].forEach(remeasureChip);
      R.avgFs = 0;
      layout();
    });
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    return () => {
      window.cancelAnimationFrame(tweenRafRef.current);
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    renderFnRef.current?.(element.state);
  }, [element.state]);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: '100%',
      }}
    />
  );
};

function makeTripElement(patch: Partial<TripState>): VisualElement<TripState> {
  return {
    id: 'trip-scene',
    type: 'trip-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

const STEP4_START: Partial<TripState> = {
  view: 1,
  ptX: 0,
  ptY: PART1.y,
  hR: 5,
  carX: 0,
  xtOp: 0,
  dragOn: false,
};

const STEP4_DONE: Partial<TripState> = {
  ...STEP4_START,
  ptX: PART1.x,
  carX: PART1.x,
  r1Op: 1,
  r1Lab: 1,
  gdOp: 1,
  gxOp: 1,
  carOp: 1,
  bubbleKey: 'none',
  bubble0: 0,
};

const STEP5_DONE: Partial<TripState> = {
  ...STEP4_DONE,
  r2Op: 1,
  r2Rev: 2 / 3,
  r2LabOp: 1,
  y55: 1,
  brkOp: 1,
  carX: 2.5,
};

const STEP6_DONE: Partial<TripState> = {
  ...STEP5_DONE,
  avgP: 1,
  carOp: 0,
};

const STEP7_DONE: Partial<TripState> = {
  ...STEP6_DONE,
  hiOp: 1,
  eqOp: 0,
  bubbleKey: 'none',
  bubble0: 0,
};

const STEP8_DONE: Partial<TripState> = {
  ...STEP7_DONE,
  hlOp: 1,
};

const STEP9_DONE: Partial<TripState> = {
  ...STEP8_DONE,
  lab: 1,
  x25: 1,
};

export const qiangsTripDemo: DemoConfig = {
  id: 'qiangs-trip',
  name: "Qiang's Trip",
  renderers: {
    'trip-scene': TripSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeTripElement({ stepIdx: 0 })],
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'The trip as a road',
      initialElements: [makeTripElement({ stepIdx: 1, view: 0, road: 0 })],
      async play(c) {
        await c.animateElement(
          'trip-scene',
          { state: { road: 1 } },
          { durationMs: ROAD_MS, easing: 'linear' }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { view: 1 } },
          { durationMs: 1100 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'Use Area to Represent Distance',
      summary: 'Distance is an area',
      initialElements: [
        makeTripElement({
          stepIdx: 2,
          view: 1,
          road: 1,
          ptX: START.x,
          ptY: START.y,
          uX: START.x,
          uY: START.y,
          dragOn: true,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'trip-scene',
          {
            state: {
              hOp: 1,
              ring: 1,
              r1Op: 1,
              r1Lab: 1,
              gdOp: 1,
              gxOp: 1,
              fOp: 1,
            },
          },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        controller.updateElementImmediate('trip-scene', {
          state: { dragOn: false },
        });
        await controller.animateElement(
          'trip-scene',
          {
            state: {
              hOp: 0,
              ring: 0,
              r1Op: 0,
              r1Lab: 0,
              gdOp: 0,
              gxOp: 0,
              fOp: 0,
              xtOp: 0,
            },
          },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 4,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 1: 0.5 hours',
      initialElements: [
        makeTripElement({
          ...STEP4_START,
          stepIdx: 3,
        }),
      ],
      async play(c) {
        c.updateElementImmediate('trip-scene', { state: { r1Op: 1 } });
        c.animateElement(
          'trip-scene',
          { state: { carOp: 1 } },
          { durationMs: 350 }
        ).catch(() => {});
        await c.wait(200);
        c.animateElement(
          'trip-scene',
          { state: { gdOp: 1 } },
          { durationMs: 400 }
        ).catch(() => {});
        await c.wait(900);
        await c.animateElement(
          'trip-scene',
          { state: { carX: 0.5, ptX: 0.5 } },
          { durationMs: 1500 }
        );
        await c.wait(150);
        c.animateElement(
          'trip-scene',
          { state: { r1Lab: 1 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.wait(150);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'time1' },
        });
        await c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        );
        await c.animateElement(
          'trip-scene',
          { state: { gxOp: 1 } },
          { durationMs: 400 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 5,
      title: "Let's Use Area to Describe the Problem",
      summary: 'Part 2: unknown time',
      initialElements: [
        makeTripElement({
          ...STEP4_DONE,
          stepIdx: 4,
        }),
      ],
      async play(c) {
        c.updateElementImmediate('trip-scene', { state: { r2Op: 1 } });
        c.animateElement(
          'trip-scene',
          { state: { y55: 1 } },
          { durationMs: 400 }
        ).catch(() => {});
        await c.wait(1000);
        await c.animateElement(
          'trip-scene',
          { state: { carX: 2.5, r2Rev: 2 / 3 } },
          { durationMs: 2000 }
        );
        c.animateElement(
          'trip-scene',
          { state: { r2LabOp: 1 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.wait(150);
        await c.animateElement(
          'trip-scene',
          { state: { brkOp: 1 } },
          { durationMs: 500 }
        );
      },
    },
    {
      stepNumber: 6,
      title: "Let's Use Area to Describe the Problem",
      summary: 'The average speed',
      initialElements: [
        makeTripElement({
          ...STEP5_DONE,
          stepIdx: 5,
        }),
      ],
      async play(c) {
        c.animateElement(
          'trip-scene',
          { state: { carOp: 0 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.animateElement(
          'trip-scene',
          { state: { avgP: 1 } },
          { durationMs: 1000 }
        );
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Problem',
      summary: 'The two areas must be equal',
      initialElements: [
        makeTripElement({
          ...STEP6_DONE,
          stepIdx: 6,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.animateElement(
          'trip-scene',
          { state: { hiOp: 1 } },
          { durationMs: 600 }
        ).catch(() => {});
        await c.wait(1100);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'equal' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.animateElement(
          'trip-scene',
          { state: { eqOp: 1 } },
          { durationMs: 450 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0, eqOp: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 8,
      title: 'Solve the Problem',
      summary: 'The deficit is 10 miles',
      initialElements: [
        makeTripElement({
          ...STEP7_DONE,
          stepIdx: 7,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'area' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1000);
        await c.animateElement(
          'trip-scene',
          { state: { hlOp: 1 } },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 9,
      title: 'Solve the Problem',
      summary: 'Part 2 takes 2 hours',
      initialElements: [
        makeTripElement({
          ...STEP8_DONE,
          stepIdx: 8,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'time2' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1500);
        await c.animateElement(
          'trip-scene',
          { state: { lab: 1, x25: 1 } },
          { durationMs: 500 }
        );
      },
      async exit({ controller }) {
        await controller.animateElement(
          'trip-scene',
          { state: { bubble0: 0 } },
          { durationMs: 220 }
        );
      },
    },
    {
      stepNumber: 10,
      title: 'Solve the Problem',
      summary: 'The answer: 110 miles',
      initialElements: [
        makeTripElement({
          ...STEP9_DONE,
          stepIdx: 9,
        }),
      ],
      async play(c) {
        await c.wait(300);
        c.updateElementImmediate('trip-scene', {
          state: { bubbleKey: 'answer' },
        });
        c.animateElement(
          'trip-scene',
          { state: { bubble0: 1 } },
          { durationMs: 260 }
        ).catch(() => {});
        await c.wait(1200);
        await c.animateElement(
          'trip-scene',
          { state: { ans: 1 } },
          { durationMs: 500 }
        );
      },
    },
  ],
};

const container = document.getElementById('deck');
if (container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={qiangsTripDemo} />);
  });
}
