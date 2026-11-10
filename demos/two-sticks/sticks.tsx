// Two Perpendicular Sticks — migrated to the React MathDemoPlayer framework while preserving all content, style, animation, and wording.

import React, { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  ElementRendererComponent,
  MathDemoPlayer,
  StepAnimationController,
  VisualElement,
} from '../../framework';

/* ================= the setup (lengths in cm) ================= */
const U = 40; // SVG units per centimetre
const SQ2 = Math.SQRT2;
const XL = 10 / SQ2; // AC = BD = x: picked so the thin sticks add up to exactly 10 cm
const YL = 2.0; // AO = BO = y
const ZL = XL - YL; // OC = OD = x − y
const FIGX = 8.7;
const TM = 0.13,
  TT = 0.05; // half thickness of the main sticks and the thin sticks
const TXT_TOP = 0.45; // where the question sits at the top of the mat
const PAUSE = 600;

const BASE = {
  draw: 0,
  marks: 0,
  lift: 1,
  away: 1,
  wood: 1,
  bdOut: 1,
  bdIn: 1,
  pick: 1,
  xdim: 0,
  ylbl: 1,
  zlbl: 1,
  bdl: 1,
  cross: 1,
  sq: 0,
  thinAB: 0,
  t1l: 0,
  thinCD: 0,
  t2l: 0,
  lay: 0,
  eqn: 0,
  fade: 0,
  gather: 0,
  prompt: 0,
  prob: 0,
};
type BaseKey = keyof typeof BASE;
const KEYS = Object.keys(BASE) as BaseKey[];

const PIC: typeof BASE = {
  ...BASE,
  draw: 1,
  marks: 1,
  lift: 0,
  away: 0,
  wood: 0,
  bdOut: 0,
  bdIn: 0,
  pick: 0,
  ylbl: 0,
  zlbl: 0,
  bdl: 0,
  prob: 1,
};

const T: Record<string | number, typeof BASE> = {
  1: { ...PIC },
  2: { ...PIC, prompt: 1, marks: 0, draw: 0, wood: 1, lift: 1 },
  3: { ...BASE, bdIn: 0, cross: 0, xdim: 1, bdl: 0 },
  4: { ...BASE, cross: 0, xdim: 1 },
  across: { ...BASE, sq: 1 },
  5: { ...BASE, sq: 1, thinAB: 1, t1l: 1, thinCD: 1, t2l: 1 },
  6: {
    ...BASE,
    sq: 1,
    thinAB: 1,
    t1l: 1,
    thinCD: 1,
    t2l: 1,
    lay: 1,
    eqn: 1,
  },
  7: {
    ...BASE,
    sq: 1,
    thinAB: 1,
    t1l: 1,
    thinCD: 1,
    t2l: 1,
    lay: 1,
    eqn: 1,
    fade: 1,
    gather: 1,
  },
};

const CHOREO: Record<string | number, Partial<Record<BaseKey, [number, number]>>> = {
  2: {
    prompt: [0, 700],
    marks: [1300, 600],
    draw: [1400, 800],
    wood: [1400, 1500],
    lift: [1400, 1200],
  },
  3: {
    prompt: [0, 700],
    prob: [0, 700],
    away: [500, 3200],
    bdOut: [3300, 1280],
    cross: [4600, 900],
    xdim: [5600, 600],
    pick: [6300, 1500],
    ylbl: [7900, 600],
    zlbl: [8700, 600],
  },
  4: { bdIn: [300, 1280], bdl: [1700, 2800] },
  across: { xdim: [0, 350], cross: [200, 1500], sq: [1550, 400] },
  5: {
    thinAB: [300, 1300],
    t1l: [1700, 600],
    thinCD: [2600, 1500],
    t2l: [4200, 600],
  },
  6: { lay: [200, 1900], eqn: [2250, 600] },
  7: { fade: [0, 800], prob: [0, 600], gather: [450, 1100] },
};

const LINEAR_KEYS = new Set<string>(['away', 'lay', 'pick', 'bdl']);

const SIDE_START: Record<'AB' | 'BC' | 'CD' | 'DA', number> = {
  AB: 0.44,
  BC: 0,
  CD: 0.6,
  DA: 0.16,
};

const SOLVE_SEQ: [number, keyof typeof SOLVE][] = [
  [2300, 'sol2'],
  [3400, 'strike'],
  [4300, 'sol3'],
  [5600, 'sol4'],
  [6900, 'sol5'],
  [8300, 'sol6'],
];
const SOLVE = { sol2: 0, strike: 0, sol3: 0, sol4: 0, sol5: 0, sol6: 0 };

const ALT = [
  'The homework figure on a mat, with the question written above it. AC and BD cross at O at a right angle, AO equals BO and OC equals OD.',
  'Above the ruler: Imagine, how would you build this shape using sticks? Then every line turns into a stick.',
  'BC and AD, then AB and CD, then BD are laid upright side by side in the top-left corner, leaving only AC. AC is labeled x, a point O is picked on it, AO is labeled y and OC x minus y.',
  'BD is taken from the corner, laid under AC and marked the same way. Then BD is laid across AC at a right angle at O.',
  'AB is taken from the corner and laid on top, labeled root 2 times y, then CD, labeled root 2 times x minus y.',
  'The two thin sticks are laid end to end on the ruler and reach 10 centimetres: root 2 times y plus root 2 times x minus y equals 10.',
  'The equation moves to the top of the paper and is solved line by line. x equals 10 divided by root 2, which is 5 root 2, so AC is 5 root 2 centimetres.',
];

export type SticksState = typeof BASE &
  typeof SOLVE & {
    stepIdx: number;
    pulseCount: number;
  };

