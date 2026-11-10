// Two Perpendicular Sticks: AB + CD = 10 cm: how long is AC? The figure is rebuilt with sticks, which are laid end to
// end on a ruler.

import React, { Fragment, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DemoConfig,
  ElementRendererComponent,
  MathDemoPlayer,
  StepAnimationController,
  VisualElement,
  useMeasure,
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

/* attributes and styles from the drawing's numbers (lengths in cm, drawn at U units per cm) */
const fade = (v: number) => (v <= 0.001 ? '0' : Math.min(1, v).toFixed(3));
const seen = (v: number): React.CSSProperties => ({ opacity: fade(v) });
const xyAt = (p: Pt) => ({ x: u(p.x), y: u(p.y) });
const lineAt = (p: Pt, q: Pt) => ({ x1: u(p.x), y1: u(p.y), x2: u(q.x), y2: u(q.y) });
const rectAt = (x: number, y: number, w: number, h: number, r?: number) => ({
  x: x.toFixed(2),
  y: y.toFixed(2),
  width: Math.max(0, w).toFixed(2),
  height: Math.max(0, h).toFixed(2),
  rx: (r || 0).toFixed(2),
});

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

/* ================= drawing ================= */

/** A main stick (AC or BD): wood with a pencil mark at O, or just a pencil line while `wood` is 0. */
function Stick(props: { O: Pt; ang: number; lift: number; live: number; tick: number; wood: number }) {
  const { O, ang, lift, live, tick } = props;
  const w = props.wood,
    x = YL,
    y = ZL,
    L = XL;
  const h = 0.06 + 0.2 * w;
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
  const body = rectAt(bx, by, bw, bh, br);
  return (
    <g>
      <rect
        className="shadow"
        filter="url(#soft)"
        transform={`translate(${u(O.x + 0.05 + 0.24 * lift)} ${u(O.y + 0.08 + 0.34 * lift)}) rotate(${ang.toFixed(2)})`}
        {...body}
        style={seen(w * (0.32 + 0.2 * lift) * live)}
      />
      <g transform={`translate(${u(O.x)} ${u(O.y)}) rotate(${ang.toFixed(2)})`} style={seen(live)}>
        <line className="pencil" y1={0} y2={0} x1={rx.toFixed(2)} x2={(y * U).toFixed(2)} style={seen(1 - w)} />
        <rect className="wood" {...body} style={seen(w * 1.6)} />
        <path
          className="grain"
          d={`M${(rx + 9).toFixed(1)} ${(-rh * 0.2).toFixed(1)}H${(y * U - 14).toFixed(1)}M${(rx + 24).toFixed(1)} ${(rh * 0.22).toFixed(1)}H${(y * U - 8).toFixed(1)}`}
          style={seen(w * 0.5)}
        />
        <rect className="stick-line" {...body} style={seen(w)} />
        <line className="omark" x1={0} x2={0} y1={(ry - 3).toFixed(2)} y2={(-ry + 3).toFixed(2)} style={seen(w * tick)} />
      </g>
    </g>
  );
}

/** A thin stick (a side of the figure): a pencil line that turns into a stick as `stk` goes to 1. */
function Thin({ seg, stk, rise, alpha }: { seg: [Pt, Pt]; stk: number; rise: number; alpha: number }) {
  const [p, q] = trimSeg(seg[0], seg[1]);
  const so = { x: REST.x + 0.1 * rise, y: REST.y + 0.14 * rise };
  return (
    <g style={seen(alpha)}>
      <line className="pencil" {...lineAt(seg[0], seg[1])} style={seen(1 - stk)} />
      <line
        className="thin-shadow"
        filter="url(#softU)"
        {...lineAt(add(p, so, 1), add(q, so, 1))}
        style={seen(stk * (0.3 + 0.25 * rise))}
      />
      <line className="thin-edge" {...lineAt(p, q)} style={seen(stk)} />
      <line className="thin thin-n" {...lineAt(p, q)} style={seen(stk)} />
    </g>
  );
}

/* the words and maths written on the paper */
const Yi = () => <i>y</i>;
const XminusY = () => (
  <>
    <i>x</i> − <i>y</i>
  </>
);
/** √2 · (and `then`, written on in the same run of text, as the original HTML had it) */
const R2 = ({ then = '' }: { then?: string }) => (
  <>
    <span className="rad">
      <span>2</span>
    </span>
    {'\u202f·\u202f' + then}
  </>
);
const RAD2 = () => (
  <span className="rad">
    <span>2</span>
  </span>
);

const LB_KEYS = ['yA', 'yB', 'zA', 'zB', 'xA', 'xB', 't1', 'plus', 't2', 'eq', 'ten'] as const;
type LbKey = (typeof LB_KEYS)[number];
const LB: Record<LbKey, { cls: string; body: ReactNode }> = {
  yA: { cls: 'ml c-blue', body: <Yi /> },
  yB: { cls: 'ml c-blue', body: <Yi /> },
  zA: { cls: 'ml c-orange', body: <XminusY /> },
  zB: { cls: 'ml c-orange', body: <XminusY /> },
  xA: { cls: 'ml', body: <i>x</i> },
  xB: { cls: 'ml', body: <i>x</i> },
  t1: { cls: 'ml c-blue', body: <><R2 /><Yi /></> },
  plus: { cls: 'ml', body: '+' },
  t2: { cls: 'ml c-orange', body: <><R2 then="(" /><XminusY />)</> },
  eq: { cls: 'ml', body: '=' },
  ten: { cls: 'ml', body: '10' },
};

