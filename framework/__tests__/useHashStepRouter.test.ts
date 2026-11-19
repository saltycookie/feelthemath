import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  parseStepHash,
  formatStepHash,
  useHashStepRouter,
} from '../useHashStepRouter';

describe('useHashStepRouter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#');
  });

  it('parses valid 1-based #step-N hashes into 0-based indices', () => {
    expect(parseStepHash('#step-1', 5)).toBe(0);
    expect(parseStepHash('#step-5', 5)).toBe(4);
    expect(parseStepHash('#STEP-3', 5)).toBe(2);
    expect(parseStepHash('  #step-2  ', 5)).toBe(1);
  });

  it('returns null for invalid or out-of-range hashes', () => {
    expect(parseStepHash('', 5)).toBeNull();
    expect(parseStepHash('#step-0', 5)).toBeNull();
    expect(parseStepHash('#step-6', 5)).toBeNull();
    expect(parseStepHash('#other', 5)).toBeNull();
  });

  it('formats 0-based index into #step-N', () => {
    expect(formatStepHash(0)).toBe('#step-1');
    expect(formatStepHash(3)).toBe('#step-4');
  });

  it('normalizes missing hash to #step-1 on mount and updates via replaceState', () => {
    const onJump = vi.fn();
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    const { result } = renderHook(() => useHashStepRouter(4, onJump));

    expect(result.current.stepIndex).toBe(0);
    expect(window.location.hash).toBe('#step-1');
    expect(replaceSpy).toHaveBeenCalled();

    act(() => {
      result.current.setStepIndexAndHash(2);
    });
    expect(result.current.stepIndex).toBe(2);
    expect(window.location.hash).toBe('#step-3');
    expect(onJump).not.toHaveBeenCalled();
  });

  it('clamps out-of-range indices in setStepIndexAndHash', () => {
    const { result } = renderHook(() => useHashStepRouter(3, vi.fn()));

    act(() => {
      result.current.setStepIndexAndHash(99);
    });
    expect(result.current.stepIndex).toBe(2);
    expect(window.location.hash).toBe('#step-3');

    act(() => {
      result.current.setStepIndexAndHash(-5);
    });
    expect(result.current.stepIndex).toBe(0);
    expect(window.location.hash).toBe('#step-1');
  });

  it('invokes onExternalHashJump when hashchange navigates to a different valid step', () => {
    const onJump = vi.fn();
    const { result } = renderHook(() => useHashStepRouter(5, onJump));

    act(() => {
      window.history.replaceState(null, '', '#step-4');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current.stepIndex).toBe(3);
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(3);
  });
});
