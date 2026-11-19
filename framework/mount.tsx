import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { watchBox } from './box';
import { MathDemoPlayer } from './components/MathDemoPlayer';
import type { DemoConfig } from './types';

/**
 * Renders `demo` into the page's deck element (`<div class="deck" id="deck">`). Every demo ends with this call.
 *
 * Registers the box view-transition listeners (`watchBox()`) and runs the first render synchronously:
 * the built page loads its entry script with `blocking="render"` (see vite.config.ts), so that the paper
 * is already drawn when the browser takes its snapshot for the view transition from the front page.
 * A render left to React's scheduler could land after that snapshot.
 */
export function mountDemo<TScenes extends Record<string, any>>(
  demo: DemoConfig<TScenes>,
  containerId = 'deck'
): void {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`mountDemo: no element with id "${containerId}" to render "${demo.id}" into`);
  }
  watchBox();
  const root = createRoot(container);
  flushSync(() => {
    root.render(<MathDemoPlayer demo={demo} />);
  });
}