/** The working, one line per row; `on` and `struck` say which rows show and whether row 2 is crossed out. */
function SolveRows({ on, struck, bx }: { on?: boolean[]; struck?: boolean; bx?: { l: string; r: string } }) {
  const cls = (n: number, extra = '') => 'srow' + extra + (on?.[n - 1] ? ' on' : '') + (n === 2 && struck ? ' struck' : '');
  return (
    <>
      <div className={cls(1)} data-r="1">
        <span className="sl">
          <span className="ph" data-p="t1">
            <span className="c-blue"><R2 /><Yi /></span>
          </span>{' '}
          <span className="ph" data-p="plus">+</span>{' '}
          <span className="ph" data-p="t2">
            <span className="c-orange"><R2 then="(" /><XminusY />)</span>
          </span>
        </span>
        <span className="se"><span className="ph" data-p="eq">=</span></span>
        <span className="sr"><span className="ph" data-p="ten">10</span></span>
        <span className="sn">what the ruler shows</span>
      </div>
      <div className={cls(2)} data-r="2">
        <span className="sl">
          <span className="c-blue st"><R2 /><Yi /></span>
          {' + '}
          <span className="c-orange">
            <R2 /><i>x</i>{' '}
            <span className="st">{'− '}<R2 /><Yi /></span>
          </span>
        </span>
        <span className="se">=</span>
        <span className="sr">10</span>
        <span className="sn">open the bracket</span>
      </div>
      <div className={cls(3)} data-r="3">
        <span className="sl"><R2 /><i>x</i></span>
        <span className="se">=</span>
        <span className="sr">10</span>
        <span className="sn">the <i>y</i> parts cancel</span>
      </div>
      <div className={cls(4)} data-r="4">
        <span className="sl"><i>x</i></span>
        <span className="se">=</span>
        <span className="sr">10 ÷ <RAD2 /></span>
        <span className="sn">divide both sides by √2</span>
      </div>
      <div className={cls(5)} data-r="5">
        <span className="sl"></span>
        <span className="se">=</span>
        <span className="sr">5<RAD2 /></span>
        <span className="sn">since 10 = 5 × √2 × √2</span>
      </div>
      <div
        className={cls(6, ' ans')}
        data-r="6"
        style={bx ? ({ '--bx-l': bx.l, '--bx-r': bx.r } as React.CSSProperties) : undefined}
      >
        <span className="sl">AC</span>
        <span className="se">=</span>
        <span className="sr">5<RAD2 /> cm</span>
      </div>
    </>
  );
}

type Size = { w: number; h: number };

