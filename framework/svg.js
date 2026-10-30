// StepDeck SVG helpers for drawing charts and diagrams.

import { clamp } from './deck.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

// Create an SVG element with attributes, optionally appended to parent.
export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export function text(parent, cls, str) {
  const t = el('text', { class: cls }, parent);
  if (str != null) t.textContent = str;
  return t;
}
// Move/size a rect and set its opacity (negative sizes become 0).
export function setRect(n, x, y, w, h, op = 1) {
  n.setAttribute('x', x); n.setAttribute('y', y);
  n.setAttribute('width', Math.max(0, w)); n.setAttribute('height', Math.max(0, h));
  n.setAttribute('opacity', clamp(op, 0, 1));
}
// Move a text and set its opacity (and its words, if given).
export function setText(n, x, y, op = 1, str) {
  n.setAttribute('x', x); n.setAttribute('y', y); n.setAttribute('opacity', clamp(op, 0, 1));
  if (str != null && n.textContent !== str) n.textContent = str;
}
export function setOpacity(n, op) { n.setAttribute('opacity', clamp(op, 0, 1)); }

// Chips: a small filled label marking a known value on an axis. colour: 'blue' | 'orange' | 'pink' | 'chalk'.
export function chip(parent, colour) {
  const g = el('g', { class: 'chip ' + colour }, parent);
  return { g, r: el('rect', { height: 22 }, g), t: el('text', {}, g), tw: 0 };
}
// Centre a chip on (cx, cy) with the words str; minW keeps a minimum width.
export function setChip(c, cx, cy, str, op, minW) {
  if (c.t.textContent !== str) { c.t.textContent = str; c.tw = 0; }
  if (!c.tw) c.tw = c.t.getComputedTextLength() || 0;       // measured once per label (call remeasureChip when fonts change)
  const bw = Math.max(minW || (14 + 8 * str.length), c.tw + 14);
  c.r.setAttribute('x', cx - bw / 2); c.r.setAttribute('y', cy - 11); c.r.setAttribute('width', bw);
  c.t.setAttribute('x', cx); c.t.setAttribute('y', cy + 4.8);
  c.g.setAttribute('opacity', clamp(op, 0, 1));
}
export function remeasureChip(c) { c.tw = 0; }

// Path data for a straight arrow from (x0, y0) to (x1, y1) with an open head.
export function arrowPath(x0, y0, x1, y1, head = 10, spread = .5) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  return 'M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1 +
    'M' + (x1 - head * Math.cos(a - spread)) + ' ' + (y1 - head * Math.sin(a - spread)) +
    'L' + x1 + ' ' + y1 + 'L' + (x1 - head * Math.cos(a + spread)) + ' ' + (y1 - head * Math.sin(a + spread));
}
