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
const SPIN_TOGGLE_OUT_MS = 250;
const STOP_NOON_MS = 1800;
const TANGENT_IN_MS = 550;
const SURFACE_ZOOM_MS = 1600;
const ZOOM_TOGGLE_IN_MS = 450;
const ZOOM_TOGGLE_OUT_MS = 250;
const SEASON_SWITCH_IN_MS = 450;
const SPREAD_SLIDE_MS = 2600;
const HEAT_LABELS_IN_MS = 500;

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
          set: { youOnTheNorthHemisphereOpacity: 1, digitalClockOpacity: 1, spinToggleOpacity: 1 },
        },
      ],
      exit: [
        { unset: ['earthSpinPaused'] },
      ],
    },
    {
      title: 'Look at the sun at noon',
      play: [
        { ms: SPIN_TOGGLE_OUT_MS, set: { spinToggleOpacity: 0 } },
        { wait: 120, ms: STOP_NOON_MS, easing: 'linear', set: { stopAtNoonProgress: 1 } },
        { wait: 200, ms: TANGENT_IN_MS, easing: 'ease-out', set: { tangentLineOpacity: 1 } },
        { wait: 350, ms: SURFACE_ZOOM_MS, easing: 'ease-in-out', set: { surfaceZoomProgress: 1 } },
        {
          wait: 200,
          ms: ZOOM_TOGGLE_IN_MS,
          set: { zoomToggleOpacity: 1, moreHeatMessageOpacity: 1 },
        },
        { set: { canToggleZoom: true } },
      ],
      exit: [
        { unset: ['canToggleZoom'] },
        {
          parallel: [
            {
              ms: (s) => Math.round(MESSAGE_OUT_MS * s.moreHeatMessageOpacity),
              unset: ['moreHeatMessageOpacity'],
            },
            {
              ms: (s) => Math.round((1 - s.surfaceZoomProgress) * 1000),
              easing: 'ease-in-out',
              set: { surfaceZoomProgress: 1 },
            },
          ],
        },
      ],
    },
    {
      title: 'The more the light spreads, the less heat the land gets',
      play: [
        { ms: ZOOM_TOGGLE_OUT_MS, set: { zoomToggleOpacity: 0 } },
        {
          wait: 80,
          ms: SEASON_SWITCH_IN_MS,
          set: { seasonSwitchOpacity: 1, spreadOverlayOpacity: 1 },
        },
        { wait: 550, ms: SPREAD_SLIDE_MS, easing: 'ease-in-out', set: { seasonCompareProgress: 1 } },
        { wait: 200, ms: HEAT_LABELS_IN_MS, set: { heatLabelsOpacity: 1 } },
        { set: { canToggleSeason: true } },
      ],
      exit: [
        { unset: ['canToggleSeason'] },
        {
          ms: MESSAGE_OUT_MS,
          unset: ['heatLabelsOpacity', 'spreadOverlayOpacity', 'seasonSwitchOpacity'],
        },
      ],
    },
  ],
};

mountDemo(seasonsWhyDemo);
