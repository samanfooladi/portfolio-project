import type { GeometryFigure } from "../types";

/**
 * The "calculation" figures around Navid while he plans (chapter 3).
 *
 * Coordinates are fractions of `pose-plan`'s own box -- 0,0 its top left, 1,1
 * its bottom right -- so they stay pinned to him at any viewport size. That
 * pose is crouched and fills nearly its whole column, so the open space is the
 * band above his head and the two upper corners; the figures live there, and
 * the few placed lower sit behind his body and only show at its edges, which is
 * what makes them read as behind him rather than pasted on.
 *
 * Kept clear on purpose: the top left corner (x < 0.15, y < 0.05), where the
 * Back button sits on narrower screens.
 *
 * Add, move or delete entries freely. The only rules are the types.
 */
export const NAVID_PLAN_GEOMETRY: readonly GeometryFigure[] = [
  // ---- far: small, dim, slow ----
  {
    type: "constellation",
    layer: "far",
    x: 0.84,
    y: -0.02,
    size: 0.2,
    nodes: [
      [8, 70],
      [30, 40],
      [52, 58],
      [74, 22],
      [92, 48],
      [60, 88],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [1, 3],
    ],
    drift: { amp: 9, dur: 5.6, phase: 0.1 },
  },
  {
    type: "solid",
    shape: "tetra",
    layer: "far",
    x: 0.71,
    y: 0.04,
    size: 0.1,
    yaw: 24,
    pitch: 18,
    drift: { amp: 7, dur: 4.8, phase: 0.62 },
    sway: 2,
  },
  {
    type: "trajectory",
    layer: "far",
    x: 0.44,
    y: -0.035,
    size: 0.46,
    bend: 0.35,
    arrow: true,
    drift: { amp: 6, dur: 6, phase: 0.35 },
  },
  {
    type: "polygon",
    layer: "far",
    x: 0.1,
    y: 0.22,
    size: 0.14,
    sides: 6,
    open: 1,
    rotate: 8,
    drift: { amp: 11, dur: 5.2, phase: 0.8 },
    sway: 1.5,
  },

  // ---- mid ----
  {
    // A protractor behind his head: the hair covers its middle, so what shows
    // is the two ends curling out either side of it.
    type: "arc",
    layer: "mid",
    x: 0.43,
    y: 0.1,
    size: 0.42,
    from: 200,
    to: 340,
    ticks: 14,
    label: "92°",
    // Past the right end: the middle of this arc is behind his hair.
    labelAngle: 352,
    drift: { amp: 8, dur: 5, phase: 0.45 },
    sway: 1.2,
  },
  {
    type: "measure",
    layer: "mid",
    x: 0.8,
    y: 0.17,
    size: 0.2,
    rotate: -12,
    label: "R2",
    drift: { amp: 12, dur: 4.4, phase: 0.2 },
  },
  {
    type: "solid",
    shape: "cube",
    layer: "mid",
    x: 0.14,
    y: 0.095,
    size: 0.13,
    yaw: 32,
    pitch: 22,
    drift: { amp: 10, dur: 4.1, phase: 0.55 },
    sway: 2,
  },
  {
    // Runs behind his whole torso and only shows where it clears him, at the
    // far left and right: the clearest cue that these are behind, not on top.
    type: "trajectory",
    layer: "mid",
    x: 0.5,
    y: 0.36,
    size: 1,
    bend: 0.22,
    drift: { amp: 6, dur: 5.8, phase: 0.05 },
  },

  // ---- near: larger, brighter, faster ----
  {
    type: "arc",
    layer: "near",
    x: 0.93,
    y: 0.13,
    size: 0.13,
    from: 150,
    to: 250,
    ticks: 8,
    label: "12°",
    drift: { amp: 16, dur: 3.4, phase: 0.72 },
  },
  {
    type: "constellation",
    layer: "near",
    x: 0.07,
    y: 0.36,
    size: 0.12,
    nodes: [
      [14, 20],
      [62, 12],
      [84, 56],
      [40, 84],
      [22, 54],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [4, 2],
    ],
    drift: { amp: 18, dur: 3.8, phase: 0.3 },
  },
  {
    type: "polygon",
    layer: "near",
    x: 0.64,
    y: 0.02,
    size: 0.1,
    sides: 3,
    open: 1,
    rotate: -14,
    drift: { amp: 14, dur: 3.2, phase: 0.9 },
    sway: 2,
  },
  {
    // "Half a second is all it gives."
    type: "measure",
    layer: "near",
    x: 0.24,
    y: -0.03,
    size: 0.15,
    rotate: 4,
    label: "0.5s",
    drift: { amp: 15, dur: 3.6, phase: 0.48 },
  },

  // ---- front: over him ----
  {
    // Standing on the floor in the dark gap between his feet, measuring to
    // the ankle of the planted one. White on the white sneaker would vanish,
    // so the line runs over denim and lands on the cuff.
    type: "setSquare",
    layer: "front",
    x: 0.47,
    y: 0.995,
    size: 0.24,
    yaw: 44,
    target: [0.285, 0.8],
    readout: 37.4,
    drift: { amp: 0, dur: 1, phase: 0 },
  },
];
