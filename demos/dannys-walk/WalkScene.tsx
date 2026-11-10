// Danny's Walk: the scene. Its state, and the renderer that draws it; the steps that change the state are in
// walk.tsx.

import React, { ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ElementRendererComponent,
  clamp,
  easeOut,
  lerp,
  useMeasure,
} from '../../framework';

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
/** How long the paper takes to unfold all the way, or to fold back, in ms. */
export const UNFOLD_MS = 2600;

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

export const BASE_STATE: WalkState = {
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

type XY = [number, number];
type Map2 = (x: number, y: number) => XY;
type View = ReturnType<typeof makeView>;

const SIDE = 16; // the words under the paper keep this far from the stage's sides

/* attributes for the drawing's marks */
const pathD = (on: boolean, p: XY, q: XY) => (on ? 'M' + p + 'L' + q : '');
const textAt = (x: number, y: number, op: number) => ({ x, y, opacity: clamp(op, 0, 1) });

/** The working of step 6: AB = √(120² + 50²) = … = 130 m. `s` gives each of its five pieces' styles. */
function Working({ s, ring }: { s?: (i: number) => React.CSSProperties; ring?: ReactNode }) {
  return (
    <>
      <span className="ml" data-s="1" style={s?.(1)}>
        <i>AB</i>
      </span>
      <span className="me" data-s="1" style={s?.(1)}>
        =
      </span>
      <span className="mr">
        <span data-s="1" style={s?.(1)}>
          <span className="rad">
            <span>
              120<sup>2</sup> + 50<sup>2</sup>
            </span>
          </span>
        </span>{' '}
        <span data-s="2" style={s?.(2)}>
          {'= 10 × '}
          <span className="rad">
            <span>
              12<sup>2</sup> + 5<sup>2</sup>
            </span>
          </span>
        </span>
      </span>
      <span className="ml"></span>
      <span className="me" data-s="3" style={s?.(3)}>
        =
      </span>
      <span className="mr">
        <span data-s="3" style={s?.(3)}>
          {'10 × '}
          <span className="rad">
            <span>169</span>
          </span>
        </span>{' '}
        <span data-s="4" style={s?.(4)}>
          = 10 × 13
        </span>
      </span>
      <span className="ml"></span>
      <span className="me" data-s="5" style={s?.(5)}>
        =
      </span>
      <span className="mr">
        <span className="ans" data-s="5" style={s?.(5)}>
          130 m{ring}
        </span>
      </span>
    </>
  );
}

const HINTS: ReactNode[] = [
  "Fold and unfold Danny's world yourself!",
  'Which path is the shortest? Unfold to find it out!',
  <>
    <i>BC</i>
    <sub>3</sub> + <i>C</i>
    <sub>3</sub>
    <i>A</i> is the shortest because it forms a straight line!
  </>,
];

/** How far the paper reaches when seen from the side, folded or unfolded, at scale 1. */
function reach(PAPER: { x0: number; x1: number; h: number }) {
  const v = makeView(1, 1, 0, 0);
  const e = { x0: 0, x1: 0, y0: 0, y1: 0, mid: 0 };
  const add = ([x, y]: XY) => {
    e.x0 = Math.min(e.x0, x);
    e.x1 = Math.max(e.x1, x);
    e.y0 = Math.min(e.y0, -y);
    e.y1 = Math.max(e.y1, -y);
  };
  for (const x of [PAPER.x0, PAPER.x1]) {
    add(proj(v, x, PAPER.h));
    for (let i = 0; i <= 12; i++) {
      const p = (i / 12) * Math.PI;
      add(proj(v, x, PAPER.h * Math.cos(p), -PAPER.h * Math.sin(p)));
    }
  }
  e.mid = (proj(v, PAPER.x0, 0)[0] + proj(v, PAPER.x1, 0)[0]) / 2;
  return e;
}

/** The hand-drawn ring round the answer, for a box w × h. */
function ringPath(w: number, h: number) {
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
  return 'M' + pts.join('L');
}

export const WalkSceneRenderer: ElementRendererComponent<WalkState> = ({ element, updateState }) => {
  const S = element.state;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const probRef = useRef<HTMLParagraphElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const askRef = useRef<HTMLParagraphElement | null>(null);
  const hintRefs = [useRef<HTMLParagraphElement | null>(null), useRef<HTMLParagraphElement | null>(null), useRef<HTMLParagraphElement | null>(null)];
  const mathRef = useRef<HTMLDivElement | null>(null);
  const mathProbeRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGSVGElement | null>(null);
  const ringPathRef = useRef<SVGPathElement | null>(null);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const tERef = useRef<SVGTextElement | null>(null);
  const walkARefs = [useRef<SVGPathElement | null>(null), useRef<SVGPathElement | null>(null), useRef<SVGPathElement | null>(null), useRef<SVGPathElement | null>(null)];

  /* ---- measure, in four passes: each one reads what the one before it has laid out ---- */

  // 1. the stage, and the words above and below the figure
  const stage = useMeasure(
    stageRef,
    () => {
      const el = stageRef.current!;
      if (!el.clientWidth || !el.clientHeight) return undefined;
      return {
        SW: el.clientWidth,
        SH: el.clientHeight,
        gap: parseFloat(getComputedStyle(el).rowGap) || 0,
        probH: probRef.current!.offsetHeight,
        askH: askRef.current!.offsetHeight,
        swW: switcherRef.current!.offsetWidth,
        swH: switcherRef.current!.offsetHeight,
      };
    },
    null as null | { SW: number; SH: number; gap: number; probH: number; askH: number; swW: number; swH: number }
  );
  const SW = stage?.SW ?? 0,
    SH = stage?.SH ?? 0;
  const g = SW < 560 ? 56 : 70;
  const W = Math.min(960, SW - g),
    fx = Math.min((SW - W) / 2, SW - g - W);
  const room = SH - (stage?.probH ?? 0) - (stage?.askH ?? 0) - 2 * (stage?.gap ?? 0);
  const fs = stage ? clamp(Math.min(W / 48, room / 9), 12, 21) : 18;
  const m = { l: fs * 3.4, r: fs * 3.4, t: fs * 3.3, b: fs * 2.9 };
  const fit = (top: number) => Math.min((W - m.l - m.r) / SPAN.w, (room - top - m.b) / SPAN.h, MAX_K);
  const compact = stage ? fit(m.t) < 3 && fit(fs * 2.1) > fit(m.t) : false;
  if (compact) m.t = fs * 2.1;
  const k = stage ? Math.max(0.5, fit(m.t)) : 1;
  const boxH = Math.round(SPAN.h * k + m.t + m.b);
  const RIVER: XY = [MID + (fx + 3 - (fx + W / 2)) / k, MID + (fx + W - 3 - (fx + W / 2)) / k];
  const PAPER = {
    x0: -(m.l + (compact ? fs * 0.8 : 0)) / k,
    x1: SPAN.w + m.r / k,
    h: SPAN.h + (m.t * 0.92) / k,
  };

  // 2. where the figure's box landed, the hints' heights at their width, the 120 m label at this size, and the
  //    working's natural width
  const placed = useMeasure(
    stageRef,
    () =>
      stage
        ? {
            boxTop: boxRef.current!.offsetTop,
            hintH: hintRefs.map((r) => r.current!.offsetHeight),
            tE: tERef.current!.getComputedTextLength(),
            mathW: mathProbeRef.current!.offsetWidth,
            mathF: parseFloat(getComputedStyle(mathProbeRef.current!).fontSize),
          }
        : undefined,
    null as null | { boxTop: number; hintH: number[]; tE: number; mathW: number; mathF: number },
    [stage]
  );
  const pad = fs * 0.6,
    hg = fs * 0.9;
  const V2 = makeView(0, k, fx + W / 2, (placed?.boxTop ?? 0) + m.t + SPAN.h * k);
  const e = reach(PAPER);
  const hh = placed ? Math.max(...placed.hintH) : 0,
    up = e.y1,
    down = -e.y0;
  const wide = 2 * Math.max(e.mid - e.x0, e.x1 - e.mid);
  const k3 = Math.max(0.5, Math.min(k, W / wide, (SH / 2 - pad) / up, (SH / 2 - pad - hg - hh) / down));
  const oy3 = (SH - (up + down) * k3 - hg - hh) / 2 + up * k3;
  const V3 = makeView(1, k3, fx + W / 2 - k3 * e.mid, oy3);
  const hintY = oy3 + down * k3 + hg;
  const ph = PAPER.h,
    h5 = placed?.hintH[2] ?? 0;
  const k5 = Math.max(0.5, Math.min(k, W / (PAPER.x1 - PAPER.x0), (SH - 2 * pad - hg - h5) / (2 * ph)));
  const oy5 = (SH - 2 * ph * k5 - hg - h5) / 2 + ph * k5;
  const V5 = makeView(0, k5, fx + W / 2 + k5 * (MID - (PAPER.x0 + PAPER.x1) / 2), oy5);
  const hintY5 = oy5 + ph * k5 + hg;
  const mathFont =
    placed && placed.mathW > SW - 2 * SIDE
      ? Math.floor((placed.mathF * (SW - 2 * SIDE)) / placed.mathW) + 'px'
      : undefined;
  const gapW = ((placed?.tE || fs * 2.6) + fs * 0.7);
  const swW = stage?.swW ?? 0,
    swH = stage?.swH ?? 0;
  const sy = clamp(oy3 - swH / 2, 0, Math.max(0, SH - swH));

  // 3. the working at its size, and the box its answer's ring goes round
  const sized = useMeasure(
    stageRef,
    () => {
      if (!placed) return undefined;
      const r = ringRef.current!.getBoundingClientRect();
      return { mathH: mathRef.current!.offsetHeight, ringW: r.width, ringH: r.height };
    },
    null as null | { mathH: number; ringW: number; ringH: number },
    [placed, mathFont]
  );
  const mh = sized?.mathH ?? 0;
  const k6 = Math.max(0.5, Math.min(k5, (SH - 2 * pad - hg - mh) / (2 * ph)));
  const oy6 = pad + ph * k6;
  const V6 = makeView(0, k6, SW / 2 + k6 * (MID - (PAPER.x0 + PAPER.x1) / 2), oy6);
  const mathY = oy6 + ph * k6 + hg;
  const ringBox = sized && sized.ringW && sized.ringH ? { w: sized.ringW, h: sized.ringH } : null;
  const ringD = ringBox ? ringPath(ringBox.w, ringBox.h) : undefined;

  // 4. how long the ring's path is, so it can draw itself
  const ringLen = useMeasure(ringPathRef, () => (ringD ? ringPathRef.current!.getTotalLength() : undefined), 0, [ringD]);

  const ready = Boolean(stage && placed && sized);

  /* ---- interact: the switch folds and unfolds the paper (steps 3-4) ---- */

  const flipRaf = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(flipRaf.current), []);
  function flip(on: boolean) {
    if (!S.controlsOn) return;
    window.cancelAnimationFrame(flipRaf.current);
    const fromUnf = S.unf;
    const toUnf = on ? 1 : 0;
    const dur = Math.max(400, UNFOLD_MS * Math.abs(toUnf - fromUnf));
    const t0 = performance.now();
    updateState({ switchOpen: on });
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      const eased = u >= 1 ? 1 : easeOut(u);
      updateState({ unf: lerp(fromUnf, toUnf, eased), switchOpen: on });
      if (u < 1) flipRaf.current = window.requestAnimationFrame(tick);
    };
    flipRaf.current = window.requestAnimationFrame(tick);
  }

  /* ---- draw ---- */

  // the camera: flat on (step 2), turned to see the fold (steps 3-5), flat again for the triangle (step 6)
  const t = S.view,
    F = S.flat,
    U = S.rise;
  const flat = (key: 'k' | 'ox' | 'oy') => lerp(lerp(V2[key], V5[key], F), V6[key], U);
  const v: View = makeView(t, lerp(flat('k'), V3.k, t), lerp(flat('ox'), V3.ox, t), lerp(flat('oy'), V3.oy, t));
  const phi = Math.PI * S.unf,
    cf = Math.cos(phi),
    sf = Math.sin(phi);
  const front: Map2 = (x, y) => proj(v, x, y);
  const back: Map2 = (x, y) => proj(v, x, y * cf, -y * sf);
  const s = (fs * 0.6) / v.k;

  const pointAt = (p: XY, op: number) => ({
    cx: p[0],
    cy: p[1],
    r: fs * 0.34 * (0.4 + 0.6 * op),
    opacity: clamp(op, 0, 1),
  });
  const labelAt = (map: Map2, x: number, y: number, dx: number, dy: number, op: number) => {
    const [px, py] = map(x + (dx * fs) / v.k, y + (dy * fs) / v.k);
    return textAt(px, py, op);
  };
  const cornerD = (map: Map2, x: number, y: number, d1: XY, d2: XY) =>
    'M' + map(x + d1[0] * s, y + d1[1] * s) +
    'L' + map(x + (d1[0] + d2[0]) * s, y + (d1[1] + d2[1]) * s) +
    'L' + map(x + d2[0] * s, y + d2[1] * s);
  const sheetD = (map: Map2) =>
    PAPER.h > 0
      ? 'M' + map(PAPER.x0, 0) + 'L' + map(PAPER.x1, 0) + 'L' + map(PAPER.x1, PAPER.h) + 'L' + map(PAPER.x0, PAPER.h) + 'Z'
      : '';
  const capAnchor: React.CSSProperties = { textAnchor: compact ? 'end' : undefined };
  /** a place's letter, and under it (beside it, when space is short) what it is */
  const names = (map: Map2, p: { x: number; y: number }, op: number) => ({
    letter: labelAt(map, p.x, p.y, 0, 1.05, op),
    caption: compact ? labelAt(map, p.x, p.y, -0.75, 1.05, op) : labelAt(map, p.x, p.y, 0, 2.2, op),
  });

  // the river, then home (on the back half) and the playground (on the front half)
  const xa = lerp(RIVER[0], PAPER.x0, S.paper),
    xb = lerp(RIVER[1], PAPER.x1, S.paper),
    end = front(xb, 0);
  const b = front(B.x, B.y);
  const nB = names(front, B, S.b);

  // C and the walks through it
  const keep = CS.map((_, i) => (i === 2 ? 1 : 1 - S.focus));
  const cs = CS.map((p) => front(p.x, p.y));
  const shown = [S.c * S.sub, S.c2, S.c3, S.c4].map((o, i) => o * keep[i]);
  const drawn = [S.walk, S.w2, S.w3, S.w4];
  const walks = CS.map((p, i) => {
    const bc = Math.hypot(B.x - p.x, B.y - p.y),
      ca = Math.hypot(A.x - p.x, A.y - p.y),
      d = drawn[i] * (bc + ca);
    const t1 = clamp(d / bc, 0, 1),
      t2 = clamp((d - bc) / ca, 0, 1);
    return {
      B: pathD(d > 0, b, front(lerp(B.x, p.x, t1), lerp(B.y, p.y, t1))),
      A: pathD(t2 > 0, cs[i], back(lerp(p.x, A.x, t2), lerp(p.y, A.y, t2))),
      imprintA: pathD(t2 > 0, cs[i], front(lerp(p.x, A.x, t2), lerp(p.y, A.y, t2))),
      t2,
      // the dashes march from B through C towards home: start the back half's dashes where the front half's end
      lag: ((Math.hypot(b[0] - cs[i][0], b[1] - cs[i][1]) % DASH) / DASH) * MARCH - MARCH,
    };
  });
  const u1 = walks[0].t2;

  // the 120 m measure under the river, kept clear of the walks that cross it
  const fB = (front(B.x, -1)[1] - front(B.x, 0)[1]) / v.k;
  const dm = (fs * 2.3) / (v.k * fB),
    om = (fs * 0.4) / v.k,
    hm = (fs * 0.45) / v.k;
  const p0 = front(A.x, -dm),
    p1 = front(B.x, -dm),
    len2 = (p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 || 1,
    len = Math.sqrt(len2);
  const along = (q: XY) => ((q[0] - p0[0]) * (p1[0] - p0[0]) + (q[1] - p0[1]) * (p1[1] - p0[1])) / len2;
  const P = (f: number): XY => [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];
  const gone = 1 - S.swap;
  const half = gapW / 2 / len,
    room2 = half + (fs * 0.25) / len,
    fmid = along(front((A.x + B.x) / 2, -dm));
  const band = fs * 0.5,
    bandUp = (q: XY): XY => [q[0], q[1] - band],
    bandDn = (q: XY): XY => [q[0], q[1] + band];
  const passes = (q0: XY, q1: XY): XY | null => {
    const f1 = crossAt(bandUp(p0), bandUp(p1), q0, q1),
      f2 = crossAt(bandDn(p0), bandDn(p1), q0, q1);
    return f1 === null && f2 === null
      ? null
      : [Math.min(f1 ?? f2!, f2 ?? f1!), Math.max(f1 ?? f2!, f2 ?? f1!)];
  };
  const clearOf = (crossing: [XY, XY][]) => {
    let f = fmid;
    const ranges = crossing
      .map(([q0, q1]) => passes(q0, q1))
      .filter((r): r is XY => Boolean(r))
      .sort((r1, r2) => r1[0] - r2[0]);
    for (const [lo, hi] of ranges) if (f - room2 < hi && f + room2 > lo) f = hi + room2;
    return clamp(f, fmid, 1 - half);
  };
  const fNow = clearOf(u1 > 0 ? [[cs[0], back(lerp(C.x, A.x, u1), lerp(C.y, A.y, u1))]] : []);
  const homeOpen = front(A.x, -A.y);
  const fl = lerp(fNow, clearOf(cs.map((q): [XY, XY] => [q, homeOpen])), S.lab4);
  let dimE = '';
  if (S.bEast > 0) {
    const tx = lerp(A.x, B.x, S.bEast),
      ft = along(front(tx, -dm));
    const head = (x: number, dir: number) =>
      'M' + front(x - dir * hm, -dm + 0.55 * hm) + 'L' + front(x, -dm) + 'L' + front(x - dir * hm, -dm - 0.55 * hm);
    let d = 'M' + p0 + 'L' + P(Math.min(ft, fl - half));
    if (ft > fl + half) d += 'M' + P(fl + half) + 'L' + P(ft);
    dimE = d + head(A.x, -1) + head(tx, 1);
  }
  const lp = P(fl);

  // the right triangle ABD on the unfolded paper (step 6)
  const r = (fs * 0.34) / v.k,
    dPt = front(D.x, D.y);
  const legs =
    S.tri > 0
      ? 'M' + front(A.x + r, D.y) + 'L' + front(lerp(A.x + r, D.x, S.tri), D.y) +
        'M' + front(B.x, B.y - r) + 'L' + front(B.x, lerp(B.y - r, D.y, S.tri))
      : '';
  const [bdx, bdy] = front(D.x - (fs * 1.25) / v.k, 0);

  // home's marks: drawn on the back half, and again (black, in a mask) as the see-through marks on the front half
  const home = (map: Map2, imprint: boolean) => {
    const a = map(A.x, A.y);
    const n = names(map, A, S.a);
    return (
      <>
        <path className="dim" d={pathD(S.aDim > 0, a, map(A.x, A.y * (1 - S.aDim)))} />
        <path className="sq" d={cornerD(map, A.x, 0, [1, 0], [0, 1])} opacity={clamp(fadeIn(S.aDim), 0, 1)} />
        {walks.map((w, i) => (
          <path
            key={i}
            ref={imprint ? undefined : walkARefs[i]}
            className={imprint ? 'walk' : 'walk w' + (i + 1)}
            d={imprint ? w.imprintA : w.A}
            opacity={clamp(keep[i], 0, 1)}
          />
        ))}
        <circle className="pt" {...pointAt(a, S.a)} />
        <text className="lbl" {...n.letter}>A</text>
        <text className="cap" style={capAnchor} {...n.caption}>home</text>
        <text className="len" {...labelAt(map, A.x, A.y / 2, -1.75, 0, fadeIn(S.aDim))}>20 m</text>
      </>
    );
  };

  // The back half's dashes keep their phase unless it moves by more than 4 ms, so they don't jitter. React has no
  // say in this one style, so it is kept here.
  const lagNow = useRef([0, 0, 0, 0]);
  useLayoutEffect(() => {
    if (!ready) return;
    walks.forEach((w, i) => {
      const n = walkARefs[i].current;
      if (n && Math.abs(w.lag - lagNow.current[i]) > 0.004) {
        n.style.animationDelay = w.lag + 's';
        lagNow.current[i] = w.lag;
      }
    });
  });

  const im = clamp(S.unf / 0.6, 0, 1);
  const hy = lerp(lerp(hintY, hintY5, F * (1 - t)), mathY, U);
  const under = (op: number): React.CSSProperties => ({
    width: SW - 2 * SIDE + 'px',
    left: SIDE + 'px',
    opacity: String(clamp(op, 0, 1)),
    transform: 'translateY(' + (hy + (1 - op) * 10) + 'px)',
  });
  const piece = (i: number): React.CSSProperties => {
    const o = [S.m1, S.m2, S.m3, S.m4, S.m5][i - 1];
    return { opacity: String(clamp(o, 0, 1)), transform: 'translateY(' + (1 - o) * 8 + 'px)' };
  };
  const mask = { x: String(-SW), y: String(-SH), width: String(3 * SW), height: String(3 * SH) };

  return (
    <div
      ref={stageRef}
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
    >
      <p ref={probRef} className="problem" aria-hidden={S.stepIdx >= FOLD ? 'true' : 'false'} style={{ opacity: String(S.txt) }}>
        Danny's home is <b>20 meters</b> north of a <b className="c-blue">straight river</b> that flows from west to
        east. A playground is <b>120 meters</b> east of his home and <b>30 meters</b> north of the river. After
        playing at the playground, Danny wants to walk to the river bank to wash up before going home. What is the
        shortest total distance he needs to walk?
      </p>
      <div ref={boxRef} className="figbox" style={stage ? { height: boxH + 'px' } : undefined} />
      <p
        ref={askRef}
        className="ask"
        style={{ opacity: String(clamp(S.ask, 0, 1)), transform: 'translateY(' + (1 - S.ask) * 10 + 'px)' }}
      >
        How short can <i>BC</i> + <i>CA</i> be?
      </p>

      <svg
        id="fig"
        role="img"
        aria-label={ALT[S.stepIdx] || ALT[1]}
        aria-hidden={S.stepIdx === 0 ? 'true' : undefined}
        viewBox={stage ? '0 0 ' + SW + ' ' + SH : undefined}
        style={stage ? ({ '--fs': fs + 'px' } as React.CSSProperties) : undefined}
      >
        <path className="sheet" d={sheetD(back)} opacity={clamp(S.paper, 0, 1)} />
        <g opacity={clamp(1 - 0.45 * S.paper * clamp(0.5 + cf, 0, 1), 0, 1)}>{home(back, false)}</g>
        <defs>
          <mask id="imprint" maskUnits="userSpaceOnUse" {...mask}>
            <rect fill="#fff" {...mask} />
            <g className="imprint" opacity={clamp(S.paper * im * im * (3 - 2 * im), 0, 1)}>
              {home(front, true)}
            </g>
          </mask>
        </defs>

        <g>
          <path className="sheet" mask="url(#imprint)" d={sheetD(front)} opacity={clamp(S.paper, 0, 1)} />
          <path className="dim" d={pathD(S.bRiver > 0, b, front(B.x, B.y * (1 - S.bRiver)))} />
          <path className="sq" d={cornerD(front, B.x, 0, [-1, 0], [0, 1])} opacity={clamp(fadeIn(S.bRiver), 0, 1)} />
          {walks.map((w, i) => (
            <path key={i} className={'walk w' + (i + 1)} d={w.B} opacity={clamp(keep[i], 0, 1)} />
          ))}
          <circle className="pt" {...pointAt(b, S.b)} />
          <text className="lbl" {...nB.letter}>B</text>
          <text className="cap" style={capAnchor} {...nB.caption}>playground</text>
          <text className="len" {...labelAt(front, B.x, B.y / 2, 1.75, 0, fadeIn(S.bRiver))}>30 m</text>
        </g>

        <path className="river" d={pathD(S.river > 0, front(xa, 0), front(lerp(xa, xb, S.river), 0))} />
        <text
          className="cap river-cap"
          {...textAt(Math.max(end[0] - fs * 1.9 + 3, (front(B.x, 0)[0] + end[0]) / 2), end[1] + fs * 1.05, fadeIn(S.river, 0.7))}
        >
          river
        </text>
        <circle className="pt c" {...pointAt(cs[0], S.c)} opacity={clamp(S.c * (1 - S.sub), 0, 1)} />
        <text className="lbl c" {...textAt(cs[0][0], cs[0][1] + fs * 1.15, S.c * (1 - S.sub))}>C</text>
        {cs.map((q, i) => (
          <circle
            key={i}
            className={'pt w' + (i + 1)}
            {...pointAt(q, i ? shown[i] : S.c * keep[0])}
            opacity={clamp(shown[i], 0, 1)}
          />
        ))}
        {cs.map((q, i) => (
          <text key={i} className={'lbl w' + (i + 1)} {...textAt(q[0], q[1] + fs * 1.15, shown[i])}>
            C
            <tspan className="sub" dy=".35em">
              {String(i + 1)}
            </tspan>
          </text>
        ))}
        <path
          className="ext"
          d={'M' + front(A.x, -om) + 'L' + front(A.x, -dm - om) + 'M' + front(B.x, -om) + 'L' + front(B.x, -dm - om)}
          opacity={clamp(clamp(S.bEast * 5, 0, 1) * gone, 0, 1)}
        />
        <path className="dim" d={dimE} opacity={clamp(gone, 0, 1)} />
        <text ref={tERef} className="len" {...textAt(lp[0], lp[1], fadeIn(S.bEast) * gone)}>
          120 m
        </text>

        <path className="leg" d={legs} />
        <path className="sq" d={cornerD(front, D.x, D.y, [-1, 0], [0, 1])} opacity={clamp(S.dpt, 0, 1)} />
        <circle className="pt" {...pointAt(dPt, S.dpt)} opacity={S.tri > 0 ? clamp(S.dpt, 0, 1) : 0} />
        <text className="lbl" {...labelAt(front, D.x, D.y, 0.85, -0.95, S.dpt)}>D</text>
        <text className="len" {...textAt(bdx, bdy, S.swap)} transform={'rotate(-90 ' + bdx + ' ' + bdy + ')'}>
          50 m
        </text>
        <text className="len" {...labelAt(front, (A.x + D.x) / 2, D.y, 0, -1, S.swap)}>120 m</text>
      </svg>

      {HINTS.map((h, i) => (
        <p key={i} ref={hintRefs[i]} className="hint" style={stage ? under([S.hint3, S.hint4, S.hint5][i]) : undefined}>
          {h}
        </p>
      ))}

      <div
        ref={mathRef}
        className="math"
        style={{ fontSize: mathFont, transform: 'translate(-50%,' + mathY + 'px)' }}
      >
        <Working
          s={piece}
          ring={
            <svg
              ref={ringRef}
              className="ring"
              aria-hidden="true"
              viewBox={ringBox ? '0 0 ' + ringBox.w + ' ' + ringBox.h : undefined}
              style={{ opacity: S.ring > 0 ? '1' : '0' }}
            >
              <path
                ref={ringPathRef}
                d={ringD}
                style={{ strokeDasharray: String(ringLen), strokeDashoffset: String(ringLen * (1 - S.ring)) }}
              />
            </svg>
          }
        />
      </div>
      {/* the working at its natural size, unseen: measured to decide whether it must be made smaller to fit */}
      <div ref={mathProbeRef} className="math" aria-hidden="true" style={{ visibility: 'hidden' }}>
        <Working />
      </div>

      <div
        ref={switcherRef}
        className={'switcher' + (S.controlsOn ? ' on' : '')}
        style={{
          transform: stage ? 'translate(' + ((fx + W + SW) / 2 - swW / 2) + 'px,' + sy + 'px)' : undefined,
          opacity: String(S.sw),
        }}
      >
        <button
          className={'switch-word' + (S.switchOpen ? '' : ' now')}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => flip(false)}
        >
          fold
        </button>
        <button
          className="switch"
          type="button"
          role="switch"
          aria-checked={S.switchOpen ? 'true' : 'false'}
          aria-label="Unfold the paper"
          tabIndex={S.controlsOn ? 0 : -1}
          aria-disabled={S.controlsOn ? undefined : 'true'}
          onClick={() => flip(!S.switchOpen)}
        >
          <span className="knob"></span>
        </button>
        <button
          className={'switch-word' + (S.switchOpen ? ' now' : '')}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => flip(true)}
        >
          unfold
        </button>
      </div>
    </div>
  );
};
