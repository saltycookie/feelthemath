// Danny's Walk — migrated to the React MathDemoPlayer framework while preserving all content, style, animation, and wording.

import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  ElementRendererComponent,
  MathDemoPlayer,
  VisualElement,
  clamp,
  easeOut,
  lerp,
} from '../../framework';
import { el, text, setText, setOpacity } from '../../framework/svg.js';

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

/* ---------- the places, in metres ---------- */
const A = { x: 0, y: 20 }; // Danny's home: on the back half of the paper
const B = { x: 120, y: 30 }; // the playground: on the front half
const C = { x: 80, y: 0 }; // a point on the river bank; C1 from step 4 on
const CS = [
  C,
  { x: 14, y: 0 },
  { x: A.x + ((B.x - A.x) * A.y) / (A.y + B.y), y: 0 },
  { x: 106, y: 0 },
]; // C3: x = 48
const D = { x: B.x, y: -A.y }; // on the unfolded paper: home is 20 m south of the river
const SPAN = { w: 120, h: 30 };
const MID = 60;
const MAX_K = 7.5;
const CAM = { yaw: (25 * Math.PI) / 180, dist: 230 };
const DASH = 20,
  MARCH = 0.8;

const FOLD = 2;
const ALT = [
  '',
  "A straight river running from west to east. Danny's home, A, is 20 meters north of it. The playground, B, is 120 meters " +
    "east of A and 30 meters north of the river. C is a point on the river bank, and Danny's walk goes from B to C and then from C to A.",
  'The same figure on a sheet of see-through paper folded along the river, seen a little from the side. Home, A, is on the ' +
    "back half, behind the playground's half. The paper unfolds: the back half swings down, carrying home and the walk from " +
    'C to A with it, until home is 20 meters south of the river. Where home and its lines lay, the front half is left ' +
    'with see-through marks of them.',
  'The paper folded again. Four points on the river bank: C2 near home, C3, C1, and C4 near the playground. Four walks, ' +
    'each in its own colour, go from the playground B to one of the points and on to home A. Which one is the shortest? ' +
    'Unfolding the paper shows it.',
  'The paper unfolded, home now 20 meters south of the river. Only the walk through C3 is left: from the playground B ' +
    'it crosses the river at C3 and goes on to home in one straight line. BC3 + C3A is the shortest, because it is a straight line.',
  'The unfolded paper, straight on. A line east from home A and a line south from the playground B meet at D, making a ' +
    'right triangle ABD whose long side is the straight walk. BD is 50 meters (30 + 20) and AD is 120 meters.',
];

export interface WalkState {
  stepIdx: number;
  river: number;
  a: number;
  aDim: number;
  b: number;
  bRiver: number;
  bEast: number;
  c: number;
  walk: number;
  ask: number;
  txt: number;
  view: number;
  paper: number;
  unf: number;
  sw: number;
  hint3: number;
  switchOpen: boolean;
  controlsOn: boolean;
  sub: number;
  c2: number;
  c3: number;
  c4: number;
  w2: number;
  w3: number;
  w4: number;
  lab4: number;
  hint4: number;
  focus: number;
  hint5: number;
  flat: number;
  rise: number;
  tri: number;
  dpt: number;
  swap: number;
  m1: number;
  m2: number;
  m3: number;
  m4: number;
  m5: number;
  ring: number;
}

const BASE_STATE: WalkState = {
  stepIdx: 0,
  river: 0,
  a: 0,
  aDim: 0,
  b: 0,
  bRiver: 0,
  bEast: 0,
  c: 0,
  walk: 0,
  ask: 0,
  txt: 1,
  view: 0,
  paper: 0,
  unf: 0,
  sw: 0,
  hint3: 0,
  switchOpen: false,
  controlsOn: false,
  sub: 0,
  c2: 0,
  c3: 0,
  c4: 0,
  w2: 0,
  w3: 0,
  w4: 0,
  lab4: 0,
  hint4: 0,
  focus: 0,
  hint5: 0,
  flat: 0,
  rise: 0,
  tri: 0,
  dpt: 0,
  swap: 0,
  m1: 0,
  m2: 0,
  m3: 0,
  m4: 0,
  m5: 0,
  ring: 0,
};

const fadeIn = (t: number, from = 0.6) => clamp((t - from) / (1 - from), 0, 1);

function makeView(t: number, k: number, ox: number, oy: number) {
  return {
    k,
    ox,
    oy,
    cy: Math.cos(CAM.yaw * t),
    sy: Math.sin(CAM.yaw * t),
    q: t / CAM.dist,
  };
}

function proj(
  v: ReturnType<typeof makeView>,
  x: number,
  y: number,
  z = 0
): [number, number] {
  const px = x - MID;
  const x1 = px * v.cy + z * v.sy;
  const z1 = z * v.cy - px * v.sy;
  const f = 1 / (1 - z1 * v.q);
  return [v.ox + v.k * x1 * f, v.oy - v.k * y * f];
}

