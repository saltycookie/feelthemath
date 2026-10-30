// StepDeck: steps, animated state and step-to-step navigation, shared by every demo.
//
// A demo describes
//   - its animated values (`state`: name -> starting number),
//   - a `render(S)` that draws the page from those values (called on every animation frame),
//   - its `steps`. Each step says what it changes in the finished look (`set`) and how to get there (`play`).
//
// The engine guarantees, for every demo:
//   - a step's beginning is the previous step's finished look (unless the step says otherwise);
//   - Next carries on smoothly from where the previous step finished;
//   - Back, Replay and the step dots jump straight to the step's beginning, hold it for a moment and play the step;
//   - leaving a step stops its animation at once (no checks needed in `play`);
//   - the address shows the current step (#step-1, #step-2, ...), so a link can open the demo on any step.
//
// Step fields (all optional):
//   name        shown to screen readers on the step dots
//   slide       id of the <section class="slide"> to show
//   slideClass  class added to that slide while the step is active; restarted on Replay (for CSS animations)
//   fresh       true: the step starts from the demo's initial state instead of the previous step's finished look
//   start       values that differ in the step's beginning (on top of the previous finished look, or the initial state)
//   set         values that change by the end of the step (the finished look = beginning + set)
//   play(s)     async function animating from the beginning to the finished look; default: s.apply(s.end)
//   enter(info) / leave(info)   synchronous hooks for anything that is not an animated value (info.glide: arriving with Next)
//   replay      false to disable Replay on this step

export const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const sleep = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

const CANCELLED = Symbol('step left');
const HOLD = 450;           // ms the beginning is shown after a jump, before the step plays
const GLIDE = 450;          // ms for values to glide into the beginning on Next
const GLIDE_TRANSIENT = 250;

