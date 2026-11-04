// StepDeck: steps, animated state and step-to-step navigation, shared by every demo.
//
// A demo describes
//   - its animated values (`state`: name -> starting number),
//   - a `render(S)` that draws the page from those values (called on every animation frame): everything on the
//     demo's .stage, including which words or pictures are there at all,
//   - its `steps`. Each step says what it changes in the finished look (`set`) and how to get there (`play`, and
//     `leave` when leaving the step with Next animates too).
//
// The engine guarantees, for every demo:
//   - a step's beginning is the previous step's finished look (unless the step says otherwise);
//   - Next first plays the leaving step's leave() animation, if it has one, then carries on smoothly from there;
//   - Back, Replay and the step dots jump straight to the step's beginning, hold it for a moment and play the step;
//   - leaving a step stops its animation at once (no checks needed in `play`);
//   - while a step is still animating, the deck reports itself busy (Next waits; the dots and the address do not);
//   - the address shows the current step (#step-1, #step-2, ...), so a link can open the demo on any step;
//   - <html> shows it too, for tools: data-step="N", plus data-step-busy while the step is still animating.
//
// Step fields (all optional):
//   name        shown to screen readers on the step dots
//   title       shown in the title band at the top of the paper as soon as the step is entered (orange; none: empty)
//   fresh       true: the step starts from the demo's initial state instead of the previous step's finished look
//   start       values that differ in the step's beginning (on top of the previous finished look, or the initial state)
//   set         values that have changed by the time the step is left with Next (the finished look = beginning + set):
//               usually where play ends; where leave ends, when leave animates
//   play(s)     async function animating from the beginning to the finished look; default: s.apply(s.end)
//   enter(info) / leave(info, s)   hooks for anything that is not an animated value (info.glide: arriving / leaving with
//               Next). leave may also animate, with the runner s as in play (s.end is the step's finished look): an
//               async leave is waited for when leaving with Next, and cut short by any other move. Use it when the
//               reader can change the drawing (a switch, a drag): leave tidies the drawing into the finished look.
//   replay      false to disable Replay on this step

import { watchBox } from './box.js';

export const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const sleep = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

const CANCELLED = Symbol('step left');
const HOLD = 450;           // ms the beginning is shown after a jump, before the step plays
const GLIDE = 450;          // ms for values to glide into the beginning on Next
const GLIDE_TRANSIENT = 250;
const ARRIVE_HOLD = 250;    // ms the step's beginning is shown once the box has opened, before the step plays

