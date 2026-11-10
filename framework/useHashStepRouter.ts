import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Parses `#step-X` from a URL hash string into a 0-based step index.
 * Clamps the index to `[0, totalSteps - 1]`.
 */
export function parseStepHash(hash: string, totalSteps: number): number | null {
  const match = /^#step-(\d+)$/i.exec(hash.trim());
  if (!match) return null;
  const stepNum = parseInt(match[1], 10);
  if (Number.isNaN(stepNum) || stepNum < 1 || stepNum > totalSteps) {
    return null;
  }
  return stepNum - 1;
}

export function formatStepHash(stepIndex: number): string {
  return `#step-${stepIndex + 1}`;
}

/**
 * Synchronizes the current step index with the browser URL hash (`#step-1`, `#step-2`, ...).
 * Uses `history.replaceState` when updating the step hash so browser Back returns to the home page.
 */
export function useHashStepRouter(
  totalSteps: number,
  onExternalHashJump: (targetStepIndex: number) => void
) {
  const [stepIndex, setStepIndexState] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const parsed = parseStepHash(window.location.hash, totalSteps);
    return parsed !== null ? parsed : 0;
  });

  // Keep a synchronous ref of stepIndex so programmatic URL hash updates
  // do not double-trigger `onExternalHashJump` when `hashchange` fires.
  const stepIndexRef = useRef<number>(stepIndex);
  stepIndexRef.current = stepIndex;

  // Ensure initial URL hash is normalized to #step-X on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const parsed = parseStepHash(window.location.hash, totalSteps);
    if (parsed === null) {
      window.history.replaceState(null, '', formatStepHash(stepIndexRef.current));
    }
  }, [totalSteps]);

  // Listen for browser hashchange / popstate events (e.g. user editing #step-3 in URL bar)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUrlChange = () => {
      const parsed = parseStepHash(window.location.hash, totalSteps);
      if (parsed !== null && parsed !== stepIndexRef.current) {
        stepIndexRef.current = parsed;
        setStepIndexState(parsed);
        onExternalHashJump(parsed);
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [totalSteps, onExternalHashJump]);

  const setStepIndexAndHash = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(totalSteps - 1, nextIndex));
      stepIndexRef.current = clamped;
      setStepIndexState(clamped);
      if (typeof window !== 'undefined') {
        const targetHash = formatStepHash(clamped);
        if (window.location.hash !== targetHash) {
          window.history.replaceState(null, '', targetHash);
        }
      }
    },
    [totalSteps]
  );

  return {
    stepIndex,
    setStepIndexAndHash,
  };
}
