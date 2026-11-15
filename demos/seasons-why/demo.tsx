import { mountDemo, type DemoConfig } from '../../framework';
import { SeasonsWhySceneRenderer } from './renderer';
import { type SeasonsWhyState } from './state';

/** How long each animation takes, in ms. */
const PROBLEM_IN_MS = 500;
const PROBLEM_OUT_MS = 250;
const MESH_IN_MS = 600;
const SUN_EARTH_IN_MS = 600;
const ORBIT_SHOW_MS = 450;
const ORBIT_MS = 3200;
const MESSAGE_IN_MS = 500;
const MESSAGE_OUT_MS = 250;
const VIEW_TILT_MS = 1400;
const AXIS_TILT_MS = 1200;
const TILTED_ORBIT_MS = 4500;
const VIEW_SIDE_MS = 1200;
const YOU_IN_MS = 500;
const DEC_SOLID_MS = 800;
const SUN_FOLD_MS = 1600;

export const seasonsWhyDemo: DemoConfig<{ 'seasons-scene': SeasonsWhyState }> = {
  id: 'seasons-why',
  name: 'Why Are There Seasons?',
  renderers: {
    'seasons-scene': SeasonsWhySceneRenderer,
  },
  steps: [
    {
      title: '',
      play: [
        { ms: PROBLEM_IN_MS, set: { problemOpacity: 1 } },
      ],
      exit: [
        { ms: PROBLEM_OUT_MS, set: { problemOpacity: 0 } },
      ],
    },
    {
      title: 'Is the Earth Closer to the Sun in Summers?',
      play: [
        { ms: MESH_IN_MS, set: { mesh2DOpacity: 1 } },
        { wait: 150, ms: SUN_EARTH_IN_MS, set: { sunAndEarthOpacity: 1 } },
        { wait: 250, ms: ORBIT_SHOW_MS, set: { earthOrbitOpacity: 1 } },
        { wait: 150, ms: ORBIT_MS, easing: 'ease-in-out', set: { earthOrbitProgress: 1 } },
        { wait: 250, ms: MESSAGE_IN_MS, set: { aboutSameDistMessageOpacity: 1 } },
      ],
      exit: [
        { ms: MESSAGE_OUT_MS, unset: ['aboutSameDistMessageOpacity'] },
      ],
    },
    {
      title: "The Earth's Spin Axis Is Tilted",
      play: [
        { wait: 200, ms: VIEW_TILT_MS, easing: 'ease-in-out', set: { space30DegViewProgress: 1 } },
        { wait: 350, ms: AXIS_TILT_MS, easing: 'ease-in-out', set: { earthSpinAxisTiltedProgress: 1 } },
      ],
    },
    {
      title: 'The Earth Always Tilts to the Same Direction',
      play: [
        { wait: 250, ms: TILTED_ORBIT_MS, easing: 'linear', set: { tiltedEarthOrbitingProgress: 1 } },
        { wait: 250, ms: MESSAGE_IN_MS, set: { moveEarthMessageOpacity: 1 } },
        { set: { canDragEarth: true } },
      ],
      exit: [
        { unset: ['canDragEarth'] },
        {
          parallel: [
            {
              ms: (s) => Math.round(MESSAGE_OUT_MS * s.moveEarthMessageOpacity),
              unset: ['moveEarthMessageOpacity'],
            },
            {
              ms: (s) => Math.round(Math.abs(s.earthDragProgress) * 2400),
              easing: 'ease-in-out',
              set: { earthDragProgress: 0 },
            },
          ],
        },
      ],
    },
    {
      title: 'June vs December',
      play: [
        { wait: 200, ms: VIEW_SIDE_MS, easing: 'ease-in-out', set: { spaceSidedViewProgress: 1 } },
        { wait: 200, ms: DEC_SOLID_MS, easing: 'ease-in-out', set: { solidDecemberEarthProgress: 1 } },
        { wait: 300, ms: SUN_FOLD_MS, easing: 'ease-in-out', set: { sunFoldedProgress: 1 } },
      ],
    },
    {
      title: 'Suppose You Live in the North',
      play: [
        {
          wait: 200,
          ms: YOU_IN_MS,
          set: { youOnTheNorthHemisphereOpacity: 1, digitalClockOpacity: 1 },
        },
      ],
      exit: [
        { unset: ['earthSpinPaused'] },
      ],
    },
  ],
};

mountDemo(seasonsWhyDemo);
