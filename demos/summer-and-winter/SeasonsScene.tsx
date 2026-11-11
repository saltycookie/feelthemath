// Summer and Winter: the scene. Its state, and the renderer that draws it; the steps that change the state are in
// seasons.tsx.

import React, { useRef, useState } from 'react';
import {
  arrowPath,
  clamp,
  clamp01,
  lerp,
  smoothstep,
  textAt,
  useMeasure,
  useTween,
  type ElementRendererComponent,
} from '../../framework';

const RAD = Math.PI / 180;

/* ---------- the sky's numbers, in degrees ---------- */
/** How far Earth's axis leans from upright. */
const TILT = 23.44;
/** How far north "you" live: picked so that December's noon light covers exactly twice the ground June's does. */
const LATITUDE = Math.atan(1 / (3 * Math.tan(TILT * RAD))) / RAD; // 37.6
/** How high the noon Sun stands over "you", measured up from the ground. */
const SUN_JUNE = 90 - LATITUDE + TILT; // 75.9
const SUN_DECEMBER = 90 - LATITUDE - TILT; // 29.0
/** How far "you" are round the globe from the point that faces the Sun. */
const FROM_SUN_JUNE = LATITUDE - TILT;
const FROM_SUN_DECEMBER = LATITUDE + TILT;
/** The squares of ground one beam of sunlight covers in June. In December it covers twice as many. */
const SQUARES = 4;
/** The squares drawn on the ground. */
const GROUND_SQUARES = 10;

/** The months marked on the orbit, a quarter of a year apart, from the one in which the top of Earth leans to the Sun. */
const MONTHS = ['June', 'September', 'December', 'March'];

/** How long the Earth takes to glide to where a key press sends it, in ms. */
const GLIDE_MS = 140;
/** One press of an arrow key moves the Earth this much of a year, */
const KEY_YEAR = 1 / 24;
/** and the Sun this much of the way between its June and December heights. */
const KEY_SUN = 1 / 8;

const SIDE = 16; // the hints keep this far from the stage's sides

const ALT = [
  '',
  'Seen from above: the Sun, and Earth going around it in a circle through June, September, December and March, ' +
    'always about the same distance away.',
  'The same orbit seen from the side. Earth is a globe with a line through its poles, and the line leans over: ' +
    'Earth is tilted.',
  'Earth goes around the Sun and leaves a print in June, September, December and March. Its axis leans the same ' +
    'way in all four.',
  'June and December close up, on either side of the Sun, with a pink dot, you, on the top half of Earth. In June ' +
    'the top of Earth leans toward the Sun; in December it leans away.',
  'In June a ray of sunlight meets the ground at the dot almost straight on. In December it meets it at a slant.',
  'Standing at the dot. A beam of sunlight comes down from a high Sun and lights 4 squares of ground. With the Sun ' +
    'low, as in December, the same beam is spread over 8 squares, and each is lit less.',
  'June and December again. Under June, with its straight light: summer. Under December, with its slanted light: winter.',
];

/**
 * What the scene looks like at one moment. The steps (seasons.tsx) animate these values; the reader changes `year`
 * by dragging the Earth and `sunHeight` by dragging the Sun. Unless it says otherwise, a number runs from 0 (hidden,
 * or not begun) to 1 (shown, or done).
 */
export interface SeasonsState {
  /** The step being shown, counted from 0. */
  stepIdx: number;
  /** The question of step 1. */
  question: number;
  /** The Sun. */
  sun: number;
  /** The Earth. */
  earth: number;
  /** The words "Sun" and "Earth" beside them. */
  names: number;
  /** The dashed line from the Sun to the Earth, drawn from the Sun. */
  distance: number;
  /** Where the Earth is on its way round the Sun, in years since June: 0.25 is September, 0.5 December, 0.75 March. */
  year: number;
  /** How much of the orbit is drawn, in years since June. Each month's name appears as the line reaches it. */
  orbit: number;
  /** The hint in step 2: Earth stays about the same distance from the Sun. */
  hintDistance: number;
  /** The camera: 0 looks down on the orbit from above, 1 looks at it from the side. */
  sideView: number;
  /** The Earth: 0 a dot, 1 a globe with its equator and its night side. */
  globe: number;
  /** The dashed upright line through the Earth, to see its lean against. */
  upright: number;
  /** The Earth's axis. */
  axis: number;
  /** How far the axis leans: 0 upright, 1 tilted. */
  tilt: number;
  /** The prints the Earth leaves at the four months, in years since June: each appears as this passes it. */
  prints: number;
  /** Whether the reader can drag the Earth round the Sun (step 4). */
  earthDraggable: boolean;
  /** The hint in step 4: drag the Earth. */
  hintDragEarth: number;
  /** The pulsing ring round the thing to drag. */
  ring: number;
  /** The camera: 0 the whole orbit from the side, 1 June's and December's Earths close up, either side of the Sun. */
  closeUp: number;
  /** "you": the pink dot on each Earth, and the word beside it. */
  you: number;
  /** The ground at each dot: a short line that touches the globe there. */
  floor: number;
  /** The ray of sunlight that reaches "you" on each Earth: June's arrives, then December's. */
  rays: number;
  /** The camera: 0 the two Earths, 1 standing on the ground at "you" in June. */
  ground: number;
  /** How high the Sun stands over the ground: 1 as at noon in June, 0 as in December. */
  sunHeight: number;
  /** The Sun's path from June down to December, and the count of lit squares. */
  marks: number;
  /** Whether the reader can drag the Sun up and down (step 7). */
  sunDraggable: boolean;
  /** The hint in step 7: drag the Sun. */
  hintDragSun: number;
  /** "summer" under June, then "winter" under December. */
  seasons: number;
}