function crossAt(
  p0: [number, number],
  p1: [number, number],
  q0: [number, number],
  q1: [number, number]
): number | null {
  const rx = p1[0] - p0[0],
    ry = p1[1] - p0[1],
    sx = q1[0] - q0[0],
    sy = q1[1] - q0[1],
    den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = q0[0] - p0[0],
    qy = q0[1] - p0[1],
    t = (qx * sy - qy * sx) / den,
    u = (qx * ry - qy * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : null;
}

const WalkSceneRenderer: ElementRendererComponent<WalkState> = ({
  element,
  updateState,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<WalkState>(element.state);
  stateRef.current = element.state;

  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  const renderFnRef = useRef<((s: WalkState) => void) | null>(null);
  const flipRafRef = useRef<number>(0);

  useEffect(() => {
    const stage = hostRef.current;
    if (!stage) return;
    stage.innerHTML = '';

    const prob = tag(
      'p',
      { class: 'problem' },
      `Danny's home is <b>20 meters</b> north of a <b class="c-blue">straight river</b>
  that flows from west to east. A playground is <b>120 meters</b> east of his home and <b>30 meters</b> north of the river.
  After playing at the playground, Danny wants to walk to the river bank to wash up before going home. What is the
  shortest total distance he needs to walk?`,
      stage
    );
    const box = tag('div', { class: 'figbox' }, '', stage);
    const ask = tag(
      'p',
      { class: 'ask' },
      'How short can <i>BC</i> + <i>CA</i> be?',
      stage
    );
    const svg = el('svg', {
      id: 'fig',
      role: 'img',
      'aria-label': 'The figure',
    }, stage) as unknown as SVGSVGElement;

    const hints = [
      "Fold and unfold Danny's world yourself!",
      'Which path is the shortest? Unfold to find it out!',
      '<i>BC</i><sub>3</sub> + <i>C</i><sub>3</sub><i>A</i> is the shortest because it forms a straight line!',
    ].map((html) => tag('p', { class: 'hint' }, html, stage));
    const [hint3, hint4, hint5] = hints;

    const math = tag(
      'div',
      { class: 'math' },
      `
  <span class="ml" data-s="1"><i>AB</i></span><span class="me" data-s="1">=</span><span class="mr"><span data-s="1"><span class="rad"><span>120<sup>2</sup> + 50<sup>2</sup></span></span></span>
    <span data-s="2">= 10 × <span class="rad"><span>12<sup>2</sup> + 5<sup>2</sup></span></span></span></span>
  <span class="ml"></span><span class="me" data-s="3">=</span><span class="mr"><span data-s="3">10 × <span class="rad"><span>169</span></span></span>
    <span data-s="4">= 10 × 13</span></span>
  <span class="ml"></span><span class="me" data-s="5">=</span><span class="mr"><span class="ans" data-s="5">130 m<svg class="ring" aria-hidden="true"><path/></svg></span></span>`,
      stage
    );
    const ring = math.querySelector('.ring') as SVGSVGElement;
    const ringPath = ring.querySelector('path') as SVGPathElement;
    const pieces = [1, 2, 3, 4, 5].map((i) => [
      ...math.querySelectorAll<HTMLElement>('[data-s="' + i + '"]'),
    ]);

    const switcher = tag('div', { class: 'switcher' }, '', stage);
    const wordFold = tag(
      'button',
      { class: 'switch-word', type: 'button', tabindex: -1, 'aria-hidden': 'true' },
      'fold',
      switcher
    );
    const toggle = tag(
      'button',
      {
        class: 'switch',
        type: 'button',
        role: 'switch',
        'aria-checked': 'false',
        'aria-label': 'Unfold the paper',
        tabindex: -1,
        'aria-disabled': 'true',
      },
      '<span class="knob"></span>',
      switcher
    ) as HTMLButtonElement;
    const wordUnfold = tag(
      'button',
      { class: 'switch-word', type: 'button', tabindex: -1, 'aria-hidden': 'true' },
      'unfold',
      switcher
    );

    let SW = 0,
      SH = 0;
    let fs = 18,
      compact = false;
    let V2: ReturnType<typeof makeView> | null = null,
      V3: ReturnType<typeof makeView> | null = null,
      V5: ReturnType<typeof makeView> | null = null,
      V6: ReturnType<typeof makeView> | null = null;
    let PAPER: { x0: number; x1: number; h: number } | null = null;
    let RIVER: [number, number] | null = null;
    let gapW = 0;
    let hintY = 0,
      hintY5 = 0,
      mathY = 0;
    let ringLen = 0;

    function subText(parent: Element, cls: string, main: string, sub: string) {
      const t = text(parent, cls, main);
      el('tspan', { class: 'sub', dy: '.35em' }, t).textContent = sub;
      return t;
    }

    const R: Record<string, any> = {};
    R.sheetB = el('path', { class: 'sheet' }, svg);
    R.back = el('g', {}, svg);
    R.dimA = el('path', { class: 'dim' }, R.back);
    R.sqA = el('path', { class: 'sq' }, R.back);
    R.walkA = CS.map((_, i) =>
      el('path', { class: 'walk w' + (i + 1) }, R.back)
    );
    R.pA = el('circle', { class: 'pt' }, R.back);
    R.lA = text(R.back, 'lbl', 'A');
    R.cA = text(R.back, 'cap', 'home');
    R.tA = text(R.back, 'len', '20 m');

    const mask = el(
      'mask',
      { id: 'imprint', maskUnits: 'userSpaceOnUse' },
      el('defs', {}, svg)
    );
    R.maskAll = el('rect', { fill: '#fff' }, mask);
    const g = el('g', { class: 'imprint' }, mask);
    R.imp = {
      g,
      mask,
      dimA: el('path', { class: 'dim' }, g),
      sqA: el('path', { class: 'sq' }, g),
      walkA: CS.map(() => el('path', { class: 'walk' }, g)),
      pA: el('circle', { class: 'pt' }, g),
      lA: text(g, 'lbl', 'A'),
      cA: text(g, 'cap', 'home'),
      tA: text(g, 'len', '20 m'),
    };

    R.front = el('g', {}, svg);
    R.sheetF = el('path', { class: 'sheet', mask: 'url(#imprint)' }, R.front);
    R.dimB = el('path', { class: 'dim' }, R.front);
    R.sqB = el('path', { class: 'sq' }, R.front);
    R.walkB = CS.map((_, i) =>
      el('path', { class: 'walk w' + (i + 1) }, R.front)
    );
    R.pB = el('circle', { class: 'pt' }, R.front);
    R.lB = text(R.front, 'lbl', 'B');
    R.cB = text(R.front, 'cap', 'playground');
    R.tB = text(R.front, 'len', '30 m');

    R.river = el('path', { class: 'river' }, svg);
    R.riverT = text(svg, 'cap river-cap', 'river');
    R.pC = el('circle', { class: 'pt c' }, svg);
    R.lC = text(svg, 'lbl c', 'C');
    R.pCs = CS.map((_, i) => el('circle', { class: 'pt w' + (i + 1) }, svg));
    R.lCs = CS.map((_, i) =>
      subText(svg, 'lbl w' + (i + 1), 'C', String(i + 1))
    );
    R.ext = el('path', { class: 'ext' }, svg);
    R.dimE = el('path', { class: 'dim' }, svg);
    R.tE = text(svg, 'len', '120 m');

    R.legs = el('path', { class: 'leg' }, svg);
    R.sqD = el('path', { class: 'sq' }, svg);
    R.pD = el('circle', { class: 'pt' }, svg);
    R.lD = text(svg, 'lbl', 'D');
    R.tBD = text(svg, 'len', '50 m');
    R.tAD = text(svg, 'len', '120 m');

    function reach() {
      const v = makeView(1, 1, 0, 0);
      const e = { x0: 0, x1: 0, y0: 0, y1: 0, mid: 0 };
      const add = ([x, y]: [number, number]) => {
        e.x0 = Math.min(e.x0, x);
        e.x1 = Math.max(e.x1, x);
        e.y0 = Math.min(e.y0, -y);
        e.y1 = Math.max(e.y1, -y);
      };
      for (const x of [PAPER!.x0, PAPER!.x1]) {
        add(proj(v, x, PAPER!.h));
        for (let i = 0; i <= 12; i++) {
          const p = (i / 12) * Math.PI;
          add(proj(v, x, PAPER!.h * Math.cos(p), -PAPER!.h * Math.sin(p)));
        }
      }
      e.mid = (proj(v, PAPER!.x0, 0)[0] + proj(v, PAPER!.x1, 0)[0]) / 2;
      return e;
    }

    function drawRing() {
      const r = ring.getBoundingClientRect(),
        w = r.width,
        h = r.height;
      if (!w || !h) return;
      const n = 64,
        a0 = -2.5,
        sweep = 2 * Math.PI + 0.55,
        pts: string[][] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n,
          a = a0 + sweep * u,
          g = 1.035 - 0.07 * u;
        pts.push([
          (w / 2 + (w / 2 - 3) * g * Math.cos(a)).toFixed(1),
          (h / 2 + (h / 2 - 3) * g * Math.sin(a)).toFixed(1),
        ]);
      }
      ring.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      ringPath.setAttribute('d', 'M' + pts.join('L'));
      ringLen = ringPath.getTotalLength();
      ringPath.style.strokeDasharray = String(ringLen);
    }

    function line(
      n: Element,
      p: [number, number],
      q: [number, number],
      on: boolean
    ) {
      n.setAttribute('d', on ? 'M' + p + 'L' + q : '');
    }

    function sheet(
      n: Element,
      map: (x: number, y: number) => [number, number],
      h: number,
      op: number
    ) {
      n.setAttribute(
        'd',
        h > 0
          ? 'M' +
              map(PAPER!.x0, 0) +
              'L' +
              map(PAPER!.x1, 0) +
              'L' +
              map(PAPER!.x1, h) +
              'L' +
              map(PAPER!.x0, h) +
              'Z'
          : ''
      );
      setOpacity(n, op);
    }

    function corner(
      n: Element,
      map: (x: number, y: number) => [number, number],
      x: number,
      y: number,
      d1: [number, number],
      d2: [number, number],
      s: number,
      op: number
    ) {
      n.setAttribute(
        'd',
        'M' +
          map(x + d1[0] * s, y + d1[1] * s) +
          'L' +
          map(x + (d1[0] + d2[0]) * s, y + (d1[1] + d2[1]) * s) +
          'L' +
          map(x + d2[0] * s, y + d2[1] * s)
      );
      setOpacity(n, op);
    }

    function label(
      n: Element,
      map: (x: number, y: number) => [number, number],
      x: number,
      y: number,
      dx: number,
      dy: number,
      op: number,
      k: number
    ) {
      const [px, py] = map(x + (dx * fs) / k, y + (dy * fs) / k);
      setText(n, px, py, op);
    }

    function names(
      lt: Element,
      cap: Element,
      map: (x: number, y: number) => [number, number],
      p: { x: number; y: number },
      op: number,
      k: number
    ) {
      label(lt, map, p.x, p.y, 0, 1.05, op, k);
      if (compact) label(cap, map, p.x, p.y, -0.75, 1.05, op, k);
      else label(cap, map, p.x, p.y, 0, 2.2, op, k);
    }

    function point(n: Element, p: [number, number], op: number) {
      n.setAttribute('cx', String(p[0]));
      n.setAttribute('cy', String(p[1]));
      n.setAttribute('r', String(fs * 0.34 * (0.4 + 0.6 * op)));
      setOpacity(n, op);
    }

    function under(n: HTMLElement, op: number, y: number) {
      n.style.opacity = String(clamp(op, 0, 1));
      n.style.transform = 'translateY(' + (y + (1 - op) * 10) + 'px)';
    }

    const lagNow = CS.map(() => 0);

    function render(S: WalkState) {
      if (!V2 || !V3 || !V5 || !V6 || !PAPER || !RIVER) return;

      // Sync accessibility attributes
      if (S.stepIdx === 0) svg.setAttribute('aria-hidden', 'true');
      else svg.removeAttribute('aria-hidden');
      svg.setAttribute('aria-label', ALT[S.stepIdx] || ALT[1]);
      prob.setAttribute('aria-hidden', S.stepIdx >= FOLD ? 'true' : 'false');

      // Sync switch visual & interactive state
      toggle.setAttribute('aria-checked', S.switchOpen ? 'true' : 'false');
      wordFold.classList.toggle('now', !S.switchOpen);
      wordUnfold.classList.toggle('now', S.switchOpen);
      switcher.classList.toggle('on', S.controlsOn);
      toggle.tabIndex = S.controlsOn ? 0 : -1;
      if (S.controlsOn) toggle.removeAttribute('aria-disabled');
      else toggle.setAttribute('aria-disabled', 'true');

      const t = S.view,
        F = S.flat,
        U = S.rise;
      const flat = (key: 'k' | 'ox' | 'oy') =>
        lerp(lerp(V2![key], V5![key], F), V6![key], U);
      const v = makeView(
        t,
        lerp(flat('k'), V3.k, t),
        lerp(flat('ox'), V3.ox, t),
        lerp(flat('oy'), V3.oy, t)
      );
      const phi = Math.PI * S.unf,
        cf = Math.cos(phi),
        sf = Math.sin(phi);
      const front = (x: number, y: number) => proj(v, x, y);
      const back = (x: number, y: number) => proj(v, x, y * cf, -y * sf);
      const s = (fs * 0.6) / v.k;

      prob.style.opacity = String(S.txt);
      ask.style.opacity = String(clamp(S.ask, 0, 1));
      ask.style.transform = 'translateY(' + (1 - S.ask) * 10 + 'px)';
      const hy = lerp(lerp(hintY, hintY5, F * (1 - t)), mathY, U);
      under(hint3, S.hint3, hy);
      under(hint4, S.hint4, hy);
      under(hint5, S.hint5, hy);

      math.style.transform = 'translate(-50%,' + mathY + 'px)';
      [S.m1, S.m2, S.m3, S.m4, S.m5].forEach((o, i) =>
        pieces[i].forEach((n) => {
          n.style.opacity = String(clamp(o, 0, 1));
          n.style.transform = 'translateY(' + (1 - o) * 8 + 'px)';
        })
      );
      ringPath.style.strokeDashoffset = String(ringLen * (1 - S.ring));
      ring.style.opacity = S.ring > 0 ? '1' : '0';

      sheet(R.sheetB, back, PAPER.h, S.paper);
      sheet(R.sheetF, front, PAPER.h, S.paper);
      setOpacity(R.back, 1 - 0.45 * S.paper * clamp(0.5 + cf, 0, 1));

      const xa = lerp(RIVER[0], PAPER.x0, S.paper),
        xb = lerp(RIVER[1], PAPER.x1, S.paper),
        end = front(xb, 0);
      line(R.river, front(xa, 0), front(lerp(xa, xb, S.river), 0), S.river > 0);
      setText(
        R.riverT,
        Math.max(end[0] - fs * 1.9 + 3, (front(B.x, 0)[0] + end[0]) / 2),
        end[1] + fs * 1.05,
        fadeIn(S.river, 0.7)
      );

      const home = (
        map: (x: number, y: number) => [number, number],
        n: Record<string, any>
      ) => {
        const a = map(A.x, A.y);
        point(n.pA, a, S.a);
        names(n.lA, n.cA, map, A, S.a, v.k);
        line(n.dimA, a, map(A.x, A.y * (1 - S.aDim)), S.aDim > 0);
        corner(n.sqA, map, A.x, 0, [1, 0], [0, 1], s, fadeIn(S.aDim));
        label(n.tA, map, A.x, A.y / 2, -1.75, 0, fadeIn(S.aDim), v.k);
      };
      home(back, R);
      home(front, R.imp);
      const im = clamp(S.unf / 0.6, 0, 1);
      setOpacity(R.imp.g, S.paper * im * im * (3 - 2 * im));

      const b = front(B.x, B.y);
      point(R.pB, b, S.b);
      names(R.lB, R.cB, front, B, S.b, v.k);
      line(R.dimB, b, front(B.x, B.y * (1 - S.bRiver)), S.bRiver > 0);
      corner(R.sqB, front, B.x, 0, [-1, 0], [0, 1], s, fadeIn(S.bRiver));
      label(R.tB, front, B.x, B.y / 2, 1.75, 0, fadeIn(S.bRiver), v.k);

      const keep = CS.map((_, i) => (i === 2 ? 1 : 1 - S.focus));
      const cs = CS.map((p) => front(p.x, p.y));
      const shown = [S.c * S.sub, S.c2, S.c3, S.c4].map((o, i) => o * keep[i]);
      point(R.pC, cs[0], S.c);
      setOpacity(R.pC, S.c * (1 - S.sub));
      setText(R.lC, cs[0][0], cs[0][1] + fs * 1.15, S.c * (1 - S.sub));
      cs.forEach((q, i) => {
        point(R.pCs[i], q, i ? shown[i] : S.c * keep[0]);
        setOpacity(R.pCs[i], shown[i]);
        setText(R.lCs[i], q[0], q[1] + fs * 1.15, shown[i]);
      });

      const drawn = [S.walk, S.w2, S.w3, S.w4];
      let u1 = 0;
      CS.forEach((p, i) => {
        const bc = Math.hypot(B.x - p.x, B.y - p.y),
          ca = Math.hypot(A.x - p.x, A.y - p.y),
          d = drawn[i] * (bc + ca);
        const t1 = clamp(d / bc, 0, 1),
          t2 = clamp((d - bc) / ca, 0, 1);
        line(
          R.walkB[i],
          b,
          front(lerp(B.x, p.x, t1), lerp(B.y, p.y, t1)),
          d > 0
        );
        line(
          R.walkA[i],
          cs[i],
          back(lerp(p.x, A.x, t2), lerp(p.y, A.y, t2)),
          t2 > 0
        );
        line(
          R.imp.walkA[i],
          cs[i],
          front(lerp(p.x, A.x, t2), lerp(p.y, A.y, t2)),
          t2 > 0
        );
        setOpacity(R.walkB[i], keep[i]);
        setOpacity(R.walkA[i], keep[i]);
        setOpacity(R.imp.walkA[i], keep[i]);
        const lag =
          ((Math.hypot(b[0] - cs[i][0], b[1] - cs[i][1]) % DASH) / DASH) *
            MARCH -
          MARCH;
        if (Math.abs(lag - lagNow[i]) > 0.004) {
          R.walkA[i].style.animationDelay = lag + 's';
          lagNow[i] = lag;
        }
        if (!i) u1 = t2;
      });

      const fB = (front(B.x, -1)[1] - front(B.x, 0)[1]) / v.k;
      const dm = (fs * 2.3) / (v.k * fB),
        om = (fs * 0.4) / v.k,
        hm = (fs * 0.45) / v.k;
      const p0 = front(A.x, -dm),
        p1 = front(B.x, -dm),
        len2 = (p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 || 1,
        len = Math.sqrt(len2);
      const at = (q: [number, number]) =>
        ((q[0] - p0[0]) * (p1[0] - p0[0]) + (q[1] - p0[1]) * (p1[1] - p0[1])) /
        len2;
      const P = (f: number): [number, number] => [
        lerp(p0[0], p1[0], f),
        lerp(p0[1], p1[1], f),
      ];
      R.ext.setAttribute(
        'd',
        'M' +
          front(A.x, -om) +
          'L' +
          front(A.x, -dm - om) +
          'M' +
          front(B.x, -om) +
          'L' +
          front(B.x, -dm - om)
      );
      const gone = 1 - S.swap;
      setOpacity(R.ext, clamp(S.bEast * 5, 0, 1) * gone);
      setOpacity(R.dimE, gone);
      const half = gapW / 2 / len,
        room = half + (fs * 0.25) / len,
        fmid = at(front((A.x + B.x) / 2, -dm));
      const band = fs * 0.5,
        up = (q: [number, number]): [number, number] => [q[0], q[1] - band],
        dn = (q: [number, number]): [number, number] => [q[0], q[1] + band];
      const passes = (
        q0: [number, number],
        q1: [number, number]
      ): [number, number] | null => {
        const f1 = crossAt(up(p0), up(p1), q0, q1),
          f2 = crossAt(dn(p0), dn(p1), q0, q1);
        return f1 === null && f2 === null
          ? null
          : [Math.min(f1 ?? f2!, f2 ?? f1!), Math.max(f1 ?? f2!, f2 ?? f1!)];
      };
      const clearOf = (walks: [ [number, number], [number, number] ][]) => {
        let f = fmid;
        const ranges = walks
          .map(([q0, q1]) => passes(q0, q1))
          .filter((r): r is [number, number] => Boolean(r))
          .sort((r1, r2) => r1[0] - r2[0]);
        for (const [lo, hi] of ranges)
          if (f - room < hi && f + room > lo) f = hi + room;
        return clamp(f, fmid, 1 - half);
      };
      const fNow = clearOf(
        u1 > 0
          ? [[cs[0], back(lerp(C.x, A.x, u1), lerp(C.y, A.y, u1))]]
          : []
      );
      const homeOpen = front(A.x, -A.y);
      const fl = lerp(
        fNow,
        clearOf(cs.map((q) => [q, homeOpen])),
        S.lab4
      );
      if (S.bEast > 0) {
        const tx = lerp(A.x, B.x, S.bEast),
          ft = at(front(tx, -dm));
        const head = (x: number, dir: number) =>
          'M' +
          front(x - dir * hm, -dm + 0.55 * hm) +
          'L' +
          front(x, -dm) +
          'L' +
          front(x - dir * hm, -dm - 0.55 * hm);
        let d = 'M' + p0 + 'L' + P(Math.min(ft, fl - half));
        if (ft > fl + half) d += 'M' + P(fl + half) + 'L' + P(ft);
        R.dimE.setAttribute('d', d + head(A.x, -1) + head(tx, 1));
      } else R.dimE.setAttribute('d', '');
      const lp = P(fl);
      setText(R.tE, lp[0], lp[1], fadeIn(S.bEast) * gone);

      if (S.tri > 0) {
        const r = (fs * 0.34) / v.k,
          d = front(D.x, D.y);
        R.legs.setAttribute(
          'd',
          'M' +
            front(A.x + r, D.y) +
            'L' +
            front(lerp(A.x + r, D.x, S.tri), D.y) +
            'M' +
            front(B.x, B.y - r) +
            'L' +
            front(B.x, lerp(B.y - r, D.y, S.tri))
        );
        point(R.pD, d, S.dpt);
      } else {
        R.legs.setAttribute('d', '');
        setOpacity(R.pD, 0);
      }
      corner(R.sqD, front, D.x, D.y, [-1, 0], [0, 1], s, S.dpt);
      label(R.lD, front, D.x, D.y, 0.85, -0.95, S.dpt, v.k);
      const [bx, by] = front(D.x - (fs * 1.25) / v.k, 0);
      setText(R.tBD, bx, by, S.swap);
      R.tBD.setAttribute('transform', 'rotate(-90 ' + bx + ' ' + by + ')');
      label(R.tAD, front, (A.x + D.x) / 2, D.y, 0, -1, S.swap, v.k);

      switcher.style.opacity = String(S.sw);
    }

    function layout() {
      if (!stage) return;
      SW = stage.clientWidth;
      SH = stage.clientHeight;
      if (!SW || !SH) return;
      const gap = parseFloat(getComputedStyle(stage).rowGap) || 0;
      const g = SW < 560 ? 56 : 70;
      const W = Math.min(960, SW - g),
        fx = Math.min((SW - W) / 2, SW - g - W);
      const room = SH - prob.offsetHeight - ask.offsetHeight - 2 * gap;
      fs = clamp(Math.min(W / 48, room / 9), 12, 21);
      const m = { l: fs * 3.4, r: fs * 3.4, t: fs * 3.3, b: fs * 2.9 };
      const fit = (top: number) =>
        Math.min((W - m.l - m.r) / SPAN.w, (room - top - m.b) / SPAN.h, MAX_K);
      compact = fit(m.t) < 3 && fit(fs * 2.1) > fit(m.t);
      if (compact) m.t = fs * 2.1;
      const k = Math.max(0.5, fit(m.t));
      box.style.height = Math.round(SPAN.h * k + m.t + m.b) + 'px';
      V2 = makeView(0, k, fx + W / 2, box.offsetTop + m.t + SPAN.h * k);
      RIVER = [MID + (fx + 3 - V2.ox) / k, MID + (fx + W - 3 - V2.ox) / k];

      PAPER = {
        x0: -(m.l + (compact ? fs * 0.8 : 0)) / k,
        x1: SPAN.w + m.r / k,
        h: SPAN.h + (m.t * 0.92) / k,
      };
      const side = 16;
      hints.forEach((n) => {
        n.style.width = SW - 2 * side + 'px';
        n.style.left = side + 'px';
      });
      const e = reach(),
        pad = fs * 0.6,
        hg = fs * 0.9,
        hh = Math.max(...hints.map((n) => n.offsetHeight)),
        up = e.y1,
        down = -e.y0;
      const wide = 2 * Math.max(e.mid - e.x0, e.x1 - e.mid);
      const k3 = Math.max(
        0.5,
        Math.min(
          k,
          W / wide,
          (SH / 2 - pad) / up,
          (SH / 2 - pad - hg - hh) / down
        )
      );
      const oy3 = (SH - (up + down) * k3 - hg - hh) / 2 + up * k3;
      V3 = makeView(1, k3, fx + W / 2 - k3 * e.mid, oy3);
      hintY = oy3 + down * k3 + hg;

      const ph = PAPER.h,
        h5 = hint5.offsetHeight;
      const k5 = Math.max(
        0.5,
        Math.min(
          k,
          W / (PAPER.x1 - PAPER.x0),
          (SH - 2 * pad - hg - h5) / (2 * ph)
        )
      );
      const oy5 = (SH - 2 * ph * k5 - hg - h5) / 2 + ph * k5;
      V5 = makeView(
        0,
        k5,
        fx + W / 2 + k5 * (MID - (PAPER.x0 + PAPER.x1) / 2),
        oy5
      );
      hintY5 = oy5 + ph * k5 + hg;

      math.style.fontSize = '';
      const mw = math.offsetWidth,
        mf = parseFloat(getComputedStyle(math).fontSize);
      if (mw > SW - 2 * side)
        math.style.fontSize = Math.floor((mf * (SW - 2 * side)) / mw) + 'px';
      const mh = math.offsetHeight;
      const k6 = Math.max(
        0.5,
        Math.min(k5, (SH - 2 * pad - hg - mh) / (2 * ph))
      );
      const oy6 = pad + ph * k6;
      V6 = makeView(
        0,
        k6,
        SW / 2 + k6 * (MID - (PAPER.x0 + PAPER.x1) / 2),
        oy6
      );
      mathY = oy6 + ph * k6 + hg;
      drawRing();

      const sy = clamp(
        oy3 - switcher.offsetHeight / 2,
        0,
        Math.max(0, SH - switcher.offsetHeight)
      );
      switcher.style.transform =
        'translate(' +
        ((fx + W + SW) / 2 - switcher.offsetWidth / 2) +
        'px,' +
        sy +
        'px)';

      svg.setAttribute('viewBox', '0 0 ' + SW + ' ' + SH);
      svg.style.setProperty('--fs', fs + 'px');
      for (const n of [R.imp.mask, R.maskAll]) {
        n.setAttribute('x', String(-SW));
        n.setAttribute('y', String(-SH));
        n.setAttribute('width', String(3 * SW));
        n.setAttribute('height', String(3 * SH));
      }
      R.cA.style.textAnchor =
        R.cB.style.textAnchor =
        R.imp.cA.style.textAnchor =
          compact ? 'end' : '';
      gapW = (R.tE.getComputedTextLength() || fs * 2.6) + fs * 0.7;
      render(stateRef.current);
    }

    function flip(on: boolean) {
      if (!stateRef.current.controlsOn) return;
      window.cancelAnimationFrame(flipRafRef.current);
      const fromUnf = stateRef.current.unf;
      const toUnf = on ? 1 : 0;
      const dur = Math.max(400, 2600 * Math.abs(toUnf - fromUnf));
      const t0 = performance.now();
      updateStateRef.current({ switchOpen: on });

      const tick = (now: number) => {
        const u = Math.min(1, (now - t0) / dur);
        const eased = u >= 1 ? 1 : easeOut(u);
        const nextUnf = lerp(fromUnf, toUnf, eased);
        updateStateRef.current({ unf: nextUnf, switchOpen: on });
        if (u < 1) {
          flipRafRef.current = window.requestAnimationFrame(tick);
        }
      };
      flipRafRef.current = window.requestAnimationFrame(tick);
    }

    toggle.addEventListener('click', () => flip(!stateRef.current.switchOpen));
    wordFold.addEventListener('click', () => flip(false));
    wordUnfold.addEventListener('click', () => flip(true));

    renderFnRef.current = render;
    layout();
    document.fonts?.ready?.then(layout);
    const ro = new ResizeObserver(layout);
    ro.observe(stage);

    return () => {
      window.cancelAnimationFrame(flipRafRef.current);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'inherit',
      }}
    />
  );
};

function makeWalkElement(patch: Partial<WalkState>): VisualElement<WalkState> {
  return {
    id: 'walk-scene',
    type: 'walk-scene',
    x: 0,
    y: 0,
    opacity: 1,
    state: { ...BASE_STATE, ...patch },
  };
}

const STEP2_DONE: Partial<WalkState> = {
  river: 1,
  a: 1,
  aDim: 1,
  b: 1,
  bRiver: 1,
  bEast: 1,
  c: 1,
  walk: 1,
  ask: 1,
  txt: 1,
};

const STEP3_DONE: Partial<WalkState> = {
  ...STEP2_DONE,
  txt: 0,
  ask: 0,
  view: 1,
  paper: 1,
  unf: 0,
  sw: 1,
  hint3: 0,
  switchOpen: false,
  controlsOn: false,
};

const STEP4_DONE: Partial<WalkState> = {
  ...STEP3_DONE,
  sub: 1,
  c2: 1,
  c3: 1,
  c4: 1,
  w2: 1,
  w3: 1,
  w4: 1,
  lab4: 1,
  hint4: 1,
  unf: 1,
  switchOpen: true,
  controlsOn: false,
};

const STEP5_DONE: Partial<WalkState> = {
  ...STEP4_DONE,
  sw: 0,
  hint4: 0,
  focus: 1,
  hint5: 1,
  flat: 1,
  view: 0,
};

export const dannysWalkDemo: DemoConfig = {
  id: 'dannys-walk',
  name: "Danny's Walk",
  renderers: {
    'walk-scene': WalkSceneRenderer,
  },
  steps: [
    {
      stepNumber: 1,
      title: 'Problem Description',
      summary: 'The problem',
      initialElements: [makeWalkElement({ stepIdx: 0 })],
    },
    {
      stepNumber: 2,
      title: 'Problem Description',
      summary: 'The problem as a figure',
      initialElements: [makeWalkElement({ stepIdx: 1 })],
      async play(c) {
        await c.animateElement(
          'walk-scene',
          { state: { river: 1 } },
          { durationMs: 1000 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { a: 1 } },
          { durationMs: 450 }
        );
        await c.wait(100);
        await c.animateElement(
          'walk-scene',
          { state: { aDim: 1 } },
          { durationMs: 700 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { b: 1 } },
          { durationMs: 450 }
        );
        await c.wait(100);
        await c.animateElement(
          'walk-scene',
          { state: { bRiver: 1 } },
          { durationMs: 800 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { bEast: 1 } },
          { durationMs: 1100 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { c: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { walk: 1 } },
          { durationMs: 2600, easing: 'linear' }
        );
        await c.wait(350);
        await c.animateElement(
          'walk-scene',
          { state: { ask: 1 } },
          { durationMs: 600 }
        );
      },
    },
    {
      stepNumber: 3,
      title: 'Imagine Danny Living on a Folded Paper',
      summary: 'The folded paper',
      initialElements: [
        makeWalkElement({
          ...STEP2_DONE,
          stepIdx: 2,
          switchOpen: false,
          controlsOn: false,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'walk-scene',
          { state: { txt: 0, ask: 0, paper: 1 } },
          { durationMs: 1200 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { view: 1 } },
          { durationMs: 1700 }
        );
        await c.wait(700);
        c.updateElementImmediate('walk-scene', { state: { switchOpen: true } });
        await c.animateElement(
          'walk-scene',
          { state: { unf: 1 } },
          { durationMs: 3000 }
        );
        await c.wait(400);
        c.updateElementImmediate('walk-scene', { state: { controlsOn: true } });
        await c.animateElement(
          'walk-scene',
          { state: { sw: 1, hint3: 1 } },
          { durationMs: 600 }
        );
      },
      async exit({ currentElements, controller }) {
        const s = currentElements['walk-scene']?.state as WalkState | undefined;
        const curHint3 = s?.hint3 ?? 0;
        const curUnf = s?.unf ?? 0;
        controller.updateElementImmediate('walk-scene', {
          state: { controlsOn: false, switchOpen: false },
        });
        await Promise.all([
          controller.animateElement(
            'walk-scene',
            { state: { hint3: 0 } },
            { durationMs: 600 * curHint3 }
          ),
          controller.animateElement(
            'walk-scene',
            { state: { unf: 0 } },
            { durationMs: 2600 * curUnf }
          ),
        ]);
      },
    },
    {
      stepNumber: 4,
      title: 'Which Path Is the Shortest?',
      summary: 'Four walks',
      initialElements: [
        makeWalkElement({
          ...STEP3_DONE,
          stepIdx: 3,
          switchOpen: false,
          controlsOn: false,
        }),
      ],
      async play(c) {
        c.animateElement(
          'walk-scene',
          { state: { lab4: 1 } },
          { durationMs: 900 }
        ).catch(() => {});
        await c.animateElement(
          'walk-scene',
          { state: { sub: 1 } },
          { durationMs: 600 }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { c2: 1 } },
          { durationMs: 450 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { c3: 1 } },
          { durationMs: 450 }
        );
        await c.wait(150);
        await c.animateElement(
          'walk-scene',
          { state: { c4: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { w2: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { w3: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(200);
        await c.animateElement(
          'walk-scene',
          { state: { w4: 1 } },
          { durationMs: 1500, easing: 'linear' }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { hint4: 1 } },
          { durationMs: 600 }
        );
        c.updateElementImmediate('walk-scene', { state: { controlsOn: true } });
      },
      async exit({ currentElements, controller }) {
        const s = currentElements['walk-scene']?.state as WalkState | undefined;
        const curUnf = s?.unf ?? 0;
        controller.updateElementImmediate('walk-scene', {
          state: { controlsOn: false, switchOpen: true },
        });
        await controller.animateElement(
          'walk-scene',
          { state: { unf: 1 } },
          { durationMs: 2600 * (1 - curUnf) }
        );
      },
    },
    {
      stepNumber: 5,
      title: 'Which Path Is the Shortest?',
      summary: 'The straight walk',
      initialElements: [
        makeWalkElement({
          ...STEP4_DONE,
          stepIdx: 4,
          switchOpen: true,
          controlsOn: false,
        }),
      ],
      async play(c) {
        await c.animateElement(
          'walk-scene',
          { state: { sw: 0, hint4: 0 } },
          { durationMs: 600 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { focus: 1 } },
          { durationMs: 900 }
        );
        await c.wait(400);
        await c.animateElement(
          'walk-scene',
          { state: { hint5: 1 } },
          { durationMs: 600 }
        );
      },
      async exit({ controller }) {
        controller.updateElementImmediate('walk-scene', { state: { flat: 1 } });
        await controller.animateElement(
          'walk-scene',
          { state: { view: 0 } },
          { durationMs: 1700 }
        );
      },
    },
    {
      stepNumber: 6,
      title: 'Solve the Problem',
      summary: 'The answer',
      initialElements: [
        makeWalkElement({
          ...STEP5_DONE,
          stepIdx: 5,
        }),
      ],
      async play(c) {
        c.animateElement(
          'walk-scene',
          { state: { hint5: 0 } },
          { durationMs: 500 }
        ).catch(() => {});
        await c.animateElement(
          'walk-scene',
          { state: { rise: 1 } },
          { durationMs: 1300 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { tri: 1 } },
          { durationMs: 1400 }
        );
        await c.animateElement(
          'walk-scene',
          { state: { dpt: 1 } },
          { durationMs: 450 }
        );
        await c.wait(300);
        await c.animateElement(
          'walk-scene',
          { state: { swap: 1 } },
          { durationMs: 900 }
        );
        await c.wait(500);
        await c.animateElement(
          'walk-scene',
          { state: { m1: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m2: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m3: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m4: 1 } },
          { durationMs: 600 }
        );
        await c.wait(600);
        await c.animateElement(
          'walk-scene',
          { state: { m5: 1 } },
          { durationMs: 600 }
        );
        await c.wait(250);
        await c.animateElement(
          'walk-scene',
          { state: { ring: 1 } },
          { durationMs: 900 }
        );
      },
    },
  ],
};

const container = document.getElementById('deck');
if (container) {
  createRoot(container).render(<MathDemoPlayer demo={dannysWalkDemo} />);
}
