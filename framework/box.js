// StepDeck: the demo's side of opening and closing the box (framework/lid.js is the front page's side).
//
// A demo is the box open, with its sheet of paper raised a little above the walls (theme.css: .deck). When the lid
// opens over it, coming from the front page, the paper is first down inside the box, between its walls, and rises
// once the lid is open; going back, it sinks between the walls before the lid closes over it.
//
// The paper is the .deck itself (view-transition-name box-sheet, in theme.css). Down in the box, it is the demo's
// picture made a little smaller, so that it fits between the walls (--box-sunk), with the walls drawn over it: this
// script lays them there (.box-walls), just before the browser takes its pictures, and takes them away when the
// transition is over. createDeck() calls watchBox(), so every demo does this; a demo page loads its script with
// blocking="render", so that this is ready before the page's first frame.

let watching = false, laidNo = 0;

// Lay the walls over the box. Returns their number, or 0 when the page has no box.
function lay() {
  lift();
  const deck = document.querySelector('.deck');
  const r = deck && deck.getBoundingClientRect();
  if (!r || !r.width || !r.height) return 0;
  const walls = document.createElement('div');
  walls.className = 'box-walls';
  walls.inert = true;
  walls.setAttribute('aria-hidden', 'true');
  walls.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  document.body.appendChild(walls);
  // how small the paper is when down in the box: small enough for the paper, which covers all but --lift-peek of
  // the walls, to fit between them
  const root = document.documentElement;
  const rim = parseFloat(getComputedStyle(deck).borderTopWidth) || 0;
  const peek = parseFloat(getComputedStyle(root).getPropertyValue('--lift-peek')) || 0;
  root.style.setProperty('--box-sunk', `${(r.width - 2 * rim) / (r.width - 2 * peek)} ${(r.height - 2 * rim) / (r.height - 2 * peek)}`);
  return ++laidNo;
}
// Take the walls away (only those laid as number n, when n is given: later ones may have replaced them).
function lift(n) {
  if (n !== undefined && n !== laidNo) return;
  document.querySelectorAll('.box-walls').forEach(w => w.remove());
}

export function watchBox() {
  if (watching) return;
  watching = true;
  // Going back to the front page: the paper sinks between the walls, which must be in this page's picture.
  // They are taken away afterwards, as this page may be kept and shown again by the browser's Back button.
  addEventListener('pageswap', e => {
    if (!e.viewTransition) return;
    const n = lay();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
  // Arriving from the front page (or shown again from the back-forward cache): the paper rises from between the walls.
  addEventListener('pagereveal', e => {
    lift();
    if (!e.viewTransition) return;
    const n = lay();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
}
