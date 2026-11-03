// StepDeck: the box's lid, opened and closed as the reader goes between the front page and a demo.
//
// The front page is the box with its lid on, and a demo is the same box open, on the same spot of the same desk.
// Going into a demo, the lid splits into four pieces from the middle and each piece slides away into its corner of
// the box, uncovering the paper inside. Coming back (the home link, Finish, the browser's Back button), the four
// pieces slide out of the corners and meet in the middle.
//
// It is a cross-document view transition: the browser takes pictures of the page it leaves and of the page it
// opens, and animates those pictures (theme.css, "the lid"). A picture can't be cut up, so this script cuts the lid
// instead, just before the pictures are taken: it lays four copies of the lid over it, each showing one quarter
// (.lid-piece, named lid-tl, lid-tr, lid-bl and lid-br), and takes them away when the transition is over.
//
// Load it as a classic script in the <head> of the page whose .box-lid is the lid (the front page), so that it is
// ready before the page's first frame:  <script src="framework/lid.js"></script>
// Browsers without cross-document view transitions (or a reader who asks for reduced motion) just change pages.

(() => {
  const root = document.documentElement;
  root.toggleAttribute('data-lid', true);          // theme.css: this page is the lid
  const CORNERS = ['tl', 'tr', 'bl', 'br'];
  // what the reader is pointing at or has focused keeps its look on the copies (a card's border, its focus ring)
  const HOT = ':hover, :focus-visible, :active';
  const KEEP = ['border-color', 'outline', 'outline-offset', 'background-color', 'color', 'opacity', 'box-shadow', 'transform'];
  let cutNo = 0;                                    // which cut the pieces on the page belong to

  // Lay the four pieces over the lid. Returns the cut's number, or 0 when there is no lid to cut.
  function cut() {
    lift();
    const lid = document.querySelector('.box-lid');
    const r = lid && lid.getBoundingClientRect();
    if (!r || !r.width || !r.height) return 0;
    const n = ++cutNo;
    const mx = Math.round(r.width / 2), my = Math.round(r.height / 2);
    const all = [...lid.querySelectorAll('*')];
    const hot = all.flatMap((el, i) => el.matches(HOT) ? [[i, getComputedStyle(el)]] : []);
    for (const c of CORNERS) {
      const right = c[1] === 'r', below = c[0] === 'b';
      const x = right ? mx : 0, y = below ? my : 0;
      const piece = document.createElement('div');
      piece.className = 'lid-piece';
      piece.inert = true;
      piece.setAttribute('aria-hidden', 'true');
      piece.style.cssText = `left:${r.left + x}px;top:${r.top + y}px;width:${right ? r.width - mx : mx}px;` +
        `height:${below ? r.height - my : my}px;view-transition-name:lid-${c}`;
      // a copy of the whole lid, placed so that this piece's quarter of it lies exactly over the lid
      const copy = lid.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      copy.style.cssText += `;position:absolute;left:${-x}px;top:${-y}px;width:${r.width}px;height:${r.height}px;margin:0;max-width:none`;
      const els = copy.querySelectorAll('*');
      for (const [i, cs] of hot) for (const p of KEEP) els[i].style.setProperty(p, cs.getPropertyValue(p));
      piece.appendChild(copy);
      document.body.appendChild(piece);
      copy.scrollTop = lid.scrollTop;               // a lid that scrolls shows the same part
      copy.scrollLeft = lid.scrollLeft;
    }
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
  // first frame, so the pieces can slide in over the demo; then the real lid is all that's left.
  addEventListener('pagereveal', e => {
    lift();
    if (!e.viewTransition) return;
    const n = cut();
    if (n) e.viewTransition.finished.finally(() => lift(n));
  });
})();
