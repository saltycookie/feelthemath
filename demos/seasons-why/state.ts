export interface SeasonsWhyState {
  // Showing "Why are there summers and winters?"
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
  // the December earth.
  tiltedEarthOrbitingProgress: number;
  // Interactive orbit offset (in turns relative to June, in [-0.5, 0.5]) when the user drags the Earth in Step 4.
  earthDragProgress: number;
  // Whether the user can currently drag the live Earth around its orbit.
  canDragEarth: boolean;
  // Showing message: "Move the earth around yourself!"
  moveEarthMessageOpacity: number;
  // Showing you as a dot with a "You" label, at 30 deg north.
  youOnTheNorthHemisphereOpacity: number;
  // Showing synchronized HH:MM AM/PM digital clocks below June and December.
  digitalClockOpacity: number;
  // Opacity of the Step 6 Pause / Spin toggle (fades out at start of Step 7).
  spinToggleOpacity: number;
  // Whether Earth rotation and clocks are paused by the Step 6 Pause / Spin toggle.
  earthSpinPaused: boolean;
  // Progress (0 -> 1) of smoothly decelerating Earth spin to stop right at 12:00 PM noon in Step 7.
  stopAtNoonProgress: number;
  // Opacity / draw progress of the tangent line at "You" in Step 7.
  tangentLineOpacity: number;
  // Progress (0 -> 1) of zooming into "You" and shifting the tangent line to horizontal (Step 7).
  surfaceZoomProgress: number;
  // Opacity of the Step 7 Zoom In / Zoom Out toggle below the clocks.
  zoomToggleOpacity: number;
  // Whether the user can currently click the Step 7 Zoom In / Zoom Out toggle.
  canToggleZoom: boolean;
  // Showing message: "When do you get more heat, June or December?"
  moreHeatMessageOpacity: number;
  // Opacity of the Step 8 June / December toggle switch below the clocks.
  seasonSwitchOpacity: number;
  // Continuous position (0 = June, 1 = December) of the Step 8 comparison animation and toggle switch.
  seasonCompareProgress: number;
  // Opacity of the Step 8 red heat intensity bar, spread measurement, and dotted beam copy.
  spreadOverlayOpacity: number;
  // Opacity of the Step 8 "More heat" message below June's month & clock.
  moreHeatLabelOpacity: number;
  // Opacity of the Step 8 "less heat" message below December's month & clock.
  lessHeatLabelOpacity: number;
  // Opacity of the Step 9 "Summer" label replacing "More heat" below June's month & clock.
  summerLabelOpacity: number;
  // Opacity of the Step 9 "Winter" label replacing "less heat" below December's month & clock.
  winterLabelOpacity: number;
  // Continuous position (0 = 30°N, 1 = 30°S) moving "You" and its tangent line to the Southern Hemisphere in Step 10.
  youSouthProgress: number;
  // Opacity of the Step 10 bottom message: "Can you figure out when is summer, when is winter?"
  southQuestionMessageOpacity: number;
  // Whether the user can interactively toggle the Step 8 June / December switch.
  canToggleSeason: boolean;
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
  earthDragProgress: 0,
  canDragEarth: false,
  moveEarthMessageOpacity: 0,
  youOnTheNorthHemisphereOpacity: 0,
  digitalClockOpacity: 0,
  spinToggleOpacity: 0,
  earthSpinPaused: false,
  stopAtNoonProgress: 0,
  tangentLineOpacity: 0,
  surfaceZoomProgress: 0,
  zoomToggleOpacity: 0,
  canToggleZoom: false,
  moreHeatMessageOpacity: 0,
  seasonSwitchOpacity: 0,
  seasonCompareProgress: 0,
  spreadOverlayOpacity: 0,
  moreHeatLabelOpacity: 0,
  lessHeatLabelOpacity: 0,
  summerLabelOpacity: 0,
  winterLabelOpacity: 0,
  youSouthProgress: 0,
  southQuestionMessageOpacity: 0,
  canToggleSeason: false,
  spaceSidedViewProgress: 0,
  solidDecemberEarthProgress: 0,
  sunFoldedProgress: 0,
};

