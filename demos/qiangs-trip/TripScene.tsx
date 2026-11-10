// Qiang's Trip: the scene. Its state, and the renderer that draws it; the steps that change the state are
// in trip.tsx.

import React, { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import {
  Bubble,
  BubbleAnchor,
  Chip,
  ElementRendererComponent,
  arrowPath,
  clamp,
  easeOut as stdEaseOut,
  lerp,
  placeBubble,
  useMeasure,
} from '../../framework';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

const XM = 3.5,
  YM = 65;
const XDRAG = 3,
  YDRAG = 55;
export const START = { x: 1.5, y: 40 };
export const PART1 = { x: 0.5, y: 30 };
const EXPLORE = 2; // 0-based index of step 3

export const ROAD_MS = 6450;
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

/* the road of steps 1-2, in its own 800 × 244 drawing */
const PART1_LEN = 250; // 40 → 290
const PART2_LEN = 470; // 290 → 760
const ROAD_LABELS: { key: string; cls: string; x: number; y: number; text: string }[] = [
  { key: 'dist1', cls: 'big c-blue', x: 165, y: 48, text: '15 mi' },
  { key: 'speed1', cls: 'sm c-blue', x: 165, y: 158, text: '30 mph' },
  { key: 'dist2', cls: 'big c-orange', x: 525, y: 48, text: '? mi' },
  { key: 'speed2', cls: 'sm c-orange', x: 525, y: 158, text: '55 mph' },
  { key: 'whole', cls: 'sm c-ink', x: 400, y: 236, text: '50 mph average' },
];

export type BubbleKey = 'none' | 'time1' | 'equal' | 'area' | 'time2' | 'answer';

/** What the bubble says, and where it sits on the chart. */
const SAY: Record<BubbleKey, ReactNode> = {
  none: null,
  time1: (
    <>
      <b className="c-blue">15</b><u>mi</u> ÷ <b className="c-blue">30</b><u>mph</u> = <b className="c-blue">0.5</b><u>h</u>
    </>
  ),
  equal: (
    <>
      The two areas<br />should be <b className="c-pink">equal</b>
    </>
  ),
  area: (
    <>
      <b className="c-pink">20</b> × <b className="c-blue">0.5</b> = <b className="c-pink">10</b>
    </>
  ),
  time2: (
    <>
      <b className="c-pink">10</b> ÷ <b className="c-pink">5</b> = <b className="c-orange">2</b><u>h</u>
    </>
  ),
  answer: (
    <>
      <b className="c-orange">2</b> × <b className="c-orange">55</b> = <b className="c-orange">110</b>
    </>
  ),
};

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

export const BASE_STATE: TripState = {
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

/* attributes for a rect and a text placed from the drawing's numbers (opacity clamped to 0–1) */
const rectAt = (x: number, y: number, w: number, h: number, op = 1) => ({
  x,
  y,
  width: Math.max(0, w),
  height: Math.max(0, h),
  opacity: clamp(op, 0, 1),
});
const textAt = (x: number, y: number, op = 1) => ({ x, y, opacity: clamp(op, 0, 1) });

/** Steps 1-2: the problem, and the trip drawn as a road as `road` goes from 0 to 1. */
function Road({ road }: { road: number }) {
  const at = (key: string) => clamp((road * ROAD_MS - ROAD[key][0]) / ROAD[key][1], 0, 1);
  const d1 = driving(at('drive1')),
    d2 = driving(at('drive2'));
  return (
    <svg
      className="road"
      viewBox="0 0 800 244"
      role="img"
      aria-label="A road in two parts: 15 miles at 30 mph, then an unknown distance at 55 mph, with an overall average of 50 mph"
      style={{ opacity: String(roadEaseOut(at('show'))) }}
    >
      <defs>
        <linearGradient id="gRoadB" gradientUnits="userSpaceOnUse" x1={290} y1={0} x2={760} y2={0}>
          <stop offset={0} style={{ stopColor: 'var(--orange)' }} />
          <stop offset={1} style={{ stopColor: 'var(--orange)', stopOpacity: 0.22 }} />
        </linearGradient>
      </defs>
      <line className="rline road-base" x1={40} y1={110} x2={760} y2={110} />
      <line
        className="rline drawn"
        pathLength={1}
        x1={40}
        y1={110}
        x2={290}
        y2={110}
        style={{ stroke: 'var(--blue)' }}
        strokeDashoffset={String(1 - d1)}
      />
      <line
        className="rline drawn"
        pathLength={1}
        x1={290}
        y1={110}
        x2={760}
        y2={110}
        stroke="url(#gRoadB)"
        strokeDashoffset={String(1 - d2)}
      />
      <g transform={'translate(' + (d1 * PART1_LEN + d2 * PART2_LEN) + ' 0)'}>
        <g transform="translate(40 99)">
          <rect className="car-body" x={-27} y={-24} width={54} height={16} rx={5} />
          <path className="car-body" d="M-15 -23 L-8 -37 H12 L21 -23 Z" />
          <circle className="car-wheel" cx={-14} cy={-8} r={6.5} />
          <circle className="car-wheel" cx={14} cy={-8} r={6.5} />
        </g>
      </g>
      {ROAD_LABELS.map(({ key, cls, x, y, text }) => {
        const p = roadEaseOut(at(key));
        return (
          <g key={key} opacity={clamp(p, 0, 1)} transform={'translate(0 ' + 8 * (1 - p) + ')'}>
            {key === 'whole' && <path className="brace" d="M40 184 v12 H760 v-12" />}
            <text className={'rt ' + cls} x={x} y={y}>
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const TripSceneRenderer: ElementRendererComponent<TripState> = ({ element, updateState }) => {
  const S = element.state;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const formulaRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const avgProbeRef = useRef<SVGTextElement | null>(null);

  /* ---- measure: the paper, then the things drawn on it whose size the text decides ---- */

  const paper = useMeasure<{ W: number; H: number } | null>(
    boxRef,
    () => {
      const r = boxRef.current!.getBoundingClientRect();
      return { W: Math.max(280, Math.floor(r.width)), H: Math.max(240, Math.floor(r.height)) };
    },
    null
  );
  const W = paper?.W ?? 0,
    H = paper?.H ?? 0;
  const narrow = W < 520;
  const M = { l: narrow ? 60 : 68, r: narrow ? 14 : 20, t: 8, b: narrow ? 58 : 64 };
  const pw = paper ? W - M.l - M.r : 0,
    ph = paper ? H - M.t - M.b : 0;
  const px = (t: number) => M.l + (t / XM) * pw;
  const py = (v: number) => M.t + (1 - v / YM) * ph;

  const formula = useMeasure(
    formulaRef,
    () => (pw ? { w: formulaRef.current!.offsetWidth, h: formulaRef.current!.offsetHeight } : undefined),
    { w: 0, h: 0 },
    [S.uX, S.uY, pw]
  );
  const bubble = useMeasure(
    bubbleRef,
    () => (pw ? { w: bubbleRef.current!.offsetWidth, h: bubbleRef.current!.offsetHeight } : undefined),
    { w: 0, h: 0 },
    [S.bubbleKey, pw]
  );
  // "average speed" on one line, to see whether it fits beside the chart or goes on two
  const afs = pw < 470 ? 15 : 17;
  const avgW = useMeasure(
    avgProbeRef,
    () => avgProbeRef.current!.getComputedTextLength() || afs * 6.2,
    0,
    [afs]
  );

  /* ---- interact: drag the point, or move it with the arrow keys (step 3) ---- */

  const dragRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [near, setNear] = useState(false);
  const tweenRafRef = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(tweenRafRef.current), []);

  function animatePointTo(x: number, y: number) {
    if (x === S.uX && y === S.uY) return;
    window.cancelAnimationFrame(tweenRafRef.current);
    const fromX = S.ptX,
      fromY = S.ptY;
    const t0 = performance.now();
    const dur = 140;
    updateState({ uX: x, uY: y });
    const tick = (now: number) => {
      const uVal = Math.min(1, (now - t0) / dur);
      const eased = uVal >= 1 ? 1 : stdEaseOut(uVal);
      updateState({ ptX: lerp(fromX, x, eased), ptY: lerp(fromY, y, eased), uX: x, uY: y });
      if (uVal < 1) tweenRafRef.current = window.requestAnimationFrame(tick);
    };
    tweenRafRef.current = window.requestAnimationFrame(tick);
  }

  function onPoint(e: React.PointerEvent) {
    const b = svgRef.current!.getBoundingClientRect(),
      r = e.pointerType === 'mouse' ? 28 : 40;
    const dx = e.clientX - b.left - px(S.ptX),
      dy = e.clientY - b.top - py(S.ptY);
    return dx * dx + dy * dy < r * r;
  }

  function moveTo(e: React.PointerEvent) {
    const b = svgRef.current!.getBoundingClientRect();
    const t = ((e.clientX - b.left - M.l) / pw) * XM,
      v = (1 - (e.clientY - b.top - M.t) / ph) * YM;
    animatePointTo(clamp(Math.round(t / 0.5) * 0.5, 0.5, XDRAG), clamp(Math.round(v / 5) * 5, 5, YDRAG));
  }

  function endDrag() {
    dragRef.current = false;
    setDragging(false);
  }

  const capHandlers = {
    onPointerDown(e: React.PointerEvent<SVGRectElement>) {
      if (!S.dragOn || !onPoint(e)) return;
      e.preventDefault();
      dragRef.current = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateState({ hov: 1 });
    },
    onPointerMove(e: React.PointerEvent<SVGRectElement>) {
      if (!S.dragOn) return;
      if (dragRef.current) {
        moveTo(e);
        return;
      }
      const isNear = onPoint(e);
      setNear(isNear);
      if (S.hov > 0.5 !== isNear) updateState({ hov: isNear ? 1 : 0 });
    },
    onPointerLeave() {
      setNear(false);
      if (!dragRef.current && S.hov !== 0) updateState({ hov: 0 });
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
  };

  function onHandleKey(e: React.KeyboardEvent) {
    if (!S.dragOn) return;
    let x = S.uX,
      y = S.uY;
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
  }

  /* ---- draw ---- */

  const x0 = px(0),
    y0 = py(0);
  const P = S.stepIdx === EXPLORE ? { x: S.uX, y: S.uY } : PART1;

  // the first part's rectangle: its corner is the point
  const rx = px(S.ptX),
    ry = py(S.ptY),
    w1 = rx - x0,
    h1 = y0 - ry;
  const small = w1 < 62;
  const yTxt = fmt(P.y),
    yW = 14 + 8 * yTxt.length;
  const hr = S.hR + 2.5 * S.hov;

  // the second part's rectangle, its brace, and the average line
  const a = px(0.5),
    b = px(XM),
    t55 = py(55),
    t50 = py(50);
  const bx = a + (b - a) * S.r2Rev;
  const big = pw >= 420 ? 26 : 20;
  const by = py(58);
  const brkPoints =
    a + ',' + (by - 5) + ' ' + a + ',' + (by + 5) + ' ' + a + ',' + by + ' ' +
    bx + ',' + by + ' ' + bx + ',' + (by - 5) + ' ' + bx + ',' + (by + 5);
  const ay = py(50);
  const ax = bx + 10;
  const avgWrap = M.l + pw - 4 - ax < avgW;

  // the deficit (above the first part) and the surplus (above the second), outlined in pink
  const dT = py(50),
    dB = py(30),
    dW = px(0.5) - x0,
    dcx = x0 + dW / 2;
  const ins = Math.min(7, dW / 5);
  const hlo = S.hlOp * S.hiOp,
    narrowH = dW - 2 * ins < 60,
    hfs = (pw < 420 ? 14 : 17) + 'px';

  // the formula rides just above the rectangle
  const fx = clamp((x0 + rx) / 2 - formula.w / 2, M.l + 4, M.l + pw - 4 - formula.w);
  let fy = ry - 32 - formula.h;
  if (fy < M.t + 4) fy = ry + 36;

  // the bubble, and the two arrows that point from it at the equal areas (step 7)
  const anchors: Record<BubbleKey, BubbleAnchor | null> = {
    none: null,
    time1: [px(0.5) + 20, py(0) - 12, 'right'],
    equal: [px(0.5) + 36 + bubble.w / 2, py(40), 'mid'],
    area: [px(0.5), py(40), 'right'],
    time2: [px(1.5), py(58) + 3, 'above'],
    answer: [px(1.5), py(27) + 16, 'below'],
  };
  const bubbleOp = clamp(S.bubble0 || 0, 0, 1);
  const anchor = anchors[S.bubbleKey];
  const placed =
    anchor && bubbleOp >= 0.001 ? placeBubble(anchor, bubble, { x: M.l, y: M.t, w: pw, h: ph }) : null;
  const eqOn = S.eqOp > 0.001 && S.bubble0 > 0.001 && placed;
  let eqA: string | undefined, eqB: string | undefined;
  if (eqOn) {
    const { left: bl, top: bt } = eqOn;
    const tx = Math.max(x0 + 14, Math.min((x0 + a) / 2, a - 30));
    eqA = arrowPath(bl, bt + bubble.h / 2, tx, bt + bubble.h / 2);
    const ux = clamp(a + (px(XM) - a) * 0.12, bl + 16, bl + bubble.w - 16);
    eqB = arrowPath(ux, bt, ux, (py(55) + py(50)) / 2);
  }

  // the chart's grid: a line every 5 mph and every half hour
  const speeds: number[] = [];
  for (let v = 0; v <= YM; v += 5) speeds.push(v);
  const times: number[] = [];
  for (let t = 0.5; t <= XM + 1e-9; t += 0.5) times.push(t);
  const yx = narrow ? 15 : 18,
    yy = M.t + ph / 2;

  const intro = 1 - 2 * S.view,
    chart = 2 * S.view - 1;

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      <div
        className="layer intro"
        style={{ opacity: clamp(intro, 0, 1), visibility: intro > 0 ? undefined : 'hidden' }}
      >
        <p className="problem">
          {'Qiang drives '}
          <b className="c-blue">15 miles</b>
          {' at an average speed of '}
          <b className="c-blue">30 miles per hour</b>
          {'. How many additional miles will he have to drive at '}
          <b className="c-orange">55 miles per hour</b>
          {' to average '}
          <b className="c-ink">50 miles per hour</b>
          {' for the entire trip?'}
        </p>
        <Road road={S.road} />
      </div>

      <div
        ref={boxRef}
        className="layer"
        style={{ opacity: clamp(chart, 0, 1), visibility: chart > 0 ? undefined : 'hidden' }}
      >
        <svg
          ref={svgRef}
          id="chart"
          role="img"
          aria-label="Average speed in mph against time in hours"
          width={paper ? W : undefined}
          height={paper ? H : undefined}
          viewBox={paper ? '0 0 ' + W + ' ' + H : undefined}
        >
          <rect className="plot" {...rectAt(M.l, M.t, pw, ph)} />
          <g>
            {speeds.map((v) => (
              <Fragment key={v}>
                <line className={'gl' + (v % 10 === 0 ? ' major' : '')} x1={M.l} x2={M.l + pw} y1={py(v)} y2={py(v)} />
                <text className="tick" x={M.l - 15} y={py(v) + 4} textAnchor="end">
                  {v < YM ? String(v) : null}
                </text>
              </Fragment>
            ))}
            {times.map((t) => (
              <line key={t} className="gl" x1={px(t)} x2={px(t)} y1={M.t} y2={M.t + ph} />
            ))}
            <line className="axis" x1={M.l} x2={M.l} y1={M.t} y2={M.t + ph} />
            <line className="axis" x1={M.l} x2={M.l + pw} y1={M.t + ph} y2={M.t + ph} />
          </g>
          <g opacity={clamp(S.xtOp, 0, 1)}>
            {times.map((t) => (
              <text key={t} className="tick" x={px(t)} y={py(0) + 19} textAnchor="middle">
                {t < XM - 1e-9 ? fmt(t) : null}
              </text>
            ))}
          </g>

          <rect className="rc r1" {...rectAt(x0, ry, w1, h1, S.r1Op)} />
          <rect className="rc r2" {...rectAt(a, t55, bx - a, y0 - t55, S.r2Op)} />
          <line className="avg" x1={x0} x2={x0 + S.avgP * (bx - x0)} y1={ay} y2={ay} opacity={clamp(S.avgP * 5, 0, 1)} />
          <polyline className="brk" points={brkPoints} opacity={clamp(S.brkOp, 0, 1)} />
          <rect className="hi" {...rectAt(x0 + ins, dT + ins, dW - 2 * ins, dB - dT - 2 * ins, S.hiOp)} />
          <rect className="hi" {...rectAt(a + ins, t55 + ins, bx - a - 2 * ins, t50 - t55 - 2 * ins, S.hiOp)} />
          <path className="eqa" d={eqA} opacity={eqOn ? clamp(S.eqOp, 0, 1) : 0} />
          <path className="eqa" d={eqB} opacity={eqOn ? clamp(S.eqOp, 0, 1) : 0} />

          <text
            className="tx c-ink"
            style={{ fontSize: (small ? 13 : 17) + 'px' }}
            {...textAt(x0 + w1 / 2, ry + h1 / 2 + 5, S.r1Op * S.r1Lab)}
          >
            {fmt(Math.round(S.ptX * S.ptY * 10) / 10) + ' mi'}
          </text>
          <text className="tx c-ink" style={{ fontSize: big + 'px' }} {...textAt(px(1.5), py(27) + 4, S.r2LabOp * (1 - S.ans))}>
            ? mi
          </text>
          <text className="tx c-ink" style={{ fontSize: big + 'px' }} {...textAt(px(1.5), py(27) + 4, S.r2LabOp * S.ans)}>
            110 mi
          </text>
          <text
            className="tx c-ink"
            style={{ fontSize: hfs }}
            {...textAt(dcx, (dT + dB) / 2 + (narrowH ? -3 : 5), hlo)}
          >
            <tspan>10</tspan>
            <tspan x={narrowH ? dcx : undefined} dy={narrowH ? '15' : undefined}>
              {narrowH ? 'mi' : ' mi'}
            </tspan>
          </text>
          <text
            className="tx c-ink"
            style={{ fontSize: hfs }}
            {...textAt((a + ins + (bx - ins)) / 2, (t55 + t50) / 2 + 5, hlo)}
          >
            10 mi
          </text>
          <text
            className="tx c-ink halo"
            style={{ textAnchor: 'start', fontSize: afs + 'px' }}
            {...textAt(ax, avgWrap ? ay + afs * 0.33 - afs * 0.55 : ay + afs * 0.33, (S.avgP - 0.75) * 4)}
          >
            <tspan>average</tspan>
            <tspan x={avgWrap ? ax : undefined} dy={avgWrap ? afs * 1.1 : undefined}>
              {avgWrap ? 'speed' : ' speed'}
            </tspan>
          </text>
          <text className="tx c-ink" style={{ fontSize: '18px' }} {...textAt(px(1.5), by + 20, S.brkOp * (1 - S.lab))}>
            ? h
          </text>
          <text className="tx c-ink" style={{ fontSize: '18px' }} {...textAt(px(1.5), by + 20, S.brkOp * S.lab)}>
            2 h
          </text>
          <text
            className="atitle"
            style={{ textAnchor: 'middle', fontSize: (narrow ? 18 : 21) + 'px' }}
            x={M.l + pw / 2}
            y={H - 10}
          >
            time (hours)
          </text>
          <text
            className="atitle"
            style={{ textAnchor: 'middle', fontSize: (narrow ? 18 : 21) + 'px' }}
            x={yx}
            y={yy}
            transform={'rotate(-90 ' + yx + ' ' + yy + ')'}
          >
            average speed (mph)
          </text>

          <Chip colour="blue" cx={rx} cy={y0 + 17} text={fmt(P.x)} opacity={S.gxOp * S.r1Op} />
          <Chip colour="orange" cx={px(2.5)} cy={y0 + 17} text="2.5" opacity={S.x25} />
          <Chip colour="blue" cx={M.l - 4 - yW / 2} cy={ry} text={yTxt} opacity={S.gdOp * S.r1Op} minWidth={yW} />
          <Chip colour="orange" cx={M.l - 19} cy={py(55)} text="55" opacity={S.y55} minWidth={30} />
          <Chip colour="ink" cx={M.l - 19} cy={py(50)} text="50" opacity={clamp(S.avgP * 3, 0, 1)} minWidth={30} />

          <g opacity={clamp(S.carOp, 0, 1)} transform={'translate(' + px(S.carX) + ' ' + y0 + ') scale(1.2)'}>
            <rect className="tcb" x={-15} y={-14} width={30} height={8} rx={3} />
            <path className="tcb" d="M-7 -14 L-3.5 -21 H5 L9.5 -14 Z" />
            <circle className="tcw" cx={-7.5} cy={-4} r={4} />
            <circle className="tcw" cx={8} cy={-4} r={4} />
          </g>

          <g
            className="handle"
            tabIndex={S.dragOn ? 0 : -1}
            role="slider"
            aria-label="Point: speed and time. Arrow keys move it."
            aria-valuetext={S.uY + ' mph, ' + S.uX + ' hours, ' + fmt(S.uX * S.uY) + ' miles'}
            transform={'translate(' + rx + ' ' + ry + ')'}
            opacity={clamp(S.hOp, 0, 1)}
            onKeyDown={onHandleKey}
          >
            <circle className="hring" r={hr + 8} style={{ display: S.ring > 0.05 ? undefined : 'none' }} />
            <circle className="hfocus" r={hr + 6} />
            <circle className="hcore" r={String(hr)} />
            <path
              className="hicon"
              d="M-5 0H5M0-5V5M-2-3L0-5L2-3M-2 3L0 5L2 3M-3-2L-5 0L-3 2M3-2L5 0L3 2"
              opacity={clamp((S.hR - 6) / 5, 0, 1)}
            />
          </g>
          <rect
            className={'cap-hit' + (S.dragOn ? ' on' : '') + (dragging ? ' drag' : '') + (near ? ' near' : '')}
            style={{ pointerEvents: S.dragOn ? 'all' : 'none' }}
            {...rectAt(M.l, M.t, pw, ph)}
            {...capHandlers}
          />

          {/* "average speed" on one line, unseen: measured to decide whether the label beside the chart wraps */}
          <text
            ref={avgProbeRef}
            className="tx c-ink halo"
            style={{ textAnchor: 'start', fontSize: afs + 'px', visibility: 'hidden' }}
            aria-hidden="true"
          >
            <tspan>average</tspan>
            <tspan> speed</tspan>
          </text>
        </svg>

        <div
          ref={formulaRef}
          className="formula"
          aria-live="polite"
          style={{
            maxWidth: pw ? pw - 16 : undefined,
            transform: 'translate(' + fx + 'px,' + fy + 'px)',
            opacity: clamp(S.fOp, 0, 1),
          }}
        >
          <span className="w">distance = speed × time =</span>{' '}
          <span>
            <b className="c-blue">{fmt(S.uY)}</b>
            <u>mph</u>
          </span>
          {' × '}
          <span>
            <b className="c-blue">{fmt(S.uX)}</b>
            <u>h</u>
          </span>
          {' = '}
          <span>
            <b className="c-blue z">{fmt(S.uX * S.uY)}</b>
            <u>mi</u>
          </span>
        </div>

        <Bubble
          ref={bubbleRef}
          opacity={bubbleOp}
          placement={placed}
          maxWidth={pw ? Math.min(360, pw - 24) : undefined}
        >
          {SAY[S.bubbleKey]}
        </Bubble>
      </div>
    </div>
  );
};