export function createDeck(opts) {
  const {
    state, render, steps,
    transient = [],            // values that are never part of a look (e.g. arrows that belong to a bubble)
    durations = {}, delays = {},   // per-value defaults for s.apply(): duration, and delay when the value grows
    bubbles = null,            // a createBubbles() instance, if the demo uses callout bubbles
    root = document,
  } = opts;

  /* ---------- animated state ---------- */
  const S = { ...state };
  if (bubbles) bubbles.keys.forEach(k => { if (!(k in S)) S[k] = 0; });
  const initial = { ...S };
  const tweens = [];
  let raf = 0, epoch = 0;
  const listeners = [];

  function dirty() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i];
      if (now < t.t0) continue;
      const p = clamp((now - t.t0) / t.dur, 0, 1);
      S[t.key] = t.from + (t.to - t.from) * ease(p);
      if (p >= 1) { S[t.key] = t.to; tweens.splice(i, 1); t.res(); }
    }
    render(S);
    if (tweens.length) raf = requestAnimationFrame(frame);
  }
  // Animate one value; a new tween on the same value replaces the old one. Resolves when done (or replaced).
  function tween(key, to, dur = 600, delay = 0) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const o = tweens.splice(i, 1)[0]; o.res(); }
    if (reduceMotion || (dur <= 0 && delay <= 0)) { S[key] = to; dirty(); return Promise.resolve(); }
    return new Promise(res => { tweens.push({ key, from: S[key], to, t0: performance.now() + delay, dur, res }); dirty(); });
  }
  function applyLook(look, skip = []) {
    for (const k in look) {
      if (skip.includes(k)) continue;
      tween(k, look[k], durations[k] || 550, look[k] > S[k] ? (delays[k] || 0) : 0);
    }
  }

  /* ---------- looks: each step's beginning and finished look ---------- */
  const transientKeys = new Set([...transient, ...(bubbles ? bubbles.keys : [])]);
  const plain = o => { const c = { ...o }; transientKeys.forEach(k => { c[k] = 0; }); return c; };
  const starts = [], ends = [];
  steps.forEach((st, i) => {
    const base = (i === 0 || st.fresh) ? plain(initial) : ends[i - 1];
    const begin = plain({ ...base, ...(st.start || {}) });
    starts.push(begin);
    ends.push(plain({ ...begin, ...(st.set || {}) }));
  });

  // Put the board in step i's beginning; returns how long to wait before the step's own animation.
  function toStart(i, glide) {
    const st = starts[i];
    if (!glide) { for (const k in st) tween(k, st[k], 0); return HOLD; }
    let moving = false, fading = false;
    for (const k in st) {
      if (Math.abs(S[k] - st[k]) < .01) continue;
      if (transientKeys.has(k)) fading = true; else moving = true;
      tween(k, st[k], transientKeys.has(k) ? GLIDE_TRANSIENT : GLIDE);
    }
    return moving ? 600 : fading ? 300 : 0;
  }

  /* ---------- slides ---------- */
  const slideEl = id => id ? root.querySelector('#' + id) : null;
  function showSlides(i, glide) {
    const st = steps[i];
    root.querySelectorAll('.slide').forEach(el => el.classList.toggle('active', el.id === st.slide));
    steps.forEach((o, j) => { if (j !== i && o.slideClass && o.slide && (o.slide !== st.slide || o.slideClass !== st.slideClass)) slideEl(o.slide)?.classList.remove(o.slideClass); });
    const el = slideEl(st.slide);
    if (el && st.slideClass) {
      if (!glide && el.classList.contains(st.slideClass)) restartAnimations(el, st.slideClass);
      else el.classList.add(st.slideClass);
    }
  }
  // Replay: run the slide's CSS animations again from the start, without touching its layout.
  function restartAnimations(el, cls) {
    if (el.getAnimations) {
      el.getAnimations({ subtree: true }).forEach(a => { if (a.animationName) { a.currentTime = 0; a.play(); } });
    } else { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  }

  /* ---------- the step runner handed to play() ---------- */
  function runner(i, ep) {
    const alive = () => ep === epoch;
    const check = v => { if (!alive()) throw CANCELLED; return v; };
    // a promise that stops the step if it has been left; harmless when nobody awaits it
    const guard = p => { const q = p.then(check); q.catch(() => {}); return q; };
    return {
      S, index: i, start: starts[i], end: ends[i],
      alive,
      wait: ms => guard(sleep(ms)),
      // to('key', value, dur, delay)  or  to({key: value, ...}, dur, delay)
      to(...args) {
        if (typeof args[0] === 'object') {
          const [look, dur, delay] = args;
          return guard(Promise.all(Object.keys(look).map(k => tween(k, look[k], dur, delay))));
        }
        const [key, value, dur, delay] = args;
        return guard(tween(key, value, dur, delay));
      },
      apply: (look, { skip = [] } = {}) => applyLook(look, skip),
      // show callout bubble n (default 0) next to anchor() -> [x, y, side]
      bubble(html, anchor, { index = 0, dur = 450, delay = 0 } = {}) {
        if (!bubbles) throw new Error('createDeck: no bubbles were given');
        bubbles.set(index, html, anchor);
        return guard(tween(bubbles.keys[index], 1, dur, delay));
      },
    };
  }

  /* ---------- navigation ---------- */
  let cur = -1;
  function go(i, how = 'jump') {                  // how: 'next' | 'jump' | 'replay'
    i = clamp(i, 0, steps.length - 1);
    if (i === cur && how !== 'replay') return;
    const glide = how !== 'replay' && cur >= 0 && i === cur + 1;
    const prev = cur;
    cur = i; const ep = ++epoch;
    if (prev >= 0 && steps[prev].leave) steps[prev].leave({ glide, to: i });
    showSlides(i, glide);
    const st = steps[i];
    if (st.enter) st.enter({ glide, from: prev });
    const lead = toStart(i, glide);
    writeHash(i);
    listeners.forEach(f => f(i));
    const s = runner(i, ep);
    (async () => {
      try {
        await s.wait(lead);
        if (st.play) await st.play(s); else s.apply(s.end);
      } catch (e) { if (e !== CANCELLED) throw e; }
    })();
  }

  /* ---------- the address: #step-N (counting from 1) ---------- */
  // The step replaces the address rather than adding to the browser history, so the browser's Back button
  // leaves the demo instead of walking back through its steps. Typing or following a #step-N link jumps there.
  function hashStep() {
    const m = /^#step-(\d+)$/.exec(location.hash);
    const n = m ? parseInt(m[1], 10) : NaN;
    return n >= 1 && n <= steps.length ? n - 1 : null;
  }
  function writeHash(i) {
    const h = '#step-' + (i + 1);
    if (location.hash === h) return;
    try { history.replaceState(history.state, '', h); } catch (_) { /* some embedded frames refuse; the step still works */ }
  }
  window.addEventListener('hashchange', () => { const i = hashStep(); if (i !== null && i !== cur) go(i, 'jump'); });

  return {
    S, steps,
    get index() { return cur; },
    get step() { return steps[cur]; },
    get count() { return steps.length; },
    canReplay: i => steps[i] && steps[i].replay !== false,
    go,
    next: () => { if (cur < steps.length - 1) go(cur + 1, 'next'); },
    back: () => { if (cur > 0) go(cur - 1, 'jump'); },
    replay: () => go(cur, 'replay'),
    start: i => go(i ?? hashStep() ?? 0, 'jump'),     // the step in the address, or the first
    onChange: f => { listeners.push(f); },
    tween,
    redraw: () => { render(S); },
    dirty,
  };
}

// Run cb once the web fonts have loaded (and again if more arrive), so text can be measured again.
export function onFontsLoaded(cb) {
  if (!document.fonts) return;
  document.fonts.ready.then(cb);
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', cb);
}
