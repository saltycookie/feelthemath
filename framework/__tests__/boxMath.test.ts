import { describe, it, expect, beforeEach } from 'vitest';
import { applyBoxSinkVars, computeBoxPass, measureBoxElement } from '../boxMath';

describe('boxMath', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
    document.body.innerHTML = '';
  });

  it('computes monotonic pass fraction in [0, 1] for standard box dimensions', () => {
    const rect = { width: 1000, height: 700 };
    const sunk = (700 - 2 * 20) / 700;
    const passLinear = computeBoxPass(rect, sunk, 12, 3, 'cubic-bezier(0, 0, 1, 1)');
    const passEase = computeBoxPass(rect, sunk, 12, 3, 'cubic-bezier(0.4, 0, 0.2, 1)');

    // Linear cubic-bezier should equal the exact geometric ratio (fit - sunk) / (1 - sunk)
    const expectedFit = Math.max((1000 - 24) / (1000 - 6), (700 - 24) / (700 - 6));
    const expectedWay = (expectedFit - sunk) / (1 - sunk);
    expect(passLinear).toBeCloseTo(expectedWay, 5);

    // Ease-out curve reaches the same height earlier than linear
    expect(passEase).toBeGreaterThan(0);
    expect(passEase).toBeLessThan(passLinear);
  });

  it('falls back to default cubic-bezier(0.4, 0, 0.2, 1) when ease string has no cubic-bezier()', () => {
    const rect = { width: 800, height: 600 };
    const sunk = 0.92;
    const explicit = computeBoxPass(rect, sunk, 12, 3, 'cubic-bezier(.4,0,.2,1)');
    const fallback = computeBoxPass(rect, sunk, 12, 3, '');
    expect(fallback).toBeCloseTo(explicit, 6);
  });

  it('measures a box element and applies --box-sunk and --box-pass CSS variables', () => {
    const root = document.documentElement;
    root.style.setProperty('--lift-peek', '3px');
    root.style.setProperty('--box-wall', '12px');
    root.style.setProperty('--box-inset', '20px');
    root.style.setProperty('--box-ease', 'cubic-bezier(.4,0,.2,1)');

    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({
        left: 20,
        top: 20,
        right: 820,
        bottom: 620,
        width: 800,
        height: 600,
        x: 20,
        y: 20,
        toJSON() {},
      }) as DOMRect;

    const m = measureBoxElement(el, root);
    expect(m).not.toBeNull();
    expect(m!.sunk).toBeCloseTo((600 - 40) / 600, 6);
    expect(m!.pass).toBeGreaterThan(0);
    expect(m!.pass).toBeLessThan(1);

    applyBoxSinkVars(m!, root);
    expect(root.style.getPropertyValue('--box-sunk')).toBe(String(m!.sunk));
    expect(root.style.getPropertyValue('--box-pass')).toBe(m!.pass.toFixed(4));
  });

  it('returns null when element is missing or has zero dimensions, and clamps sunk >= 0.5', () => {
    expect(measureBoxElement(null)).toBeNull();

    const zeroEl = document.createElement('div');
    zeroEl.getBoundingClientRect = () =>
      ({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    expect(measureBoxElement(zeroEl)).toBeNull();

    const tinyEl = document.createElement('div');
    tinyEl.getBoundingClientRect = () =>
      ({ width: 30, height: 30, left: 0, top: 0, right: 30, bottom: 30, x: 0, y: 0, toJSON() {} }) as DOMRect;
    document.documentElement.style.setProperty('--box-inset', '20px');
    const tiny = measureBoxElement(tinyEl);
    expect(tiny!.sunk).toBe(0.5);
  });
});
