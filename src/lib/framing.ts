import anchorsJson from "@/data/character-anchors.json";
import { type Character, FRAMING, MOBILE, TUNING } from "@/data/characters";

/**
 * Turns the measured anchors into positions for the layers inside a strip.
 *
 * Every number returned is a multiplier of 100dvh, applied in CSS. Keeping them
 * viewport-relative means the layout engine re-resolves them on resize, and the
 * horizontal anchor is expressed against `50%` of the strip surface so it stays
 * correct while a strip's width animates on hover.
 */

export type HeadBox = { x: number; y: number; w: number; h: number };

export type Anchors = {
  fullHeadCenterX: number | null;
  fullHeadSpanX?: number | null;
  fullAspect: number | null;
  closeupHeadCenterX: number | null;
  closeupHeadSpanX?: number | null;
  closeupAspect: number | null;
  /**
   * Square head crop inside the close-up, as fractions of it. Square in pixels,
   * so w and h differ: w is a fraction of the width, h of the height. The
   * avatar files are already cut to it; it is kept for anything that has to
   * reason about the crop without loading one.
   */
  headBox?: HeadBox | null;
  /**
   * Story poses, keyed the same way the chapters are. A pose is stood on the
   * bottom edge at a height of its own, so the aspect ratio is the only thing
   * worth measuring -- there is no head line to hang it from.
   */
  poses?: Record<string, { aspect: number | null }> | null;
};

const ANCHORS = anchorsJson as Record<string, Anchors>;

const EMPTY: Anchors = {
  fullHeadCenterX: null,
  fullAspect: null,
  closeupHeadCenterX: null,
  closeupAspect: null,
  headBox: null,
};

export function anchorsFor(id: string): Anchors {
  return ANCHORS[id] ?? EMPTY;
}

const TAN_CUT = Math.tan((TUNING.cutAngle * Math.PI) / 180);

/**
 * Offset from the centre of a strip surface to that strip's diagonal centreline
 * at height fraction `f`, as a multiple of the viewport height.
 *
 * The cuts lean, so a centreline slides left as y grows and only crosses the
 * surface centre at mid-height. The first and last strips are trapezoids -- one
 * of their edges is the straight screen edge and does not lean -- so their
 * centreline travels exactly half as far.
 */
export function centerlineDx(f: number, straightEdge: boolean): number {
  const dx = (0.5 - f) * TAN_CUT;
  return straightEdge ? dx / 2 : dx;
}

/**
 * Lean of that centreline, in degrees. It is not the cut angle on the end
 * strips: travelling half as far over the same height is a shallower line.
 */
export function centerlineAngleDeg(straightEdge: boolean): number {
  const tan = straightEdge ? TAN_CUT / 2 : TAN_CUT;
  return (Math.atan(tan) * 180) / Math.PI;
}

export type FullFraming = {
  /** All four are multipliers of 100dvh. */
  width: number;
  height: number;
  top: number;
  /** Horizontal offset from the surface's own centre (the `50%` in CSS). */
  dx: number;
  /** transform-origin for the hover zoom, as percentages of the image box. */
  originX: number;
  originY: number;
  /** Height fraction at which the head anchor sits; where the dot is drawn. */
  headF: number;
  /** Centreline offset at the head's y, for the debug dot. */
  headDx: number;
};

/**
 * Hangs a Full view so that its top edge (= top of hair, guaranteed by the
 * build script's alpha trim) sits on the shared head line, and its measured
 * head anchor -- not its geometric centre -- sits on the strip centreline at
 * the head's own height.
 */
export function fullFramingFor(c: Character, straightEdge: boolean): FullFraming | null {
  const a = anchorsFor(c.id);
  if (a.fullAspect == null || a.fullHeadCenterX == null) return null;

  const height = (FRAMING.fullHeightVh / 100) * (c.scaleAdjust ?? 1);
  const width = height * a.fullAspect;
  const top = FRAMING.headTopVh / 100 + (c.offsetY ?? 0) / 100;

  // The centreline shifts with height, so sample it at the head, not the middle.
  const headF = top + FRAMING.headAnchorY * height;
  const headDx = centerlineDx(headF, straightEdge);

  return {
    width,
    height,
    top,
    dx: headDx - a.fullHeadCenterX * width + (c.offsetX ?? 0) / 100,
    originX: a.fullHeadCenterX * 100,
    originY: FRAMING.headAnchorY * 100,
    headF,
    headDx,
  };
}

export type CloseupFraming = {
  /** Multipliers of 100dvh. */
  width: number;
  height: number;
  /** Horizontal offset from the centre of the viewport. */
  dx: number;
};

/**
 * Centres a close-up on the screen by its measured head anchor and sits it on
 * the bottom edge. Used by the selected state.
 */
export function closeupFramingFor(c: Character): CloseupFraming | null {
  const a = anchorsFor(c.id);
  if (a.closeupAspect == null || a.closeupHeadCenterX == null) return null;

  const height = FRAMING.closeupHeightVh / 100;
  const width = height * a.closeupAspect;
  // left: calc(50% + dx*100dvh) must put headCenterX on the viewport centre.
  return { width, height, dx: -a.closeupHeadCenterX * width };
}

/** The shared head line, as a fraction of the viewport height. */
export const HEAD_TOP_F = FRAMING.headTopVh / 100;

export type MobileFraming = {
  /** Multipliers of 100dvh. */
  width: number;
  height: number;
  /** Horizontal offset from the centre of the viewport. */
  dx: number;
};

/**
 * Stands a Full view on the bottom edge of the phone screen with its measured
 * head anchor -- not its centre -- on the middle of the screen.
 *
 * Same idea as closeupFramingFor, different layer and a height that is clamped:
 * the art is trimmed to the top of the hair, so a height the viewport cannot
 * fit would crop the head rather than the feet.
 */
export function mobileFramingFor(c: Character): MobileFraming | null {
  const a = anchorsFor(c.id);
  if (a.fullAspect == null || a.fullHeadCenterX == null) return null;

  const wanted = MOBILE.fullHeightVh * (c.scaleAdjust ?? 1);
  const height = Math.min(wanted, 100 - MOBILE.headClearanceVh) / 100;
  const width = height * a.fullAspect;
  // left: calc(50% + dx*100dvh) must put fullHeadCenterX on the viewport centre.
  return { width, height, dx: -a.fullHeadCenterX * width };
}
