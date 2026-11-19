import { describe, it, expect } from 'vitest';
import {
  cloneScene,
  isSharedAtSamePosition,
  resolveDemoSteps,
  resolveSceneRendererEntry,
} from '../stepTimeline';
import type { DemoConfig, SceneRendererComponent } from '../types';

interface StateA {
  a: number;
  b: string;
  flag: boolean;
}

const SceneA: SceneRendererComponent<StateA> = () => null;
SceneA.defaultState = { a: 0, b: 'init', flag: false };

interface StateB {
  x: number;
}

const SceneB: SceneRendererComponent<StateB> = () => null;
SceneB.defaultState = { x: 10 };

describe('stepTimeline', () => {
  it('resolves bare and object scene renderer entries with default transforms', () => {
    expect(resolveSceneRendererEntry(SceneA)).toEqual({
      renderer: SceneA,
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
    });
    expect(
      resolveSceneRendererEntry({ renderer: SceneA, x: 12, opacity: 0.5 })
    ).toEqual({
      renderer: SceneA,
      x: 12,
      y: 0,
      opacity: 0.5,
      scale: 1,
    });
  });

  it('folds play, exit, unset, parallel, and scene transforms forward deterministically', () => {
    const demo: DemoConfig<{ main: StateA }> = {
      id: 'fold-test',
      name: 'Fold Test',
      scenes: { main: SceneA },
      steps: [
        {
          title: 'Step 1',
          play: [
            { set: { a: 5, b: 'step1', flag: true } },
            { x: 20, y: -10, scale: 1.2 },
          ],
          exit: { unset: ['flag'] },
        },
        {
          title: 'Step 2',
          play: {
            parallel: [
              { ms: 200, set: { a: 10 } },
              [{ wait: 50, set: { b: 'step2' } }],
            ],
          },
        },
        {
          title: 'Step 3',
        },
      ],
    };

    const resolved = resolveDemoSteps(demo);
    expect(resolved).toHaveLength(3);

    // Step 1 starts at defaultState
    expect(resolved[0].sceneId).toBe('main');
    expect(resolved[0].initialScene.state).toEqual({ a: 0, b: 'init', flag: false });
    expect(resolved[0].initialScene.x).toBe(0);

    // Step 2 inherits Step 1 play + exit (flag reverted to false)
    expect(resolved[1].initialScene.state).toEqual({ a: 5, b: 'step1', flag: false });
    expect(resolved[1].initialScene.x).toBe(20);
    expect(resolved[1].initialScene.y).toBe(-10);
    expect(resolved[1].initialScene.scale).toBe(1.2);

    // Step 3 inherits Step 2 parallel cues
    expect(resolved[2].initialScene.state).toEqual({ a: 10, b: 'step2', flag: false });
  });

  it('resets state and transforms when switching scenes in a multi-scene demo', () => {
    const demo: DemoConfig<{ a: StateA; b: StateB }> = {
      id: 'multi',
      name: 'Multi',
      scenes: {
        a: SceneA,
        b: { renderer: SceneB, x: 30, y: 40, opacity: 0.8, scale: 0.9 },
      },
      steps: [
        { scene: 'a', play: { set: { a: 99 } } },
        { play: { set: { b: 'carried' } } },
        { scene: 'b', play: { set: { x: 25 } } },
        { scene: 'a' },
      ],
    };

    const resolved = resolveDemoSteps(demo);
    expect(resolved[1].sceneId).toBe('a');
    expect(resolved[1].initialScene.state).toEqual({ a: 99, b: 'init', flag: false });

    expect(resolved[2].sceneId).toBe('b');
    expect(resolved[2].initialScene).toMatchObject({
      id: 'b',
      type: 'b',
      x: 30,
      y: 40,
      opacity: 0.8,
      scale: 0.9,
      state: { x: 10 },
    });

    // Switching back to scene 'a' starts fresh from defaultState
    expect(resolved[3].sceneId).toBe('a');
    expect(resolved[3].initialScene.state).toEqual({ a: 0, b: 'init', flag: false });
  });

  it('throws clear errors for missing or unknown scenes', () => {
    const missingSceneDemo: DemoConfig<{ a: StateA; b: StateB }> = {
      id: 'missing',
      name: 'Missing',
      scenes: { a: SceneA, b: SceneB },
      steps: [{ title: 'Oops' }],
    };
    expect(() => resolveDemoSteps(missingSceneDemo)).toThrow(/must declare `scene`/);

    const unknownSceneDemo: DemoConfig<any> = {
      id: 'unknown',
      name: 'Unknown',
      scenes: { a: SceneA },
      steps: [{ title: 'Bad', scene: 'nope' }],
    };
    expect(() => resolveDemoSteps(unknownSceneDemo)).toThrow(/unknown scene "nope"/);
  });

  it('cloneScene deep-clones state and isSharedAtSamePosition checks id, type, and position', () => {
    const original = {
      id: 'main',
      type: 'main',
      x: 5,
      y: 10,
      opacity: 1,
      scale: 1,
      transitionDurationMs: 250,
      state: { nested: { count: 1 } },
    };
    const copy = cloneScene(original);
    copy.state.nested.count = 99;
    expect(original.state.nested.count).toBe(1);
    expect(copy.transitionDurationMs).toBe(0);

    expect(isSharedAtSamePosition(original, copy)).toBe(true);
    expect(isSharedAtSamePosition(original, { ...copy, x: 6 })).toBe(false);
    expect(isSharedAtSamePosition(original, { ...copy, id: 'other' })).toBe(false);
    expect(isSharedAtSamePosition(null, copy)).toBe(false);
  });
});
