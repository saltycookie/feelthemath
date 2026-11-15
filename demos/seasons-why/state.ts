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
  // Showing you as a dot with a "You" label, at 30 deg north.
  youOnTheNorthHemisphereOpacity: number;
  // Viewing space from the front.
  // The 2D mesh and earth orbit disappears when it progresses to 1.
  spaceSidedViewProgress: number;
  // The December earth imprint becomes a solid spinning earth like the June earth.
  solidDecemberEarthProgress: number;
  // A vertical line crossing the center of the sun appears
  // The view zooms in (so the sun and earth gets bigger), while the sun gets
  // folded and disappear into the vertical line.
  // Horizontal sunlight shines from the center line to both earths.
  // All the above progress at the same time.
  sunFoldedProgress: number;
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

