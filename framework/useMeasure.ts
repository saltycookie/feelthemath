import { DependencyList, RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** A measured width and height in px, in the shape `placeBubble` takes. */
export interface Size {
  w: number;
  h: number;
}

/**
 * Reads sizes from the page and keeps them in state, for renderers that draw from measured sizes: how big the paper
 * is, how wide a line of text came out, how tall a bubble is.
 *
 * `measure` reads the DOM (offsetWidth, getBoundingClientRect, getComputedTextLength, ...) and returns plain data:
 * numbers, strings, booleans, and arrays and objects of them. It must not change the DOM. It runs in a layout effect,
 * so whatever is drawn from its result is in place before the browser paints:
 * - after the first render, and after every render in which one of `deps` changed;
 * - whenever the element in `ref` changes size (it may mount later than the component);
 * - once the page's web fonts have loaded, since they change how big text is.
 * The component renders again only when the result differs from the last one. Returning `undefined` means "nothing
 * to measure yet" and keeps the last result.
 *
 * Point `ref` at an element whose size changes along with what `measure` reads (the paper the words are written on,
 * say): while a window is being resized, a read made straight after a render can still see the old layout, and the
 * element's ResizeObserver brings the measurement up to date once the new layout is in.
 */
export function useMeasure<T>(
  ref: RefObject<Element | null>,
  measure: () => T | undefined,
  initial: T,
  deps: DependencyList = []
): T {
  const [value, setValue] = useState<T>(initial);
  const measureRef = useRef(measure);
  const lastRef = useRef(JSON.stringify(initial));
  const liveRef = useRef(true);
  const runRef = useRef(() => {
    if (!liveRef.current) return;
    const next = measureRef.current();
    if (next === undefined) return;
    const json = JSON.stringify(next);
    if (json === lastRef.current) return;
    lastRef.current = json;
    setValue(next);
  });

  // The latest `measure` sees the latest props and state.
  useLayoutEffect(() => {
    measureRef.current = measure;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => runRef.current(), deps);

  // Watch whichever element `ref` holds after each render.
  const watched = useRef<{ el: Element | null; ro: ResizeObserver | null }>({ el: null, ro: null });
  useLayoutEffect(() => {
    const el = ref.current,
      w = watched.current;
    if (el === w.el) return;
    w.ro?.disconnect();
    w.el = el;
    w.ro = el ? new ResizeObserver(() => runRef.current()) : null;
    if (el) w.ro!.observe(el);
  });

  useEffect(() => {
    liveRef.current = true;
    document.fonts?.ready?.then(() => runRef.current());
    return () => {
      liveRef.current = false;
      watched.current.ro?.disconnect();
      watched.current = { el: null, ro: null };
    };
  }, []);

  return value;
}
