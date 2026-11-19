import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, act } from '@testing-library/react';

const DEMOS = [
  { slug: 'example', expectedSteps: 3 },
  { slug: 'dannys-walk', expectedSteps: 6 },
  { slug: 'qiangs-trip', expectedSteps: 10 },
  { slug: 'two-sticks', expectedSteps: 7 },
  { slug: 'seasons-why', expectedSteps: 10 },
] as const;

describe('Real demos smoke tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) =>
      window.setTimeout(() => {
        now += 16;
        cb(now);
      }, 16)
    );
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      window.clearTimeout(id);
    });
    if (typeof window.ResizeObserver === 'undefined') {
      (window as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof window.matchMedia === 'undefined') {
      (window as any).matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
    }
    if (typeof (SVGElement.prototype as any).getComputedTextLength !== 'function') {
      (SVGElement.prototype as any).getComputedTextLength = () => 40;
    }
    if (typeof (SVGElement.prototype as any).getTotalLength !== 'function') {
      (SVGElement.prototype as any).getTotalLength = () => 100;
    }
    document.body.innerHTML = '<div class="deck" id="deck"></div>';
    window.history.replaceState(null, '', '#step-1');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  for (const { slug, expectedSteps } of DEMOS) {
    it(`mounts and navigates ${slug} cleanly across steps`, async () => {
      // Dynamic import runs mountDemo(...) into #deck
      await act(async () => {
        if (slug === 'example') await import('../../demos/example/demo');
        if (slug === 'dannys-walk') await import('../../demos/dannys-walk/demo');
        if (slug === 'qiangs-trip') await import('../../demos/qiangs-trip/demo');
        if (slug === 'two-sticks') await import('../../demos/two-sticks/demo');
        if (slug === 'seasons-why') await import('../../demos/seasons-why/demo');
      });

      const dots = document.querySelectorAll<HTMLButtonElement>('.nav .dot');
      expect(dots.length).toBe(expectedSteps);
      expect(document.documentElement.dataset.step).toBe('1');
      expect(document.querySelector('.fw-visual-element')).toBeTruthy();

      // Jump to the final step via its dot and ensure it renders without errors
      await act(async () => {
        fireEvent.click(dots[expectedSteps - 1]);
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(document.documentElement.dataset.step).toBe(String(expectedSteps));
      expect(document.querySelector('[data-act="next"]')?.textContent).toContain('Finish');

      // Jump back to step 1
      await act(async () => {
        fireEvent.click(dots[0]);
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(document.documentElement.dataset.step).toBe('1');
    });
  }
});
