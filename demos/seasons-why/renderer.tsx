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
const MESH_HALF = 1.45;
const MESH_LINES = 9; // 8x8 grid cells
const SUN_R = 0.22;
const EARTH_R = 0.16;
const AXIAL_TILT_RAD = (23.5 * Math.PI) / 180;
const LATITUDES_DEG = [-60, -30, 0, 30, 60];
const MERIDIANS = 6;
const SPIN_RAD_PER_SEC = 1.35;

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
  cx: number,
  cy: number,
  scale: number
) {
  const p = clamp01(viewTiltProgress);
  const alpha = (Math.PI / 3) * p;
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
  showTiltGuide?: number;
  youOpacity?: number;
  gradId: string;
  sunScreen: ProjPoint;
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
  showTiltGuide = 0,
  youOpacity = 0,
  gradId,
  sunScreen,
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

  // Sunlit direction in screen space for day/night shading
  const dxSun = sunScreen.x - center.x;
  const dySun = sunScreen.y - center.y;
  const distSun = Math.hypot(dxSun, dySun) || 1;
  const ux = dxSun / distSun;
  const uy = dySun / distSun;

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

  // "You" dot on Northern Hemisphere (40°N on the front-facing hemisphere)
  const youOp = clamp01(youOpacity);
  let youPt: EarthPos | null = null;
  if (youOp > 0.01 && !isImprint) {
    youPt = sampleEarthPoint(
      ex,
      ey,
      (40 * Math.PI) / 180,
      -Math.PI * 0.45,
      tiltRad,
      proj,
      camDir
    );
  }

  const labelOp = clamp01(labelOpacity) * op;

  return (
    <g key={key} opacity={op}>
      <defs>
        <linearGradient
          id={gradId}
          x1={0.5 + 0.5 * ux}
          y1={0.5 + 0.5 * uy}
          x2={0.5 - 0.5 * ux}
          y2={0.5 - 0.5 * uy}
        >
          <stop offset="0%" stopColor="#eff7ff" />
          <stop offset="48%" stopColor="#cbe3fb" />
          <stop offset="56%" stopColor="#92bde8" />
          <stop offset="100%" stopColor="#6c99c8" />
        </linearGradient>
      </defs>

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

      {/* Earth sphere body */}
      <circle
        className={isImprint ? 'earth-body imprint' : 'earth-body'}
        cx={center.x}
        cy={center.y}
        r={rPx}
        fill={isImprint ? 'var(--blue-fill)' : `url(#${gradId})`}
      />

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

      {/* Optional "You" dot on Northern Hemisphere */}
      {youPt && youOp > 0.01 && (
        <g opacity={youOp}>
          <circle className="you-dot" cx={youPt.sx} cy={youPt.sy} r={4.5} />
          <text className="scene-cap c-pink halo" x={youPt.sx + 14} y={youPt.sy - 8}>
            You
          </text>
        </g>
      )}

      {/* Globe label */}
      {label && labelOp > 0.01 && (
        <text
          className={isImprint ? 'scene-lbl imprint halo' : 'scene-lbl earth halo'}
          x={center.x}
          y={center.y + rPx + 22}
          opacity={labelOp}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export const SeasonsWhySceneRenderer: ElementRendererComponent<SeasonsWhyState> = ({
  element,
}) => {
  const S = element.state;
  const uid = useId().replace(/:/g, '');
  const boxRef = useRef<HTMLDivElement>(null);
  const [spinAngle, setSpinAngle] = useState(0);

  // Measure the drawing box below the problem text
  const box = useMeasure<Size | null>(
    boxRef,
    () => {
      const rect = boxRef.current?.getBoundingClientRect();
      return rect?.width && rect.height ? { w: rect.width, h: rect.height } : undefined;
    },
    null
  );

  // Continuously spin the Earth whenever it is visible
  useEffect(() => {
    if (S.sunAndEarthOpacity <= 0.01) return;
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
  }, [S.sunAndEarthOpacity > 0.01]);

  // Layout calculation
  const W = box?.w ?? 0;
  const H = box?.h ?? 0;
  const msgReserve = box ? Math.min(58, Math.max(36, H * 0.14)) : 0;
  const availH = Math.max(120, H - msgReserve);
  const padX = Math.max(18, W * 0.04);
  const padY = Math.max(14, availH * 0.05);
  const viewP = clamp01(S.space30DegViewProgress);
  const horizSpan = lerp(3.3, 3.64, viewP);
  const vertSpan = lerp(2.96, 1.98, viewP);
  const scale = box
    ? Math.min((W - 2 * padX) / horizSpan, (availH - 2 * padY) / vertSpan)
    : 100;
  const cx = W / 2;
  const cy = availH / 2 + 4 - 0.06 * scale * viewP;

  // Build projected 3D scene primitives once `box` is measured
  let sceneContent: React.ReactNode = null;
  if (box) {
    const { proj, camDirFrom } = makeProjector(S.space30DegViewProgress, cx, cy, scale);

    // 1. 2D Space Mesh (Z = 0)
    const meshOp = clamp01(S.mesh2DOpacity);
    const meshLines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    let meshBorderD = '';
    if (meshOp > 0.002) {
      for (let i = 0; i < MESH_LINES; i++) {
        const v = lerp(-MESH_HALF, MESH_HALF, i / (MESH_LINES - 1));
        const isMajor = i === 0 || i === MESH_LINES - 1 || Math.abs(v) < 1e-6;
        const hx0 = proj(-MESH_HALF, v, 0);
        const hx1 = proj(MESH_HALF, v, 0);
        meshLines.push({ x1: hx0.x, y1: hx0.y, x2: hx1.x, y2: hx1.y, major: isMajor });

        const vy0 = proj(v, -MESH_HALF, 0);
        const vy1 = proj(v, MESH_HALF, 0);
        meshLines.push({ x1: vy0.x, y1: vy0.y, x2: vy1.x, y2: vy1.y, major: isMajor });
      }
      const c0 = proj(-MESH_HALF, -MESH_HALF, 0);
      const c1 = proj(MESH_HALF, -MESH_HALF, 0);
      const c2 = proj(MESH_HALF, MESH_HALF, 0);
      const c3 = proj(-MESH_HALF, MESH_HALF, 0);
      meshBorderD = `M${c0.x.toFixed(1)},${c0.y.toFixed(1)} L${c1.x.toFixed(1)},${c1.y.toFixed(1)} L${c2.x.toFixed(1)},${c2.y.toFixed(1)} L${c3.x.toFixed(1)},${c3.y.toFixed(1)} Z`;
    }

    // 2. Orbit path (Z = 0)
    const orbitOp = clamp01(S.earthOrbitOpacity);
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

    const orbitTheta =
      Math.PI + 2 * Math.PI * (S.earthOrbitProgress + S.tiltedEarthOrbitingProgress);
    const ex = ORBIT_R * Math.cos(orbitTheta);
    const ey = ORBIT_R * Math.sin(orbitTheta);
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

    // Live Earth label fades into "June" once Step 4 begins orbiting
    const liveEarthLabelOp = clamp01(1 - tiltedP / 0.1);

    interface DepthItem {
      zc: number;
      node: React.ReactNode;
    }

    const depthItems: DepthItem[] = [];

    // Sun item
    if (sunEarthOp > 0.002) {
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

      depthItems.push({
        zc: sunScreen.zc,
        node: (
          <g key="sun" opacity={sunEarthOp}>
            <circle cx={sunScreen.x} cy={sunScreen.y} r={sunR * 2.1} fill={`url(#sunGlow-${uid})`} />
            <g>{rays}</g>
            <circle
              className="sun-body"
              cx={sunScreen.x}
              cy={sunScreen.y}
              r={sunR}
              fill={`url(#sunBody-${uid})`}
            />
            <text
              className="scene-lbl sun halo"
              x={sunScreen.x}
              y={sunScreen.y + sunR + 20}
            >
              Sun
            </text>
          </g>
        ),
      });
    }

    // June imprint (left, -ORBIT_R, 0)
    if (juneIn > 0.002) {
      const juneProj = proj(-ORBIT_R, 0, 0);
      depthItems.push({
        zc: juneProj.zc - 0.001,
        node: renderGlobe({
          key: 'june-imprint',
          ex: -ORBIT_R,
          ey: 0,
          tiltRad: AXIAL_TILT_RAD,
          spinRad: 0,
          opacity: juneIn * 0.85,
          isImprint: true,
          label: 'June',
          labelOpacity: 1,
          gradId: `juneGrad-${uid}`,
          sunScreen,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    // December imprint (right, +ORBIT_R, 0)
    if (decIn > 0.002) {
      const decProj = proj(ORBIT_R, 0, 0);
      depthItems.push({
        zc: decProj.zc - 0.001,
        node: renderGlobe({
          key: 'dec-imprint',
          ex: ORBIT_R,
          ey: 0,
          tiltRad: AXIAL_TILT_RAD,
          spinRad: 0,
          opacity: decIn * 0.85,
          isImprint: true,
          label: 'December',
          labelOpacity: 1,
          gradId: `decGrad-${uid}`,
          sunScreen,
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
          label: 'Earth',
          labelOpacity: liveEarthLabelOp,
          showTiltGuide: tiltGuideOp,
          youOpacity: S.youOnTheNorthHemisphereOpacity,
          gradId: `earthGrad-${uid}`,
          sunScreen,
          proj,
          camDirFrom,
          scale,
        }),
      });
    }

    depthItems.sort((a, b) => a.zc - b.zc);

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
        </defs>

        {/* 2D Space Mesh */}
        {meshOp > 0.002 && (
          <g opacity={meshOp}>
            <path className="space-plane" d={meshBorderD} />
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

        {/* Depth-sorted Sun, Earth, and Imprints */}
        {depthItems.map((item) => item.node)}
      </>
    );
  }

  const msgOp = clamp01(S.aboutSameDistMessageOpacity);
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
      <div className="box" ref={boxRef}>
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
      </div>
    </div>
  );
};

SeasonsWhySceneRenderer.defaultState = DEFAULT_SEASONS_WHY_STATE;
