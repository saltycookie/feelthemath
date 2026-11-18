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
const SURFACE_ZOOM_MS = 2600;
const ZOOM_TOGGLE_IN_MS = 450;
const SPREAD_IN_MS = 450;
const SPREAD_SLIDE_MS = 2600;
const HEAT_LABELS_IN_MS = 500;
const ANSWER_RING_MS = 750;
const YOU_SOUTH_MS = 1400;

export const seasonsWhyDemo: DemoConfig<{ 'seasons-scene': SeasonsWhyState }> = {
  id: 'seasons-why',
  name: 'Why Are There Seasons?',
  scenes: {
    'seasons-scene': SeasonsWhySceneRenderer,
  },
  steps: [
    {
      play: [
        { ms: PROBLEM_IN_MS, set: { problemOpacity: 1 } },
      ],
      exit: [
        { ms: PROBLEM_OUT_MS, set: { problemOpacity: 0 } },
      ],
    },
    {
      topMessage: 'Is it because the earth is closer to the sun in summers?',
      play: [
        { ms: MESH_IN_MS, set: { mesh2DOpacity: 1 } },
        { wait: 150, ms: SUN_EARTH_IN_MS, set: { sunAndEarthOpacity: 1 } },
        { wait: 250, ms: ORBIT_SHOW_MS, set: { earthOrbitOpacity: 1 } },
        { wait: 150, ms: ORBIT_MS, easing: 'linear', set: { earthOrbitProgress: 1 } },
      ],
      bottomMessage: 'No, the earth stays at about the same distance from the sun all year around.',
    },
    {
      topMessage: "The earth's spin axis is tilted",
      play: [
        { wait: 200, ms: VIEW_TILT_MS, easing: 'ease-in-out', set: { space30DegViewProgress: 1 } },
        { wait: 350, ms: AXIS_TILT_MS, easing: 'ease-in-out', set: { earthSpinAxisTiltedProgress: 1 } },
      ],
    },
    {
      topMessage: 'Moreover, the earth always tilts to the same direction',
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
      topMessage: 'Let\'s look at June and December more closely',
      play: [
        { wait: 200, ms: VIEW_SIDE_MS, easing: 'ease-in-out', set: { spaceSidedViewProgress: 1 } },
        { wait: 200, ms: DEC_SOLID_MS, easing: 'ease-in-out', set: { solidDecemberEarthProgress: 1 } },
        { wait: 300, ms: SUN_FOLD_MS, easing: 'ease-in-out', set: { sunFoldedProgress: 1 } },
      ],
    },
    {
      topMessage: 'Suppose you live in the north',
      play: [
        {
          wait: 200,
          ms: YOU_IN_MS,
          set: { youOnTheNorthHemisphereOpacity: 1, digitalClockOpacity: 1, spinToggleOpacity: 1 },
        },
        { wait: 250, ms: MESSAGE_IN_MS, set: { sunlightDiffMessageOpacity: 1 } },
      ],
      exit: [
        { unset: ['earthSpinPaused'] },
        { ms: MESSAGE_OUT_MS, unset: ['sunlightDiffMessageOpacity'] },
      ],
    },
    {
      topMessage: 'Let\'s look at the sun at noon',
      play: [
        { ms: SPIN_TOGGLE_OUT_MS, set: { spinToggleOpacity: 0 } },
        { wait: 120, ms: STOP_NOON_MS, easing: 'linear', set: { stopAtNoonProgress: 1 } },
        { wait: 200, ms: TANGENT_IN_MS, easing: 'ease-out', set: { tangentLineOpacity: 1 } },
        { wait: 350, ms: SURFACE_ZOOM_MS, easing: 'ease-in-out', set: { surfaceZoomProgress: 1 } },
      ],
      bottomMessage: 'When does the land get more heat, June or December?',
    },
    {
      topMessage: 'The more the light spreads, the less heat the land gets',
      play: [
        {
          wait: 80,
          ms: SPREAD_IN_MS,
          set: { spreadOverlayOpacity: 1 },
        },
        { wait: 550, ms: SPREAD_SLIDE_MS, easing: 'ease-in-out', set: { seasonCompareProgress: 1 } },
        { wait: 200, ms: HEAT_LABELS_IN_MS, set: { moreHeatLabelOpacity: 1 } },
        { wait: 350, ms: HEAT_LABELS_IN_MS, set: { lessHeatLabelOpacity: 1 } },
      ],
      exit: [
        {
          ms: (s) => Math.round((1 - s.seasonCompareProgress) * 1000),
          easing: 'ease-in-out',
          set: { seasonCompareProgress: 1 },
        },
      ],
    },
    {
      play: [
        { wait: 250, ms: 300, set: { moreHeatLabelOpacity: 0 } },
        { ms: 400, set: { summerLabelOpacity: 1 } },
        { wait: 150, ms: ANSWER_RING_MS, set: { summerRingProgress: 1 } },
        { wait: 300, ms: 300, set: { lessHeatLabelOpacity: 0 } },
        { ms: 400, set: { winterLabelOpacity: 1 } },
        { wait: 150, ms: ANSWER_RING_MS, set: { winterRingProgress: 1 } },
        { wait: 450, ms: SURFACE_ZOOM_MS, easing: 'ease-in-out', set: { surfaceZoomProgress: 0 } },
      ],
      bottomMessage: 'In the north, summer is in June and winter is in December.',
      exit: [
        {
          ms: MESSAGE_OUT_MS,
          set: {
            summerLabelOpacity: 0,
            winterLabelOpacity: 0,
            summerRingProgress: 0,
            winterRingProgress: 0,
          },
        },
        { unset: ['spreadOverlayOpacity'] },
      ],
    },
    {
      topMessage: 'What if you live in the south?',
      bottomMessage: 'Can you figure out when is summer and when is winter?',
      play: [
        { wait: 250, ms: YOU_SOUTH_MS, easing: 'ease-in-out', set: { youSouthProgress: 1 } },
        { wait: 200, ms: ZOOM_TOGGLE_IN_MS, set: { zoomToggleOpacity: 1 } },
        { set: { canToggleZoom: true } },
      ],
    },
  ],
};

mountDemo(seasonsWhyDemo);
