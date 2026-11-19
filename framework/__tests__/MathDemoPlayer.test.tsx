import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MathDemoPlayer } from '../components/MathDemoPlayer';
import type { DemoConfig, SceneRendererComponent } from '../types';

interface CounterState {
  value: number;
  visible: number;
  note: string;
  interactive: boolean;
}

const DEFAULT_COUNTER_STATE: CounterState = {
  value: 0,
  visible: 0,
  note: 'initial',
  interactive: false,
};

const CounterScene: SceneRendererComponent<CounterState> = ({
  scene,
  isAnimating,
  updateState,
}) => (
  <div className="fw-scene" data-testid={`scene-${scene.id}`}>
    <span data-testid="value">{scene.state.value.toFixed(2)}</span>
    <span data-testid="visible">{scene.state.visible.toFixed(2)}</span>
    <span data-testid="note">{scene.state.note}</span>
    <span data-testid="animating">{String(isAnimating)}</span>
    <button
      type="button"
      data-testid="bump"
      onClick={() => updateState({ value: 42, note: 'edited' })}
    >
      Bump
    </button>
  </div>
);
CounterScene.defaultState = DEFAULT_COUNTER_STATE;

interface AltState {
  label: string;
  alpha: number;
}

const AltScene: SceneRendererComponent<AltState> = ({ scene }) => (
  <div className="fw-scene" data-testid={`scene-${scene.id}`}>
    <span data-testid="alt-label">{scene.state.label}</span>
    <span data-testid="alt-alpha">{scene.state.alpha.toFixed(2)}</span>
  </div>
);
AltScene.defaultState = { label: 'alt-default', alpha: 0 };

function createSingleSceneDemo(): DemoConfig<{ main: CounterState }> {
  return {
    id: 'test-single',
    name: 'Test Single Scene',
    scenes: { main: CounterScene },
    steps: [
      {
        title: 'Step One',
        summary: 'Intro',
      },
      {
        title: 'Step Two',
        summary: 'Animate',
        play: [
          { set: { note: 'playing', interactive: true } },
          { ms: 100, set: { value: 10, visible: 1 } },
        ],
        exit: [
          { unset: ['interactive'] },
          { ms: (s) => (s.value > 20 ? 120 : 60), set: { value: 20 } },
        ],
      },
      {
        title: 'Step Three',
        summary: 'Done',
        topMessage: 'Top banner',
        bottomMessage: 'Bottom banner',
        play: {
          parallel: [
            { ms: 80, set: { visible: 0.5 } },
            { wait: 20, set: { note: 'finished' } },
          ],
        },
      },
    ],
  };
}

function createMultiSceneDemo(): DemoConfig<{ first: CounterState; second: AltState }> {
  return {
    id: 'test-multi',
    name: 'Test Multi Scene',
    scenes: {
      first: CounterScene,
      second: { renderer: AltScene, x: 10, y: 20, opacity: 1, scale: 1 },
    },
    steps: [
      {
        title: 'First Scene Step',
        scene: 'first',
        play: { ms: 50, set: { value: 5 } },
      },
      {
        title: 'Second Scene Step',
        scene: 'second',
        play: { ms: 50, set: { alpha: 1, label: 'ready' } },
      },
    ],
  };
}