const SticksSceneRenderer: ElementRendererComponent<SticksState> = ({ element }) => {
  const P = element.state;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const benchRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLParagraphElement | null>(null);
  const probRef = useRef<HTMLParagraphElement | null>(null);
  const solveRef = useRef<HTMLDivElement | null>(null);
  const solveProbeRef = useRef<HTMLDivElement | null>(null);
  const labelEls = useRef<Partial<Record<LbKey, HTMLSpanElement | null>>>({});
  const labelRefs = useMemo(
    () =>
      Object.fromEntries(
        LB_KEYS.map((k) => [k, (el: HTMLSpanElement | null) => void (labelEls.current[k] = el)])
      ) as Record<LbKey, (el: HTMLSpanElement | null) => void>,
    []
  );

  /* ---- measure 1: the box the mat sits in; it sets the scale ---- */
  const box = useMeasure<Size | null>(
    boxRef,
    () => {
      const r = boxRef.current!.getBoundingClientRect();
      return r.width && r.height ? { w: r.width, h: r.height } : undefined;
    },
    null
  );
  // a squarer mat when the box is tall
  const mode = !box ? '' : box.w / box.h < 1.12 ? 'narrow' : 'wide';
  const MAT = { w: 17.4, h: mode === 'narrow' ? 17.0 : 14.4 };
  const RUL = { x0: 1.2, top: MAT.h - 1.85, h: 1.45 };
  const RY = RUL.top - 0.15;
  const ar = MAT.w / MAT.h;
  const H = box?.h ?? 0,
    bw = box ? Math.min(box.w, H * ar) : 0,
    bh = bw / ar;
  const cmPx = bw / MAT.w;
  const KS = clamp(27 / cmPx, 1, 1.45);
  const KT = clamp(15 / (0.48 * cmPx), 1, 1.6);
  const scale = { cm: cmPx.toFixed(3) + 'px', k: KS.toFixed(3), kt: KT.toFixed(3) };

  /* ---- measure 2: the words at that scale, and whether the working is too wide for one line per row ---- */
  const text = useMeasure<{ sz: Record<LbKey, Size>; promptH: number; probH: number; stack: boolean } | null>(
    overlayRef,
    () => {
      const els = labelEls.current;
      if (!box || !promptRef.current || !probRef.current || !solveProbeRef.current || !benchRef.current) return undefined;
      const sz = {} as Record<LbKey, Size>;
      for (const k of LB_KEYS) sz[k] = { w: els[k]!.offsetWidth / cmPx, h: els[k]!.offsetHeight / cmPx };
      return {
        sz,
        promptH: promptRef.current.offsetHeight / cmPx,
        probH: probRef.current.offsetHeight / cmPx,
        stack: solveProbeRef.current.offsetWidth > benchRef.current.clientWidth * 0.96,
      };
    },
    null,
    [mode, scale.cm, scale.k, scale.kt]
  );
  const SZ: Record<LbKey, Size> =
    text?.sz ?? (Object.fromEntries(LB_KEYS.map((k) => [k, { w: 1, h: 0.7 }])) as Record<LbKey, Size>);
  const promptH = text?.promptH ?? 0.7,
    probH = text?.probH ?? 0.7;
  const stack = text?.stack ?? false;

  /* ---- measure 3: where the working's first row puts its terms, for the labels to fly to; the answer's box ---- */
  const solveAt = useMeasure<{ tgt: Record<string, Pt>; bx: { l: string; r: string } } | null>(
    overlayRef,
    () => {
      const solve = solveRef.current,
        overlay = overlayRef.current;
      if (!box || !solve || !overlay) return undefined;
      const rows = solve.querySelectorAll<HTMLElement>('.srow');
      const or = overlay.getBoundingClientRect();
      const ans = rows[5],
        ar = ans.getBoundingClientRect();
      const sl = ans.querySelector('.sl')!.getBoundingClientRect(),
        sr = ans.querySelector('.sr')!.getBoundingClientRect();
      const tgt: Record<string, Pt> = {};
      rows[0].querySelectorAll<HTMLElement>('[data-p]').forEach((ph) => {
        const r = ph.getBoundingClientRect();
        tgt[ph.dataset.p!] = { x: (r.left + r.width / 2 - or.left) / cmPx, y: (r.top + r.height / 2 - or.top) / cmPx };
      });
      return {
        tgt,
        bx: { l: (sl.left - ar.left).toFixed(1) + 'px', r: (ar.right - sr.right).toFixed(1) + 'px' },
      };
    },
    null,
    [mode, scale.cm, scale.k, scale.kt, stack]
  );
  const TGT = solveAt?.tgt ?? {};

  /* ---- the ticks and square pulse when the figure first shows (step 1) ---- */
  // Restarting the CSS animation takes a frame with the class off, then on again.
  const [pulse, setPulse] = useState(false);
  const pulseRaf = useRef(0),
    pulseTimer = useRef(0);
  useLayoutEffect(() => {
    if (P.pulseCount <= 0) return;
    setPulse(false);
    cancelAnimationFrame(pulseRaf.current);
    pulseRaf.current = requestAnimationFrame(() => {
      setPulse(true);
      window.clearTimeout(pulseTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulse(false), 3600);
    });
  }, [P.pulseCount]);
  useEffect(
    () => () => {
      cancelAnimationFrame(pulseRaf.current);
      window.clearTimeout(pulseTimer.current);
    },
    []
  );

  const shell = (inner: ReactNode) => (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <h1 className="sr-only">Two Perpendicular Sticks</h1>
      <div ref={boxRef} className="benchbox">
        {inner}
      </div>
    </div>
  );
  if (!box) return shell(null);

  /* ---- draw ---- */

  const promptTop = RUL.top - 0.3 - promptH;
  const regionTop = TXT_TOP + probH + 0.25;
  const regionBot = Math.min(RY - (SZ.t1.h + TT + 0.1), promptTop) - 0.2;
  const FIGY = (regionTop + regionBot) / 2;

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

  // BD: taken from the pile, laid under AC, then turned across it
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
          ? rigid(pileBD[0], pileBD[1], { x: left, y: FIGY + gap }, { x: left + X, y: FIGY + gap }, t)
          : pileBD;
    }
    const d = { x: (seg[1].x - seg[0].x) / X, y: (seg[1].y - seg[0].y) / X };
    Obd = add(seg[0], d, Y);
    aBD = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    liftBD = airborne(t);
  }
  const tickO = clamp((P.pick - 0.8) / 0.2);
  const bl = P.bdl,
    on = placed ? 1 : 0;
  const nameBD = P.bdOut < 0.999 ? 1 - clamp(P.bdOut * 5) : clamp(bl / 0.2) * on;
  const tickBD = clamp((bl - 0.2) / 0.15) * on;
  const dA = { x: 1, y: 0 },
    dB = dirDeg(aBD),
    nB = { x: dB.y, y: -dB.x },
    nBneg = { x: -nB.x, y: -nB.y };
  const A = add(Oac, dA, -Y),
    C = add(Oac, dA, Z),
    B = add(Obd, dB, -Y),
    D = add(Obd, dB, Z);

  // the homework figure's marks (steps 1-2)
  const t = 0.2;
  const mAO = { x: left + Y / 2, y: Oc.y },
    mBO = { x: Oc.x, y: top + Y / 2 };
  const mOC = { x: Oc.x + Z / 2, y: Oc.y },
    mOD = { x: Oc.x, y: Oc.y + Z / 2 };
  const sMark = 0.42;

  // the thin sticks: from the figure to the pile, back onto the figure, then onto the ruler
  const figT: Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]> = { AB: [Ac, Bc], BC: [Bc, Cc], CD: [Cc, Dc], DA: [Dc, Ac] };
  const aT: Record<string, number> = {},
    segT = {} as Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]>,
    riseT: Record<string, number> = {},
    pileT = {} as Record<'AB' | 'BC' | 'CD' | 'DA', [Pt, Pt]>;
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
  // the stick being moved goes on top
  const sticks: [string, number, ReactNode][] = [
    ['AC', 0, <Stick O={Oac} ang={0} lift={4 * c * (1 - c)} live={live} tick={tickO} wood={P.wood} />],
    [
      'BD',
      P.bdOut >= 0.999 && P.bdIn > 0 ? 16 : P.bdOut > 0 ? 14 : 1,
      <Stick O={Obd} ang={aBD} lift={liftBD} live={live} tick={tickBD} wood={P.wood} />,
    ],
    ['AB', tAB > 0 ? 21 : P.thinAB > 0 ? 19 : aT.AB > 0 ? 12 : 2, <Thin seg={segT.AB} stk={P.lift} rise={riseT.AB} alpha={live} />],
    ['BC', aT.BC > 0 ? 10 : 4, <Thin seg={segT.BC} stk={P.lift} rise={riseT.BC} alpha={live} />],
    ['CD', tCD > 0 ? 22 : P.thinCD > 0 ? 20 : aT.CD > 0 ? 13 : 3, <Thin seg={segT.CD} stk={P.lift} rise={riseT.CD} alpha={live} />],
    ['DA', aT.DA > 0 ? 11 : 5, <Thin seg={segT.DA} stk={P.lift} rise={riseT.DA} alpha={live} />],
  ];
  const stacked = sticks.map((s, i) => [s, i] as const).sort((p, q) => p[0][1] - q[0][1]);

  // letters on the sticks
  const pl = (1 - P.draw) * live;

  // the point O being picked on AC (step 3)
  const pk = P.pick;
  const pxk = pk < 0.5 ? lerp(0.35, 1.4 * Y, ease(pk / 0.5)) : lerp(1.4 * Y, Y, ease(clamp((pk - 0.5) / 0.3)));
  const tip = { x: A.x + pxk, y: Oac.y - TM - 0.07 };

  // y, x − y and x beside the main sticks
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
    c < 0.5 ? Y / 2 : Math.min(Y - SZ.yA.w / 2 - 0.05, Math.max(Y / 2, 0.46 * k + 0.25 * k + SZ.yA.w / 2 + 0.35));
  const xa = P.xdim * (1 - c) * live;
  const ya = Oac.y - (cl + SZ.yA.h + 0.14),
    yb = Obd.y + (cl + SZ.yB.h + 0.14);
  const sq = Math.min(0.5, Y * 0.25, Z * 0.25);

  // the equation on the ruler, which flies up into the working (steps 6-7)
  const g = P.gather,
    swap = g >= 0.999;
  const G = (p: Pt, key: string) => (TGT[key] ? lerp2(p, TGT[key], g) : p);
  const rowY = RY - (SZ.t1.h / 2 + TT + 0.1);
  const pPlus = {
    x: Math.max(RUL.x0 + ab, RUL.x0 + ab / 2 + SZ.t1.w / 2 + 0.15 + SZ.plus.w / 2),
    y: rowY,
  };
  const pEq = { x: RUL.x0 + 10 + 0.3 + SZ.eq.w / 2, y: rowY };
  const pTen = { x: pEq.x + SZ.eq.w / 2 + 0.2 + SZ.ten.w / 2, y: rowY };
  const hide = swap ? 0 : 1;

  // where each word on the paper goes, and how much of it shows
  const at = (p: Pt, a: number): React.CSSProperties => ({
    left: ((p.x / MAT.w) * 100).toFixed(3) + '%',
    top: ((p.y / MAT.h) * 100).toFixed(3) + '%',
    opacity: fade(a),
  });
  const atTop = (y: number, a: number): React.CSSProperties => ({ top: ((y / MAT.h) * 100).toFixed(3) + '%', opacity: fade(a) });
  const labelAt: Record<LbKey, React.CSSProperties> = {
    yA: at(add(add(Oac, dA, -alongYA), sideYA, reach(SZ.yA, sideYA) + cl), my * flip * live),
    yB: at(add(add(Obd, dB, -Y / 2), sideYB, reach(SZ.yB, sideYB) + cl), byl * flip * live),
    zA: at(add(add(Oac, dA, Z / 2), up, reach(SZ.zA, up) + cl), mz * live),
    zB: at(add(add(Obd, dB, Z / 2), nBneg, reach(SZ.zB, nBneg) + cl), bzl * live),
    xA: at({ x: left + X / 2, y: ya - 0.08 - SZ.xA.h / 2 }, xa),
    xB: at({ x: left + X / 2, y: yb + 0.08 + SZ.xB.h / 2 }, xa * bxl),
    t1: at(G(besideSeg(tAB > 0 ? segT.AB : [A, B], SZ.t1), 't1'), P.t1l * hide),
    plus: at(G(pPlus, 'plus'), P.eqn * hide),
    t2: at(G(besideSeg(tCD > 0 ? segT.CD : [C, D], SZ.t2), 't2'), P.t2l * hide),
    eq: at(G(pEq, 'eq'), P.eqn * hide),
    ten: at(G(pTen, 'ten'), P.eqn * hide),
  };
  const rowsOn = [swap, P.sol2 > 0.5, P.sol3 > 0.5, P.sol4 > 0.5, P.sol5 > 0.5, P.sol6 > 0.5];

  // the mat's centimetre grid and the ruler
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
  let rulerTicks = '';
  for (let i = 0; i <= 150; i++) {
    const X0 = (RUL.x0 + i / 10) * U,
      len = i % 10 === 0 ? 0.44 : i % 5 === 0 ? 0.3 : 0.17;
    rulerTicks += `M${X0.toFixed(1)} ${u(RUL.top)}v${u(len)}`;
  }
  const benchStyle = {
    width: bw + 'px',
    height: bh + 'px',
    left: (box.w - bw) / 2 + 'px',
    top: 0 + (H - bh) / 2 + 'px',
    '--cm': scale.cm,
    '--k': scale.k,
    '--kt': scale.kt,
  } as React.CSSProperties;

  return shell(
    <div ref={benchRef} className="bench" style={benchStyle}>
      <svg
        className="scene"
        role="img"
        aria-label={`The figure, step ${P.stepIdx + 1} of 7. ${ALT[P.stepIdx] || ALT[0]}`}
        viewBox={`0 0 ${MAT.w * U} ${MAT.h * U}`}
      >
        <defs>
          <filter id="soft" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id="softU" filterUnits="userSpaceOnUse" x={-200} y={-200} width={1200} height={1200}>
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <rect className="mat-bg" x={2} y={2} rx={14} width={String(MAT.w * U - 4)} height={String(MAT.h * U - 4)} />
        <g style={seen(live)}>
          <path className="grid" d={g1} />
          <path className="grid5" d={g5} />
        </g>
        <g style={seen(live)}>
          <rect className="ruler-body" x={u(RUL.x0 - 0.4)} y={u(RUL.top)} width={u(15.8)} height={u(RUL.h)} rx={5} />
          <path className="ruler-ticks" d={rulerTicks} />
          {Array.from({ length: 16 }, (_, n) => (
            <text
              key={n}
              className={'ruler-num' + (n === 10 && P.eqn * live > 0.5 ? ' hot' : '')}
              {...xyAt({ x: RUL.x0 + n, y: RUL.top + 0.74 })}
            >
              {String(n)}
            </text>
          ))}
          <text className="ruler-unit" {...xyAt({ x: RUL.x0 - 0.22, y: RUL.top + 1.16 })}>
            cm
          </text>
        </g>

        <g className={pulse ? 'pulse' : undefined} style={seen(P.marks)}>
          <path
            className="tick tick-y"
            d={`M${u(mAO.x)} ${u(mAO.y - t)}V${u(mAO.y + t)}M${u(mBO.x - t)} ${u(mBO.y)}H${u(mBO.x + t)}`}
          />
          <path
            className="tick tick-z"
            d={
              `M${u(mOC.x - 0.09)} ${u(mOC.y - t)}V${u(mOC.y + t)}M${u(mOC.x + 0.09)} ${u(mOC.y - t)}V${u(mOC.y + t)}` +
              `M${u(mOD.x - t)} ${u(mOD.y - 0.09)}H${u(mOD.x + t)}M${u(mOD.x - t)} ${u(mOD.y + 0.09)}H${u(mOD.x + t)}`
            }
          />
          <path className="sqr" d={`M${u(Oc.x)} ${u(Oc.y - sMark)}H${u(Oc.x + sMark)}V${u(Oc.y)}`} />
        </g>
        <g style={seen(P.draw)}>
          <text className="lbl print" {...xyAt({ x: Ac.x - 0.6 * k, y: Ac.y })}>A</text>
          <text className="lbl print" {...xyAt({ x: Bc.x, y: Bc.y - 0.6 * k })}>B</text>
          <text className="lbl print" {...xyAt({ x: Cc.x + 0.6 * k, y: Cc.y })}>C</text>
          <text className="lbl print" {...xyAt({ x: Dc.x, y: Dc.y + 0.62 * k })}>D</text>
          <text className="lbl print" {...xyAt({ x: Oc.x - 0.45 * k, y: Oc.y + 0.5 * k })}>O</text>
        </g>

        <g style={seen(P.sq * c * live)}>
          <path className="sqr" d={`M${u(Oc.x - sq)} ${u(Oc.y)}V${u(Oc.y - sq)}H${u(Oc.x)}`} />
          <path className="sqr" d={`M${u(Oc.x + sq)} ${u(Oc.y)}V${u(Oc.y + sq)}H${u(Oc.x)}`} />
        </g>

        <g>
          {stacked.map(([[key, , node]]) => (
            <Fragment key={key}>{node}</Fragment>
          ))}
        </g>

        <g>
          <path className="dim" d={`M${u(left)} ${u(ya + 0.16)}V${u(ya)}H${u(left + X)}V${u(ya + 0.16)}`} style={seen(xa)} />
          <path className="dim" d={`M${u(left)} ${u(yb - 0.16)}V${u(yb)}H${u(left + X)}V${u(yb - 0.16)}`} style={seen(xa * bxl)} />
          <path
            className="guide"
            d={`M${u(left)} ${u(Oac.y - 0.3)}V${u(Obd.y + 0.3)}M${u(left + X)} ${u(Oac.y - 0.3)}V${u(Obd.y + 0.3)}`}
            style={seen(clamp((bl - 0.05) / 0.2) * on * (1 - c) * live)}
          />
        </g>
        <path
          className="guide"
          d={`M${u(Oac.x)} ${u(Oac.y + 0.26)}V${u(Obd.y - 0.26)}`}
          style={seen(clamp((bl - 0.12) / 0.15) * on * tickO * (1 - c) * 0.9 * live)}
        />
        <path
          className="pick"
          d={`M${u(tip.x)} ${u(tip.y)}l${u(-0.17)} ${u(-0.32)}h${u(0.34)}Z`}
          style={seen(clamp(pk / 0.08) * (1 - clamp((pk - 0.85) / 0.15)) * live)}
        />

        <text className="lbl" {...xyAt(add(A, dA, -0.6 * k))} style={seen(pl)}>A</text>
        <text className="lbl" {...xyAt(add(B, dB, -0.6 * k))} style={seen(pl * nameBD)}>B</text>
        <text className="lbl" {...xyAt(add(C, dA, 0.6 * k))} style={seen(pl)}>C</text>
        <text className="lbl" {...xyAt(add(D, dB, 0.62 * k))} style={seen(pl * nameBD)}>D</text>
        <text
          className="lbl"
          {...xyAt(add(Oac, lerp2({ x: 0, y: 0.56 * k }, { x: -0.46 * k, y: 0.52 * k }, c), 1))}
          style={seen(pl * Math.max(P.wood * (1 - clamp(P.bdOut * 2)), tickO))}
        >
          O
        </text>
        <text className="lbl" {...xyAt({ x: Obd.x, y: Obd.y - 0.56 * k })} style={seen(pl * tickBD * (1 - c))}>
          O
        </text>
        <line
          className="read"
          {...lineAt({ x: RUL.x0 + 10, y: RY - 0.42 }, { x: RUL.x0 + 10, y: RUL.top + 0.56 })}
          style={seen(P.eqn * live)}
        />
      </svg>

      <div ref={overlayRef} className="overlay" aria-hidden="true">
        <p ref={promptRef} className="ptxt bold prompt" style={atTop(promptTop + 0.25 * (1 - P.prompt), P.prompt)}>
          Imagine: how would you build this shape using sticks?
        </p>
        <p ref={probRef} className="ptxt" style={atTop(TXT_TOP, P.prob)}>
          In the figure, <i>AB</i> + <i>CD</i>
          {' = 10 cm. What is the length of '}
          <i>AC</i>?
        </p>
        {LB_KEYS.map((key) => (
          <span key={key} ref={labelRefs[key]} className={LB[key].cls} style={labelAt[key]}>
            {LB[key].body}
          </span>
        ))}
        <div ref={solveRef} className={'solve' + (stack ? ' stack' : '')}>
          <SolveRows on={rowsOn} struck={P.strike > 0.5} bx={solveAt?.bx} />
        </div>
        {/* the working at its natural width, unseen: measured to decide whether its rows must stack */}
        <div ref={solveProbeRef} className="solve" style={{ maxWidth: 'none', visibility: 'hidden' }}>
          <SolveRows />
        </div>
      </div>
    </div>
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