/** The state before anything is drawn. Each step begins as this with some of the values changed. */
export const BASE_STATE: SeasonsState = {
  stepIdx: 0,
  question: 0,
  sun: 0,
  earth: 0,
  names: 0,
  distance: 0,
  year: 0,
  orbit: 0,
  hintDistance: 0,
  sideView: 0,
  globe: 0,
  upright: 0,
  axis: 0,
  tilt: 0,
  prints: 0,
  earthDraggable: false,
  hintDragEarth: 0,
  ring: 0,
  closeUp: 0,
  you: 0,
  floor: 0,
  rays: 0,
  ground: 0,
  sunHeight: 1,
  marks: 0,
  sunDraggable: false,
  hintDragSun: 0,
  seasons: 0,
};

type XY = [number, number];

const wrap = (year: number) => ((year % 1) + 1) % 1;

/* ================= where everything goes ================= */

/**
 * The sizes of the four views for a stage W × H, in px: the orbit from above, the orbit from the side, June and
 * December close up, and the ground. `fs` is the size of the labels, `hintH` the height of the tallest hint (the
 * first two views and the last have a hint under them, at their `hintY`), and `monthW` the width of the widest month
 * written beside the orbit.
 */
function layOut(W: number, H: number, fs: number, hintH: number, monthW: number) {
  const room = H - hintH - 0.9 * fs;

  // from the side: the orbit is as wide as the stage, and flat enough to leave the Sun clear of the Earth passing
  // in front of it and behind it
  let rEarth = clamp(Math.max(W / 18, Math.min(W / 14, room / 22)), 13, 52);
  let R = Math.min(W / 2 - Math.max(rEarth + 10, 2.5 * fs), 11.5 * rEarth);
  const flat = clamp((3 * rEarth) / R, Math.sin(22 * RAD), Math.sin(50 * RAD));
  const tall = R * flat + 1.3 * rEarth + 1.7 * fs;
  if (tall > room / 2) {
    const fit = Math.max(0.3, (room / 2 - 1.7 * fs) / (R * flat + 1.3 * rEarth));
    rEarth *= fit;
    R *= fit;
  }
  const side = { R, flat, rEarth, rSun: 1.2 * rEarth, hintY: room / 2 + R * flat + 1.3 * rEarth + 2.2 * fs };

  // from above: a circle, with the months' names round it (`monthW` is the widest of them)
  const rDot = Math.max(6, 0.28 * rEarth);
  const rTop = Math.max(40, Math.min(W / 2 - monthW - 0.5 * fs - 8, room / 2 - 1.8 * fs) - rDot);
  const top = { R: rTop, rEarth: rDot, rSun: 2.2 * rDot, hintY: room / 2 + rTop + rDot + 2.3 * fs };

  // close up: the Sun and the two Earths, three circles of one size in a row, with the months and seasons under them
  const r = Math.max(20, Math.min((W - 16) / 7.1, (H - 3.7 * fs - 8) / 2.5, 150));
  const close = { R: 2.55 * r, r, cy: (H - 0.1 * r - 3.6 * fs) / 2 };

  // the ground: `u` is one square. The Sun is `reach` away, between its June and December heights on the right:
  // with its rays, it reaches 6.3 squares above the ground and 5.75 to the right of "you". The squares and the
  // count of them are under the ground.
  const u = Math.max(12, Math.min((W - 20) / 10.75, (room - 16 - 1.6 * fs) / 7.3, 54));
  const y = (room + 5.3 * u - 1.6 * fs) / 2 + 4;
  const ground = { u, x: W / 2 - 0.37 * u, y, reach: 5.4 * u, rSun: 0.72 * u, hintY: y + u + 2.5 * fs };

  return { cx: W / 2, cy: room / 2, side, top, close, ground };
}

/* ================= the pieces ================= */

/**
 * A globe of radius `r` whose axis leans `lean` radians to the right, seen from `alt` radians above the orbit's
 * plane: which way its north points on the screen, and the near half of its equator.
 */