async function flushTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('MathDemoPlayer lifecycle & invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return window.setTimeout(() => {
        now += 16;
        cb(now);
      }, 16);
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      window.clearTimeout(id);
    });
    // Ensure ResizeObserver exists in jsdom
    if (typeof window.ResizeObserver === 'undefined') {
      (window as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    window.history.replaceState(null, '', '#step-1');
    document.documentElement.removeAttribute('data-step');
    document.documentElement.removeAttribute('data-step-busy');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders step 1 canonically, exposes data-step, and enables Next without Replay when step has no play', () => {
    const demo = createSingleSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    expect(screen.getByText('Step One')).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('0.00');
    expect(screen.getByTestId('note').textContent).toBe('initial');
    expect(document.documentElement.dataset.step).toBe('1');
    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(false);

    const backBtn = screen.getByRole('button', { name: 'Previous step' }) as HTMLButtonElement;
    const replayBtn = screen.getByRole('button', { name: 'Replay this step' }) as HTMLButtonElement;
    const nextBtn = screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement;

    expect(backBtn.disabled).toBe(true);
    expect(replayBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it('runs play on Next, sets data-step-busy while animating, then settles to folded end state', async () => {
    const demo = createSingleSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));

    // Step 1 has no exit, so it immediately advances to step 2 and starts playing
    await flushTimers(10);
    expect(document.documentElement.dataset.step).toBe('2');
    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled
    ).toBe(true);

    // Advance past initial 40ms paint delay + 100ms play cue
    await flushTimers(300);

    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(false);
    expect(screen.getByTestId('value').textContent).toBe('10.00');
    expect(screen.getByTestId('visible').textContent).toBe('1.00');
    expect(screen.getByTestId('note').textContent).toBe('playing');
    expect(window.location.hash).toBe('#step-2');
    expect(
      (screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(
      (screen.getByRole('button', { name: 'Replay this step' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('supports interactive updateState, dynamic exit duration, and Replay canonical reset', async () => {
    window.history.replaceState(null, '', '#step-2');
    const demo = createSingleSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    await flushTimers(300);
    expect(screen.getByTestId('value').textContent).toBe('10.00');

    // Interactive update changes state to 42 / "edited"
    fireEvent.click(screen.getByTestId('bump'));
    expect(screen.getByTestId('value').textContent).toBe('42.00');
    expect(screen.getByTestId('note').textContent).toBe('edited');

    // Replay resets to canonical initial state (value=0) and replays to 10.00
    fireEvent.click(screen.getByRole('button', { name: 'Replay this step' }));
    expect(screen.getByTestId('value').textContent).toBe('0.00');
    expect(screen.getByTestId('note').textContent).toBe('initial');
    await flushTimers(300);
    expect(screen.getByTestId('value').textContent).toBe('10.00');
    expect(screen.getByTestId('note').textContent).toBe('playing');

    // Edit again and click Next -> exit animates value from 42 -> 20, then Step 3 begins at value=20
    fireEvent.click(screen.getByTestId('bump'));
    expect(screen.getByTestId('value').textContent).toBe('42.00');

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(true);

    // Advance through Step 2 exit (120ms) + Step 3 topMessage (500ms) + play (80ms) + bottomMessage (250ms)
    await flushTimers(1500);

    expect(document.documentElement.dataset.step).toBe('3');
    expect(window.location.hash).toBe('#step-3');
    expect(screen.getByTestId('value').textContent).toBe('20.00');
    expect(screen.getByTestId('visible').textContent).toBe('0.50');
    expect(screen.getByTestId('note').textContent).toBe('finished');
    expect(screen.getByText('Top banner')).toBeTruthy();
    expect(screen.getByText('Bottom banner')).toBeTruthy();
  });

  it('deterministically enters step 3 directly via URL hash #step-3 with folded state from steps 1-2', async () => {
    window.history.replaceState(null, '', '#step-3');
    const demo = createSingleSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    // Before play finishes, step 3's canonical initial state already reflects step 2's play + exit
    expect(screen.getByTestId('value').textContent).toBe('20.00');
    expect(screen.getByTestId('visible').textContent).toBe('1.00');
    expect(screen.getByTestId('note').textContent).toBe('playing');

    await flushTimers(1200);
    expect(screen.getByTestId('visible').textContent).toBe('0.50');
    expect(screen.getByTestId('note').textContent).toBe('finished');
  });

  it('aborts in-flight animations cleanly when jumping via Back or step dots', async () => {
    window.history.replaceState(null, '', '#step-2');
    const demo = createSingleSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    // Jump back to Step 1 mid-animation
    await flushTimers(60);
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));

    await flushTimers(300);
    expect(document.documentElement.dataset.step).toBe('1');
    expect(screen.getByTestId('value').textContent).toBe('0.00');
    expect(screen.getByTestId('note').textContent).toBe('initial');
    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(false);
  });

  it('fades out and switches scenes when advancing across different scenes in a multi-scene demo', async () => {
    const demo = createMultiSceneDemo();
    render(<MathDemoPlayer demo={demo} />);

    await flushTimers(200);
    expect(screen.getByTestId('scene-first')).toBeTruthy();
    expect(screen.getByTestId('value').textContent).toBe('5.00');

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    // Still fading out old scene for 250ms
    await flushTimers(100);
    expect(document.documentElement.dataset.step).toBe('1');
    expect(document.documentElement.hasAttribute('data-step-busy')).toBe(true);

    // After 250ms default fade-out + next step play
    await flushTimers(500);
    expect(document.documentElement.dataset.step).toBe('2');
    expect(screen.queryByTestId('scene-first')).toBeNull();
    expect(screen.getByTestId('scene-second')).toBeTruthy();
    expect(screen.getByTestId('alt-label').textContent).toBe('ready');
    expect(screen.getByTestId('alt-alpha').textContent).toBe('1.00');
  });
});