export function createDeck(opts) {
  const {
    state, render, steps,
    transient = [],            // values that are never part of a look (e.g. arrows that belong to a bubble)
    durations = {}, delays = {},   // per-value defaults for s.apply(): duration, and delay when the value grows
    linear = [],               // values that animate at an even pace instead of easing in and out
    bubbles = null,            // a createBubbles() instance, if the demo uses callout bubbles
  } = opts;
  watchBox();                  // the paper rises from the box as the lid opens, and sinks before it closes (box.js)

  /* ---------- animated state ---------- */
  const S = { ...state };
  const evenKeys = new Set(linear);
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
      S[t.key] = t.from + (t.to - t.from) * (t.even ? p : ease(p));
      if (p >= 1) { S[t.key] = t.to; tweens.splice(i, 1); t.res(); }
    }
    render(S);
    if (tweens.length) raf = requestAnimationFrame(frame);
  }
  // Animate one value; a new tween on the same value replaces the old one. Resolves when done (or replaced).
  function tween(key, to, dur = 600, delay = 0) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const o = tweens.splice(i, 1)[0]; o.res(); }
    if (reduceMotion || (dur <= 0 && delay <= 0)) { S[key] = to; dirty(); return Promise.resolve(); }
    return new Promise(res => { tweens.push({ key, from: S[key], to, t0: performance.now() + delay, dur: Math.max(1, dur), even: evenKeys.has(key), res }); dirty(); });
  }
  function applyLook(look, skip = [], tw = tween) {
    for (const k in look) {
      if (skip.includes(k)) continue;
      tw(k, look[k], durations[k] || 550, look[k] > S[k] ? (delays[k] || 0) : 0);
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

  // Put the drawing in step i's beginning; returns how long to wait before the step's own animation.
  function toStart(i, glide, tw) {
    const st = starts[i];
    if (!glide) { for (const k in st) tw(k, st[k], 0); return HOLD; }
    let moving = false, fading = false;
    for (const k in st) {
      if (Math.abs(S[k] - st[k]) < .01) continue;
      if (transientKeys.has(k)) fading = true; else moving = true;
      tw(k, st[k], transientKeys.has(k) ? GLIDE_TRANSIENT : GLIDE);
    }
    return moving ? 600 : fading ? 300 : 0;
  }

  /* ---------- the step runner handed to play() ---------- */
  function runner(i, ep, tw, pending) {
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
          return guard(Promise.all(Object.keys(look).map(k => tw(k, look[k], dur, delay))));
        }
        const [key, value, dur, delay] = args;
        return guard(tw(key, value, dur, delay));
      },
      apply: (look, { skip = [] } = {}) => applyLook(look, skip, tw),
      // show callout bubble n (default 0) next to anchor() -> [x, y, side]
      bubble(html, anchor, { index = 0, dur = 450, delay = 0 } = {}) {
        if (!bubbles) throw new Error('createDeck: no bubbles were given');
        bubbles.set(index, html, anchor);
        return guard(tw(bubbles.keys[index], 1, dur, delay));
      },
      // wait until every value the step started animating has arrived (including ones started while waiting)
      async settle() {
        for (let n = 0; n !== pending.length;) { n = pending.length; await guard(Promise.all(pending)); }
      },
    };
  }

  /* ---------- busy: a step is still animating ---------- */
  let busy = false;
  const busyListeners = [];
  function setBusy(b) { if (busy !== b) { busy = b; mark(); busyListeners.forEach(f => f(b)); } }
  // Tools (screenshots, tests) read the deck from the page: <html data-step="3" data-step-busy> while step 3 animates,
  // and the same without data-step-busy once it has finished. See tools/thumbnail.py.
  function mark() {
    const html = document.documentElement;
    html.dataset.step = cur + 1;
    html.toggleAttribute('data-step-busy', busy);
  }

  /* ---------- arriving in the box ---------- */
  // Coming from the front page, the demo is uncovered as the box's lid opens, and its paper then rises from the box
  // (lid.js, box.js and theme.css). The step's own animation waits until all that is over, so that nothing plays
  // unseen. (pagereveal fires just before the page's first frame, once this script has run: demo pages load their
  // script with blocking="render".)
  let arriving = null;
  addEventListener('pagereveal', e => {
    if (!e.viewTransition) return;
    arriving = e.viewTransition.finished.catch(() => {}).then(() => { arriving = null; });
  });

  /* ---------- navigation ---------- */
  let cur = -1;
  function go(i, how = 'jump') {                  // how: 'next' | 'jump' | 'replay'
    i = clamp(i, 0, steps.length - 1);
    if (i === cur && how !== 'replay') return;
    const glide = how !== 'replay' && cur >= 0 && i === cur + 1;
    const prev = cur;
    cur = i; const ep = ++epoch;
    const pending = [];                                // every tween this step starts, so we know when it is done
    const tw = (...a) => { const p = tween(...a); pending.push(p); return p; };
    // Leave the previous step. Its leave() may animate the drawing to the look it hands over (its finished look), with a
    // runner like play's. Leaving with Next, the new step waits for that; any other move jumps to the new step's
    // beginning straight away, which cuts the animation short (its runner is stale from the start).
    let leaving = null;
    if (prev >= 0 && steps[prev].leave) leaving = steps[prev].leave({ glide, to: i }, runner(prev, glide ? ep : -1, tw, pending));
    const waits = glide && typeof leaving?.then === 'function';
    if (!waits && typeof leaving?.catch === 'function') leaving.catch(e => { if (e !== CANCELLED) throw e; });
    // the new step takes over: its enter() hook, and the drawing to its beginning (returns how long to hold)
    const st = steps[i];
    const begin = () => {
      if (st.enter) st.enter({ glide, from: prev });
      return toStart(i, glide, tw);
    };
    const lead = waits ? 0 : begin();
    writeHash(i);
    busy = true; mark();                               // quietly: the listeners below hear it with the new step
    listeners.forEach(f => f(i));
    const s = runner(i, ep, tw, pending);
    (async () => {
      try {
        if (waits) {                                   // the previous step's leave() animates first
          await leaving;
          if (ep !== epoch) return;
          await s.wait(begin());
        } else await s.wait(lead);
        if (arriving) { await arriving; await s.wait(ARRIVE_HOLD); }   // the box is still opening
        if (st.play) await st.play(s); else s.apply(s.end);
        await s.settle();
        if (ep === epoch) setBusy(false);
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
    get busy() { return busy; },                       // true while the current step is still animating
    onBusy: f => { busyListeners.push(f); },
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
