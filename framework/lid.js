// StepDeck: the box's lid, opened and closed as the reader goes between the front page and a demo.
//
// The front page is the box with its lid on, and a demo is the same box open, on the same spot of the same desk.
// Going into a demo, the lid splits along the middle into two flaps, like a cardboard box's: the top flap rolls over
// the box's top edge and the bottom flap over its bottom edge, each showing the lid's thickness and then its plain
// underside as it turns, until they lie flat outside the box and the paper inside is uncovered. Coming back (the home
// link, Finish, the browser's Back button), the flaps roll back over the edges and close in the middle.
//
// It is a cross-document view transition: the browser takes pictures of the page it leaves and of the page it
// opens, and animates those pictures (theme.css, "the lid"). A picture can't be cut up or given a thickness, so this
// script builds the flaps instead, just before the pictures are taken, and takes them away when the transition is
// over. Each flap is three pictures, lying over the lid where the flap is:
//   lid-top        a copy of the lid, showing the flap's half of it: the writing on top
//   lid-top-edge   an empty box the size of the flap; theme.css paints the cut edge (the lid's thickness) on it
//   lid-top-back   an empty box the size of the flap; theme.css paints the underside on it
// and the same for lid-bottom. theme.css turns each of them in 3D about the flap's hinge on the box's edge.
//
// Load it as a classic script in the <head> of the page whose .box-lid is the lid (the front page), so that it is
// ready before the page's first frame:  <script src="framework/lid.js"></script>
// Browsers without cross-document view transitions (or a reader who asks for reduced motion) just change pages.

(() => {
  const root = document.documentElement;
  root.toggleAttribute('data-lid', true);          // theme.css: this page is the lid
  const FLAPS = ['top', 'bottom'];
  // what the reader is pointing at or has focused keeps its look on the copies (a card's border, its focus ring)
  const HOT = ':hover, :focus-visible, :active';
  const KEEP = ['border-color', 'outline', 'outline-offset', 'background-color', 'color', 'opacity', 'box-shadow', 'transform'];
  let cutNo = 0;                                    // which cut the flaps on the page belong to

  // a box over the lid where a flap is; inert, and hidden from screen readers
  function piece(name, x, y, w, h) {
    const p = document.createElement('div');
    p.className = 'lid-piece';
    p.inert = true;
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;view-transition-name:${name}`;
    return p;
  }

  // Lay the two flaps over the lid. Returns the cut's number, or 0 when there is no lid to cut.
  function cut() {
    lift();
    const lid = document.querySelector('.box-lid');
    const r = lid && lid.getBoundingClientRect();
    if (!r || !r.width || !r.height) return 0;
    const n = ++cutNo;
    const mid = Math.round(r.height / 2);
    const hot = [...lid.querySelectorAll('*')].flatMap((el, i) => el.matches(HOT) ? [[i, getComputedStyle(el)]] : []);
    for (const f of FLAPS) {
      const y = f === 'bottom' ? mid : 0, h = f === 'bottom' ? r.height - mid : mid;
      const at = [r.left, r.top + y, r.width, h];
      // the underside and the edge first, so that the writing on top is drawn over them
      document.body.append(piece(`lid-${f}-back`, ...at), piece(`lid-${f}-edge`, ...at));
      const top = piece(`lid-${f}`, ...at);
      // a copy of the whole lid, placed so that this flap's half of it lies exactly over the lid
      const copy = lid.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      copy.style.cssText += `;position:absolute;left:0;top:${-y}px;width:${r.width}px;height:${r.height}px;margin:0;max-width:none`;
      const els = copy.querySelectorAll('*');
      for (const [i, cs] of hot) for (const p of KEEP) els[i].style.setProperty(p, cs.getPropertyValue(p));
      top.appendChild(copy);
      document.body.appendChild(top);
      copy.scrollTop = lid.scrollTop;               // a lid that scrolls shows the same part
      copy.scrollLeft = lid.scrollLeft;
    }
    return n;
  }
  // Take the flaps away (only those of cut n, when n is given: a later cut may have replaced them).
  function lift(n) {
    if (n !== undefined && n !== cutNo) return;
    document.querySelectorAll('.lid-piece').forEach(p => p.remove());
  }

  // Leaving the front page for a demo: cut the lid just before the browser takes its picture of this page.
  // The flaps are taken away afterwards, as this page may be kept and shown again by the browser's Back button.
  addEventListener('pageswap', e => {
    if (!e.viewTransition) return;
    const n = cut();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
  // Arriving at the front page from a demo (or shown again from the back-forward cache): cut the lid before its
  // first frame, so the flaps can close over the demo; then the real lid is all that's left.
  addEventListener('pagereveal', e => {
    lift();
    if (!e.viewTransition) return;
    const n = cut();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
})();
