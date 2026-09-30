/**
 * The scroll story: what a selected character has to say about themselves,
 * one chapter per rest point on the way down.
 *
 * Content only. Which side a chapter lands on, how far you scroll to reach it
 * and how one pose becomes the next are all computed from the chapter's index,
 * so adding, reordering or deleting a chapter is a data edit and nothing more.
 */
export type Chapter = {
  /** Stable key. Becomes the timeline label and the React key. */
  id: string;
  /**
   * Pose asset key, built from `assets-source/<id>/pose-<key>.png`.
   * `front` is the exception: it resolves to the Full view the lineup already
   * ships, because it is the same artwork.
   */
  pose: string;
  /** Sets the pose's height on screen. A bust stands a little shorter. */
  poseKind: "full" | "bust";
  title: string;
  /** Paragraphs or bullet lines. They fade in one after another. */
  body: string[];
  /**
   * Something drawn around the character while this chapter is on screen, and
   * only then. It rides along with the figure, so it is laid out against this
   * chapter's own pose -- which is why the figures live here, on the chapter,
   * rather than in a list keyed to anyone.
   */
  overlay?: ChapterOverlay;
};

export type ChapterOverlay = { kind: "geometry"; figures: readonly GeometryFigure[] };

/**
 * How far away a figure reads. The three behind the character differ in size,
 * brightness and drift speed; `front` is the one layer drawn over the pose.
 */
export type GeometryLayer = "far" | "mid" | "near" | "front";

type FigureBase = {
  /**
   * Where the figure sits, as fractions of the pose's own box: 0,0 is its top
   * left, 1,1 its bottom right. Values past 0-1 are fine -- the art has air
   * above it -- because figures are clipped to the character's column, never
   * to the pose, and so can never reach the text.
   *
   * The centre of the figure, except for `setSquare`, where `y` is the ground
   * its base stands on.
   */
  x: number;
  y: number;
  /** Width, as a fraction of the pose box's width. Height follows the shape. */
  size: number;
  layer: GeometryLayer;
  /** Resting angle, in degrees. */
  rotate?: number;
  /**
   * The drift up and down: amplitude in px, seconds per cycle, and where in
   * the cycle it starts (0-1), so no two figures ever move in step. The layer
   * scales amplitude and speed on top of these.
   */
  drift: { amp: number; dur: number; phase: number };
  /** A very slow sway, plus or minus this many degrees. */
  sway?: number;
};

export type GeometryFigure =
  /** Angle arc with degree ticks, the two rays that make the angle, a label. */
  | (FigureBase & {
      type: "arc";
      /** Degrees, clockwise from pointing right: 270 is straight up. */
      from: number;
      to: number;
      ticks: number;
      label?: string;
      /** Moves the label outside the arc, at this angle. For an arc whose
          middle something covers. */
      labelAngle?: number;
    })
  /** Dashed curved trajectory; `bend` pushes the curve off the straight line. */
  | (FigureBase & { type: "trajectory"; bend: number; arrow?: boolean })
  /** Nodes on a 0-100 square, and which of them connect. */
  | (FigureBase & {
      type: "constellation";
      nodes: readonly (readonly [number, number])[];
      links: readonly (readonly [number, number])[];
    })
  /** Regular polygon; `open` edges are left out so it never quite closes. */
  | (FigureBase & { type: "polygon"; sides: number; open: number })
  /** A solid shown by its edges alone, turned to `yaw` and tipped by `pitch`. */
  | (FigureBase & { type: "solid"; shape: "cube" | "tetra"; yaw: number; pitch: number })
  /** A dimension line: end caps, a scale, a label. */
  | (FigureBase & { type: "measure"; label?: string })
  /**
   * The drafting triangle on the ground. `target` is the point it measures to,
   * in the same pose-box fractions as `x` and `y`; `readout` is the degree
   * figure it shows, which ticks around that value.
   */
  | (FigureBase & {
      type: "setSquare";
      yaw: number;
      target: readonly [number, number];
      readout: number;
    });
