import React, { useEffect, useId, useState, useRef } from 'react';
import {
  clamp01,
  lerp,
  useMeasure,
  type SceneRendererComponent,
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
const YOU_LAT_RAD = (30 * Math.PI) / 180;
const NOON_SPIN_ANGLE = Math.PI * 0.45;
const TANGENT_HALF_RATIO = 0.92 / 3;
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

  return { proj, camDirFrom };
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
 * Builds an SVG path string containing either the front-facing (`dot >= 0`) or
 * back-facing (`dot < 0`) spans of a sampled curve on the sphere, interpolating
 * limb crossings cleanly.
 */
function buildSphereCurvePath(pts: EarthPos[], front: boolean): string {
  if (pts.length < 2) return '';
  const segments: string[] = [];
  let inSpan = false;
  const isVis = (pt: EarthPos) => (front ? pt.dot >= 0 : pt.dot < 0);

  const pushMove = (x: number, y: number) => {
    segments.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
  };
  const pushLine = (x: number, y: number) => {
    segments.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  };

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const curVis = isVis(cur);
    if (i === 0) {
      if (curVis) {
        pushMove(cur.sx, cur.sy);
        inSpan = true;
      }
      continue;
    }

    const prev = pts[i - 1];
    const prevVis = isVis(prev);

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

/** Hand-drawn orange answer ring path around a box of size w × h (matches Danny's Walk). */
function ringPath(w: number, h: number): string {
  const n = 64;
  const a0 = -2.5;
  const sweep = 2 * Math.PI + 0.55;
  const pts: string[][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + sweep * u;
    const g = 1.035 - 0.07 * u;
    pts.push([
      (w / 2 + (w / 2 - 3) * g * Math.cos(a)).toFixed(1),
      (h / 2 + (h / 2 - 3) * g * Math.sin(a)).toFixed(1),
    ]);
  }
  return 'M' + pts.join('L');
}

function AnswerRingWord({ text, progress }: { text: string; progress: number }) {
  const ringRef = useRef<SVGSVGElement | null>(null);
  const ringPathRef = useRef<SVGPathElement | null>(null);

  const ringBox = useMeasure<Size | null>(
    ringRef,
    () => {
      const rect = ringRef.current?.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0
        ? { w: rect.width, h: rect.height }
        : undefined;
    },
    null
  );

  const ringD = ringBox ? ringPath(ringBox.w, ringBox.h) : undefined;
  const ringLen = useMeasure(
    ringPathRef,
    () => (ringD && ringPathRef.current ? ringPathRef.current.getTotalLength() : undefined),
    0,
    [ringD]
  );

  const p = clamp01(progress);

  return (
    <span className="season-ans">
      {text}
      <svg
        ref={ringRef}
        className="season-ring"
        aria-hidden="true"
        viewBox={ringBox ? `0 0 ${ringBox.w} ${ringBox.h}` : undefined}
        style={{ opacity: p > 0 && ringLen > 0 ? 1 : 0 }}
      >
        <path
          ref={ringPathRef}
          d={ringD}
          style={{
            strokeDasharray: String(ringLen),
            strokeDashoffset: String(ringLen * (1 - p)),
          }}
        />
      </svg>
    </span>
  );
}

function formatClockTime(lonRad: number): string {
  const dayFrac = (((lonRad + Math.PI) / (Math.PI * 2)) % 1 + 1) % 1;
  const totalMinutes = (Math.floor((dayFrac + 1e-9) * 96) * 15) % 1440;
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
  labelXOverride?: number;
  labelYOverride?: number;
  sideViewProgress?: number;
  showTiltGuide?: number;
  youOpacity?: number;
  youLatRad?: number;
  youSouthProgress?: number;
  youLabelOpacity?: number;
  youZoomProgress?: number;
  forceYouFront?: boolean;
  globeBodyOpacity?: number;
  lightDirOverride?: [number, number, number];
  globeClipId?: string;
  surfaceOverlay?: React.ReactNode;
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
  labelXOverride,
  labelYOverride,
  sideViewProgress = 0,
  showTiltGuide = 0,
  youOpacity = 0,
  youLatRad = YOU_LAT_RAD,
  youSouthProgress = 0,
  youLabelOpacity = 1,
  youZoomProgress = 0,
  forceYouFront = false,
  globeBodyOpacity = 1,
  lightDirOverride,
  globeClipId,
  surfaceOverlay,
  gradId,
  proj,
  camDirFrom,
  scale,
}: GlobeRenderOptions): React.ReactNode {
  const op = clamp01(opacity);
  if (op <= 0.002) return null;
  const bodyOp = clamp01(globeBodyOpacity);

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
      d: buildSphereCurvePath(pts, true),
      backD: isImprint && deg === 0 ? buildSphereCurvePath(pts, false) : '',
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
    const d = buildSphereCurvePath(pts, true);
    if (d) lonPaths.push(d);
  }

  // True 3D day/night shading on the sphere: light comes from the Sun at (0, 0, 0) toward (ex, ey, 0)
  const distE = Math.hypot(ex, ey) || 1;
  const Lx = lightDirOverride ? lightDirOverride[0] : -ex / distE;
  const Ly = lightDirOverride ? lightDirOverride[1] : -ey / distE;
  const Lz = lightDirOverride ? lightDirOverride[2] : 0;

  let shadowPathD = '';
  let fxLit = 0.5;
  let fyLit = 0.5;
  const clipId = `${gradId}-clip`;
  const blurId = `${gradId}-blur`;
  const shadowBlurPx = Math.min(18, Math.max(1.8, rPx * 0.065));

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

  // "You" dot (30°N moving to 30°S in Step 10, fixed on the spinning Earth)
  const youOp = clamp01(youOpacity);
  let youPt: EarthPos | null = null;
  if (youOp > 0.01 && !isImprint) {
    youPt = sampleEarthPoint(
      ex,
      ey,
      youLatRad,
      spinRad - NOON_SPIN_ANGLE,
      tiltRad,
      proj,
      camDir
    );
  }
  const youOnBack = !forceYouFront && Boolean(youPt && youPt.dot < 0);
  const youZoomP = clamp01(youZoomProgress);
  const youSouthP = clamp01(youSouthProgress);
  const youLblOp = clamp01(youLabelOpacity);
  const youBaseYOff = lerp(-10, 12, youSouthP * (ex < 0 ? 1 : 0));

  const renderYou = (opacity: number) =>
    youPt && opacity > 0.01 ? (
      <g opacity={opacity}>
        <circle className="you-dot" cx={youPt.sx} cy={youPt.sy} r={4.5} />
        {youLblOp > 0.01 && (
          <text
            className="scene-cap c-pink halo"
            opacity={youLblOp}
            x={youPt.sx + lerp(14, 0, youZoomP)}
            y={youPt.sy + lerp(youBaseYOff, 18, youZoomP)}
          >
            You
          </text>
        )}
      </g>
    ) : null;

  const sideP = clamp01(sideViewProgress);
  const labelOp = clamp01(labelOpacity) * op;
  const labelX = labelXOverride ?? center.x;
  const labelY =
    labelYOverride ??
    Math.max(center.y + rPx + lerp(22, 44, sideP), southOuter.y + 22 * sideP);

  const globeVisuals = (
    <>
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

      {bodyOp > 0.002 && (
        <g opacity={bodyOp}>
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

          {/* Backside of the equator visible through semi-transparent imprint */}
          {isImprint &&
            latPaths.map(
              ({ deg, isEquator, backD }) =>
                isEquator &&
                backD && (
                  <g key={`lat-back-${deg}`} className="earth-grid imprint">
                    <path className="equator-back" d={backD} />
                  </g>
                )
            )}

          {/* Earth sphere body (always full opacity to preserve its color) */}
          <circle
            className={isImprint ? 'earth-body imprint' : 'earth-body'}
            cx={center.x}
            cy={center.y}
            r={rPx}
            fill={
              isImprint
                ? 'color-mix(in srgb, var(--blue) 30%, var(--paper))'
                : `url(#${gradId})`
            }
            fillOpacity={isImprint ? 0.82 : undefined}
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
        </g>
      )}

      {/* Step 7 flat land, surface tangent, and 5 sunlight beams */}
      {surfaceOverlay}

      {/* "You" dot in front of the Earth/land when on the front hemisphere */}
      {!youOnBack && renderYou(youOp)}
    </>
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

      {globeClipId ? <g clipPath={`url(#${globeClipId})`}>{globeVisuals}</g> : globeVisuals}

      {/* Globe label */}
      {label && labelOp > 0.01 && (
        <text
          className={isImprint ? 'scene-lbl imprint halo' : 'scene-lbl earth halo'}
          x={labelX}
          y={labelY}
          opacity={labelOp}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export const SeasonsWhySceneRenderer: SceneRendererComponent<SeasonsWhyState> = ({
  scene,
  isAnimating,
  updateState,
}) => {
  const S = scene.state;
  const uid = useId().replace(/:/g, '');
  const boxRef = useRef<HTMLDivElement>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const stopNoonRef = useRef<{ startAngle: number; targetAngle: number } | null>(null);
  const [zoomTweenTarget, setZoomTweenTarget] = useState<0 | 1 | null>(null);
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

  const stopNoonP = clamp01(S.stopAtNoonProgress);
  const canToggleZoom = Boolean(S.canToggleZoom) && !isAnimating;

  // Continuously spin the Earth whenever it is visible, not paused, and not stopping at noon
  const isSpinning = S.sunAndEarthOpacity > 0.01 && !S.earthSpinPaused && stopNoonP <= 0.0001;
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

  // Keep spinAngle synced to NOON_SPIN_ANGLE once stopped at noon so Back navigation resumes cleanly
  useEffect(() => {
    if (stopNoonP >= 0.9999) {
      setSpinAngle(NOON_SPIN_ANGLE);
    }
  }, [stopNoonP]);

  let effectiveSpinAngle = spinAngle;
  if (stopNoonP <= 0.0001) {
    stopNoonRef.current = null;
  } else if (stopNoonP >= 0.9999) {
    stopNoonRef.current = null;
    effectiveSpinAngle = NOON_SPIN_ANGLE;
  } else {
    if (!stopNoonRef.current) {
      const start = ((spinAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const rawDelta =
        ((NOON_SPIN_ANGLE - start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const delta = rawDelta < 1.1 ? rawDelta + Math.PI * 2 : rawDelta;
      stopNoonRef.current = { startAngle: start, targetAngle: start + delta };
    }
    const easedStop = 1 - Math.pow(1 - stopNoonP, 2);
    effectiveSpinAngle = lerp(
      stopNoonRef.current.startAngle,
      stopNoonRef.current.targetAngle,
      easedStop
    );
  }

  // Smoothly animate between zoomed in (1) and zoomed out (0) when user clicks the Step 7 / Step 9 toggle
  const surfaceZoomRef = useRef(S.surfaceZoomProgress);
  surfaceZoomRef.current = S.surfaceZoomProgress;
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  useEffect(() => {
    if (zoomTweenTarget === null) return;
    if (!canToggleZoom) {
      setZoomTweenTarget(null);
      return;
    }

    const startZoom = clamp01(surfaceZoomRef.current);
    const targetZoom = zoomTweenTarget;
    const durationMs = Math.max(180, Math.round(Math.abs(targetZoom - startZoom) * 2200));
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const raw = Math.min(1, (now - startTime) / durationMs);
      const eased =
        raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const nextVal = raw >= 1 ? targetZoom : lerp(startZoom, targetZoom, eased);
      updateStateRef.current({ surfaceZoomProgress: nextVal });
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setZoomTweenTarget(null);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [zoomTweenTarget, canToggleZoom]);

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
    ? Math.min((W - 2 * padX) / 1.52, Math.max(80, H - 160) / 0.68)
    : 100;
  const scale = lerp(baseScale, zoomedScale, sunFoldP);
  const cx = W / 2;
  const unfoldedCy = availH / 2 + (4 - 0.04 * scale * viewP) * (1 - sideP);
  const foldedCy = H / 2 - Math.min(34, H * 0.06);
  const cy = lerp(unfoldedCy, foldedCy, sunFoldP);

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

  const updateDragFromClientPos = (clientX: number, clientY: number, angleOffset: number) => {
    const ptrTheta = screenToOrbitTheta(clientX, clientY);
    if (ptrTheta === null) return;
    const theta = ptrTheta + angleOffset;
    const rawTurns = (theta - Math.PI) / (2 * Math.PI);
    const nextDragP = (((rawTurns % 1) + 1.5) % 1) - 0.5;
    dragContextRef.current.updateState({ earthDragProgress: nextDragP });
  };

  const endDrag = (pointerId?: number) => {
    const active = dragRef.current;
    if (!active) return;
    if (pointerId !== undefined && pointerId !== active.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      if (boxRef.current?.hasPointerCapture?.(active.pointerId)) {
        boxRef.current.releasePointerCapture(active.pointerId);
      }
    } catch {
      // Ignore if pointer capture is unavailable or already released
    }
  };

  // Prevent iOS Safari / mobile browsers from hijacking an active Earth drag for scroll/overscroll
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !canDrag) return;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [canDrag]);

  useEffect(() => {
    if (!isDragging) return;
    if (!canDrag || !dragRef.current) {
      endDrag();
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      const active = dragRef.current;
      if (!active || e.pointerId !== active.pointerId) return;
      updateDragFromClientPos(e.clientX, e.clientY, active.angleOffset);
    };

    const onPointerEnd = (e: PointerEvent) => {
      endDrag(e.pointerId);
    };

    const onWindowBlur = () => {
      endDrag();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [isDragging, canDrag]);

  const handleEarthPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (!canDrag || !box) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragRef.current && !e.isPrimary) return;
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
    try {
      boxRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable (e.g., synthetic events)
    }
  };

  const handleBoxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || e.pointerId !== active.pointerId) return;
    if (!canDrag) {
      endDrag(e.pointerId);
      return;
    }
    e.stopPropagation();
    updateDragFromClientPos(e.clientX, e.clientY, active.angleOffset);
  };

  const handleBoxPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || e.pointerId !== active.pointerId) return;
    e.stopPropagation();
    endDrag(e.pointerId);
  };

  // Build projected 3D scene primitives once `box` is measured
  let sceneContent: React.ReactNode = null;
  let toggleTop = Math.max(0, H - 36);
  let heatMsgTop = Math.max(0, H - 48);
  let seasonsMsgTop = Math.max(0, H - 42);
  let juneLabelX = W * 0.25;
  let decLabelX = W * 0.75;
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
    let backOrbitD = '';
    let frontOrbitD = '';
    let orbitComplete = false;
    if (orbitOp > 0.002) {
      const buildOrbitArc = (aStart: number, aEnd: number, segCount: number) => {
        const pts: string[] = [];
        for (let i = 0; i <= segCount; i++) {
          const a = lerp(aStart, aEnd, i / segCount);
          const p = proj(ORBIT_R * Math.cos(a), ORBIT_R * Math.sin(a), 0);
          pts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        return pts.join('');
      };

      const segs = 96;
      fullOrbitD = buildOrbitArc(Math.PI, Math.PI * 3, segs) + 'Z';

      const prog = clamp01(S.earthOrbitProgress);
      orbitComplete = prog >= 0.999;
      if (prog > 0.003) {
        drawnOrbitD = buildOrbitArc(Math.PI, Math.PI + prog * Math.PI * 2, Math.max(2, Math.ceil(segs * prog)));
      }
      if (orbitComplete) {
        const orbitExitDelta = 2 * Math.asin(Math.min(0.95, EARTH_R / (2 * ORBIT_R)));
        backOrbitD = buildOrbitArc(2 * Math.PI - orbitExitDelta, 3 * Math.PI + orbitExitDelta, 64);
        frontOrbitD = buildOrbitArc(Math.PI + orbitExitDelta, 2 * Math.PI - orbitExitDelta, 48);
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

    const imprintNodes: React.ReactNode[] = [];

    // June imprint (left, -earthXOffset, 0) — semi-transparent globe with orbit passing through it
    const juneImprintOp = juneIn * 0.85 * (1 - solidDecP);
    if (juneImprintOp > 0.002) {
      imprintNodes.push(
        renderGlobe({
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
        })
      );
    }

    // December imprint (right, +earthXOffset, 0) — semi-transparent globe with orbit passing through it
    const decImprintOp = decIn * 0.85 * (1 - solidDecP);
    if (decImprintOp > 0.002) {
      imprintNodes.push(
        renderGlobe({
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
        })
      );
    }

    const clockOp = clamp01(S.digitalClockOpacity);
    const spreadOp = clamp01(S.spreadOverlayOpacity);
    const seasonP = clamp01(S.seasonCompareProgress);
    const tangentOp = clamp01(S.tangentLineOpacity);
    const zoomP = sunFoldP >= 0.999 ? clamp01(S.surfaceZoomProgress) : 0;
    const spreadVisOp = spreadOp * clamp01((zoomP - 0.7) / 0.3);
    const southP = clamp01(S.youSouthProgress);
    const youLatRad = lerp(YOU_LAT_RAD, -YOU_LAT_RAD, southP);
    const clockTime =
      clockOp > 0.002 ? formatClockTime(effectiveSpinAngle - NOON_SPIN_ANGLE) : undefined;

    juneLabelX = cx - scale * earthXOffset;
    decLabelX = cx + scale * earthXOffset;

    const lineHalfZ = lerp(0.30, 0.34, clamp01(sunFoldP / 0.35));
    const lineBotZ = lerp(0.30, 0.36, clamp01(sunFoldP / 0.35));
    const lineTopRaw = proj(0, 0, lineHalfZ);
    const lineBot = proj(0, 0, -lineBotZ);
    const clockY = Math.max(17, Math.min(cy - EARTH_R * scale - 24, lineTopRaw.y - 24));
    const lineTop = {
      x: lineTopRaw.x,
      y: Math.max(lineTopRaw.y, clockY + 13 + 10 * clockOp),
    };

    const juneUnzoomedCenter = proj(-earthXOffset, 0, 0);
    const juneUnzoomedRPx = EARTH_R * scale * juneUnzoomedCenter.f;
    const juneUnzoomedSouthOuter = proj(
      -earthXOffset - EARTH_R * 1.72 * Math.sin(AXIAL_TILT_RAD),
      0,
      -EARTH_R * 1.72 * Math.cos(AXIAL_TILT_RAD)
    );
    const fixedSideLabelY = Math.max(
      juneUnzoomedCenter.y + juneUnzoomedRPx + lerp(22, 44, sideP),
      juneUnzoomedSouthOuter.y + 22 * sideP
    );

    if (clockOp > 0.002) {
      toggleTop = Math.max(0, Math.min(H - 68, fixedSideLabelY + 20));
      heatMsgTop = Math.max(0, Math.min(H - 52, fixedSideLabelY + 16));
    }

    const meshBottomY = proj(0, -MESH_HALF_Y, 0).y;
    const frontEarthCenter = proj(0, -ORBIT_R, 0);
    const frontEarthR = EARTH_R * scale * frontEarthCenter.f;
    const frontEarthSouth = proj(
      0,
      -ORBIT_R,
      -EARTH_R * 1.72 * Math.cos(AXIAL_TILT_RAD)
    );
    const frontEarthBottomY = Math.max(
      frontEarthCenter.y + frontEarthR + 28,
      frontEarthSouth.y + 8
    );
    const unfoldedMsgTop = Math.max(meshBottomY + 12, frontEarthBottomY + 8);
    const foldedMsgTop = toggleTop + 30 + 10;
    const msgBottomMargin = W < 540 ? 48 : 34;
    seasonsMsgTop = Math.max(
      0,
      Math.min(H - msgBottomMargin, lerp(unfoldedMsgTop, foldedMsgTop, sunFoldP))
    );

    const panelTop =
      clockOp > 0.002 ? Math.round(lerp(4, clockY + 13 + 8, clockOp)) : 4;
    const panelBottom = Math.max(panelTop + 80, fixedSideLabelY - 16);
    const panelH = panelBottom - panelTop;
    const junePanelRect = { x: 6, y: panelTop, w: Math.max(40, cx - 12), h: panelH };
    const decPanelRect = { x: cx + 6, y: panelTop, w: Math.max(40, W - cx - 12), h: panelH };

    const rayOp = clamp01(sunFoldP / 0.15) * sunEarthOp;
    const lineGap = scale * 0.08;
    const rayFracs = [-0.8, -0.4, 0, 0.4, 0.8];

    const panelHalfTarget = Math.min(junePanelRect.w, decPanelRect.w) * 0.495;
    const baseTangentHalfLen = TANGENT_HALF_RATIO * EARTH_R * scale;
    const surfaceZoomMult = Math.max(5.5, panelHalfTarget / Math.max(1, baseTangentHalfLen));

    const globeBodyOp = clamp01(1 - clamp01((zoomP - 0.1) / 0.65));
    const flatLandOp = clamp01((zoomP - 0.25) / 0.55);

    const youTargetY = panelTop + panelH * 0.68;
    const juneDeltaLat = youLatRad - AXIAL_TILT_RAD;
    const decDeltaLat = youLatRad + AXIAL_TILT_RAD;
    const juneElevSin = Math.max(0.28, Math.cos(juneDeltaLat));
    const decElevAngle = Math.PI / 2 - Math.abs(decDeltaLat);
    const decElevSin = Math.max(0.28, Math.cos(decDeltaLat));

    const minPanelW = Math.min(junePanelRect.w, decPanelRect.w);
    const beamMargin = 10;
    const dPerpZoom = Math.min(minPanelW * 0.052, panelH * 0.08);
    const juneGroundHalfSpan = (2 * dPerpZoom) / juneElevSin;
    const decGroundHalfSpan = (2 * dPerpZoom) / decElevSin;

    const computeYouOffsetInPanel = (panelW: number, dxAtZoom: number, groundHalfSpan: number) => {
      const shiftFrac = clamp01((Math.abs(dxAtZoom) - 0.2) / 0.6) * 0.06 * Math.sign(dxAtZoom);
      const desired = panelW * (0.5 + shiftFrac);
      return Math.max(
        beamMargin + groundHalfSpan,
        Math.min(panelW - beamMargin - groundHalfSpan, desired)
      );
    };

    const juneDx1 = -Math.sin(juneDeltaLat);
    const decDx1 = Math.sin(decDeltaLat);
    const juneYouOffsetInPanel = computeYouOffsetInPanel(
      junePanelRect.w,
      juneDx1,
      juneGroundHalfSpan
    );
    const decYouOffsetInPanel = computeYouOffsetInPanel(
      decPanelRect.w,
      decDx1,
      decGroundHalfSpan
    );

    const computeMaxDropY = (
      panelW: number,
      youOffset: number,
      dxAtZoom: number,
      elevSin: number,
      groundHalfSpan: number
    ) => {
      const cot = Math.abs(dxAtZoom) / elevSin;
      if (cot < 1e-3) return Infinity;
      const runway =
        dxAtZoom >= 0
          ? Math.max(20, youOffset - beamMargin - groundHalfSpan)
          : Math.max(20, panelW - beamMargin - groundHalfSpan - youOffset);
      return runway / cot;
    };

    const maxDeltaYForJune = computeMaxDropY(
      junePanelRect.w,
      juneYouOffsetInPanel,
      juneDx1,
      juneElevSin,
      juneGroundHalfSpan
    );
    const maxDeltaYForDec = computeMaxDropY(
      decPanelRect.w,
      decYouOffsetInPanel,
      decDx1,
      decElevSin,
      decGroundHalfSpan
    );
    const sharedBeamDropY = Math.max(
      28,
      Math.min(panelH * 0.5, youTargetY - (panelTop + 14), maxDeltaYForJune, maxDeltaYForDec)
    );
    const beamStartY = youTargetY - sharedBeamDropY;

    const buildSurfaceView = (side: 'june' | 'dec') => {
      const isJune = side === 'june';
      const worldEx = isJune ? -earthXOffset : earthXOffset;
      const panelRect = isJune ? junePanelRect : decPanelRect;
      const thetaNorm0 = isJune
        ? youLatRad - AXIAL_TILT_RAD
        : Math.PI - (youLatRad + AXIAL_TILT_RAD);
      const targetRot = Math.PI / 2 - thetaNorm0;
      const rotRad = targetRot * zoomP;
      const panelTiltRad = tiltRad - rotRad;
      const zoomFactor = lerp(1, surfaceZoomMult, zoomP);
      const panelScale = scale * zoomFactor;

      const youDx0 = EARTH_R * Math.cos(thetaNorm0);
      const youDz0 = EARTH_R * Math.sin(thetaNorm0);
      const youPos0X = cx + scale * (worldEx + youDx0);
      const youPos0Y = cy - scale * youDz0;
      const youTargetX = panelRect.x + (isJune ? juneYouOffsetInPanel : decYouOffsetInPanel);
      const youPosX = lerp(youPos0X, youTargetX, zoomP);
      const youPosY = lerp(youPos0Y, youTargetY, zoomP);

      const normAng = thetaNorm0 + rotRad;
      const youDx = EARTH_R * Math.cos(normAng);
      const youDz = EARTH_R * Math.sin(normAng);
      const panelCx = youPosX - panelScale * youDx;
      const panelCy = youPosY + panelScale * youDz;

      const xShift = worldEx * (1 - clamp01(zoomP / 0.3));
      const q = 1 / 6.0;
      const panelProj = (x: number, y: number, z = 0): ProjPoint => {
        const lx = x - worldEx;
        const zc = -y;
        const f = 1 / (1 - zc * q);
        return {
          x: panelCx + panelScale * ((xShift + lx) * f - xShift),
          y: panelCy - panelScale * z * f,
          f,
          zc,
        };
      };
      const panelCamDir = (x: number, y: number, z: number): [number, number, number] => {
        const lx = x - worldEx;
        const vx = -(xShift + lx);
        const vy = -6.0 - y;
        const vz = -z;
        const len = Math.hypot(vx, vy, vz) || 1;
        return [vx / len, vy / len, vz / len];
      };

      const lightDirOverride: [number, number, number] = isJune
        ? [Math.cos(rotRad), 0, Math.sin(rotRad)]
        : [-Math.cos(rotRad), 0, -Math.sin(rotRad)];

      // Sunlight travel direction in screen (x_right, y_down) coordinates
      const Dx = isJune ? -Math.cos(rotRad) : Math.cos(rotRad);
      const Dy = isJune ? Math.sin(rotRad) : -Math.sin(rotRad);
      const rayAngDeg = (Math.atan2(Dy, Dx) * 180) / Math.PI;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const lxStart = isJune ? earthXOffset - 0.08 : -earthXOffset + 0.08;

      const tx = Math.sin(normAng);
      const ty = Math.cos(normAng);
      const gx = -Math.cos(normAng);
      const gy = Math.sin(normAng);

      const zoomRays: React.ReactNode[] = [];
      if (zoomP > 0.001 && rayOp > 0.005) {
        const dGroundTarget = dPerpZoom / (isJune ? juneElevSin : decElevSin);
        const endSmooth = zoomP * zoomP * (3 - 2 * zoomP);
        const lenBlend = clamp01(zoomP / 0.85);
        const lenSmooth = lenBlend * lenBlend * (3 - 2 * lenBlend);

        for (let k = -2; k <= 2; k++) {
          const frac = k * 0.4;
          const z = frac * EARTH_R;
          const dxHit = Math.sqrt(Math.max(0, EARTH_R * EARTH_R - z * z));
          const lxHit0 = isJune ? dxHit : -dxHit;
          const pHitSphere = panelProj(
            worldEx + lxHit0 * cosR - z * sinR,
            0,
            lxHit0 * sinR + z * cosR
          );
          const endSphereX = pHitSphere.x - 6 * Dx;
          const endSphereY = pHitSphere.y - 6 * Dy;

          const groundPosOffset = (isJune ? -k : k) * dGroundTarget;
          const hitFlatX = youPosX + groundPosOffset * tx;
          const hitFlatY = youPosY + groundPosOffset * ty;
          const endFlatX = hitFlatX - 6 * Dx;
          const endFlatY = hitFlatY - 6 * Dy;

          const endX = lerp(endSphereX, endFlatX, endSmooth);
          const endY = lerp(endSphereY, endFlatY, endSmooth);

          const len0 = Math.max(8, Math.abs(lxStart - lxHit0) * scale - 6);
          const lenToTop = Math.max(12, (endY - beamStartY) / Math.max(0.28, Dy));
          const rayLen = lerp(len0, lenToTop, lenSmooth);
          const startX = endX - rayLen * Dx;
          const startY = endY - rayLen * Dy;

          zoomRays.push(
            <g key={`beam-${k}`} opacity={rayOp}>
              <line
                className="sunlight-ray"
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
              />
              <path
                className="sunlight-arrow"
                d="M-6.5,-3.8 L0,0 L-6.5,3.8"
                transform={`translate(${endX.toFixed(1)} ${endY.toFixed(1)}) rotate(${rayAngDeg.toFixed(1)})`}
              />
            </g>
          );
        }
      }

      const lineOp = tangentOp > 0.002 ? clamp01(tangentOp / 0.25) : 0;
      const tangentDrawP = clamp01(tangentOp / 0.85);
      const leftHalfLen =
        lerp(baseTangentHalfLen, youTargetX - (panelRect.x + 2), zoomP) * tangentDrawP;
      const rightHalfLen =
        lerp(baseTangentHalfLen, panelRect.x + panelRect.w - 2 - youTargetX, zoomP) * tangentDrawP;

      const xL = youPosX - leftHalfLen * tx;
      const yL = youPosY - leftHalfLen * ty;
      const xR = youPosX + rightHalfLen * tx;
      const yR = youPosY + rightHalfLen * ty;
      const landDepth = panelRect.h + 40;
      const landGradId = `flatLand-${side}-${uid}`;
      const landPolyD = `M${xL.toFixed(1)},${yL.toFixed(1)} L${xR.toFixed(1)},${yR.toFixed(1)} L${(xR + landDepth * gx).toFixed(1)},${(yR + landDepth * gy).toFixed(1)} L${(xL + landDepth * gx).toFixed(1)},${(yL + landDepth * gy).toFixed(1)} Z`;

      const surfaceOverlay =
        zoomP > 0.001 || tangentOp > 0.002 ? (
          <g>
            {/* Flat land surface filling below the tangent line as Earth zooms in */}
            {flatLandOp > 0.005 && (leftHalfLen > 1 || rightHalfLen > 1) && (
              <g opacity={flatLandOp}>
                <defs>
                  <linearGradient
                    id={landGradId}
                    gradientUnits="userSpaceOnUse"
                    x1={youPosX}
                    y1={youPosY}
                    x2={youPosX + panelRect.h * 0.34 * gx}
                    y2={youPosY + panelRect.h * 0.34 * gy}
                  >
                    <stop offset="0%" stopColor="#c3def8" />
                    <stop offset="40%" stopColor="#dcecfb" />
                    <stop offset="100%" stopColor="#f3f8fe" />
                  </linearGradient>
                </defs>
                <path className="flat-land" d={landPolyD} fill={`url(#${landGradId})`} />
              </g>
            )}

            {/* 5 parallel sunlight beams */}
            {zoomRays.length > 0 && <g>{zoomRays}</g>}

            {/* Tangent / flat ground surface line drawn through "You" */}
            {lineOp > 0.01 && (leftHalfLen > 1 || rightHalfLen > 1) && (
              <g opacity={lineOp}>
                {1 - flatLandOp > 0.01 && (
                  <line
                    className="tangent-line-halo"
                    opacity={1 - flatLandOp}
                    x1={xL}
                    y1={yL}
                    x2={xR}
                    y2={yR}
                  />
                )}
                <line className="tangent-line" x1={xL} y1={yL} x2={xR} y2={yR} />
              </g>
            )}
          </g>
        ) : null;

      return {
        panelTiltRad,
        panelScale,
        panelProj,
        panelCamDir,
        lightDirOverride,
        fixedLabelX: cx + scale * worldEx,
        surfaceOverlay,
      };
    };

    const juneSide = zoomP > 0.001 || tangentOp > 0.002 ? buildSurfaceView('june') : null;
    const decSide = zoomP > 0.001 || tangentOp > 0.002 ? buildSurfaceView('dec') : null;

    // Solid spinning December Earth (Step 5/6/7 — +π phase aligns solar noon with June Earth)
    const solidDecOp = sunEarthOp * solidDecP;
    if (solidDecOp > 0.002) {
      const decProj = proj(earthXOffset, 0, 0);
      depthItems.push({
        zc: decProj.zc,
        node: renderGlobe({
          key: 'solid-dec-earth',
          ex: earthXOffset,
          ey: 0,
          tiltRad: decSide ? decSide.panelTiltRad : AXIAL_TILT_RAD,
          spinRad: effectiveSpinAngle + Math.PI,
          opacity: solidDecOp,
          label: 'December',
          labelOpacity: 1,
          labelXOverride: zoomP > 0.001 && decSide ? decSide.fixedLabelX : undefined,
          labelYOverride: zoomP > 0.001 ? fixedSideLabelY : undefined,
          sideViewProgress: sideP,
          youOpacity: S.youOnTheNorthHemisphereOpacity * solidDecP,
          youLatRad,
          youSouthProgress: southP,
          youLabelOpacity: zoomP > 0.001 ? 1 - spreadVisOp : 1,
          youZoomProgress: zoomP,
          forceYouFront: zoomP > 0.001 || stopNoonP >= 0.9999,
          globeBodyOpacity: globeBodyOp,
          lightDirOverride: zoomP > 0.001 && decSide ? decSide.lightDirOverride : undefined,
          globeClipId: zoomP > 0.001 ? `decPanelClip-${uid}` : undefined,
          surfaceOverlay: decSide?.surfaceOverlay,
          gradId: `decSolidGrad-${uid}`,
          proj: zoomP > 0.001 && decSide ? decSide.panelProj : proj,
          camDirFrom: zoomP > 0.001 && decSide ? decSide.panelCamDir : camDirFrom,
          scale: zoomP > 0.001 && decSide ? decSide.panelScale : scale,
        }),
      });
    }

    // Live spinning Earth (becomes June Earth in Steps 5-7)
    if (sunEarthOp > 0.002) {
      const useJunePanel = sunFoldP >= 0.999 && juneSide !== null;
      depthItems.push({
        zc: earthScreen.zc,
        node: renderGlobe({
          key: 'live-earth',
          ex: useJunePanel && zoomP > 0.001 ? -earthXOffset : ex,
          ey: useJunePanel && zoomP > 0.001 ? 0 : ey,
          tiltRad: useJunePanel && juneSide ? juneSide.panelTiltRad : tiltRad,
          spinRad: effectiveSpinAngle,
          opacity: sunEarthOp,
          label: liveEarthLabel,
          labelXOverride:
            useJunePanel && zoomP > 0.001 && juneSide ? juneSide.fixedLabelX : undefined,
          labelYOverride: useJunePanel && zoomP > 0.001 ? fixedSideLabelY : undefined,
          sideViewProgress: sideP,
          showTiltGuide: tiltGuideOp,
          youOpacity: S.youOnTheNorthHemisphereOpacity,
          youLatRad,
          youSouthProgress: southP,
          youLabelOpacity: useJunePanel && zoomP > 0.001 ? 1 - spreadVisOp : 1,
          youZoomProgress: useJunePanel ? zoomP : 0,
          forceYouFront: zoomP > 0.001 || stopNoonP >= 0.9999,
          globeBodyOpacity: useJunePanel ? globeBodyOp : 1,
          lightDirOverride:
            useJunePanel && zoomP > 0.001 && juneSide ? juneSide.lightDirOverride : undefined,
          globeClipId: useJunePanel && zoomP > 0.001 ? `junePanelClip-${uid}` : undefined,
          surfaceOverlay: useJunePanel ? juneSide?.surfaceOverlay : undefined,
          gradId: `earthGrad-${uid}`,
          proj: useJunePanel && zoomP > 0.001 && juneSide ? juneSide.panelProj : proj,
          camDirFrom:
            useJunePanel && zoomP > 0.001 && juneSide ? juneSide.panelCamDir : camDirFrom,
          scale: useJunePanel && zoomP > 0.001 && juneSide ? juneSide.panelScale : scale,
        }),
      });
    }

    depthItems.sort((a, b) => a.zc - b.zc);

    // Step 8 moving dotted-line copy of sunlight beams, red heat intensity bar, and spread measurement
    let spreadComparisonNode: React.ReactNode = null;
    if (spreadVisOp > 0.002 && sunEarthOp > 0.002) {
      const juneYouX = junePanelRect.x + junePanelRect.w * 0.5;
      const decYouX = decPanelRect.x + decYouOffsetInPanel;
      const copyCenterX = lerp(juneYouX, decYouX, seasonP);

      const juneDGround = dPerpZoom / juneElevSin;
      const juneLeftHitX = juneYouX - 2 * juneDGround;
      const juneRightHitX = juneYouX + 2 * juneDGround;
      const juneBarFill = 'rgb(220, 48, 42)';
      const juneBarStroke = 'rgba(176, 36, 30, 0.88)';

      const juneRayAngle = Math.PI / 2 + (YOU_LAT_RAD - AXIAL_TILT_RAD);
      const decRayAngle = decElevAngle;
      const copyRayAngle = lerp(juneRayAngle, decRayAngle, seasonP);
      const copyDx = Math.cos(copyRayAngle);
      const copyDy = Math.sin(copyRayAngle);
      const copyRayDeg = (copyRayAngle * 180) / Math.PI;
      const copyDGround = dPerpZoom / copyDy;

      const leftHitX = copyCenterX - 2 * copyDGround;
      const rightHitX = copyCenterX + 2 * copyDGround;
      const spreadRatio = juneElevSin / copyDy;
      const minRatio = 1;
      const maxRatio = juneElevSin / decElevSin;
      const heatFadeT = clamp01((spreadRatio - minRatio) / Math.max(1e-4, maxRatio - minRatio));
      const spreadUnits = lerp(3, 5, heatFadeT);

      const barR = Math.round(lerp(220, 245, heatFadeT));
      const barG = Math.round(lerp(48, 178, heatFadeT));
      const barB = Math.round(lerp(42, 170, heatFadeT));
      const barFill = `rgb(${barR}, ${barG}, ${barB})`;
      const barStroke = `rgba(176, 36, 30, ${lerp(0.88, 0.42, heatFadeT).toFixed(2)})`;

      const barY = youTargetY + 1.1;
      const barH = Math.round(Math.min(34, Math.max(20, (panelBottom - youTargetY) * 0.3)));
      const measY = barY + barH + 10;
      const movingMeasOp = clamp01(seasonP / 0.12);

      spreadComparisonNode = (
        <g opacity={spreadVisOp}>
          {/* Dotted-line copy of the 5 sunlight beams sliding from June to December */}
          {[-2, -1, 0, 1, 2].map((idx) => {
            const hitX = copyCenterX + idx * copyDGround;
            const endX = hitX - 6 * copyDx;
            const endY = youTargetY - 6 * copyDy;
            const rayLen = (endY - beamStartY) / copyDy;
            const startX = endX - rayLen * copyDx;
            const startY = beamStartY;
            return (
              <g key={`copy-beam-${idx}`}>
                <line
                  className="sunlight-ray-copy"
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                />
                <path
                  className="sunlight-arrow-copy"
                  d="M-6.5,-3.8 L0,0 L-6.5,3.8"
                  transform={`translate(${endX.toFixed(1)} ${endY.toFixed(1)}) rotate(${copyRayDeg.toFixed(1)})`}
                />
              </g>
            );
          })}

          {/* Static copy of the red heat intensity bar kept at the June position */}
          <rect
            className="heat-bar"
            x={juneLeftHitX}
            y={barY}
            width={Math.max(4, juneRightHitX - juneLeftHitX)}
            height={barH}
            fill={juneBarFill}
            stroke={juneBarStroke}
          />

          {/* Moving red heat intensity bar sliding with the beams toward December */}
          {seasonP > 0.001 && (
            <rect
              className="heat-bar"
              x={leftHitX}
              y={barY}
              width={Math.max(4, rightHitX - leftHitX)}
              height={barH}
              fill={barFill}
              stroke={barStroke}
            />
          )}

          {/* Keep both "You" surface dots crisp above the top edge of the bars */}
          {S.youOnTheNorthHemisphereOpacity > 0.01 && (
            <g opacity={clamp01(S.youOnTheNorthHemisphereOpacity)}>
              <circle className="you-dot" cx={juneYouX} cy={youTargetY} r={4.5} />
              {solidDecP > 0.01 && (
                <circle
                  className="you-dot"
                  cx={decYouX}
                  cy={youTargetY}
                  r={4.5}
                  opacity={solidDecP}
                />
              )}
            </g>
          )}

          {/* Static June measurement bracket and "3.00 units spread" label */}
          <line
            className="spread-measure-line"
            x1={juneLeftHitX}
            y1={measY}
            x2={juneRightHitX}
            y2={measY}
          />
          <line
            className="spread-measure-tick"
            x1={juneLeftHitX}
            y1={measY - 4}
            x2={juneLeftHitX}
            y2={measY + 4}
          />
          <line
            className="spread-measure-tick"
            x1={juneRightHitX}
            y1={measY - 4}
            x2={juneRightHitX}
            y2={measY + 4}
          />
          <text className="spread-measure-txt halo" x={juneYouX} y={measY + 16}>
            3.00 units spread
          </text>

          {/* Moving measurement bracket and "X units spread" label */}
          {movingMeasOp > 0.01 && (
            <g opacity={movingMeasOp}>
              <line
                className="spread-measure-line"
                x1={leftHitX}
                y1={measY}
                x2={rightHitX}
                y2={measY}
              />
              <line
                className="spread-measure-tick"
                x1={leftHitX}
                y1={measY - 4}
                x2={leftHitX}
                y2={measY + 4}
              />
              <line
                className="spread-measure-tick"
                x1={rightHitX}
                y1={measY - 4}
                x2={rightHitX}
                y2={measY + 4}
              />
              <text className="spread-measure-txt halo" x={copyCenterX} y={measY + 16}>
                {`${spreadUnits.toFixed(2)} units spread`}
              </text>
            </g>
          )}
        </g>
      );
    }

    // 4. Vertical center line & horizontal sunlight rays (Steps 5-6; smoothly fades into zoomed panels in Step 7)
    const showSunFold = sunFoldP > 0.002 && sunEarthOp > 0.002;
    const centerLineOp =
      clamp01(sunFoldP / 0.2) * sunEarthOp * (1 - clamp01(zoomP / 0.35));

    const showUnzoomedRays = showSunFold && zoomP <= 0.001;
    const sunlightRays = showUnzoomedRays
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
            r={Math.max(liveEarthRPx + 28, 46)}
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
          <clipPath id={`junePanelClip-${uid}`}>
            <rect
              x={junePanelRect.x}
              y={junePanelRect.y}
              width={junePanelRect.w}
              height={junePanelRect.h}
              rx={8}
            />
          </clipPath>
          <clipPath id={`decPanelClip-${uid}`}>
            <rect
              x={decPanelRect.x}
              y={decPanelRect.y}
              width={decPanelRect.w}
              height={decPanelRect.h}
              rx={8}
            />
          </clipPath>
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

        {/* Earth Orbit (back & interior behind imprints, front arc emerging in front of imprints) */}
        {orbitOp > 0.002 && orbitComplete && imprintNodes.length > 0 ? (
          <>
            <g opacity={orbitOp}>
              <path className="orbit-guide" d={backOrbitD} style={{ strokeLinecap: 'butt' }} />
              <path className="orbit-trail" d={backOrbitD} style={{ strokeLinecap: 'butt' }} />
              {orbitArrowsOp > 0.01 && (
                <g opacity={orbitArrowsOp}>{renderOrbitArrow(Math.PI / 2)}</g>
              )}
            </g>
            {imprintNodes}
            <g opacity={orbitOp}>
              <path className="orbit-guide" d={frontOrbitD} style={{ strokeLinecap: 'butt' }} />
              <path className="orbit-trail" d={frontOrbitD} style={{ strokeLinecap: 'butt' }} />
              {orbitArrowsOp > 0.01 && (
                <g opacity={orbitArrowsOp}>{renderOrbitArrow((3 * Math.PI) / 2)}</g>
              )}
            </g>
          </>
        ) : (
          <>
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
            {imprintNodes}
          </>
        )}

        {/* Horizontal sunlight rays from center line to both Earths (Step 5/6 unzoomed) */}
        {showUnzoomedRays && rayOp > 0.002 && <g opacity={rayOp}>{sunlightRays}</g>}

        {/* Depth-sorted Sun and live/solid Earths (always in front of orbit & imprints) */}
        {depthItems.map((item) => item.node)}

        {/* Vertical center line crossing the center of the Sun (Step 5/6) */}
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

        {/* Subtle divider between zoomed June and December surface panels (Step 7) */}
        {zoomP > 0.01 && (
          <line
            className="zoom-divider"
            x1={cx}
            y1={panelTop + 6}
            x2={cx}
            y2={panelBottom - 6}
            opacity={zoomP * 0.75}
          />
        )}

        {/* Single synchronized HH:MM AM/PM digital clock centered above both Earths (Step 6+) */}
        {clockTime && clockOp > 0.01 && sunEarthOp > 0.002 && (
          <g
            className="digital-clock"
            opacity={clockOp * sunEarthOp}
            transform={`translate(${cx.toFixed(1)} ${clockY.toFixed(1)})`}
          >
            <rect className="digital-clock-box" x={-46} y={-13} width={92} height={26} rx={6} />
            <text className="digital-clock-txt" x={0} y={0}>
              {clockTime}
            </text>
          </g>
        )}

        {/* Step 8 moving dotted beam copy, red heat bar, and spread measurement */}
        {spreadComparisonNode}

        {/* Topmost Step 4 draggable Earth affordance & hit target */}
        {dragLayer}
      </>
    );
  }

  const msgOp = clamp01(S.aboutSameDistMessageOpacity);
  const moveMsgOp = clamp01(S.moveEarthMessageOpacity);
  const sunlightDiffMsgOp = clamp01(S.sunlightDiffMessageOpacity);
  const heatMsgOp = clamp01(S.moreHeatMessageOpacity);
  const southMsgOp = clamp01(S.southQuestionMessageOpacity);
  const spinToggleOp = clamp01(S.spinToggleOpacity);
  const zoomToggleOp = clamp01(S.zoomToggleOpacity);
  const moreHeatLabelOp = clamp01(S.moreHeatLabelOpacity);
  const lessHeatLabelOp = clamp01(S.lessHeatLabelOpacity);
  const summerLabelOp = clamp01(S.summerLabelOpacity);
  const winterLabelOp = clamp01(S.winterLabelOpacity);
  const summerRingP = clamp01(S.summerRingProgress);
  const winterRingP = clamp01(S.winterRingProgress);
  const isSpinPaused = Boolean(S.earthSpinPaused);
  const canToggleSpin = spinToggleOp > 0.05 && !isAnimating;
  const effectiveZoomTarget = zoomTweenTarget ?? (S.surfaceZoomProgress >= 0.5 ? 1 : 0);
  const isZoomedOut = effectiveZoomTarget === 0;
  const canClickZoom = zoomToggleOp > 0.05 && canToggleZoom;
  const probOp = clamp01(S.problemOpacity);
  const heatMsgMaxW = Math.max(120, Math.round(W * 0.44));
  const msgTopPx = `${seasonsMsgTop.toFixed(1)}px`;

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
        Why are there <b className="c-orange">summers</b> and{' '}
        <b className="c-blue">winters</b>?
      </p>
      <div
        className={canDrag ? 'box can-drag' : 'box'}
        ref={boxRef}
        style={isDragging ? { cursor: 'grabbing' } : undefined}
        onPointerMove={handleBoxPointerMove}
        onPointerUp={handleBoxPointerEnd}
        onPointerCancel={handleBoxPointerEnd}
        onLostPointerCapture={handleBoxPointerEnd}
      >
        <svg className="pic" role="img" aria-label={ALT_TEXT}>
          {sceneContent}
        </svg>
        <p
          className="seasons-msg"
          aria-hidden={msgOp <= 0.01 ? true : undefined}
          style={{
            top: msgTopPx,
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
            top: msgTopPx,
            opacity: moveMsgOp,
            transform: `translateY(${((1 - moveMsgOp) * 8).toFixed(1)}px)`,
          }}
        >
          Move the earth around yourself!
        </p>
        <p
          className="seasons-msg"
          aria-hidden={sunlightDiffMsgOp <= 0.01 ? true : undefined}
          style={{
            top: msgTopPx,
            opacity: sunlightDiffMsgOp,
            transform: `translateY(${((1 - sunlightDiffMsgOp) * 8).toFixed(1)}px)`,
          }}
        >
          Do you see any difference in sunlight between June and December?
        </p>
        <p
          className="seasons-msg"
          aria-hidden={heatMsgOp <= 0.01 ? true : undefined}
          style={{
            top: msgTopPx,
            opacity: heatMsgOp,
            transform: `translateY(${((1 - heatMsgOp) * 8).toFixed(1)}px)`,
          }}
        >
          When do you get more heat, June or December?
        </p>
        <p
          className="seasons-msg"
          aria-hidden={southMsgOp <= 0.01 ? true : undefined}
          style={{
            top: msgTopPx,
            opacity: southMsgOp,
            transform: `translateY(${((1 - southMsgOp) * 8).toFixed(1)}px)`,
          }}
        >
          Can you figure out when is summer, when is winter?
        </p>
        {moreHeatLabelOp > 0.01 && (
          <p
            className="heat-side-msg june"
            style={{
              left: `${juneLabelX.toFixed(1)}px`,
              top: `${heatMsgTop.toFixed(1)}px`,
              maxWidth: `${heatMsgMaxW}px`,
              opacity: moreHeatLabelOp,
              transform: `translate(-50%, ${((1 - moreHeatLabelOp) * 6).toFixed(1)}px)`,
            }}
          >
            Narrower spread,
            <br />
            more intense heat
          </p>
        )}
        {lessHeatLabelOp > 0.01 && (
          <p
            className="heat-side-msg dec"
            style={{
              left: `${decLabelX.toFixed(1)}px`,
              top: `${heatMsgTop.toFixed(1)}px`,
              maxWidth: `${heatMsgMaxW}px`,
              opacity: lessHeatLabelOp,
              transform: `translate(-50%, ${((1 - lessHeatLabelOp) * 6).toFixed(1)}px)`,
            }}
          >
            Wider spread,
            <br />
            less intense heat
          </p>
        )}
        {summerLabelOp > 0.01 && (
          <p
            className="heat-side-msg june season-ans-msg"
            style={{
              left: `${juneLabelX.toFixed(1)}px`,
              top: `${heatMsgTop.toFixed(1)}px`,
              maxWidth: `${heatMsgMaxW}px`,
              opacity: summerLabelOp,
              transform: `translate(-50%, ${((1 - summerLabelOp) * 6).toFixed(1)}px)`,
            }}
          >
            <AnswerRingWord text="Summer" progress={summerRingP} />
          </p>
        )}
        {winterLabelOp > 0.01 && (
          <p
            className="heat-side-msg dec season-ans-msg"
            style={{
              left: `${decLabelX.toFixed(1)}px`,
              top: `${heatMsgTop.toFixed(1)}px`,
              maxWidth: `${heatMsgMaxW}px`,
              opacity: winterLabelOp,
              transform: `translate(-50%, ${((1 - winterLabelOp) * 6).toFixed(1)}px)`,
            }}
          >
            <AnswerRingWord text="Winter" progress={winterRingP} />
          </p>
        )}
        {spinToggleOp > 0.01 && (
          <button
            type="button"
            className="spin-toggle"
            aria-pressed={isSpinPaused}
            aria-label={isSpinPaused ? 'Spin both Earths' : 'Pause both Earths'}
            disabled={!canToggleSpin}
            onClick={() => canToggleSpin && updateState({ earthSpinPaused: !isSpinPaused })}
            style={{
              top: `${toggleTop.toFixed(1)}px`,
              opacity: spinToggleOp,
              pointerEvents: canToggleSpin ? 'auto' : 'none',
              transform: `translate(-50%, ${((1 - spinToggleOp) * 6).toFixed(1)}px)`,
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
        {zoomToggleOp > 0.01 && (
          <button
            type="button"
            className="zoom-toggle"
            aria-pressed={isZoomedOut}
            aria-label={isZoomedOut ? 'Zoom in on both Earths' : 'Zoom out from both Earths'}
            disabled={!canClickZoom}
            onClick={() => canClickZoom && setZoomTweenTarget(isZoomedOut ? 1 : 0)}
            style={{
              top: `${toggleTop.toFixed(1)}px`,
              opacity: zoomToggleOp,
              pointerEvents: canClickZoom ? 'auto' : 'none',
              transform: `translate(-50%, ${((1 - zoomToggleOp) * 6).toFixed(1)}px)`,
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="6.8" cy="6.8" r="4.5" />
              <line x1="10.2" y1="10.2" x2="14" y2="14" />
              <line x1="4.9" y1="6.8" x2="8.7" y2="6.8" />
              {isZoomedOut && <line x1="6.8" y1="4.9" x2="6.8" y2="8.7" />}
            </svg>
            <span>{isZoomedOut ? 'Zoom In' : 'Zoom Out'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

SeasonsWhySceneRenderer.defaultState = DEFAULT_SEASONS_WHY_STATE;
