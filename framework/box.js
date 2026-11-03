// StepDeck: the demo's side of opening and closing the box (framework/lid.js is the front page's side).
//
// A demo is the box open, with its sheet of paper raised a little above the walls (theme.css: .deck). When the lid
// opens over it, coming from the front page, the paper is first down at the bottom of the box, inside its walls
// (--box-inset from its outer edge), in the dark of the closed box and in the walls' shade. The light comes in as the lid opens, and the
// paper rises, coming fully into the light only as it passes the tops of the walls. Going back, it sinks to the bottom
// of the box, into the walls' shade, and the box goes dark as the lid closes over it.
//
// The paper is the .deck itself (view-transition-name box-sheet, in theme.css). Down in the box, it is the demo's
// picture made smaller (--box-sunk), as the bottom of the box looks from above. The rest of the box is laid by this
// script, just before the browser takes its pictures, and taken away when the transition is over; each piece is a
// picture of its own (theme.css draws them):
//   box-inside   the inside of the box, under the paper: the inner sides of its four walls, seen in perspective from
//                above, between the tops of the walls and the bottom of the box
//   box-shade    the walls' shade on the paper down in the box. It rises with the paper, fading as it comes up
//   box-walls    the tops of the walls, over the paper while it is down in the box
// createDeck() calls watchBox(), so every demo does this; a demo page loads its script with blocking="render", so
// that this is ready before the page's first frame.

let watching = false, laidNo = 0;
const root = document.documentElement;

// How the box looks from above with its paper down in it.
//   sunk  how small the bottom of the box looks, the same across and down (the reader looks in from above the middle
//         of the box): small enough to be --box-inset in from the box's outer edge across its narrower side (the
//         walls' tops, --box-wall, and then their inner sides), and a little more along the longer one, as in
//         perspective
//   fit   how small the paper is as it passes the tops of the walls: the paper covers all but --lift-peek of the walls
//         when raised, so it fits between them when it is this small
// lid.js works out the same on the front page, for the closing.
function measure() {
  const deck = document.querySelector('.deck'), r = deck?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return null;
  const cs = getComputedStyle(root), px = name => parseFloat(cs.getPropertyValue(name)) || 0;
  const peek = px('--lift-peek'), wall = px('--box-wall'), inset = Math.max(px('--box-inset'), wall + 1);
  const s = Math.min(r.width, r.height);
  return {
    r,
    sunk: Math.max(.5, (s - 2 * inset) / s),
    fit: [(r.width - 2 * wall) / (r.width - 2 * peek), (r.height - 2 * wall) / (r.height - 2 * peek)],
  };
}

// Lay the box's pieces over the paper. Returns their number, or 0 when the page has no box.
function lay(m) {
  lift();
  if (!m) return 0;
  const { r, sunk } = m;
  const piece = cls => {
    const p = document.createElement('div');
    p.className = 'box-piece ' + cls;
    p.inert = true;
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    return p;
  };
  const inside = piece('box-inside');
  // where the bottom of the box is, seen from above: this far in from the box's outer edges
  inside.style.setProperty('--fx', (r.width * (1 - sunk) / 2).toFixed(2) + 'px');
  inside.style.setProperty('--fy', (r.height * (1 - sunk) / 2).toFixed(2) + 'px');
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const w = document.createElement('i');
    w.className = 'box-side ' + side;
    inside.appendChild(w);
  }
  document.body.append(inside, piece('box-shade'), piece('box-walls'));
  return ++laidNo;
}
// The page that draws the transition says how small the paper is down in the box, and as it passes the walls' tops.
function sink(m) {
  root.style.setProperty('--box-sunk', String(m.sunk));
  root.style.setProperty('--box-fit', `${m.fit[0]} ${m.fit[1]}`);
}
// Take the pieces away (only those laid as number n, when n is given: later ones may have replaced them).
function lift(n) {
  if (n !== undefined && n !== laidNo) return;
  document.querySelectorAll('.box-piece').forEach(p => p.remove());
}

export function watchBox() {
  if (watching) return;
  watching = true;
  // Going back to the front page: the paper sinks into the box, whose pieces must be in this page's pictures.
  // They are taken away afterwards, as this page may be kept and shown again by the browser's Back button.
  addEventListener('pageswap', e => {
    if (!e.viewTransition) return;
    const n = lay(measure());
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
  // Arriving from the front page (or shown again from the back-forward cache): the paper rises from the box.
  addEventListener('pagereveal', e => {
    lift();
    if (!e.viewTransition) return;
    const m = measure(), n = lay(m);
    if (!n) return;
    sink(m);
    e.viewTransition.finished.finally(() => lift(n));
  });
}
