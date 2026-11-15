import { mountDemo, type DemoConfig } from '../../framework';
import { SeasonsWhyState } from './state';

export const seasonsWhyDemo: DemoConfig<{'seasons-scene': SeasonsWhyState}> = {
  id: 'seasons-why',
  name: 'Why Are There Seasons?',
  renderers: {
    'seasons-scene': null
  },
  steps: [
    {
      title: '',
      play: [
        {set: {problemOpacity: 1}}
      ]
    },
    {
      title: 'Is the Earth Closer to the Sun in Summers?',
      play: [
        {set: {mesh2DOpacity: 1}},
        {set: {sunAndEarthOpacity: 1}},
        {set: {earthOrbitOpacity: 1}},
        {set: {earthOrbitProgress: 1}},
        {set: {aboutSameDistMessageOpacity: 1}}
      ],
      exit: [
        {set: {aboutSameDistMessageOpacity: 1}}
      ]
    },
    {
      title: 'The Earth\'s Spin Axis Is Tilted',
      play: [
        {set: {space45DegViewProgress: 1}},
        {set: {earthSpinAxisTiltedProgress: 1}},
      ]
    },
    {
      title: 'The Earth Always Tilts to the Same Direction',
      play: [
        {set: {tiltedEarthOrbitingProgress: 1}},
      ]
    }
  ],
};
