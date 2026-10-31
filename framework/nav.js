// StepDeck navigation: Back, one dot per step, Replay and Next, plus the arrow keys,
// a home link in the top-left corner of the page that leads back to the list of demos,
// and a title band across the top that shows the current step's `title` (empty when it has none).
// createNav(container, deck) fills an empty <nav class="nav"> and keeps it in step with the deck.
//   home: where the home link goes. Default: <meta name="stepdeck-home" content="..."> if the page has one,
//         otherwise '../../' (the site's front page, seen from demos/<name>/). false: no home link.

const HOUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h5v-5.5h3v5.5h5V10"/></svg>';

export function createNav(container, deck, { keys = true, home } = {}) {
  const page = container.closest('.deck') || document.body;
  // the title band: always there, so every step's drawing starts at the same height
  const bar = document.createElement('header');
  bar.className = 'titlebar';
  const title = document.createElement('p');
  title.className = 'step-title';
  title.setAttribute('aria-live', 'polite');
  bar.appendChild(title);
  page.insertBefore(bar, page.querySelector('.stage') || page.firstChild);

  if (home === undefined) home = document.querySelector('meta[name="stepdeck-home"]')?.content || '../../';
  if (home !== false) {
    const a = document.createElement('a');
    a.className = 'home'; a.href = home;
    a.setAttribute('aria-label', 'All demos'); a.title = 'All demos';
    a.innerHTML = HOUSE;
    page.prepend(a);
  }
  container.innerHTML =
    '<div class="nav-l"><button class="btn" type="button" data-act="back" aria-label="Previous step"><span class="arrow">←</span> Back</button></div>' +
    '<div class="dots"></div>' +
    '<div class="nav-r">' +
      '<button class="btn ghost" type="button" data-act="replay" aria-label="Replay this step"><span class="ic" aria-hidden="true">↺</span><span class="lbl">Replay</span></button>' +
      '<button class="btn" type="button" data-act="next" aria-label="Next step">Next <span class="arrow">→</span></button>' +
    '</div>';
  if (!container.hasAttribute('aria-label')) container.setAttribute('aria-label', 'Steps');
  const btn = act => container.querySelector('[data-act="' + act + '"]');
  const back = btn('back'), next = btn('next'), replay = btn('replay');
  const dotsEl = container.querySelector('.dots');
  const dots = deck.steps.map((st, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dot'; b.innerHTML = '<i></i>';
    b.setAttribute('aria-label', 'Step ' + (i + 1) + (st.name ? ': ' + st.name : ''));
    b.addEventListener('click', () => deck.go(i));
    dotsEl.appendChild(b);
    return b;
  });

  // Next waits until the current step has finished animating. It stays focusable meanwhile (aria-disabled,
  // not disabled), so a keyboard user can keep pressing it; the dots and the address still go anywhere.
  const waiting = () => next.getAttribute('aria-disabled') === 'true';
  function refreshNext() {
    next.disabled = deck.index === deck.count - 1;
    if (!next.disabled && deck.busy) next.setAttribute('aria-disabled', 'true'); else next.removeAttribute('aria-disabled');
  }
  back.addEventListener('click', () => deck.back());
  next.addEventListener('click', () => { if (!waiting()) deck.next(); });
  replay.addEventListener('click', () => deck.replay());

  if (keys) document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); if (!waiting()) deck.next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); deck.back(); }
  });

  function update(i) {
    title.textContent = deck.steps[i].title || '';      // straight away, before the step's animation starts
    const was = document.activeElement;
    back.disabled = i === 0;
    refreshNext();
    replay.disabled = !deck.canReplay(i);
    // never leave keyboard focus on a button that just became disabled
    if (was && was.disabled) (was === back || was === replay ? next : replay).focus();
    dots.forEach((d, j) => {
      d.classList.toggle('done', j < i);
      if (j === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
  }
  deck.onChange(update);
  deck.onBusy(refreshNext);
  return { update };
}
