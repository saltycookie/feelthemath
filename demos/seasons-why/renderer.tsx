import React, { useEffect, useId, useState, useRef } from 'react';
import {
  clamp01,
  lerp,
  useMeasure,
  type ElementRendererComponent,
  type Size,
} from '../../framework';
import { DEFAULT_SEASONS_WHY_STATE, type SeasonsWhyState } from './state';

/* ================= constants (world units: orbit radius = 1) ================= */
const ORBIT_R = 1.0;
const MESH_HALF_Y = 1.36;
const MESH_CELL = 0.34;
const MESH_Y_LINES = 9; // 8 grid cells vertically (-MESH_HALF_Y .. +MESH_HALF_Y)
const SUN_R = 0.275;
const EARTH_R = 0.20;
const AXIAL_TILT_RAD = (23.5 * Math.PI) / 180;
const LATITUDES_DEG = [-60, -30, 0, 30, 60];
const MERIDIANS = 6;
const SPIN_RAD_PER_SEC = 1.35;
const MONTHS = [
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
  'April',
  'May',
];

const ALT_TEXT =
  'A 3D diagram of the Sun at the center and the spinning Earth orbiting around it on a circular path.';

interface ProjPoint {
  x: number;
  y: number;
  f: number;
  zc: number;
}

interface EarthPos {
  dx: number;
  dy: number;
  dz: number;
  sx: number;
  sy: number;
  dot: number;
}

function makeProjector(
  viewTiltProgress: number,
  sideViewProgress: number,
  cx: number,
  cy: number,
  scale: number
) {
  const p = clamp01(viewTiltProgress);
  const s = clamp01(sideViewProgress);
  const alpha = lerp((Math.PI / 3) * p, Math.PI / 2, s);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  // Mild perspective strength scales in smoothly as camera tilts toward 30° above plane.
  const q = sa / 6.0;

  const proj = (x: number, y: number, z = 0): ProjPoint => {
    const xc = x;
    const yc = y * ca + z * sa;
    const zc = -y * sa + z * ca;
    const f = 1 / (1 - zc * q);
    return {
      x: cx + scale * xc * f,
      y: cy - scale * yc * f,
      f,
      zc,
    };
  };

  const camDirFrom = (x: number, y: number, z: number): [number, number, number] => {
    if (q <= 1e-6) return [0, 0, 1];
    const dist = 1 / q;
    const vx = -x;
    const vy = -dist * sa - y;
    const vz = dist * ca - z;
    const len = Math.hypot(vx, vy, vz) || 1;
    return [vx / len, vy / len, vz / len];
  };

  return { proj, camDirFrom, alpha, ca, sa };
}

function sampleEarthPoint(
  ex: number,
  ey: number,
  lat: number,
  lon: number,
  tiltRad: number,
  proj: (x: number, y: number, z?: number) => ProjPoint,
  camDir: [number, number, number]
): EarthPos {
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  const u = EARTH_R * cl * Math.cos(lon);
  const v = EARTH_R * cl * Math.sin(lon);
  const w = EARTH_R * sl;

  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  const dx = u * ct + w * st;
  const dy = v;
  const dz = -u * st + w * ct;

  const p = proj(ex + dx, ey + dy, dz);
  const dot = (dx * camDir[0] + dy * camDir[1] + dz * camDir[2]) / EARTH_R;
  return { dx, dy, dz, sx: p.x, sy: p.y, dot };
}

/**
 * Builds an SVG path string containing only the front-facing (`dot >= 0`) spans
 * of a sampled curve on the sphere, interpolating limb crossings cleanly.
 */
function buildFrontCurvePath(pts: EarthPos[]): string {
  if (pts.length < 2) return '';
  const segments: string[] = [];
  let inSpan = false;

  const pushMove = (x: number, y: number) => {
    segments.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
  };
  const pushLine = (x: number, y: number) => {
    segments.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  };

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    if (i === 0) {
      if (cur.dot >= 0) {
        pushMove(cur.sx, cur.sy);
        inSpan = true;
      }
      continue;
    }

    const prev = pts[i - 1];
    const prevVis = prev.dot >= 0;
    const curVis = cur.dot >= 0;

    if (!prevVis && curVis) {
      const t = prev.dot / (prev.dot - cur.dot);
      pushMove(lerp(prev.sx, cur.sx, t), lerp(prev.sy, cur.sy, t));
      pushLine(cur.sx, cur.sy);
      inSpan = true;
    } else if (prevVis && curVis) {
      if (!inSpan) {
        pushMove(prev.sx, prev.sy);
        inSpan = true;
      }
      pushLine(cur.sx, cur.sy);
    } else if (prevVis && !curVis) {
      const t = prev.dot / (prev.dot - cur.dot);
      pushLine(lerp(prev.sx, cur.sx, t), lerp(prev.sy, cur.sy, t));
      inSpan = false;
    }
  }

  return segments.join('');
}

