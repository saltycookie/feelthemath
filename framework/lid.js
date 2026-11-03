// StepDeck: the box's lid, opened and closed as the reader goes between the front page and a demo.
// This is the front page's side; framework/box.js is the demo's.
//
// The front page is the box with its lid on, and a demo is the same box open, on the same spot of the same desk.
// Going into a demo, the lid splits along the middle into two flaps, like a cardboard box's, and the flaps roll open,
// the writing on them fading as they turn: the top one up over the box's top edge, the bottom one down over its
// bottom edge, each showing the lid's thickness on its cut edge, until they stand upright on the box's edges, out of
// sight. Then the paper inside rises above the box's walls. Coming back (the home link, Finish, the browser's Back
// button), the paper sinks back between the walls, the flaps roll closed, the writing coming back on them, and meet
// at the split; then the split goes.
//
// It is a cross-document view transition: the browser takes pictures of the page it leaves and of the page it
// opens, and animates those pictures (theme.css, "opening and closing the box"). A picture can't be cut up or given a
// thickness, so this script builds the pieces instead, just before the pictures are taken, and takes them away when
// the transition is over. Each is a picture of its own, lying over the lid:
//   lid-split        a strip across the middle of the lid; theme.css draws the split on it
//   lid-top          a blank copy of the lid, showing the top flap's half of it
//   lid-top-words    a copy of the lid, writing and all, showing the same half: it fades to leave the blank half
//   lid-top-edge     an empty box the size of the flap; theme.css paints the cut edge (the lid's thickness) on it
//   lid-top-back     an empty box the size of the flap; theme.css paints the underside on it
// and the same four for lid-bottom. theme.css turns each flap's pictures together in 3D about its hinge on the box's
// edge.
//
// Load it as a classic script in the <head> of the page whose .box-lid is the lid (the front page), so that it is
// ready before the page's first frame:  <script src="framework/lid.js"></script>
// Browsers without cross-document view transitions (or a reader who asks for reduced motion) just change pages.

(() => {
  const root = document.documentElement;
  root.toggleAttribute('data-lid', true);          // theme.css: this page is the lid
  const FLAPS = ['top', 'bottom'];
  const SPLIT = 8;                                  // px: the height of the strip the split is drawn on
  // what the reader is pointing at or has focused keeps its look on the copy (a card's border, its focus ring)
  const HOT = ':hover, :focus-visible, :active';
  const KEEP = ['border-color', 'outline', 'outline-offset', 'background-color', 'color', 'opacity', 'box-shadow', 'transform'];
  let cutNo = 0;                                    // which cut the pieces on the page belong to

  // a box over the lid; inert, and hidden from screen readers
  function piece(name, x, y, w, h) {
    const p = document.createElement('div');
    p.className = 'lid-piece';
    p.inert = true;
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;view-transition-name:${name}`;
    return p;
  }
  // a copy of the lid (deep: with its writing), placed in a piece so that it lies exactly over the lid
  function copyOf(lid, r, y, deep) {
    const copy = lid.cloneNode(deep);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    copy.style.cssText += `;position:absolute;left:0;top:${-y}px;width:${r.width}px;height:${r.height}px;margin:0;max-width:none`;
    return copy;
  }

  // Lay the pieces over the lid. Returns the cut's number, or 0 when there is no lid to cut.
  function cut() {
    lift();
    const lid = document.querySelector('.box-lid');
    const r = lid && lid.getBoundingClientRect();
    if (!r || !r.width || !r.height) return 0;
    const n = ++cutNo;
    const mid = Math.round(r.height / 2);
    const hot = [...lid.querySelectorAll('*')].flatMap((el, i) => el.matches(HOT) ? [[i, getComputedStyle(el)]] : []);
    // the flaps: underside, edge and blank half first, so that the writing is drawn over them
    for (const f of FLAPS) {
      const y = f === 'bottom' ? mid : 0, h = f === 'bottom' ? r.height - mid : mid;
      const at = [r.left, r.top + y, r.width, h];
      const blank = piece(`lid-${f}`, ...at);
      blank.appendChild(copyOf(lid, r, y, false));
      const words = piece(`lid-${f}-words`, ...at);
      const copy = copyOf(lid, r, y, true);
      const els = copy.querySelectorAll('*');
      for (const [i, cs] of hot) for (const p of KEEP) els[i].style.setProperty(p, cs.getPropertyValue(p));
      words.appendChild(copy);
      document.body.append(piece(`lid-${f}-back`, ...at), piece(`lid-${f}-edge`, ...at), blank, words);
      copy.scrollTop = lid.scrollTop;               // a lid that scrolls shows the same part
      copy.scrollLeft = lid.scrollLeft;
    }
    document.body.appendChild(piece('lid-split', r.left, r.top + mid - SPLIT / 2, r.width, SPLIT));
    // Coming back, this page draws the transition, so it says how small the demo's paper is when down in the box:
    // small enough for the paper, which covers all but --lift-peek of the walls, to fit between them (box.js does
    // the same on the demo's side).
    const rim = parseFloat(getComputedStyle(lid).borderTopWidth) || 0;
    const peek = parseFloat(getComputedStyle(root).getPropertyValue('--lift-peek')) || 0;
    root.style.setProperty('--box-sunk', `${(r.width - 2 * rim) / (r.width - 2 * peek)} ${(r.height - 2 * rim) / (r.height - 2 * peek)}`);
    return n;
  }
  // Take the pieces away (only those of cut n, when n is given: a later cut may have replaced them).
  function lift(n) {
    if (n !== undefined && n !== cutNo) return;
    document.querySelectorAll('.lid-piece').forEach(p => p.remove());
  }

  // Leaving the front page for a demo: cut the lid just before the browser takes its picture of this page.
  // The pieces are taken away afterwards, as this page may be kept and shown again by the browser's Back button.
  addEventListener('pageswap', e => {
    if (!e.viewTransition) return;
    const n = cut();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
  // Arriving at the front page from a demo (or shown again from the back-forward cache): cut the lid before its
  // first frame, so the pieces can close over the demo; then the real lid is all that's left.
  addEventListener('pagereveal', e => {
    lift();
    if (!e.viewTransition) return;
    const n = cut();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
})();
