// StepDeck callout bubbles: small chalk-outlined boxes that sit beside the thing they explain, with a tail pointing at it.
//
// const bubbles = createBubbles(container, { count: 1, bounds: () => ({ x, y, w, h }) })
//   container  positioned element the bubbles live in (they are absolutely positioned inside it)
//   bounds()   the area the bubbles must stay inside, in the container's pixels
// Give `bubbles` to createDeck(); a step then shows one with  s.bubble(html, anchor).
// anchor() returns [x, y, side]: the point to explain, and where the bubble sits relative to it:
//   'right' | 'left' | 'above' | 'below' (tail on the facing edge) or 'mid' (centred on the point, no tail).
// Call bubbles.place(S) from the demo's render(), and bubbles.measure() after its layout changes.

import { clamp } from './deck.js';

export function createBubbles(container, { count = 1, bounds, gap = 11, inset = 4, maxWidth = 360 } = {}) {
  const els = [], sizes = [], anchors = [], rects = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'bubble';
    container.appendChild(el);
    els.push(el); sizes.push({ w: 0, h: 0 }); anchors.push(null); rects.push(null);
  }
  const keys = els.map((_, i) => 'bubble' + i);      // their opacities, as animated values of the deck

  function measure() {
    const b = bounds();
    if (!b || !b.w) return;
    els.forEach((el, i) => {
      el.style.maxWidth = Math.min(maxWidth, b.w - 24) + 'px';
      sizes[i].w = el.offsetWidth; sizes[i].h = el.offsetHeight;
    });
  }
  function set(i, html, anchor) { anchors[i] = anchor; els[i].innerHTML = html; measure(); }

  function place(S) {
    const b = bounds();
    els.forEach((el, i) => {
      const op = clamp(S[keys[i]] || 0, 0, 1);
      el.style.opacity = op;
      const a = anchors[i];
      if (!a || op < .001 || !b) return;
      const [ax, ay, side] = a(), { w, h } = sizes[i];
      const L = b.x + inset, R = b.x + b.w - inset, T = b.y + inset, B = b.y + b.h - inset;
      let left, top;
      if (side === 'right') { left = ax + gap; top = ay - h / 2; }
      else if (side === 'left') { left = ax - gap - w; top = ay - h / 2; }
      else if (side === 'below') { left = ax - w / 2; top = ay + gap; }
      else if (side === 'mid') { left = ax - w / 2; top = ay - h / 2; }
      else { left = ax - w / 2; top = ay - gap - h; }                       // 'above'
      left = clamp(left, L, Math.max(L, R - w)); top = clamp(top, T, Math.max(T, B - h));
      rects[i] = [left, top, w, h];
      // the tail stays on the bubble's edge, as close to the anchor as it can
      const tp = (side === 'right' || side === 'left') ? clamp(ay - top, 16, h - 16) - 6 : clamp(ax - left, 16, w - 16) - 6;
      el.dataset.tail = side;
      el.style.setProperty('--tp', tp + 'px');
      el.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    });
  }

  return {
    keys, els, set, measure, place,
    size: i => sizes[i],
    rect: i => rects[i],             // [left, top, width, height] where bubble i was last placed
  };
}
