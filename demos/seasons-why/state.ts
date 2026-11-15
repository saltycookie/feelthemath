export interface SeasonsWhyState {
  // Showing "Why are there hot summers and cold winters?"
  problemOpacity: number;
  // 2D mesh representing the space.
  mesh2DOpacity: number;
  // The sun in the middle and the earth on the left hand side. The earth has several longitude
  // latitude lines, and it is spinning. Assume the earth's spin axis is not tilted.
  sunAndEarthOpacity: number;
  // The earth orbits the sun, drawing a circle.
  earthOrbitProgress: number;
  // Showing the earth orbit.
  earthOrbitOpacity: number;
  // Showing message: "No, the Earth stays at about the same distance from the Sun all year."
  aboutSameDistMessageOpacity: number;
  // Showing space (2d mesh, sun, earth, orbit, etc) from the front, 30 degree above the plane.
  space30DegViewProgress: number;
  // Tilt the earth's spin axis to the correct angle.
  earthSpinAxisTiltedProgress: number;
  // The tilted earth orbiting the sun, leaving imprints for the June earth and
  // the  December earth.
  tiltedEarthOrbitingProgress: number;
  // Showing you as a dot with a "You" label.
  youOnTheNorthHemisphereOpacity: number;
}

export const DEFAULT_SEASONS_WHY_STATE: SeasonsWhyState = {
  problemOpacity: 0,
  mesh2DOpacity: 0,
  sunAndEarthOpacity: 0,
  earthOrbitProgress: 0,
  earthOrbitOpacity: 0,
  aboutSameDistMessageOpacity: 0,
  space30DegViewProgress: 0,
  earthSpinAxisTiltedProgress: 0,
  tiltedEarthOrbitingProgress: 0,
  youOnTheNorthHemisphereOpacity: 0,
};