function formatClockTime(lonRad: number): string {
  const dayFrac = (((lonRad + Math.PI) / (Math.PI * 2)) % 1 + 1) % 1;
  const totalMinutes = (Math.floor(dayFrac * 96) * 15) % 1440;
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface GlobeRenderOptions {
  key: string;
  ex: number;
  ey: number;
  tiltRad: number;
  spinRad: number;
  opacity: number;
  isImprint?: boolean;
  label?: string;
  labelOpacity?: number;
  clockTime?: string;
  clockOpacity?: number;
  sideViewProgress?: number;
  showTiltGuide?: number;
  youOpacity?: number;
  gradId: string;
  proj: (x: number, y: number, z?: number) => ProjPoint;
  camDirFrom: (x: number, y: number, z: number) => [number, number, number];
  scale: number;
}

function renderGlobe({
  key,
  ex,
  ey,
  tiltRad,
  spinRad,
  opacity,
  isImprint = false,
  label,
  labelOpacity = 1,
  clockTime,
  clockOpacity = 0,
  sideViewProgress = 0,
  showTiltGuide = 0,
  youOpacity = 0,
  gradId,
  proj,
  camDirFrom,
  scale,
}: GlobeRenderOptions): React.ReactNode {
  const op = clamp01(opacity);
  if (op <= 0.002) return null;

  const center = proj(ex, ey, 0);
  const rPx = EARTH_R * scale * center.f;
  const camDir = camDirFrom(ex, ey, 0);

  // Axis endpoints in local frame (tilt around Y toward +X)
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);
  const axisPt = (w: number) => proj(ex + w * st, ey, w * ct);

  const southOuter = axisPt(-EARTH_R * 1.72);
  const southPole = axisPt(-EARTH_R);
  const northPole = axisPt(EARTH_R);
  const northOuter = axisPt(EARTH_R * 1.80);

  // Check whether North/South pole sticks emerge on the visible front/outside of the sphere
  const northDot = (st * camDir[0] + ct * camDir[2]);
  const southDot = -northDot;

  // Latitude paths
  const latPaths = LATITUDES_DEG.map((deg) => {
    const lat = (deg * Math.PI) / 180;
    const steps = 56;
    const pts: EarthPos[] = [];
    for (let i = 0; i <= steps; i++) {
      const lon = (i / steps) * Math.PI * 2;
      pts.push(sampleEarthPoint(ex, ey, lat, lon, tiltRad, proj, camDir));
    }
    return {
      deg,
      isEquator: deg === 0,
      d: buildFrontCurvePath(pts),
    };
  });

  // Longitude (meridian) paths
  const lonPaths: string[] = [];
  for (let m = 0; m < MERIDIANS; m++) {
    const lon = spinRad + (m * Math.PI * 2) / MERIDIANS;
    const steps = 28;
    const pts: EarthPos[] = [];
    for (let i = 0; i <= steps; i++) {
      const lat = lerp(-Math.PI / 2, Math.PI / 2, i / steps);
      pts.push(sampleEarthPoint(ex, ey, lat, lon, tiltRad, proj, camDir));
    }
    const d = buildFrontCurvePath(pts);
    if (d) lonPaths.push(d);
  }

  // True 3D day/night shading on the sphere: light comes from the Sun at (0, 0, 0) toward (ex, ey, 0)
  const distE = Math.hypot(ex, ey) || 1;
  const Lx = -ex / distE;
  const Ly = -ey / distE;
  const Lz = 0;

  let shadowPathD = '';
  let fxLit = 0.5;
  let fyLit = 0.5;
  const clipId = `${gradId}-clip`;
  const blurId = `${gradId}-blur`;
  const shadowBlurPx = Math.max(1.8, rPx * 0.065);

  if (!isImprint && rPx > 1) {
    const dotLC = Lx * camDir[0] + Ly * camDir[1] + Lz * camDir[2];
    const litX = Lx - dotLC * camDir[0];
    const litY = Ly - dotLC * camDir[1];
    const litZ = Lz - dotLC * camDir[2];
    const litLen = Math.hypot(litX, litY, litZ) || 1;
    const litPt = proj(
      ex + EARTH_R * 0.45 * (litX / litLen),
      ey + EARTH_R * 0.45 * (litY / litLen),
      EARTH_R * 0.45 * (litZ / litLen)
    );
    fxLit = clamp01(0.5 + (litPt.x - center.x) / (2 * rPx));
    fyLit = clamp01(0.5 + (litPt.y - center.y) / (2 * rPx));

    // Terminator plane basis: B = normalize(L x camDir), V = normalize(L x B) oriented toward camera
    let bx = Ly * camDir[2] - Lz * camDir[1];
    let by = Lz * camDir[0] - Lx * camDir[2];
    let bz = Lx * camDir[1] - Ly * camDir[0];
    const bLen = Math.hypot(bx, by, bz);

    if (bLen > 1e-4) {
      bx /= bLen;
      by /= bLen;
      bz /= bLen;

      let vx = Ly * bz - Lz * by;
      let vy = Lz * bx - Lx * bz;
      let vz = Lx * by - Ly * bx;
      if (vx * camDir[0] + vy * camDir[1] + vz * camDir[2] < 0) {
        vx = -vx;
        vy = -vy;
        vz = -vz;
      }

      const termSegs = 40;
      const termPts: ProjPoint[] = [];
      for (let i = 0; i <= termSegs; i++) {
        const phi = (i / termSegs) * Math.PI;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const nx = cp * bx + sp * vx;
        const ny = cp * by + sp * vy;
        const nz = cp * bz + sp * vz;
        termPts.push(proj(ex + EARTH_R * nx, ey + EARTH_R * ny, EARTH_R * nz));
      }

      const darkX = -Lx + dotLC * camDir[0];
      const darkY = -Ly + dotLC * camDir[1];
      const darkZ = -Lz + dotLC * camDir[2];
      const darkLen = Math.hypot(darkX, darkY, darkZ) || 1;
      const dMidPt = proj(
        ex + EARTH_R * (darkX / darkLen),
        ey + EARTH_R * (darkY / darkLen),
        EARTH_R * (darkZ / darkLen)
      );

      const p0 = termPts[0];
      const p1 = termPts[termPts.length - 1];
      const ang0 = Math.atan2(p0.y - center.y, p0.x - center.x);
      const ang1 = Math.atan2(p1.y - center.y, p1.x - center.x);
      const angMid = Math.atan2(dMidPt.y - center.y, dMidPt.x - center.x);

      const wrapAng = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
      const d1 = wrapAng(angMid - ang1);
      const d2 = wrapAng(ang0 - angMid);
      const rExt = rPx * 1.45;

      const parts: string[] = [];
      termPts.forEach((pt, idx) => {
        parts.push(`${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
      });
      const arcSteps = 8;
      for (let i = 0; i <= arcSteps; i++) {
        const a = ang1 + (i / arcSteps) * d1;
        parts.push(
          `L${(center.x + rExt * Math.cos(a)).toFixed(1)},${(center.y + rExt * Math.sin(a)).toFixed(1)}`
        );
      }
      for (let i = 1; i <= arcSteps; i++) {
        const a = angMid + (i / arcSteps) * d2;
        parts.push(
          `L${(center.x + rExt * Math.cos(a)).toFixed(1)},${(center.y + rExt * Math.sin(a)).toFixed(1)}`
        );
      }
      parts.push('Z');
      shadowPathD = parts.join('');
    }
  }

  // Vertical reference & 23.5° tilt arc (Step 3)
  const guideOp = clamp01(showTiltGuide);
  const vertTop = proj(ex, ey, EARTH_R * 1.80);
  const vertBot = proj(ex, ey, -EARTH_R * 1.72);

  let tiltArcD = '';
  let tiltLabelPt: ProjPoint | null = null;
  if (guideOp > 0.01 && tiltRad > 0.02) {
    const arcR = EARTH_R * 1.52;
    const steps = 16;
    const parts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (tiltRad * i) / steps;
      const pt = proj(ex + arcR * Math.sin(a), ey, arcR * Math.cos(a));
      parts.push(`${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
    }
    tiltArcD = parts.join('');
    const midA = tiltRad * 0.42;
    tiltLabelPt = proj(
      ex + EARTH_R * 2.08 * Math.sin(midA),
      ey,
      EARTH_R * 2.08 * Math.cos(midA)
    );
  }

  // "You" dot on Northern Hemisphere (30°N, fixed on the spinning Earth)
  const youOp = clamp01(youOpacity);
  let youPt: EarthPos | null = null;
  if (youOp > 0.01 && !isImprint) {
    youPt = sampleEarthPoint(
      ex,
      ey,
      (30 * Math.PI) / 180,
      spinRad - Math.PI * 0.45,
      tiltRad,
      proj,
      camDir
    );
  }
  const youOnBack = Boolean(youPt && youPt.dot < 0);

  const renderYou = (opacity: number) =>
    youPt && opacity > 0.01 ? (
      <g opacity={opacity}>
        <circle className="you-dot" cx={youPt.sx} cy={youPt.sy} r={4.5} />
        <text className="scene-cap c-pink halo" x={youPt.sx + 14} y={youPt.sy - 8}>
          You
        </text>
      </g>
    ) : null;

  const sideP = clamp01(sideViewProgress);
  const labelOp = clamp01(labelOpacity) * op;
  const labelY = Math.max(
    center.y + rPx + lerp(22, 44, sideP),
    southOuter.y + 22 * sideP
  );

  return (
    <g key={key} opacity={op}>
      {!isImprint && (
        <defs>
          <radialGradient id={gradId} cx={fxLit} cy={fyLit} r={0.78}>
            <stop offset="0%" stopColor="#eff7ff" />
            <stop offset="62%" stopColor="#cbe3fb" />
            <stop offset="100%" stopColor="#b7d8f7" />
          </radialGradient>
          <clipPath id={clipId}>
            <circle cx={center.x} cy={center.y} r={rPx} />
          </clipPath>
          <filter
            id={blurId}
            filterUnits="userSpaceOnUse"
            x={center.x - rPx * 1.8}
            y={center.y - rPx * 1.8}
            width={rPx * 3.6}
            height={rPx * 3.6}
          >
            <feGaussianBlur stdDeviation={shadowBlurPx} />
          </filter>
        </defs>
      )}

      {/* Vertical reference line & tilt angle arc (Step 3) */}
      {guideOp > 0.01 && (
        <g opacity={guideOp}>
          <line
            className="axis-ref"
            x1={vertBot.x}
            y1={vertBot.y}
            x2={vertTop.x}
            y2={vertTop.y}
          />
          {tiltArcD && <path className="tilt-arc" d={tiltArcD} />}
          {tiltLabelPt && (
            <text
              className="scene-cap halo"
              x={tiltLabelPt.x}
              y={tiltLabelPt.y - 4}
              opacity={clamp01((tiltRad / AXIAL_TILT_RAD - 0.35) / 0.45)}
            >
              23.5°
            </text>
          )}
        </g>
      )}

      {/* South pole axis stick (behind globe when North pole tilts toward viewer) */}
      {southDot < 0.92 && (
        <line
          className={isImprint ? 'spin-axis imprint' : 'spin-axis'}
          x1={southPole.x}
          y1={southPole.y}
          x2={southOuter.x}
          y2={southOuter.y}
        />
      )}

      {/* Earth sphere body (always full opacity to preserve its color) */}
      <circle
        className={isImprint ? 'earth-body imprint' : 'earth-body'}
        cx={center.x}
        cy={center.y}
        r={rPx}
        fill={isImprint ? 'var(--blue-fill)' : `url(#${gradId})`}
      />
      {!isImprint && shadowPathD && (
        <g clipPath={`url(#${clipId})`}>
          <path
            d={shadowPathD}
            fill="#6795c6"
            fillOpacity={0.95}
            filter={`url(#${blurId})`}
          />
        </g>
      )}

      {/* "You" dot dimmed behind the front grid when on the far hemisphere */}
      {youOnBack && renderYou(youOp * 0.35)}

      {/* Latitude & longitude lines on front hemisphere */}
      <g className={isImprint ? 'earth-grid imprint' : 'earth-grid'}>
        {!isImprint &&
          lonPaths.map((d, idx) => <path key={`lon-${idx}`} className="meridian" d={d} />)}
        {latPaths.map(
          ({ deg, isEquator, d }) =>
            d && (isEquator || !isImprint) && (
              <path
                key={`lat-${deg}`}
                className={isEquator ? 'equator' : 'parallel'}
                d={d}
              />
            )
        )}
      </g>

      {/* Globe outline */}
      <circle
        className={isImprint ? 'earth-outline imprint' : 'earth-outline'}
        cx={center.x}
        cy={center.y}
        r={rPx}
      />

      {/* North pole axis stick & pole dot */}
      {northDot > -0.92 && (
        <g className={isImprint ? 'spin-axis-g imprint' : 'spin-axis-g'}>
          <line
            className={isImprint ? 'spin-axis imprint' : 'spin-axis'}
            x1={northPole.x}
            y1={northPole.y}
            x2={northOuter.x}
            y2={northOuter.y}
          />
          <circle
            className={isImprint ? 'pole-dot imprint' : 'pole-dot'}
            cx={northOuter.x}
            cy={northOuter.y}
            r={isImprint ? 2.4 : 3.2}
          />
        </g>
      )}

      {/* North pole dot right on the sphere center when viewed top-down */}
      {northDot > 0.92 && (
        <circle className="pole-dot" cx={northPole.x} cy={northPole.y} r={3} />
      )}

      {/* "You" dot in front of the Earth when on the front hemisphere */}
      {!youOnBack && renderYou(youOp)}

      {/* Globe label */}
      {label && labelOp > 0.01 && (
        <text
          className={isImprint ? 'scene-lbl imprint halo' : 'scene-lbl earth halo'}
          x={center.x}
          y={labelY}
          opacity={labelOp}
        >
          {label}
        </text>
      )}

      {/* Digital clock (HH:MM AM/PM) below the month label (Step 6) */}
      {clockTime && clamp01(clockOpacity) > 0.01 && (
        <g
          className="digital-clock"
          opacity={clamp01(clockOpacity) * op}
          transform={`translate(${center.x.toFixed(1)} ${(labelY + 28).toFixed(1)})`}
        >
          <rect className="digital-clock-box" x={-46} y={-13} width={92} height={26} rx={6} />
          <text className="digital-clock-txt" x={0} y={0}>
            {clockTime}
          </text>
        </g>
      )}
    </g>
  );
}

export const SeasonsWhySceneRenderer: ElementRendererComponent<SeasonsWhyState> = ({
  element,
  isAnimating,
  updateState,
}) => {
  const S = element.state;
  const uid = useId().replace(/:/g, '');
  const boxRef = useRef<HTMLDivElement>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; angleOffset: number } | null>(null);

  // Measure the drawing box below the problem text
  const box = useMeasure<Size | null>(
    boxRef,
    () => {
      const rect = boxRef.current?.getBoundingClientRect();
      return rect?.width && rect.height ? { w: rect.width, h: rect.height } : undefined;
    },
    null
  );

  // Continuously spin the Earth whenever it is visible and not paused
  const isSpinning = S.sunAndEarthOpacity > 0.01 && !S.earthSpinPaused;
  useEffect(() => {
    if (!isSpinning) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setSpinAngle((prev) => (prev + dt * SPIN_RAD_PER_SEC) % (Math.PI * 2));
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isSpinning]);

  // Layout calculation
  const W = box?.w ?? 0;
  const H = box?.h ?? 0;
  const msgReserve = box ? Math.min(58, Math.max(36, H * 0.14)) : 0;
  const availH = Math.max(120, H - msgReserve);
  const padX = Math.max(18, W * 0.04);
  const padY = Math.max(14, availH * 0.05);
  const viewP = clamp01(S.space30DegViewProgress);
  const sideP = clamp01(S.spaceSidedViewProgress);
  const solidDecP = clamp01(S.solidDecemberEarthProgress);
  const sunFoldP = clamp01(S.sunFoldedProgress);

  const baseScale = box
    ? Math.min((W - 2 * padX) / 2.96, (availH - 2 * padY) / 2.84)
    : 100;
  const zoomedScale = box
    ? Math.min((W - 2 * padX) / 1.52, (availH - 2 * padY) / 0.82)
    : 100;
  const scale = lerp(baseScale, zoomedScale, sunFoldP);
  const cx = W / 2;
  const cy = availH / 2 + (4 - 0.04 * scale * viewP) * (1 - sideP);

  const canDrag = Boolean(S.canDragEarth) && !isAnimating;

  // Keep latest inverse-projection parameters and updateState accessible inside window drag listeners
  const dragContextRef = useRef({
    cx,
    cy,
    scale,
    viewP,
    sideP,
    updateState,
  });
  dragContextRef.current = { cx, cy, scale, viewP, sideP, updateState };

  const screenToOrbitTheta = (clientX: number, clientY: number): number | null => {
    const rect = boxRef.current?.getBoundingClientRect();
    const { cx: curCx, cy: curCy, scale: curScale, viewP: vp, sideP: sp } = dragContextRef.current;
    if (!rect || curScale <= 0) return null;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const alpha = lerp((Math.PI / 3) * vp, Math.PI / 2, sp);
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const q = sa / 6.0;
    const u = (sx - curCx) / curScale;
    const v = (curCy - sy) / curScale;
    const denom = Math.max(0.08, ca - v * sa * q);
    const y = v / denom;
    const f = 1 / (1 + y * sa * q);
    const x = u / f;
    if (Math.hypot(x, y) < 0.08) return null;
    return Math.atan2(y, x);
  };

  useEffect(() => {
    if (!isDragging) return;
    if (!canDrag) {
      dragRef.current = null;
      setIsDragging(false);
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      const active = dragRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      const ptrTheta = screenToOrbitTheta(e.clientX, e.clientY);
      if (ptrTheta === null) return;
      const theta = ptrTheta + active.angleOffset;
      const rawTurns = (theta - Math.PI) / (2 * Math.PI);
      const nextDragP = (((rawTurns % 1) + 1.5) % 1) - 0.5;
      dragContextRef.current.updateState({ earthDragProgress: nextDragP });
    };

    const onPointerEnd = (e: PointerEvent) => {
      const active = dragRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [isDragging, canDrag]);

  const handleEarthPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (!canDrag || !box) return;
    e.preventDefault();
    e.stopPropagation();
    const ptrTheta = screenToOrbitTheta(e.clientX, e.clientY);
    const curTheta =
      Math.PI +
      2 *
        Math.PI *
        (S.earthOrbitProgress + S.tiltedEarthOrbitingProgress + S.earthDragProgress);
    const angleOffset = ptrTheta === null ? 0 : curTheta - ptrTheta;
    dragRef.current = { pointerId: e.pointerId, angleOffset };
    setIsDragging(true);
  };

  // Build projected 3D scene primitives once `box` is measured
  let sceneContent: React.ReactNode = null;
  let toggleTop = Math.max(0, H - 36);
  if (box) {
    const { proj, camDirFrom } = makeProjector(
      S.space30DegViewProgress,
      S.spaceSidedViewProgress,
      cx,
      cy,
      scale
    );

    // 1. 2D Space Mesh (Z = 0, horizontally unbounded) — fades out as camera moves to front/side view
    const meshOp = clamp01(S.mesh2DOpacity) * (1 - sideP);
    const meshLines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    let meshBgD = '';
    if (meshOp > 0.002) {
      const meshHalfX = Math.max(2.6, W / (2 * scale * 0.78) + MESH_CELL);
      const maxK = Math.ceil(meshHalfX / MESH_CELL);

      for (let i = 0; i < MESH_Y_LINES; i++) {
        const y = lerp(-MESH_HALF_Y, MESH_HALF_Y, i / (MESH_Y_LINES - 1));
        const isMajor = i === 0 || i === MESH_Y_LINES - 1 || Math.abs(y) < 1e-6;
        const hx0 = proj(-meshHalfX, y, 0);
        const hx1 = proj(meshHalfX, y, 0);
        meshLines.push({ x1: hx0.x, y1: hx0.y, x2: hx1.x, y2: hx1.y, major: isMajor });
      }

      for (let k = -maxK; k <= maxK; k++) {
        const x = k * MESH_CELL;
        const vy0 = proj(x, -MESH_HALF_Y, 0);
        const vy1 = proj(x, MESH_HALF_Y, 0);
        meshLines.push({ x1: vy0.x, y1: vy0.y, x2: vy1.x, y2: vy1.y, major: k === 0 });
      }

      const c0 = proj(-meshHalfX, -MESH_HALF_Y, 0);
      const c1 = proj(meshHalfX, -MESH_HALF_Y, 0);
      const c2 = proj(meshHalfX, MESH_HALF_Y, 0);
      const c3 = proj(-meshHalfX, MESH_HALF_Y, 0);
      meshBgD = `M${c0.x.toFixed(1)},${c0.y.toFixed(1)} L${c1.x.toFixed(1)},${c1.y.toFixed(1)} L${c2.x.toFixed(1)},${c2.y.toFixed(1)} L${c3.x.toFixed(1)},${c3.y.toFixed(1)} Z`;
    }

    // 2. Orbit path (Z = 0) — fades out as camera moves to front/side view
    const orbitOp = clamp01(S.earthOrbitOpacity) * (1 - sideP);
    let fullOrbitD = '';
    let drawnOrbitD = '';
    if (orbitOp > 0.002) {
      const segs = 96;
      const fullPts: string[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = Math.PI + (i / segs) * Math.PI * 2;
        const p = proj(ORBIT_R * Math.cos(a), ORBIT_R * Math.sin(a), 0);
        fullPts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      fullOrbitD = fullPts.join('') + 'Z';

      const prog = clamp01(S.earthOrbitProgress);
      if (prog > 0.003) {
        const arcSegs = Math.max(2, Math.ceil(segs * prog));
        const arcPts: string[] = [];
        for (let i = 0; i <= arcSegs; i++) {
          const a = Math.PI + ((i / arcSegs) * prog) * Math.PI * 2;
          const p = proj(ORBIT_R * Math.cos(a), ORBIT_R * Math.sin(a), 0);
          arcPts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        drawnOrbitD = arcPts.join('');
      }
    }

    // Orbit direction arrowheads in Step 4
    const tiltedP = clamp01(S.tiltedEarthOrbitingProgress);
    const orbitArrowsOp = clamp01(tiltedP / 0.12) * orbitOp;
    const renderOrbitArrow = (theta: number) => {
      const p0 = proj(ORBIT_R * Math.cos(theta), ORBIT_R * Math.sin(theta), 0);
      // Tangent in counter-clockwise direction: (-sin θ, cos θ)
      const p1 = proj(
        ORBIT_R * Math.cos(theta) - 0.08 * Math.sin(theta),
        ORBIT_R * Math.sin(theta) + 0.08 * Math.cos(theta),
        0
      );
      const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      return (
        <path
          key={`arr-${theta}`}
          className="orbit-arrow"
          d="M-6,-4 L3,0 L-6,4"
          transform={`translate(${p0.x.toFixed(1)} ${p0.y.toFixed(1)}) rotate(${ang.toFixed(1)})`}
        />
      );
    };

    // 3. Sun & Earth & Imprints (depth-sorted by camera depth `zc`)
    const sunScreen = proj(0, 0, 0);
    const sunR = SUN_R * scale * sunScreen.f;
    const sunEarthOp = clamp01(S.sunAndEarthOpacity);

    // In Step 5, Earths move inward from ±ORBIT_R to ±0.48 so that at 2x zoom (horizSpan = 1.52)
    // their outer edge sits at half the border margin of Step 4's side view (0.08 vs 0.16 in zoomed coords).
    const earthXOffset = lerp(ORBIT_R, 0.48, sunFoldP);
    const dragP = S.earthDragProgress;
    const orbitTheta =
      Math.PI + 2 * Math.PI * (S.earthOrbitProgress + S.tiltedEarthOrbitingProgress + dragP);
    const ex = earthXOffset * Math.cos(orbitTheta);
    const ey = earthXOffset * Math.sin(orbitTheta);
    const earthScreen = proj(ex, ey, 0);
    const tiltRad = AXIAL_TILT_RAD * clamp01(S.earthSpinAxisTiltedProgress);

    // Step 3 tilt guide fades out smoothly once Step 4 begins orbiting
    const tiltGuideOp =
      clamp01(S.earthSpinAxisTiltedProgress * 2.5) *
      clamp01(S.space30DegViewProgress) *
      clamp01(1 - tiltedP * 6);

    // Imprints for June (left, θ = π) and December (right, θ = 0)
    const juneIn = clamp01((tiltedP - 0.01) / 0.06);
    const decIn = clamp01((tiltedP - 0.49) / 0.06);

    // Live Earth carries the moving month label during Step 4 (June -> July -> ... -> December -> ... -> June)
    const normTurn = (((tiltedP + dragP) % 1) + 1) % 1;
    const monthIdx = Math.round(normTurn * 12) % 12;
    const liveEarthLabel = tiltedP > 0.002 ? MONTHS[monthIdx] : 'Earth';
    const liveEarthLabelOp = 1;
    const distToJune = Math.min(normTurn, 1 - normTurn);
    const distToDec = Math.abs(normTurn - 0.5);
    const juneImprintLabelOp = clamp01((distToJune - 0.04) / 0.05);
    const decImprintLabelOp = clamp01((distToDec - 0.03) / 0.05);

    interface DepthItem {
      zc: number;
      node: React.ReactNode;
    }

    const depthItems: DepthItem[] = [];

    // Sun item (folds horizontally into the vertical center line in Step 6)
    const sunFoldScaleX = Math.max(0.001, 1 - sunFoldP);
    const sunBodyOp = sunEarthOp * clamp01((1 - sunFoldP) / 0.22);
    const sunLabelOp = sunEarthOp * clamp01(1 - sunFoldP / 0.4);
    if (sunBodyOp > 0.002 || sunLabelOp > 0.002) {
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI * 2) / 12;
        const r1 = sunR * 1.18;
        const r2 = sunR * (i % 2 === 0 ? 1.42 : 1.32);
        return (
          <line
            key={i}
            className="sun-ray"
            x1={sunScreen.x + r1 * Math.cos(a)}
            y1={sunScreen.y + r1 * Math.sin(a)}
            x2={sunScreen.x + r2 * Math.cos(a)}
            y2={sunScreen.y + r2 * Math.sin(a)}
          />
        );
      });

      const sunFoldTransform =
        sunFoldP > 0.001
          ? `translate(${sunScreen.x.toFixed(1)} ${sunScreen.y.toFixed(1)}) scale(${sunFoldScaleX.toFixed(4)} 1) translate(${-sunScreen.x.toFixed(1)} ${-sunScreen.y.toFixed(1)})`
          : undefined;

      depthItems.push({
        zc: sunScreen.zc,
        node: (
          <g key="sun">
            {sunBodyOp > 0.002 && (
              <g opacity={sunBodyOp} transform={sunFoldTransform}>
                <circle
                  cx={sunScreen.x}
                  cy={sunScreen.y}
                  r={sunR * 2.1}
                  fill={`url(#sunGlow-${uid})`}
                />
                <g>{rays}</g>
                <circle
                  className="sun-body"
                  cx={sunScreen.x}
                  cy={sunScreen.y}
                  r={sunR}
                  fill={`url(#sunBody-${uid})`}
                />
              </g>
            )}
            {sunLabelOp > 0.002 && (
              <text
                className="scene-lbl sun halo"
                x={sunScreen.x}
                y={sunScreen.y + sunR + 20}
                opacity={sunLabelOp}
              >
                Sun
              </text>
            )}
          </g>
        ),
      });
    }

    // June imprint (left, -earthXOffset, 0) — fades out when solid December Earth appears so it won't show through translucent June Earth
    const juneImprintOp = juneIn * 0.85 * (1 - solidDecP);
    if (juneImprintOp > 0.002) {
      const juneProj = proj(-earthXOffset, 0, 0);
      depthItems.push({
        zc: juneProj.zc - 0.25,
        node: renderGlobe({
          key: 'june-imprint',
          ex: -earthXOffset,
          ey: 0,
          tiltRad: AXIAL_TILT_RAD,
          spinRad: 0,
          opacity: juneImprintOp,
          isImprint: true,
          label: 'June',
          labelOpacity: juneImprintLabelOp,
          sideViewProgress: sideP,
          gradId: `juneGrad-${uid}`,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    // December imprint (right, +earthXOffset, 0) — fades out as solid December Earth fades in
    const decImprintOp = decIn * 0.85 * (1 - solidDecP);
    if (decImprintOp > 0.002) {
      const decProj = proj(earthXOffset, 0, 0);
      depthItems.push({
        zc: decProj.zc - 0.25,
        node: renderGlobe({
          key: 'dec-imprint',
          ex: earthXOffset,
          ey: 0,
          tiltRad: AXIAL_TILT_RAD,
          spinRad: 0,
          opacity: decImprintOp,
          isImprint: true,
          label: 'December',
          labelOpacity: decImprintLabelOp,
          sideViewProgress: sideP,
          gradId: `decGrad-${uid}`,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    const clockOp = clamp01(S.digitalClockOpacity);
    const clockTime = clockOp > 0.002 ? formatClockTime(spinAngle - Math.PI * 0.45) : undefined;
    if (clockOp > 0.002) {
      const juneCenter = proj(-earthXOffset, 0, 0);
      const juneRPx = EARTH_R * scale * juneCenter.f;
      const juneSouthOuter = proj(
        -earthXOffset - EARTH_R * 1.72 * Math.sin(AXIAL_TILT_RAD),
        0,
        -EARTH_R * 1.72 * Math.cos(AXIAL_TILT_RAD)
      );
      const juneLabelY = Math.max(
        juneCenter.y + juneRPx + lerp(22, 44, sideP),
        juneSouthOuter.y + 22 * sideP
      );
      const clockBottomY = juneLabelY + 28 + 13;
      toggleTop = Math.max(0, Math.min(H - 34, clockBottomY + 10));
    }

    // Solid spinning December Earth (Step 5/6 — +π phase aligns solar noon with June Earth)
    const solidDecOp = sunEarthOp * solidDecP;
    if (solidDecOp > 0.002) {
      const decProj = proj(earthXOffset, 0, 0);
      depthItems.push({
        zc: decProj.zc,
        node: renderGlobe({
          key: 'solid-dec-earth',
          ex: earthXOffset,
          ey: 0,
          tiltRad: AXIAL_TILT_RAD,
          spinRad: spinAngle + Math.PI,
          opacity: solidDecOp,
          label: 'December',
          labelOpacity: 1,
          clockTime,
          clockOpacity: clockOp * solidDecP,
          sideViewProgress: sideP,
          youOpacity: S.youOnTheNorthHemisphereOpacity * solidDecP,
          gradId: `decSolidGrad-${uid}`,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    // Live spinning Earth
    if (sunEarthOp > 0.002) {
      depthItems.push({
        zc: earthScreen.zc,
        node: renderGlobe({
          key: 'live-earth',
          ex,
          ey,
          tiltRad,
          spinRad: spinAngle,
          opacity: sunEarthOp,
          label: liveEarthLabel,
          labelOpacity: liveEarthLabelOp,
          clockTime,
          clockOpacity: clockOp,
          sideViewProgress: sideP,
          showTiltGuide: tiltGuideOp,
          youOpacity: S.youOnTheNorthHemisphereOpacity,
          gradId: `earthGrad-${uid}`,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    depthItems.sort((a, b) => a.zc - b.zc);

    // 4. Vertical center line & horizontal sunlight rays (Step 5)
    const showSunFold = sunFoldP > 0.002 && sunEarthOp > 0.002;
    const centerLineOp = clamp01(sunFoldP / 0.2) * sunEarthOp;
    const lineHalfZ = lerp(0.30, 0.38, clamp01(sunFoldP / 0.35));
    const lineTop = proj(0, 0, lineHalfZ);
    const lineBot = proj(0, 0, -lineHalfZ);

    const rayOp = clamp01(sunFoldP / 0.15) * sunEarthOp;
    const lineGap = scale * 0.08;
    const rayFracs = [-0.8, -0.4, 0, 0.4, 0.8];
    const sunlightRays = showSunFold
      ? rayFracs.map((frac) => {
          const z = frac * EARTH_R;
          const pStart = proj(0, 0, z);
          const dxHit = Math.sqrt(Math.max(0, EARTH_R * EARTH_R - z * z));
          const pHitJune = proj(-earthXOffset + dxHit, 0, z);
          const pHitDec = proj(earthXOffset - dxHit, 0, z);

          const xStartJune = pStart.x - lineGap;
          const xStartDec = pStart.x + lineGap;
          const xEndJune = lerp(xStartJune, pHitJune.x + 6, sunFoldP);
          const xEndDec = lerp(xStartDec, pHitDec.x - 6, sunFoldP);
          const lenJune = Math.abs(xEndJune - xStartJune);
          const lenDec = Math.abs(xEndDec - xStartDec);
          const arrOpJune = clamp01((lenJune - 3) / 10);
          const arrOpDec = clamp01((lenDec - 3) / 10);

          return (
            <g key={`ray-${frac}`}>
              {lenJune > 1 && (
                <>
                  <line
                    className="sunlight-ray"
                    x1={xStartJune}
                    y1={pStart.y}
                    x2={xEndJune}
                    y2={pStart.y}
                  />
                  {arrOpJune > 0.01 && (
                    <path
                      className="sunlight-arrow"
                      d={`M${(xEndJune + 6.5).toFixed(1)},${(pStart.y - 3.8).toFixed(1)} L${xEndJune.toFixed(1)},${pStart.y.toFixed(1)} L${(xEndJune + 6.5).toFixed(1)},${(pStart.y + 3.8).toFixed(1)}`}
                      opacity={arrOpJune}
                    />
                  )}
                </>
              )}
              {lenDec > 1 && (
                <>
                  <line
                    className="sunlight-ray"
                    x1={xStartDec}
                    y1={pStart.y}
                    x2={xEndDec}
                    y2={pStart.y}
                  />
                  {arrOpDec > 0.01 && (
                    <path
                      className="sunlight-arrow"
                      d={`M${(xEndDec - 6.5).toFixed(1)},${(pStart.y - 3.8).toFixed(1)} L${xEndDec.toFixed(1)},${pStart.y.toFixed(1)} L${(xEndDec - 6.5).toFixed(1)},${(pStart.y + 3.8).toFixed(1)}`}
                      opacity={arrOpDec}
                    />
                  )}
                </>
              )}
            </g>
          );
        })
      : null;

    // 5. Step 4 interactive drag layer (rendered last so imprints never cover the hit target)
    let dragLayer: React.ReactNode = null;
    if (canDrag && sunEarthOp > 0.002) {
      const liveEarthRPx = EARTH_R * scale * earthScreen.f;
      const arcStart = 0.25;
      const arcEnd = 0.40;
      const arcSegs = 8;
      const buildDragArc = (dir: 1 | -1) => {
        const pts: ProjPoint[] = [];
        for (let i = 0; i <= arcSegs; i++) {
          const a = orbitTheta + dir * lerp(arcStart, arcEnd, i / arcSegs);
          pts.push(proj(earthXOffset * Math.cos(a), earthXOffset * Math.sin(a), 0));
        }
        const d = pts
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join('');
        const pPrev = pts[pts.length - 2];
        const pTip = pts[pts.length - 1];
        const ang = (Math.atan2(pTip.y - pPrev.y, pTip.x - pPrev.x) * 180) / Math.PI;
        const headD = 'M-6,-4 L2.5,0 L-6,4';
        const headTransform = `translate(${pTip.x.toFixed(1)} ${pTip.y.toFixed(1)}) rotate(${ang.toFixed(1)})`;
        return (
          <g key={dir}>
            <path className="earth-drag-arc-halo" d={d} />
            <path className="earth-drag-arc-head-halo" d={headD} transform={headTransform} />
            <path className="earth-drag-arc" d={d} />
            <path className="earth-drag-arc-head" d={headD} transform={headTransform} />
          </g>
        );
      };

      const cueOp = clamp01(S.moveEarthMessageOpacity) * sunEarthOp;
      const badgeW = 60;
      const badgeH = 24;
      const badgeX = Math.max(
        8,
        Math.min(W - badgeW - 8, earthScreen.x - liveEarthRPx * 0.65 - badgeW * 0.72)
      );
      const badgeY = Math.max(
        8,
        Math.min(availH - badgeH - 8, earthScreen.y - liveEarthRPx * 0.72 - badgeH * 0.75)
      );

      dragLayer = (
        <g className={isDragging ? 'earth-drag-layer dragging' : 'earth-drag-layer'}>
          <g
            className={isDragging ? 'earth-drag-cue dragging' : 'earth-drag-cue'}
            opacity={cueOp}
          >
            {buildDragArc(1)}
            {buildDragArc(-1)}
          </g>
          <circle
            className="earth-drag-ring"
            cx={earthScreen.x}
            cy={earthScreen.y}
            r={liveEarthRPx + 6}
            opacity={cueOp}
          />
          <circle
            className={isDragging ? 'earth-drag-hit dragging' : 'earth-drag-hit'}
            cx={earthScreen.x}
            cy={earthScreen.y}
            r={Math.max(liveEarthRPx + 18, 32)}
            onPointerDown={handleEarthPointerDown}
          />
          {cueOp > 0.01 && (
            <g
              className={isDragging ? 'earth-drag-badge dragging' : 'earth-drag-badge'}
              transform={`translate(${badgeX.toFixed(1)} ${badgeY.toFixed(1)})`}
              opacity={isDragging ? 0 : cueOp}
              onPointerDown={handleEarthPointerDown}
            >
              <rect
                className="earth-drag-badge-bg"
                x={0}
                y={0}
                width={badgeW}
                height={badgeH}
                rx={badgeH / 2}
              />
              <g className="earth-drag-badge-icon" transform="translate(14 12)">
                <line x1={-5.5} y1={0} x2={5.5} y2={0} />
                <line x1={0} y1={-5.5} x2={0} y2={5.5} />
                <path d="M-3.5,-2 L-5.5,0 L-3.5,2 M3.5,-2 L5.5,0 L3.5,2 M-2,-3.5 L0,-5.5 L2,-3.5 M-2,3.5 L0,5.5 L2,3.5" />
              </g>
              <text className="earth-drag-badge-txt" x={39} y={12}>
                Drag
              </text>
            </g>
          )}
        </g>
      );
    }

    sceneContent = (
      <>
        <defs>
          <radialGradient id={`sunGlow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(240, 138, 36, 0.36)" />
            <stop offset="55%" stopColor="rgba(240, 138, 36, 0.12)" />
            <stop offset="100%" stopColor="rgba(240, 138, 36, 0)" />
          </radialGradient>
          <radialGradient id={`sunBody-${uid}`} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="55%" stopColor="#ffd166" />
            <stop offset="100%" stopColor="#f08a24" />
          </radialGradient>
          <linearGradient id={`meshFade-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="black" />
            <stop offset="4%" stopColor="white" />
            <stop offset="96%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
          <mask id={`meshMask-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <rect x="0" y="0" width={W} height={H} fill={`url(#meshFade-${uid})`} />
          </mask>
        </defs>

        {/* 2D Space Mesh (horizontally unbounded within canvas) */}
        {meshOp > 0.002 && (
          <g opacity={meshOp} mask={`url(#meshMask-${uid})`}>
            <path className="space-plane" d={meshBgD} />
            {meshLines.map((l, idx) => (
              <line
                key={idx}
                className={l.major ? 'gl major' : 'gl'}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
              />
            ))}
          </g>
        )}

        {/* Earth Orbit */}
        {orbitOp > 0.002 && (
          <g opacity={orbitOp}>
            <path className="orbit-guide" d={fullOrbitD} />
            {drawnOrbitD && <path className="orbit-trail" d={drawnOrbitD} />}
            {orbitArrowsOp > 0.01 && (
              <g opacity={orbitArrowsOp}>
                {renderOrbitArrow(Math.PI / 2)}
                {renderOrbitArrow((3 * Math.PI) / 2)}
              </g>
            )}
          </g>
        )}

        {/* Horizontal sunlight rays from center line to both Earths (Step 6) */}
        {showSunFold && rayOp > 0.002 && <g opacity={rayOp}>{sunlightRays}</g>}

        {/* Depth-sorted Sun, Earth, and Imprints */}
        {depthItems.map((item) => item.node)}

        {/* Vertical center line crossing the center of the Sun (Step 6) */}
        {showSunFold && centerLineOp > 0.002 && (
          <line
            className="sun-center-line"
            x1={lineTop.x}
            y1={lineTop.y}
            x2={lineBot.x}
            y2={lineBot.y}
            opacity={centerLineOp}
          />
        )}

        {/* Topmost Step 4 draggable Earth affordance & hit target */}
        {dragLayer}
      </>
    );
  }

  const msgOp = clamp01(S.aboutSameDistMessageOpacity);
  const moveMsgOp = clamp01(S.moveEarthMessageOpacity);
  const clockToggleOp = clamp01(S.digitalClockOpacity);
  const isSpinPaused = Boolean(S.earthSpinPaused);
  const canToggleSpin = clockToggleOp > 0.05 && !isAnimating;
  const probOp = clamp01(S.problemOpacity);

  return (
    <div className="fw-scene seasons-root">
      <p
        className="problem seasons-problem"
        aria-hidden={probOp <= 0.01 ? true : undefined}
        style={{
          opacity: probOp,
          transform: `translateY(calc(-50% + ${((1 - probOp) * 8).toFixed(1)}px))`,
        }}
      >
        Why are there <b className="c-orange">hot summers</b> and{' '}
        <b className="c-blue">cold winters</b>?
      </p>
      <div
        className="box"
        ref={boxRef}
        style={isDragging ? { cursor: 'grabbing' } : undefined}
      >
        <svg className="pic" role="img" aria-label={ALT_TEXT}>
          {sceneContent}
        </svg>
        <p
          className="seasons-msg"
          aria-hidden={msgOp <= 0.01 ? true : undefined}
          style={{
            opacity: msgOp,
            transform: `translateY(${((1 - msgOp) * 8).toFixed(1)}px)`,
          }}
        >
          No, the Earth stays at about the same distance from the Sun all year.
        </p>
        <p
          className="seasons-msg"
          aria-hidden={moveMsgOp <= 0.01 ? true : undefined}
          style={{
            opacity: moveMsgOp,
            transform: `translateY(${((1 - moveMsgOp) * 8).toFixed(1)}px)`,
          }}
        >
          Move the earth around yourself!
        </p>
        {clockToggleOp > 0.01 && (
          <button
            type="button"
            className="spin-toggle"
            aria-pressed={isSpinPaused}
            aria-label={isSpinPaused ? 'Spin both Earths' : 'Pause both Earths'}
            disabled={!canToggleSpin}
            onClick={() => canToggleSpin && updateState({ earthSpinPaused: !isSpinPaused })}
            style={{
              top: `${toggleTop.toFixed(1)}px`,
              opacity: clockToggleOp,
              pointerEvents: canToggleSpin ? 'auto' : 'none',
              transform: `translate(-50%, ${((1 - clockToggleOp) * 6).toFixed(1)}px)`,
            }}
          >
            {isSpinPaused ? (
              <>
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3.5,2.2 L11.5,7 L3.5,11.8 Z" />
                </svg>
                <span>Spin</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <rect x="2.5" y="2.2" width="3.2" height="9.6" rx="0.9" />
                  <rect x="8.3" y="2.2" width="3.2" height="9.6" rx="0.9" />
                </svg>
                <span>Pause</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

SeasonsWhySceneRenderer.defaultState = DEFAULT_SEASONS_WHY_STATE;
