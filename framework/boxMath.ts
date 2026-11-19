// Shared box-transition perspective math used by both the front page (framework/lid.ts)
// and demo pages (framework/box.ts).

export interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

export interface PageTransitionEventLike extends Event {
  readonly viewTransition?: ViewTransition | null;
}

export interface BoxMeasurement {
  r: DOMRect;
  sunk: number;
  pass: number;
}

/**
 * When the rising paper passes the tops of the walls, as a fraction of its rise: the paper covers
 * all but `--lift-peek` of the walls (`--box-wall` thick) when raised, so it is level with their
 * tops when it is just small enough to fit between them, across and down. The rise is one movement
 * eased by `--box-ease`, a `cubic-bezier()` that must not overshoot; this finds the time at which
 * it has covered that much of the way.
 */
export function computeBoxPass(
  r: Pick<DOMRect, 'width' | 'height'>,
  sunk: number,
  wall: number,
  peek: number,
  ease: string
): number {
  const fit = Math.max(
    (r.width - 2 * wall) / (r.width - 2 * peek),
    (r.height - 2 * wall) / (r.height - 2 * peek)
  );
  const way = Math.min(1, Math.max(0, (fit - sunk) / (1 - sunk)));
  const m = /cubic-bezier\(([^)]*)\)/.exec(ease);
  const [x1, y1, x2, y2] = m ? m[1].split(',').map(Number) : [0.4, 0, 0.2, 1];
  const at = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const u = (lo + hi) / 2;
    if (at(y1, y2, u) < way) lo = u;
    else hi = u;
  }
  return at(x1, x2, (lo + hi) / 2);
}

/**
 * Measures how the box looks from above with its paper down at the bottom:
 * - `sunk`: how small the bottom of the box looks, uniform across and down (`--box-inset` in from
 *   the box's outer edge across its narrower side).
 * - `pass`: fraction of the rise at which the paper passes the tops of the walls.
 */
export function measureBoxElement(
  el: Element | null,
  root: HTMLElement = document.documentElement
): BoxMeasurement | null {
  const r = el?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return null;
  const cs = getComputedStyle(root);
  const px = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
  const peek = px('--lift-peek');
  const wall = px('--box-wall');
  const inset = Math.max(px('--box-inset'), wall + 1);
  const s = Math.min(r.width, r.height);
  const sunk = Math.max(0.5, (s - 2 * inset) / s);
  return {
    r,
    sunk,
    pass: computeBoxPass(r, sunk, wall, peek, cs.getPropertyValue('--box-ease')),
  };
}

/**
 * Writes `--box-sunk` and `--box-pass` onto `root` for the page that draws the view transition.
 */
export function applyBoxSinkVars(
  m: Pick<BoxMeasurement, 'sunk' | 'pass'>,
  root: HTMLElement = document.documentElement
): void {
  root.style.setProperty('--box-sunk', String(m.sunk));
  root.style.setProperty('--box-pass', m.pass.toFixed(4));
}