function globeLines(r: number, lean: number, alt: number) {
  const sa = Math.sin(alt),
    ca = Math.cos(alt);
  const ax = Math.sin(lean),
    ay = -Math.cos(lean) * ca,
    length = Math.hypot(ax, ay) || 1;
  const north: XY = [ax / length, ay / length];
  const t0 = Math.atan2(-Math.sin(lean) * sa, ca);
  let equator = '';
  for (let i = 0; i <= 24; i++) {
    const t = t0 - Math.PI + (Math.PI * i) / 24;
    const x = r * Math.cos(t) * Math.cos(lean);
    const y = r * (Math.cos(t) * Math.sin(lean) * ca - Math.sin(t) * sa);
    equator += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return { north, equator };
}

interface GlobeProps {
  at: XY;
  r: number;
  /** how far its axis leans to the right, in radians */
  lean: number;
  /** the camera's height above the orbit's plane, in radians */
  alt: number;
  /** where it is on the orbit: the angle from the Sun, in radians */
  theta: number;
  /** 0 a plain dot, 1 a globe with its equator and its night side */
  detail: number;
  axis: number;
  upright?: number;
  opacity?: number;
}

/** The Earth. Its night side is the half that faces away from the Sun. */
function Globe({ at, r, lean, alt, theta, detail, axis, upright = 0, opacity = 1 }: GlobeProps) {
  const { north, equator } = globeLines(r, lean, alt);
  // The Sun's direction on the screen, and how much of it points at the camera (which shows more than half of the
  // lit side) or away from it (less than half).
  const towards = Math.atan2(Math.sin(theta) * Math.sin(alt), -Math.cos(theta)) / RAD;
  const facing = Math.sin(theta) * Math.cos(alt);
  // In a frame whose x points at the Sun: the far edge of the globe, then back along the line between day and night.
  const night =
    'M0 ' + -r + 'A' + r + ' ' + r + ' 0 0 0 0 ' + r +
    'A' + Math.abs(facing) * r + ' ' + r + ' 0 0 ' + (facing > 0 ? 1 : 0) + ' 0 ' + -r + 'Z';
  const along = (from: number, to: number) => ({
    x1: north[0] * r * from,
    y1: north[1] * r * from,
    x2: north[0] * r * to,
    y2: north[1] * r * to,
  });
  return (
    <g transform={'translate(' + at[0] + ' ' + at[1] + ')'} opacity={clamp01(opacity)}>
      <circle className="earth-paper" r={r} />
      <circle className="earth" r={r} fillOpacity={lerp(0.85, 0.24, clamp01(detail))} />
      <path className="night" d={night} transform={'rotate(' + towards + ')'} opacity={clamp01(detail)} />
      <path className="equator" d={equator} opacity={clamp01(detail)} />
      <line className="upright" x1={0} y1={-1.45 * r} x2={0} y2={1.45 * r} opacity={clamp01(upright)} />
      <g opacity={clamp01(axis)}>
        <line className="axis inside" {...along(-1, 1)} />
        <line className="axis" {...along(1, 1.3)} />
        <line className="axis" {...along(-1.3, -1)} />
      </g>
    </g>
  );
}

/** The print the Earth leaves behind on its orbit: its outline and its axis. */
function Print({ at, r, lean, alt, opacity }: { at: XY; r: number; lean: number; alt: number; opacity: number }) {
  const { north } = globeLines(r, lean, alt);
  return (
    <g className="print" transform={'translate(' + at[0] + ' ' + at[1] + ')'} opacity={clamp01(opacity)}>
      <circle r={r} />
      <line x1={-1.3 * r * north[0]} y1={-1.3 * r * north[1]} x2={1.3 * r * north[0]} y2={1.3 * r * north[1]} />
    </g>
  );
}

const SUN_RAYS = Array.from({ length: 12 }, (_, i) => [Math.cos(i * 30 * RAD), Math.sin(i * 30 * RAD)]);

/** The Sun: a disc, with `shine` fading its short rays in. */
function Sun({ at, r, shine, opacity = 1 }: { at: XY; r: number; shine: number; opacity?: number }) {
  return (
    <g transform={'translate(' + at[0] + ' ' + at[1] + ')'} opacity={clamp01(opacity)}>
      <g className="sun-rays" opacity={clamp01(shine)}>
        {SUN_RAYS.map(([x, y], i) => (
          <line key={i} x1={1.2 * r * x} y1={1.2 * r * y} x2={1.42 * r * x} y2={1.42 * r * y} />
        ))}
      </g>
      <circle className="sun" r={r} />
    </g>
  );
}

const HINTS = [
  'No. Earth stays about the same distance from the Sun all year.',
  'Drag Earth around the Sun!',
  'Drag the Sun down to December!',
];

/* ================= the scene ================= */

export const SeasonsRenderer: ElementRendererComponent<SeasonsState> = ({ element, updateState }) => {
  const S = element.state;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hintRefs = [
    useRef<HTMLParagraphElement | null>(null),
    useRef<HTMLParagraphElement | null>(null),
    useRef<HTMLParagraphElement | null>(null),
  ];
  const monthRefs = [
    useRef<SVGTextElement | null>(null),
    useRef<SVGTextElement | null>(null),
    useRef<SVGTextElement | null>(null),
    useRef<SVGTextElement | null>(null),
  ];

  /* ---- measure: the stage, then the words written at the size it gives them ---- */

  const stage = useMeasure(
    rootRef,
    () => {
      const el = rootRef.current!;
      return el.clientWidth && el.clientHeight ? { W: el.clientWidth, H: el.clientHeight } : undefined;
    },
    null as null | { W: number; H: number }
  );
  const W = stage?.W ?? 0,
    H = stage?.H ?? 0;
  const fs = stage ? clamp(Math.min(W / 46, H / 22), 13, 20) : 16;
  const words = useMeasure(
    rootRef,
    () =>
      stage
        ? {
            hintH: Math.max(...hintRefs.map((r) => r.current!.offsetHeight)),
            monthW: monthRefs.map((r) => r.current!.getComputedTextLength()),
          }
        : undefined,
    null as null | { hintH: number; monthW: number[] },
    [stage, fs]
  );
  const monthW = (i: number) => words?.monthW[i] || fs * 0.52 * MONTHS[i].length;
  const V = layOut(W, H, fs, words?.hintH ?? fs * 2, Math.max(monthW(0), monthW(2)));

  /* ---- the camera: from above, from the side, close up ---- */

  // The orbit is a circle seen from above, an ellipse from the side and a line close up: its half-width and
  // half-height on the stage. How flat it looks says how high the camera is above its plane.
  const rx = lerp(lerp(V.top.R, V.side.R, S.sideView), V.close.R, S.closeUp);
  const ry = lerp(lerp(V.top.R, V.side.R * V.side.flat, S.sideView), 0, S.closeUp);
  const alt = Math.asin(clamp01(ry / rx));
  const cx = V.cx,
    cy = lerp(V.cy, V.close.cy, S.closeUp);
  const rSun = lerp(lerp(V.top.rSun, V.side.rSun, S.sideView), V.close.r, S.closeUp);
  const rEarth = lerp(lerp(V.top.rEarth, V.side.rEarth, S.globe), V.close.r, S.closeUp);
  const rPrint = lerp(V.side.rEarth, V.close.r, S.closeUp);
  const lean = TILT * S.tilt * RAD;

  /** The angle from the Sun of a place on the orbit, `year` years after June, */
  const thetaAt = (year: number) => Math.PI * (1 + 2 * year);
  /** and where that is on the stage. */
  const orbitAt = (year: number): XY => [cx + rx * Math.cos(thetaAt(year)), cy - ry * Math.sin(thetaAt(year))];
  const year = wrap(S.year);
  const earthAt = orbitAt(year);

  /* ---- close up: "you", and the sunlight that reaches you ---- */

  const june = orbitAt(0),
    december = orbitAt(0.5);
  const rC = rEarth; // close up, both Earths and the Sun are this big
  const a6 = FROM_SUN_JUNE * RAD,
    a12 = FROM_SUN_DECEMBER * RAD;
  const you6: XY = [june[0] + rC * Math.cos(a6), june[1] - rC * Math.sin(a6)];
  const you12: XY = [december[0] - rC * Math.cos(a12), december[1] - rC * Math.sin(a12)];
  const rYou = clamp(0.065 * rC, 4, 7);
  const floor = 0.31 * rC; // half the length of the bit of ground drawn at "you"
  // the ground at each dot: a line that touches the globe there
  const floor6: [XY, XY] = [
    [you6[0] - floor * Math.sin(a6), you6[1] - floor * Math.cos(a6)],
    [you6[0] + floor * Math.sin(a6), you6[1] + floor * Math.cos(a6)],
  ];
  const floor12: [XY, XY] = [
    [you12[0] - floor * Math.sin(a12), you12[1] + floor * Math.cos(a12)],
    [you12[0] + floor * Math.sin(a12), you12[1] - floor * Math.cos(a12)],
  ];
  // The ray of sunlight that reaches each dot flies level, from the Sun's side (`side`: 1 from the right, -1 from the
  // left). Both rays are the same length and fade out behind: the light has come much farther than the picture
  // shows, and just as far to both dots. A ray slides up to its dot as it arrives: June's first, then December's.
  const rayLength = 0.6 * rC;
  const rayTo = (you: XY, side: 1 | -1, arrived: number): [tail: XY, tip: XY] => {
    const tip = you[0] + side * (rYou + 2 + (1 - arrived) * 0.5 * rayLength);
    return [
      [tip + side * rayLength, you[1]],
      [tip, you[1]],
    ];
  };
  const arrived6 = smoothstep(0, 0.42, S.rays),
    arrived12 = smoothstep(0.58, 1, S.rays);
  const ray12 = rayTo(you12, -1, arrived12);
  /** Where a ray's colour fades in: from nothing at its tail to full strength over the first 60% of it. */
  const fadeAlong = ([tail, tip]: [XY, XY]) => ({
    x1: tail[0],
    y1: tail[1],
    x2: lerp(tail[0], tip[0], 0.6),
    y2: lerp(tail[1], tip[1], 0.6),
  });

  /* ---- the ground: a zoom from June's Earth in to "you", until the ground is flat ---- */

  const G = V.ground;
  const g = clamp01(S.ground);
  const zoomed = g > 0;
  const zoomEnd = (60 * G.u) / V.close.r; // how many times bigger the globe gets
  const zoom = Math.pow(zoomEnd, g);
  const turnEnd = -(90 - FROM_SUN_JUNE); // turned until "up" at the dot is up on the stage
  const turn = turnEnd * smoothstep(0, 0.85, g);
  const slide = smoothstep(0, 1, g);
  const pivot: XY = [lerp(you6[0], G.x, slide), lerp(you6[1], G.y, slide)];
  /** Where the zoom puts a point of the close-up. */
  const zoomAt = (p: XY): XY => {
    const dx = (p[0] - you6[0]) * zoom,
      dy = (p[1] - you6[1]) * zoom,
      c = Math.cos(turn * RAD),
      s = Math.sin(turn * RAD);
    return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
  };
  const globeZoom = zoomed
    ? 'translate(' + pivot + ') rotate(' + turn + ') scale(' + zoom + ') translate(' + -you6[0] + ' ' + -you6[1] + ')'
    : undefined;
  const groundZoom =
    'translate(' + pivot + ') rotate(' + (turn - turnEnd) + ') scale(' + zoom / zoomEnd + ') translate(' + -G.x + ' ' + -G.y + ')';
  const ray6 = rayTo(you6, 1, arrived6).map(zoomAt) as [XY, XY];
  const farGone = 1 - smoothstep(0, 0.22, g); // everything but June's Earth, as the zoom begins
  const globeSeen = 1 - smoothstep(0.55, 0.95, g);
  const groundSeen = smoothstep(0.35, 0.9, g);

  // the Sun over the ground, and the beam it sends down
  const height = lerp(SUN_DECEMBER, SUN_JUNE, clamp01(S.sunHeight)) * RAD;
  const lit = (SQUARES * G.u * Math.sin(SUN_JUNE * RAD)) / Math.sin(height); // the length of ground the beam covers
  const squares = Math.round(lit / G.u);
  const down: XY = [-Math.cos(height), Math.sin(height)]; // the way the light travels
  const skyAt = (deg: number, far: number): XY => [G.x + far * Math.cos(deg * RAD), G.y - far * Math.sin(deg * RAD)];
  const sunAt = skyAt(height / RAD, G.reach);
  const beamTop = skyAt(height / RAD, G.reach - 1.3 * G.rSun);
  /** The beam from just under the Sun to the ground, `f` of the way across it. */
  const beamLine = (f: number): [XY, XY] => {
    const end: XY = [G.x - lit / 2 + lit * f, G.y];
    const back = (end[0] - beamTop[0]) * down[0] + (end[1] - beamTop[1]) * down[1];
    return [[end[0] - back * down[0], end[1] - back * down[1]], end];
  };
  const fade = { x1: beamTop[0], y1: beamTop[1], x2: beamTop[0] + 2.2 * G.u * down[0], y2: beamTop[1] + 2.2 * G.u * down[1] };
  // the squares hang under the ground: their sides, then the line along their bottoms
  const squaresLeft = G.x - (GROUND_SQUARES / 2) * G.u;
  const squaresD =
    Array.from({ length: GROUND_SQUARES + 1 }, (_, i) => 'M' + (squaresLeft + i * G.u) + ' ' + G.y + 'v' + G.u).join('') +
    'M' + squaresLeft + ' ' + (G.y + G.u) + 'h' + GROUND_SQUARES * G.u;
  // the two ends of the Sun's path, each with its month beside it: June's on the left, and December's on the right
  // where the stage has room for it, or else underneath
  const juneSun = skyAt(SUN_JUNE, G.reach),
    decemberSun = skyAt(SUN_DECEMBER, G.reach);
  const beside = 1.42 * G.rSun + 0.4 * fs;
  const decemberWord: XY =
    decemberSun[0] + beside + monthW(2) + 6 <= W
      ? [decemberSun[0] + beside + monthW(2) / 2, decemberSun[1]]
      : [decemberSun[0], decemberSun[1] + 1.42 * G.rSun + 0.8 * fs];

  /* ---- interact: drag the Earth round the Sun (step 4), and the Sun up and down (step 7) ---- */

  const dragRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [near, setNear] = useState(false);
  const tween = useTween();
  const handle = S.earthDraggable ? earthAt : sunAt;
  const handleR = S.earthDraggable ? rEarth : G.rSun;
  const draggable = S.earthDraggable || S.sunDraggable;

  function pointerAt(e: React.PointerEvent): XY {
    const b = svgRef.current!.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  function onHandle(e: React.PointerEvent) {
    const [x, y] = pointerAt(e);
    return Math.hypot(x - handle[0], y - handle[1]) < Math.max(handleR + 12, e.pointerType === 'mouse' ? 26 : 40);
  }
  /** Puts the Earth, or the Sun, where the pointer is: as far round the orbit, or as high over the ground. */
  function moveTo(e: React.PointerEvent) {
    const [x, y] = pointerAt(e);
    if (S.earthDraggable) {
      const theta = Math.atan2(-(y - cy) / ry, (x - cx) / rx);
      updateState({ year: wrap(theta / (2 * Math.PI) - 0.5), ring: 0 });
    } else {
      const deg = Math.atan2(G.y - y, x - G.x) / RAD;
      const t = clamp01((deg - SUN_DECEMBER) / (SUN_JUNE - SUN_DECEMBER));
      updateState({ sunHeight: t < 0.03 ? 0 : t > 0.97 ? 1 : t, ring: 0 });
    }
  }
  function endDrag() {
    dragRef.current = false;
    setDragging(false);
  }
  const capHandlers = {
    onPointerDown(e: React.PointerEvent<SVGRectElement>) {
      if (!draggable || !onHandle(e)) return;
      e.preventDefault();
      dragRef.current = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
      moveTo(e);
    },
    onPointerMove(e: React.PointerEvent<SVGRectElement>) {
      if (!draggable) return;
      if (dragRef.current) moveTo(e);
      else setNear(onHandle(e));
    },
    onPointerLeave() {
      setNear(false);
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
  };

  function onHandleKey(e: React.KeyboardEvent) {
    if (!draggable) return;
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    if (S.earthDraggable) {
      const from = year;
      tween(GLIDE_MS, (t) => updateState({ year: wrap(from + step * KEY_YEAR * t), ring: 0 }));
    } else {
      const from = S.sunHeight,
        to = clamp01(from + step * KEY_SUN);
      tween(GLIDE_MS, (t) => updateState({ sunHeight: lerp(from, to, t), ring: 0 }));
    }
  }

  /* ---- draw ---- */

  const orbitSeen = 1 - smoothstep(0, 0.5, S.closeUp);
  const orbitD =
    'M' + (cx - rx) + ' ' + cy + 'A' + rx + ' ' + ry + ' 0 1 0 ' + (cx + rx) + ' ' + cy + 'A' + rx + ' ' + ry + ' 0 1 0 ' + (cx - rx) + ' ' + cy;

  // the dashed line from the Sun to the Earth
  const away = Math.hypot(earthAt[0] - cx, earthAt[1] - cy) || 1;
  const toEarth: XY = [(earthAt[0] - cx) / away, (earthAt[1] - cy) / away];
  const lineFrom = 1.6 * rSun,
    lineTo = lerp(lineFrom, away - rEarth - 4, clamp01(S.distance));

  // the months: round the circle seen from above; under the Earths (March, at the back, over it) seen from the side
  const monthAt = (i: number): XY => {
    const [x, y] = orbitAt(i / 4);
    const out = V.top.rEarth + 0.5 * fs;
    const fromAbove: XY = [
      [x - out - monthW(i) / 2, y],
      [x, y + out + 0.5 * fs],
      [x + out + monthW(i) / 2, y],
      [x, y - out - 0.5 * fs],
    ][i] as XY;
    const fromSide: XY = [x, y + (i === 3 ? -1 : 1) * (1.3 * rPrint + 0.95 * fs)];
    return [lerp(fromAbove[0], fromSide[0], S.sideView), lerp(fromAbove[1], fromSide[1], S.sideView)];
  };
  const monthSeen = (i: number) =>
    clamp01((S.orbit - i / 4) * 12) * (i % 2 ? 1 - smoothstep(0, 0.15, S.closeUp) : 1) * farGone;
  const printSeen = (i: number) =>
    clamp01((S.prints - i / 4) * 16) * (1 - smoothstep(0, i % 2 ? 0.15 : 0.6, S.closeUp));
  const seasonY = june[1] + 1.3 * rPrint + 2.75 * fs;

  // each hint goes under the view it belongs to
  const hints: [shown: number, y: number][] = [
    [S.hintDistance, V.top.hintY],
    [S.hintDragEarth, V.side.hintY],
    [S.hintDragSun, V.ground.hintY],
  ];
  const under = ([shown, y]: [number, number]): React.CSSProperties => ({
    width: W - 2 * SIDE + 'px',
    left: SIDE + 'px',
    opacity: String(clamp01(shown)),
    transform: 'translateY(' + (y + (1 - shown) * 10) + 'px)',
  });

  return (
    <div ref={rootRef} className="fw-scene sw-root">
      <div className="sw-ask" style={{ opacity: String(clamp01(S.question)) }} aria-hidden={S.stepIdx > 0 ? 'true' : undefined}>
        <p className="problem">
          <span>
            <b className="c-orange">Summer</b> is hot.
          </span>{' '}
          <span>
            <b className="c-blue">Winter</b> is cold.
          </span>{' '}
          <b>Why?</b>
        </p>
      </div>

      <svg
        ref={svgRef}
        id="sw-fig"
        role="img"
        aria-label={ALT[S.stepIdx] || undefined}
        aria-hidden={S.stepIdx === 0 ? 'true' : undefined}
        viewBox={stage ? '0 0 ' + W + ' ' + H : undefined}
        style={{ '--fs': fs + 'px' } as React.CSSProperties}
      >
        {stage && (
          <>
            <defs>
              {/* the stage as a window with soft edges, to look through while the camera zooms */}
              <filter id="sw-soft" filterUnits="userSpaceOnUse" x={-40} y={-40} width={W + 80} height={H + 80}>
                <feGaussianBlur stdDeviation={8} />
              </filter>
              <mask id="sw-window" maskUnits="userSpaceOnUse" x={-40} y={-40} width={W + 80} height={H + 80}>
                <rect x={14} y={14} width={Math.max(0, W - 28)} height={Math.max(0, H - 28)} fill="#fff" filter="url(#sw-soft)" />
              </mask>
              {/* sunlight fades out towards where it comes from: the beam over the ground and its rays, and the
                  ray to each dot */}
              <linearGradient id="sw-beam" gradientUnits="userSpaceOnUse" {...fade}>
                <stop offset={0} className="beam-from" />
                <stop offset={1} className="beam-to" />
              </linearGradient>
              <linearGradient id="sw-beam-ray" gradientUnits="userSpaceOnUse" {...fade}>
                <stop offset={0} className="ray-from" />
                <stop offset={1} className="ray-to" />
              </linearGradient>
              <linearGradient id="sw-ray-june" gradientUnits="userSpaceOnUse" {...fadeAlong(ray6)}>
                <stop offset={0} className="ray-from" />
                <stop offset={1} className="ray-to" />
              </linearGradient>
              <linearGradient id="sw-ray-december" gradientUnits="userSpaceOnUse" {...fadeAlong(ray12)}>
                <stop offset={0} className="ray-from" />
                <stop offset={1} className="ray-to" />
              </linearGradient>
            </defs>

            {/* the orbit, and what the Earth leaves on it */}
            <path
              className="orbit"
              d={orbitD}
              pathLength={1}
              strokeDashoffset={1 - clamp01(S.orbit)}
              opacity={S.orbit > 0 ? orbitSeen : 0}
            />
            <line
              className="distance"
              x1={cx + lineFrom * toEarth[0]}
              y1={cy + lineFrom * toEarth[1]}
              x2={cx + lineTo * toEarth[0]}
              y2={cy + lineTo * toEarth[1]}
              opacity={clamp01(S.distance * 4)}
            />
            {MONTHS.map((_, i) => (
              <Print key={i} at={orbitAt(i / 4)} r={rPrint} lean={lean} alt={alt} opacity={printSeen(i)} />
            ))}

            <Sun at={[cx, cy]} r={rSun} shine={1 - smoothstep(0, 0.5, S.closeUp)} opacity={S.sun * farGone} />
            <Globe
              at={december}
              r={rPrint}
              lean={lean}
              alt={alt}
              theta={thetaAt(0.5)}
              detail={1}
              axis={1}
              opacity={smoothstep(0, 0.6, S.closeUp) * farGone}
            />

            {/* the Earth. Zooming in to "you" makes it bigger and bigger, until its edge is the ground. What then
                reaches past the stage is seen through the soft-edged window. */}
            <g mask={zoomed ? 'url(#sw-window)' : undefined}>
              <g className="zoom" transform={globeZoom} opacity={S.earth * globeSeen}>
                <Globe
                  at={earthAt}
                  r={rEarth}
                  lean={lean}
                  alt={alt}
                  theta={thetaAt(year)}
                  detail={S.globe}
                  axis={S.axis}
                  upright={S.upright}
                />
              </g>
              <g opacity={globeSeen}>
                <path className="floor" d={'M' + zoomAt(floor6[0]) + 'L' + zoomAt(floor6[1])} opacity={clamp01(S.floor)} />
                <path className="ray" stroke="url(#sw-ray-june)" d={arrowPath(...ray6[0], ...ray6[1])} opacity={arrived6} />
              </g>
            </g>

            {/* the ground at "you": the beam, the squares it lights, and the Sun on its path */}
            {zoomed && (
              <g className="zoom" transform={groundZoom} opacity={groundSeen}>
                <path fill="url(#sw-beam)" d={'M' + [beamLine(0)[1], beamLine(1)[1], beamLine(1)[0], beamLine(0)[0]].join('L') + 'Z'} />
                {[1, 3, 5, 7].map((eighth) => (
                  <path
                    key={eighth}
                    className="ray thin"
                    stroke="url(#sw-beam-ray)"
                    d={arrowPath(...beamLine(eighth / 8)[0], ...beamLine(eighth / 8)[1], 0.24 * G.u)}
                  />
                ))}
                <rect className="lit" x={G.x - lit / 2} y={G.y} width={lit} height={G.u} opacity={(0.85 * SQUARES * G.u) / lit} />
                <path className="squares" d={squaresD} />
                <g opacity={clamp01(S.marks)}>
                  <path className="track" d={'M' + juneSun + 'A' + G.reach + ' ' + G.reach + ' 0 0 1 ' + decemberSun} />
                  <circle className="track" cx={juneSun[0]} cy={juneSun[1]} r={G.rSun} />
                  <circle className="track" cx={decemberSun[0]} cy={decemberSun[1]} r={G.rSun} />
                  <text className="month" {...textAt(juneSun[0] - beside - monthW(0) / 2, juneSun[1])}>
                    June
                  </text>
                  <text className="month" {...textAt(...decemberWord)}>
                    December
                  </text>
                  <text className="count" {...textAt(G.x, G.y + G.u + 1.05 * fs)}>
                    {squares + ' squares'}
                  </text>
                </g>
                <Sun at={sunAt} r={G.rSun} shine={1} />
              </g>
            )}
            {/* the ground itself runs off both sides of the stage */}
            {zoomed && (
              <g mask="url(#sw-window)">
                <path className="floor zoom" d={'M' + -W + ' ' + G.y + 'H' + 2 * W} transform={groundZoom} opacity={groundSeen} />
              </g>
            )}

            {/* close up: December's ray, "you" on both Earths, and what each month is */}
            <g opacity={farGone}>
              <path className="floor" d={'M' + floor12[0] + 'L' + floor12[1]} opacity={clamp01(S.floor)} />
              <path className="ray" stroke="url(#sw-ray-december)" d={arrowPath(...ray12[0], ...ray12[1])} opacity={arrived12} />
              <circle className="you" cx={you12[0]} cy={you12[1]} r={rYou} opacity={clamp01(S.you)} />
              <text className="you-word" style={{ textAnchor: 'end' }} {...textAt(you6[0] - 0.16 * rC, you6[1], S.you)}>
                you
              </text>
              <text className="you-word" {...textAt(december[0] - 0.2 * rC, december[1] - 0.6 * rC, S.you)}>
                you
              </text>
              <text className="season summer" {...textAt(june[0], seasonY, smoothstep(0, 0.42, S.seasons))}>
                summer
              </text>
              <text className="season winter" {...textAt(december[0], seasonY, smoothstep(0.58, 1, S.seasons))}>
                winter
              </text>
            </g>
            <circle className="you" cx={pivot[0]} cy={pivot[1]} r={lerp(rYou, 0.17 * G.u, slide)} opacity={clamp01(S.you)} />

            <text className="cap" {...textAt(cx, cy - 1.42 * rSun - 0.8 * fs, S.names * S.sun)}>
              Sun
            </text>
            <text className="cap" {...textAt(earthAt[0], earthAt[1] - rEarth - 0.9 * fs, S.names * S.earth)}>
              Earth
            </text>
            {MONTHS.map((month, i) => (
              <text key={month} ref={monthRefs[i]} className="month" {...textAt(...monthAt(i), monthSeen(i))}>
                {month}
              </text>
            ))}

            {/* what can be dragged: its ring, its keyboard focus, and the sheet over the stage that follows the pointer */}
            <g
              className="handle"
              tabIndex={draggable ? 0 : -1}
              role="slider"
              aria-label={S.earthDraggable ? 'Earth. Arrow keys move it around the Sun.' : 'The Sun. Arrow keys move it up and down.'}
              aria-valuetext={S.earthDraggable ? MONTHS[Math.round(year * 4) % 4] : squares + ' squares of ground lit'}
              aria-hidden={draggable ? undefined : 'true'}
              transform={'translate(' + handle[0] + ' ' + handle[1] + ')'}
              onKeyDown={onHandleKey}
            >
              <circle
                className={'ring' + (S.earthDraggable ? ' earth-ring' : '')}
                r={handleR + 9}
                style={{ display: draggable && S.ring > 0.05 ? undefined : 'none' }}
              />
              <circle className="focus" r={handleR + 6} />
            </g>
            <rect
              className={'cap-hit' + (dragging ? ' drag' : near ? ' near' : '')}
              style={{ pointerEvents: draggable ? 'all' : 'none' }}
              x={0}
              y={0}
              width={W}
              height={H}
              {...capHandlers}
            />
          </>
        )}
      </svg>

      {HINTS.map((hint, i) => (
        <p key={i} ref={hintRefs[i]} className="hint" style={stage ? under(hints[i]) : undefined}>
          {hint}
        </p>
      ))}
    </div>
  );
};