/* ================= helpers ================= */
const NS = 'http://www.w3.org/2000/svg';
function mk(
  tagName: string,
  attrs?: Record<string, any> | null,
  parent?: Element
) {
  const e = document.createElementNS(NS, tagName);
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}
function tag(
  name: string,
  attrs?: Record<string, any> | null,
  html?: string,
  parent?: HTMLElement
) {
  const e = document.createElement(name);
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (html) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

interface Pt {
  x: number;
  y: number;
}
const u = (v: number) => (v * U).toFixed(2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (p: Pt, q: Pt, t: number): Pt => ({
  x: lerp(p.x, q.x, t),
  y: lerp(p.y, q.y, t),
});
const add = (p: Pt, d: Pt, k: number): Pt => ({
  x: p.x + d.x * k,
  y: p.y + d.y * k,
});
const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const dist = (p: Pt, q: Pt) => Math.hypot(q.x - p.x, q.y - p.y);
const dirDeg = (a: number): Pt => ({
  x: Math.cos((a * Math.PI) / 180),
  y: Math.sin((a * Math.PI) / 180),
});
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const op = (e: SVGElement | HTMLElement, v: number) => {
  e.style.opacity = v <= 0.001 ? '0' : Math.min(1, v).toFixed(3);
};
function setXY(e: Element, p: Pt) {
  e.setAttribute('x', u(p.x));
  e.setAttribute('y', u(p.y));
}
function setLine(e: Element, p: Pt, q: Pt) {
  e.setAttribute('x1', u(p.x));
  e.setAttribute('y1', u(p.y));
  e.setAttribute('x2', u(q.x));
  e.setAttribute('y2', u(q.y));
}
function setRect(
  e: Element,
  x: number,
  y: number,
  w: number,
  h: number,
  r?: number
) {
  e.setAttribute('x', x.toFixed(2));
  e.setAttribute('y', y.toFixed(2));
  e.setAttribute('width', Math.max(0, w).toFixed(2));
  e.setAttribute('height', Math.max(0, h).toFixed(2));
  e.setAttribute('rx', (r || 0).toFixed(2));
}
function text(parent: Element, cls: string, str: string | number) {
  const t = mk('text', { class: cls }, parent);
  t.textContent = String(str);
  return t;
}

const REST = { x: 0.05, y: 0.08 };
const CAP = 3 / U;
function trimSeg(p: Pt, q: Pt): [Pt, Pt] {
  const len = dist(p, q);
  if (len <= 2 * CAP) {
    const m = mid(p, q);
    return [m, m];
  }
  const d = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
  return [add(p, d, CAP), add(q, d, -CAP)];
}
const airborne = (t: number) => clamp(Math.sin(Math.PI * clamp(t)) * 3);

function rigid(P1: Pt, P2: Pt, Q1: Pt, Q2: Pt, t: number): [Pt, Pt] {
  const m0 = mid(P1, P2),
    m1 = mid(Q1, Q2);
  const a0 = Math.atan2(P2.y - P1.y, P2.x - P1.x),
    a1 = Math.atan2(Q2.y - Q1.y, Q2.x - Q1.x);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const a = a0 + da * t,
    len = lerp(dist(P1, P2), dist(Q1, Q2), t);
  const c = lerp2(m0, m1, t);
  c.y -= Math.sin(Math.PI * t) * 0.9;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  return [add(c, d, -len / 2), add(c, d, len / 2)];
}

const PILE: Record<'BC' | 'DA' | 'AB' | 'CD' | 'BD', [Pt, number]> = {
  BC: [{ x: 0.8, y: 0.6 }, 90],
  DA: [{ x: 1.25, y: 0.6 }, 90],
  AB: [{ x: 1.7, y: 0.6 }, 90],
  CD: [{ x: 2.15, y: 0.6 }, 90],
  BD: [{ x: 2.66, y: 0.6 }, 90],
};

function pileSeg(key: keyof typeof PILE, fp: Pt, fq: Pt): [Pt, Pt] {
  const [p, ang] = PILE[key],
    q = add(p, dirDeg(ang), dist(fp, fq));
  let d = ang - (Math.atan2(fq.y - fp.y, fq.x - fp.x) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d) > 90 ? [q, p] : [p, q];
}

const reach = (sz: { w: number; h: number }, n: Pt) =>
  (sz.w / 2) * Math.abs(n.x) + (sz.h / 2) * Math.abs(n.y);
function besideSeg(seg: [Pt, Pt], sz: { w: number; h: number }) {
  const [p, q] = seg,
    a = Math.atan2(q.y - p.y, q.x - p.x);
  const n = { x: Math.sin(a), y: -Math.cos(a) };
  return add(mid(p, q), n, reach(sz, n) + TT + 0.1);
}

const SticksSceneRenderer: ElementRendererComponent<SticksState> = ({
  element,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SticksState>(element.state);
  stateRef.current = element.state;
  const renderFnRef = useRef<((s: SticksState) => void) | null>(null);
  const pulseMarksRef = useRef<(() => void) | null>(null);
  const lastPulseRef = useRef<number>(0);

  useLayoutEffect(() => {
    const stage = hostRef.current;
    if (!stage) return;
    stage.innerHTML = '';

    const MAT = { w: 17.4, h: 14.4 };
    let FIGY = 6.7;
    const RUL = { x0: 1.2, top: 12.55, h: 1.45 };
    let RY = RUL.top - 0.15;

    tag('h1', { class: 'sr-only' }, 'Two Perpendicular Sticks', stage);
    const box = tag('div', { class: 'benchbox' }, '', stage);
    const bench = tag('div', { class: 'bench' }, '', box);
    const svg = mk(
      'svg',
      { class: 'scene', role: 'img', 'aria-label': 'The figure' },
      bench
    ) as SVGSVGElement;
    const overlay = tag(
      'div',
      { class: 'overlay', 'aria-hidden': 'true' },
      '',
      bench
    );

    const defs = mk('defs', null, svg);
    const soft = mk(
      'filter',
      { id: 'soft', x: '-30%', y: '-80%', width: '160%', height: '260%' },
      defs
    );
    mk('feGaussianBlur', { stdDeviation: '3.2' }, soft);
    const softU = mk(
      'filter',
      {
        id: 'softU',
        filterUnits: 'userSpaceOnUse',
        x: -200,
        y: -200,
        width: 1200,
        height: 1200,
      },
      defs
    );
    mk('feGaussianBlur', { stdDeviation: '2.4' }, softU);

    const matBg = mk('rect', { class: 'mat-bg', x: 2, y: 2, rx: 14 }, svg);
    const gGrid = mk('g', null, svg);
    const gRuler = mk('g', null, svg);
    let num10: SVGElement | null = null;

    function buildStatic() {
      svg.setAttribute('viewBox', `0 0 ${MAT.w * U} ${MAT.h * U}`);
      matBg.setAttribute('width', String(MAT.w * U - 4));
      matBg.setAttribute('height', String(MAT.h * U - 4));
      gGrid.textContent = '';
      let g1 = '',
        g5 = '';
      for (let i = 1; i < MAT.w; i++) {
        const s = `M${i * U} 6V${MAT.h * U - 6}`;
        if (i % 5) g1 += s;
        else g5 += s;
      }
      for (let j = 1; j < MAT.h; j++) {
        const s = `M6 ${j * U}H${MAT.w * U - 6}`;
        if (j % 5) g1 += s;
        else g5 += s;
      }
      mk('path', { class: 'grid', d: g1 }, gGrid);
      mk('path', { class: 'grid5', d: g5 }, gGrid);
      gRuler.textContent = '';
      mk(
        'rect',
        {
          class: 'ruler-body',
          x: u(RUL.x0 - 0.4),
          y: u(RUL.top),
          width: u(15.8),
          height: u(RUL.h),
          rx: 5,
        },
        gRuler
      );
      let dt = '';
      for (let i = 0; i <= 150; i++) {
        const X0 = (RUL.x0 + i / 10) * U,
          len = i % 10 === 0 ? 0.44 : i % 5 === 0 ? 0.3 : 0.17;
        dt += `M${X0.toFixed(1)} ${u(RUL.top)}v${u(len)}`;
      }
      mk('path', { class: 'ruler-ticks', d: dt }, gRuler);
      for (let n = 0; n <= 15; n++) {
        const t = text(gRuler, 'ruler-num', n);
        setXY(t, { x: RUL.x0 + n, y: RUL.top + 0.74 });
        if (n === 10) num10 = t;
      }
      setXY(text(gRuler, 'ruler-unit', 'cm'), {
        x: RUL.x0 - 0.22,
        y: RUL.top + 1.16,
      });
    }

    const gMarks = mk('g', null, svg);
    const drTickY = mk('path', { class: 'tick tick-y' }, gMarks);
    const drTickZ = mk('path', { class: 'tick tick-z' }, gMarks);
    const drSq = mk('path', { class: 'sqr' }, gMarks);
    const gPrint = mk('g', null, svg);
    const drLbl: Record<string, SVGElement> = {};
    for (const n of ['A', 'B', 'C', 'D', 'O'])
      drLbl[n] = text(gPrint, 'lbl print', n);

    const gSq = mk('g', null, svg);
    const sqTL = mk('path', { class: 'sqr' }, gSq);
    const sqBR = mk('path', { class: 'sqr' }, gSq);

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

    function makeThin() {
      const w = mk('g', null, gSticks);
      return {
        w,
        ink: mk('line', { class: 'pencil' }, w),
        shadow: mk('line', { class: 'thin-shadow', filter: 'url(#softU)' }, w),
        edge: mk('line', { class: 'thin-edge' }, w),
        paint: mk('line', { class: 'thin thin-n' }, w),
      };
    }
    const TH = {
      AB: makeThin(),
      BC: makeThin(),
      CD: makeThin(),
      DA: makeThin(),
    };
    const ALL = [stAC, stBD, TH.AB, TH.BC, TH.CD, TH.DA];
    let zSig = '';
    function restack(z: number[]) {
      const idx = ALL.map((_, i) => i).sort((a, b) => z[a] - z[b]);
      const sig = idx.join('');
      if (sig === zSig) return;
      zSig = sig;
      for (const i of idx) gSticks.appendChild(ALL[i].w);
    }

    const gDim = mk('g', null, svg);
    const dimAC = mk('path', { class: 'dim' }, gDim),
      dimBD = mk('path', { class: 'dim' }, gDim);
    const guideEnds = mk('path', { class: 'guide' }, gDim);
    const guideO = mk('path', { class: 'guide' }, svg);
    const pickMark = mk('path', { class: 'pick' }, svg);

    const lbA = text(svg, 'lbl', 'A'),
      lbB = text(svg, 'lbl', 'B'),
      lbC = text(svg, 'lbl', 'C'),
      lbD = text(svg, 'lbl', 'D');
    const lbOa = text(svg, 'lbl', 'O'),
      lbOb = text(svg, 'lbl', 'O');
    const readLine = mk('line', { class: 'read' }, svg);

    const promptTxt = tag(
      'p',
      { class: 'ptxt bold prompt' },
      'Imagine: how would you build this shape using sticks?',
      overlay
    );
    const probTxt = tag(
      'p',
      { class: 'ptxt' },
      'In the figure, <i>AB</i> + <i>CD</i> = 10&nbsp;cm. What is the length of <i>AC</i>?',
      overlay
    );
    const Y_HTML = '<i>y</i>',
      XY_HTML = '<i>x</i> − <i>y</i>',
      R2_HTML = '<span class="rad"><span>2</span></span>&#8239;·&#8239;';
    const label = (cls: string, html: string) =>
      tag('span', { class: 'ml' + (cls ? ' ' + cls : '') }, html, overlay);
    const LB = {
      yA: label('c-blue', Y_HTML),
      yB: label('c-blue', Y_HTML),
      zA: label('c-orange', XY_HTML),
      zB: label('c-orange', XY_HTML),
      xA: label('', '<i>x</i>'),
      xB: label('', '<i>x</i>'),
      t1: label('c-blue', R2_HTML + Y_HTML),
      plus: label('', '+'),
      t2: label('c-orange', R2_HTML + '(' + XY_HTML + ')'),
      eq: label('', '='),
      ten: label('', '10'),
    };
    type LbKey = keyof typeof LB;
    const SZ: Record<LbKey, { w: number; h: number }> = {} as any;
    for (const k of Object.keys(LB) as LbKey[]) SZ[k] = { w: 1, h: 0.7 };
    let promptH = 0.7,
      probH = 0.7,
      promptTop = 11.6;

    const solve = tag(
      'div',
      { class: 'solve' },
      `
  <div class="srow" data-r="1"><span class="sl"><span class="ph" data-p="t1"><span class="c-blue">${R2_HTML}${Y_HTML}</span></span> <span class="ph" data-p="plus">+</span> <span class="ph" data-p="t2"><span class="c-orange">${R2_HTML}(${XY_HTML})</span></span></span><span class="se"><span class="ph" data-p="eq">=</span></span><span class="sr"><span class="ph" data-p="ten">10</span></span><span class="sn">what the ruler shows</span></div>
  <div class="srow" data-r="2"><span class="sl"><span class="c-blue st">${R2_HTML}${Y_HTML}</span> + <span class="c-orange">${R2_HTML}<i>x</i> <span class="st">−&#8239;${R2_HTML}${Y_HTML}</span></span></span><span class="se">=</span><span class="sr">10</span><span class="sn">open the bracket</span></div>
  <div class="srow" data-r="3"><span class="sl">${R2_HTML}<i>x</i></span><span class="se">=</span><span class="sr">10</span><span class="sn">the <i>y</i> parts cancel</span></div>
  <div class="srow" data-r="4"><span class="sl"><i>x</i></span><span class="se">=</span><span class="sr">10 ÷ <span class="rad"><span>2</span></span></span><span class="sn">divide both sides by √2</span></div>
  <div class="srow" data-r="5"><span class="sl"></span><span class="se">=</span><span class="sr">5<span class="rad"><span>2</span></span></span><span class="sn">since 10 = 5 × √2 × √2</span></div>
  <div class="srow ans" data-r="6"><span class="sl">AC</span><span class="se">=</span><span class="sr">5<span class="rad"><span>2</span></span> cm</span></div>`,
      overlay
    );
    const rows = [...solve.querySelectorAll<HTMLElement>('.srow')];
    const rowN = (n: number) => rows[n - 1];
    const TGT: Record<string, Pt> = {};
    let cmPx = 30,
      KS = 1,
      mode = '';

    function at(elNode: HTMLElement, p: Pt, a: number) {
      elNode.style.left = ((p.x / MAT.w) * 100).toFixed(3) + '%';
      elNode.style.top = ((p.y / MAT.h) * 100).toFixed(3) + '%';
      elNode.style.opacity = a <= 0.001 ? '0' : Math.min(1, a).toFixed(3);
    }
    function atTop(elNode: HTMLElement, y: number, a: number) {
      elNode.style.top = ((y / MAT.h) * 100).toFixed(3) + '%';
      elNode.style.opacity = a <= 0.001 ? '0' : Math.min(1, a).toFixed(3);
    }

    function placeStick(
      st: ReturnType<typeof makeStick>,
      O: Pt,
      ang: number,
      lift: number,
      live: number,
      tick: number,
      woodVal: number
    ) {
      const w = woodVal,
        x = YL,
        y = ZL,
        L = XL;
      const h = 0.06 + 0.2 * w;
      st.g.setAttribute(
        'transform',
        `translate(${u(O.x)} ${u(O.y)}) rotate(${ang.toFixed(2)})`
      );
      const rx = -x * U,
        ry = (-h / 2) * U,
        rw = L * U,
        rh = h * U;
      const e = 0.65,
        bx = rx + e,
        by = ry + e,
        bw = rw - 2 * e,
        bh = rh - 2 * e,
        br = bh / 2;
      setRect(st.body, bx, by, bw, bh, br);
      op(st.body, w * 1.6);
      st.pencil.setAttribute('x1', rx.toFixed(2));
      st.pencil.setAttribute('x2', (y * U).toFixed(2));
      op(st.pencil, 1 - w);
      st.grain.setAttribute(
        'd',
        `M${(rx + 9).toFixed(1)} ${(-rh * 0.2).toFixed(1)}H${(y * U - 14).toFixed(1)}M${(rx + 24).toFixed(1)} ${(rh * 0.22).toFixed(1)}H${(y * U - 8).toFixed(1)}`
      );
      op(st.grain, w * 0.5);
      setRect(st.outline, bx, by, bw, bh, br);
      op(st.outline, w);
      st.omark.setAttribute('y1', (ry - 3).toFixed(2));
      st.omark.setAttribute('y2', (-ry + 3).toFixed(2));
      op(st.omark, w * tick);
      op(st.g, live);
      st.shadow.setAttribute(
        'transform',
        `translate(${u(O.x + 0.05 + 0.24 * lift)} ${u(O.y + 0.08 + 0.34 * lift)}) rotate(${ang.toFixed(2)})`
      );
      setRect(st.shadow, bx, by, bw, bh, br);
      op(st.shadow, w * (0.32 + 0.2 * lift) * live);
    }

    function placeThin(
      th: ReturnType<typeof makeThin>,
      seg: [Pt, Pt],
      stk: number,
      rise: number,
      alpha: number
    ) {
      setLine(th.ink, seg[0], seg[1]);
      op(th.ink, 1 - stk);
      const [p, q] = trimSeg(seg[0], seg[1]);
      const so = { x: REST.x + 0.1 * rise, y: REST.y + 0.14 * rise };
      setLine(th.shadow, add(p, so, 1), add(q, so, 1));
      op(th.shadow, stk * (0.3 + 0.25 * rise));
      setLine(th.edge, p, q);
      setLine(th.paint, p, q);
      op(th.edge, stk);
      op(th.paint, stk);
      op(th.w, alpha);
    }

    function render(P: SticksState) {
      if (!mode) return;
      svg.setAttribute(
        'aria-label',
        `The figure, step ${P.stepIdx + 1} of 7. ${ALT[P.stepIdx] || ALT[0]}`
      );

      const k = KS,
        X = XL,
        Y = YL,
        Z = ZL;
      const left = FIGX - X / 2,
        top = FIGY - X / 2;
      const c = P.cross,
        live = 1 - P.fade;
      const Oc = { x: left + Y, y: top + Y };
      const gap = 1.3 * k;
      const Oac = lerp2({ x: left + Y, y: FIGY - gap }, Oc, c);
      const Ac = { x: left, y: top + Y },
        Bc = { x: left + Y, y: top },
        Cc = { x: left + X, y: top + Y },
        Dc = { x: left + Y, y: top + X };

      const placed = P.bdOut >= 0.999 && P.bdIn >= 0.999;
      let Obd: Pt, aBD: number, liftBD: number;
      if (placed) {
        Obd = lerp2({ x: left + Y, y: FIGY + gap }, Oc, c);
        aBD = 90 * c;
        liftBD = 4 * c * (1 - c);
      } else {
        const pileBD = pileSeg('BD', Bc, Dc);
        let seg: [Pt, Pt], t: number;
        if (P.bdOut < 0.999) {
          t = P.bdOut;
          seg = t > 0 ? rigid(Bc, Dc, pileBD[0], pileBD[1], t) : [Bc, Dc];
        } else {
          t = P.bdIn;
          seg =
            t > 0
              ? rigid(
                  pileBD[0],
                  pileBD[1],
                  { x: left, y: FIGY + gap },
                  { x: left + X, y: FIGY + gap },
                  t
                )
              : pileBD;
        }
        const d = {
          x: (seg[1].x - seg[0].x) / X,
          y: (seg[1].y - seg[0].y) / X,
        };
        Obd = add(seg[0], d, Y);
        aBD = (Math.atan2(d.y, d.x) * 180) / Math.PI;
        liftBD = airborne(t);
      }
      const tickO = clamp((P.pick - 0.8) / 0.2);
      const bl = P.bdl,
        on = placed ? 1 : 0;
      const nameBD =
        P.bdOut < 0.999 ? 1 - clamp(P.bdOut * 5) : clamp(bl / 0.2) * on;
      const tickBD = clamp((bl - 0.2) / 0.15) * on;
      const dA = { x: 1, y: 0 },
        dB = dirDeg(aBD),
        nB = { x: dB.y, y: -dB.x },
        nBneg = { x: -nB.x, y: -nB.y };
      const A = add(Oac, dA, -Y),
        C = add(Oac, dA, Z),
        B = add(Obd, dB, -Y),
        D = add(Obd, dB, Z);

      atTop(promptTxt, promptTop + 0.25 * (1 - P.prompt), P.prompt);
      atTop(probTxt, TXT_TOP, P.prob);

      op(gGrid, live);
      op(gRuler, live);
      placeStick(stAC, Oac, 0, 4 * c * (1 - c), live, tickO, P.wood);
      placeStick(stBD, Obd, aBD, liftBD, live, tickBD, P.wood);

      op(gMarks, P.marks);
      op(gPrint, P.draw);
      if (P.marks > 0.001 || P.draw > 0.001) {
        const t = 0.2;
        const mAO = { x: left + Y / 2, y: Oc.y },
          mBO = { x: Oc.x, y: top + Y / 2 };
        const mOC = { x: Oc.x + Z / 2, y: Oc.y },
          mOD = { x: Oc.x, y: Oc.y + Z / 2 };
        drTickY.setAttribute(
          'd',
          `M${u(mAO.x)} ${u(mAO.y - t)}V${u(mAO.y + t)}M${u(mBO.x - t)} ${u(mBO.y)}H${u(mBO.x + t)}`
        );
        drTickZ.setAttribute(
          'd',
          `M${u(mOC.x - 0.09)} ${u(mOC.y - t)}V${u(mOC.y + t)}M${u(mOC.x + 0.09)} ${u(mOC.y - t)}V${u(mOC.y + t)}` +
            `M${u(mOD.x - t)} ${u(mOD.y - 0.09)}H${u(mOD.x + t)}M${u(mOD.x - t)} ${u(mOD.y + 0.09)}H${u(mOD.x + t)}`
        );
        const s = 0.42;
        drSq.setAttribute(
          'd',
          `M${u(Oc.x)} ${u(Oc.y - s)}H${u(Oc.x + s)}V${u(Oc.y)}`
        );
        setXY(drLbl.A, { x: Ac.x - 0.6 * k, y: Ac.y });
        setXY(drLbl.B, { x: Bc.x, y: Bc.y - 0.6 * k });
        setXY(drLbl.C, { x: Cc.x + 0.6 * k, y: Cc.y });
        setXY(drLbl.D, { x: Dc.x, y: Dc.y + 0.62 * k });
        setXY(drLbl.O, { x: Oc.x - 0.45 * k, y: Oc.y + 0.5 * k });
      }

      const figT: Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]> = {
        AB: [Ac, Bc],
        BC: [Bc, Cc],
        CD: [Cc, Dc],
        DA: [Dc, Ac],
      };
      const aT: Record<string, number> = {},
        segT: Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]> = {} as any,
        riseT: Record<string, number> = {},
        pileT: Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]> = {} as any;
      for (const key of ['AB', 'BC', 'CD', 'DA'] as const) {
        const f = figT[key],
          pile = (pileT[key] = pileSeg(key, f[0], f[1]));
        const a = (aT[key] = ease(clamp((P.away - SIDE_START[key]) / 0.4)));
        segT[key] = a > 0 ? rigid(f[0], f[1], pile[0], pile[1], a) : f;
        riseT[key] = airborne(a);
      }
      const ab = SQ2 * Y,
        cd = SQ2 * Z;
      const tAB = ease(clamp(P.lay / 0.6)),
        tCD = ease(clamp((P.lay - 0.4) / 0.6));
      const Q0 = { x: RUL.x0, y: RY },
        Q1 = { x: RUL.x0 + ab, y: RY },
        Q2 = { x: RUL.x0 + ab + cd, y: RY };
      if (tAB > 0) {
        segT.AB = rigid(A, B, Q0, Q1, tAB);
        riseT.AB = airborne(tAB);
      } else if (P.thinAB > 0) {
        segT.AB = rigid(pileT.AB[0], pileT.AB[1], A, B, P.thinAB);
        riseT.AB = airborne(P.thinAB);
      }
      if (tCD > 0) {
        segT.CD = rigid(C, D, Q1, Q2, tCD);
        riseT.CD = airborne(tCD);
      } else if (P.thinCD > 0) {
        segT.CD = rigid(pileT.CD[0], pileT.CD[1], C, D, P.thinCD);
        riseT.CD = airborne(P.thinCD);
      }
      for (const key of ['AB', 'BC', 'CD', 'DA'] as const)
        placeThin(TH[key], segT[key], P.lift, riseT[key], live);
      const segAB = segT.AB,
        segCD = segT.CD;
      restack([
        0,
        P.bdOut >= 0.999 && P.bdIn > 0 ? 16 : P.bdOut > 0 ? 14 : 1,
        tAB > 0 ? 21 : P.thinAB > 0 ? 19 : aT.AB > 0 ? 12 : 2,
        aT.BC > 0 ? 10 : 4,
        tCD > 0 ? 22 : P.thinCD > 0 ? 20 : aT.CD > 0 ? 13 : 3,
        aT.DA > 0 ? 11 : 5,
      ]);

      const pl = (1 - P.draw) * live;
      setXY(lbA, add(A, dA, -0.6 * k));
      setXY(lbC, add(C, dA, 0.6 * k));
      setXY(lbB, add(B, dB, -0.6 * k));
      setXY(lbD, add(D, dB, 0.62 * k));
      op(lbA, pl);
      op(lbC, pl);
      op(lbB, pl * nameBD);
      op(lbD, pl * nameBD);
      setXY(
        lbOa,
        add(
          Oac,
          lerp2({ x: 0, y: 0.56 * k }, { x: -0.46 * k, y: 0.52 * k }, c),
          1
        )
      );
      op(lbOa, pl * Math.max(P.wood * (1 - clamp(P.bdOut * 2)), tickO));
      setXY(lbOb, { x: Obd.x, y: Obd.y - 0.56 * k });
      op(lbOb, pl * tickBD * (1 - c));

      const pk = P.pick;
      const pxk =
        pk < 0.5
          ? lerp(0.35, 1.4 * Y, ease(pk / 0.5))
          : lerp(1.4 * Y, Y, ease(clamp((pk - 0.5) / 0.3)));
      const tip = { x: A.x + pxk, y: Oac.y - TM - 0.07 };
      pickMark.setAttribute(
        'd',
        `M${u(tip.x)} ${u(tip.y)}l${u(-0.17)} ${u(-0.32)}h${u(0.34)}Z`
      );
      op(pickMark, clamp(pk / 0.08) * (1 - clamp((pk - 0.85) / 0.15)) * live);

      const my = P.ylbl,
        mz = P.zlbl,
        cl = TM + 0.09;
      const bxl = clamp((bl - 0.4) / 0.2) * on,
        byl = clamp((bl - 0.6) / 0.2) * on,
        bzl = clamp((bl - 0.8) / 0.2) * on;
      const flip = clamp(Math.abs(c - 0.5) * 4);
      const up = { x: 0, y: -1 },
        sideYA = c < 0.5 ? up : { x: 0, y: 1 },
        sideYB = c < 0.5 ? nBneg : nB;
      const alongYA =
        c < 0.5
          ? Y / 2
          : Math.min(
              Y - SZ.yA.w / 2 - 0.05,
              Math.max(Y / 2, 0.46 * k + 0.25 * k + SZ.yA.w / 2 + 0.35)
            );
      at(
        LB.yA,
        add(add(Oac, dA, -alongYA), sideYA, reach(SZ.yA, sideYA) + cl),
        my * flip * live
      );
      at(
        LB.zA,
        add(add(Oac, dA, Z / 2), up, reach(SZ.zA, up) + cl),
        mz * live
      );
      at(
        LB.yB,
        add(add(Obd, dB, -Y / 2), sideYB, reach(SZ.yB, sideYB) + cl),
        byl * flip * live
      );
      at(
        LB.zB,
        add(add(Obd, dB, Z / 2), nBneg, reach(SZ.zB, nBneg) + cl),
        bzl * live
      );

      const xa = P.xdim * (1 - c) * live;
      const ya = Oac.y - (cl + SZ.yA.h + 0.14),
        yb = Obd.y + (cl + SZ.yB.h + 0.14);
      dimAC.setAttribute(
        'd',
        `M${u(left)} ${u(ya + 0.16)}V${u(ya)}H${u(left + X)}V${u(ya + 0.16)}`
      );
      dimBD.setAttribute(
        'd',
        `M${u(left)} ${u(yb - 0.16)}V${u(yb)}H${u(left + X)}V${u(yb - 0.16)}`
      );
      guideEnds.setAttribute(
        'd',
        `M${u(left)} ${u(Oac.y - 0.3)}V${u(Obd.y + 0.3)}M${u(left + X)} ${u(Oac.y - 0.3)}V${u(Obd.y + 0.3)}`
      );
      op(dimAC, xa);
      op(dimBD, xa * bxl);
      op(guideEnds, clamp((bl - 0.05) / 0.2) * on * (1 - c) * live);
      at(LB.xA, { x: left + X / 2, y: ya - 0.08 - SZ.xA.h / 2 }, xa);
      at(LB.xB, { x: left + X / 2, y: yb + 0.08 + SZ.xB.h / 2 }, xa * bxl);
      guideO.setAttribute(
        'd',
        `M${u(Oac.x)} ${u(Oac.y + 0.26)}V${u(Obd.y - 0.26)}`
      );
      op(guideO, clamp((bl - 0.12) / 0.15) * on * tickO * (1 - c) * 0.9 * live);

      const s = Math.min(0.5, Y * 0.25, Z * 0.25);
      sqTL.setAttribute(
        'd',
        `M${u(Oc.x - s)} ${u(Oc.y)}V${u(Oc.y - s)}H${u(Oc.x)}`
      );
      sqBR.setAttribute(
        'd',
        `M${u(Oc.x + s)} ${u(Oc.y)}V${u(Oc.y + s)}H${u(Oc.x)}`
      );
      op(gSq, P.sq * c * live);

      const g = P.gather,
        swap = g >= 0.999;
      const G = (p: Pt, key: string) => (TGT[key] ? lerp2(p, TGT[key], g) : p);
      const rowY = RY - (SZ.t1.h / 2 + TT + 0.1);
      const pPlus = {
        x: Math.max(
          RUL.x0 + ab,
          RUL.x0 + ab / 2 + SZ.t1.w / 2 + 0.15 + SZ.plus.w / 2
        ),
        y: rowY,
      };
      const pEq = { x: RUL.x0 + 10 + 0.3 + SZ.eq.w / 2, y: rowY };
      const pTen = {
        x: pEq.x + SZ.eq.w / 2 + 0.2 + SZ.ten.w / 2,
        y: rowY,
      };
      const hide = swap ? 0 : 1;
      at(
        LB.t1,
        G(besideSeg(tAB > 0 ? segAB : [A, B], SZ.t1), 't1'),
        P.t1l * hide
      );
      at(
        LB.t2,
        G(besideSeg(tCD > 0 ? segCD : [C, D], SZ.t2), 't2'),
        P.t2l * hide
      );
      at(LB.plus, G(pPlus, 'plus'), P.eqn * hide);
      at(LB.eq, G(pEq, 'eq'), P.eqn * hide);
      at(LB.ten, G(pTen, 'ten'), P.eqn * hide);

      rows[0].classList.toggle('on', swap);
      for (let n = 2; n <= 6; n++) {
        const val = (P as any)['sol' + n] as number;
        rowN(n).classList.toggle('on', val > 0.5);
      }
      rowN(2).classList.toggle('struck', P.strike > 0.5);

      setLine(
        readLine,
        { x: RUL.x0 + 10, y: RY - 0.42 },
        { x: RUL.x0 + 10, y: RUL.top + 0.56 }
      );
      op(readLine, P.eqn * live);
      if (num10) num10.classList.toggle('hot', P.eqn * live > 0.5);
    }

    function measureSolve() {
      solve.classList.remove('stack');
      solve.style.maxWidth = 'none';
      const natural = solve.offsetWidth;
      solve.style.maxWidth = '';
      if (natural > bench.clientWidth * 0.96) solve.classList.add('stack');
      const or = overlay.getBoundingClientRect();
      const ans = rowN(6),
        ar = ans.getBoundingClientRect();
      const slEl = ans.querySelector('.sl') as HTMLElement;
      const srEl = ans.querySelector('.sr') as HTMLElement;
      ans.style.setProperty(
        '--bx-l',
        (slEl.getBoundingClientRect().left - ar.left).toFixed(1) + 'px'
      );
      ans.style.setProperty(
        '--bx-r',
        (ar.right - srEl.getBoundingClientRect().right).toFixed(1) + 'px'
      );
      rows[0].querySelectorAll<HTMLElement>('[data-p]').forEach((ph) => {
        const r = ph.getBoundingClientRect();
        const key = ph.dataset.p!;
        TGT[key] = {
          x: (r.left + r.width / 2 - or.left) / cmPx,
          y: (r.top + r.height / 2 - or.top) / cmPx,
        };
      });
    }

    function layout() {
      const r = box.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const m = r.width / r.height < 1.12 ? 'narrow' : 'wide';
      if (m !== mode) {
        mode = m;
        MAT.h = m === 'narrow' ? 17.0 : 14.4;
        RUL.top = MAT.h - 1.85;
        RY = RUL.top - 0.15;
        buildStatic();
      }
      const ar = MAT.w / MAT.h;
      const top = 0,
        H = r.height,
        w = Math.min(r.width, H * ar);
      const h = w / ar;
      bench.style.width = w + 'px';
      bench.style.height = h + 'px';
      bench.style.left = (r.width - w) / 2 + 'px';
      bench.style.top = top + (H - h) / 2 + 'px';

      cmPx = w / MAT.w;
      KS = clamp(27 / cmPx, 1, 1.45);
      const KT = clamp(15 / (0.48 * cmPx), 1, 1.6);
      bench.style.setProperty('--cm', cmPx.toFixed(3) + 'px');
      bench.style.setProperty('--k', KS.toFixed(3));
      bench.style.setProperty('--kt', KT.toFixed(3));
      for (const key of Object.keys(LB) as LbKey[]) {
        SZ[key] = {
          w: LB[key].offsetWidth / cmPx,
          h: LB[key].offsetHeight / cmPx,
        };
      }
      promptH = promptTxt.offsetHeight / cmPx;
      probH = probTxt.offsetHeight / cmPx;
      promptTop = RUL.top - 0.3 - promptH;
      const regionTop = TXT_TOP + probH + 0.25;
      const regionBot = Math.min(RY - (SZ.t1.h + TT + 0.1), promptTop) - 0.2;
      FIGY = (regionTop + regionBot) / 2;
      measureSolve();
      render(stateRef.current);
    }

    let pulseTimer = 0;
    pulseMarksRef.current = () => {
      gMarks.classList.remove('pulse');
      requestAnimationFrame(() => {
        gMarks.classList.add('pulse');
        window.clearTimeout(pulseTimer);
        pulseTimer = window.setTimeout(
          () => gMarks.classList.remove('pulse'),
          3600
        );
      });
    };

    renderFnRef.current = render;
    layout();
    document.fonts?.ready?.then(layout);
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    return () => {
      window.clearTimeout(pulseTimer);
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    renderFnRef.current?.(element.state);
    if (element.state.pulseCount !== lastPulseRef.current) {
      lastPulseRef.current = element.state.pulseCount;
      if (element.state.pulseCount > 0) {
        pulseMarksRef.current?.();
      }
    }
  }, [element.state]);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
};

function makeSticksElement(
  baseLook: typeof BASE,
  stepIdx: number
): VisualElement<SticksState> {
  return {
    id: 'sticks-scene',
    type: 'sticks-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: {
      ...baseLook,
      ...SOLVE,
      stepIdx,
      pulseCount: 0,
    },
  };
}

async function playParts(
  c: StepAnimationController,
  initialFrom: typeof BASE,
  parts: (string | number)[]
) {
  let from = initialFrom;
  for (let i = 0; i < parts.length; i++) {
    const partKey = parts[i];
    const to = T[partKey];
    const plan = CHOREO[partKey] || {};
    const tasks: Promise<void>[] = [];

    for (const key of KEYS) {
      if (Math.abs(from[key] - to[key]) < 1e-4) continue;
      const [delay, dur] = plan[key] || [0, 600];
      const easing = LINEAR_KEYS.has(key) ? 'linear' : undefined;
      const targetVal = to[key];
      tasks.push(
        (async () => {
          if (delay > 0) await c.wait(delay);
          await c.animateElement(
            'sticks-scene',
            { state: { [key]: targetVal } as Partial<SticksState> },
            { durationMs: dur, easing }
          );
        })()
      );
    }

    await Promise.all(tasks);
    from = to;
    if (i < parts.length - 1) {
      await c.wait(PAUSE);
    }
  }
}

export const twoSticksDemo: DemoConfig = {
  id: 'two-sticks',
  name: 'Two Perpendicular Sticks',
  renderers: {
    'sticks-scene': SticksSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeSticksElement(T[1], 0)],
      async play(c) {
        const cur =
          (c.getElements()['sticks-scene']?.state as SticksState | undefined)
            ?.pulseCount ?? 0;
        c.updateElementImmediate('sticks-scene', {
          state: { pulseCount: cur + 1 },
        });
      },
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'Think',
      initialElements: [makeSticksElement(T[1], 1)],
      async play(c) {
        await playParts(c, T[1], [2]);
      },
    },
    {
      stepNumber: 3,
      title: 'Recreate the Figure',
      summary: 'Label AC',
      initialElements: [makeSticksElement(T[2], 2)],
      async play(c) {
        await playParts(c, T[2], [3]);
      },
    },
    {
      stepNumber: 4,
      title: 'Recreate the Figure',
      summary: 'Lay BD across AC',
      initialElements: [makeSticksElement(T[3], 3)],
      async play(c) {
        await playParts(c, T[3], [4, 'across']);
      },
    },
    {
      stepNumber: 5,
      title: 'Recreate the Figure',
      summary: 'Label AB and CD',
      initialElements: [makeSticksElement(T.across, 4)],
      async play(c) {
        await playParts(c, T.across, [5]);
      },
    },
    {
      stepNumber: 6,
      title: 'Recreate the Figure',
      summary: 'Lay them on the ruler',
      initialElements: [makeSticksElement(T[5], 5)],
      async play(c) {
        await playParts(c, T[5], [6]);
      },
    },
    {
      stepNumber: 7,
      title: 'Solve the Equation',
      summary: 'Solve',
      initialElements: [makeSticksElement(T[6], 6)],
      async play(c) {
        const solvePromises = SOLVE_SEQ.map(async ([delay, key]) => {
          await c.wait(delay);
          c.updateElementImmediate('sticks-scene', {
            state: { [key]: 1 } as Partial<SticksState>,
          });
        });
        await Promise.all([playParts(c, T[6], [7]), ...solvePromises]);
      },
    },
  ],
};

const container = document.getElementById('deck');
if (container) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={twoSticksDemo} />);
  });
}
