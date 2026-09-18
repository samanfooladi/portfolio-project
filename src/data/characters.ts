/**
 * Single source of truth for every tunable visual value in the character select.
 * Nothing here should be duplicated inside a component.
 *
 * Measured values (head anchors, aspect ratios) are NOT here -- they are derived
 * from the artwork by `npm run images` and written to character-anchors.json.
 */

export type Character = {
  id: string;
  name: string;
  /** Name colour / theme colour. Also tints the Full view drop shadow. */
  accent: string;
  /** Optional second colour sampled from the wallpaper lighting. */
  accentSecondary?: string;

  /** object-position for the bg layer. The bg is never moved to align a character. */
  bgFocusX: number; // %, default 50
  bgFocusY: number; // %, default 50

  // ---- Optional per-character fine tuning of the Full view. ----
  /** Nudge right (+) or left (-), in vh. */
  offsetX?: number;
  /** Nudge down (+) or up (-), in vh. Moves the head off the shared head line. */
  offsetY?: number;
  /** Multiplies FULL_HEIGHT_VH for this character only. 1 = the shared scale. */
  scaleAdjust?: number;

  /**
   * Nudges the head box `npm run images` measures for the mobile picker avatar.
   * All three are fractions of the box's own side, so they keep meaning if the
   * art is re-measured. They move the CROP, not the character: `dx: 0.02` slides
   * the window right, which moves the head left inside the circle; `scale: 1.1`
   * widens the window, which makes the head smaller and gives hair, ears and
   * spikes room to stay inside.
   */
  headBoxAdjust?: { dx?: number; dy?: number; scale?: number };
};

export const CHARACTERS: Character[] = [
  {
    id: "esmaeel",
    name: "Esmaeel",
    accent: "#E8862A",
    accentSecondary: "#1FA3B5",
    bgFocusX: 50,
    bgFocusY: 50,
    // Head leans left of the hair line the anchor is measured from.
    headBoxAdjust: { dx: 0.02 },
  },
  {
    id: "foxy",
    name: "Foxy",
    accent: "#FF9A1F",
    bgFocusX: 50,
    bgFocusY: 50,
    // Ears already set the box width; this only drops it enough to sit them off
    // the top of the circle.
    headBoxAdjust: { dy: 0.015 },
  },
  {
    id: "mh",
    name: "MH",
    accent: "#C9955C",
    bgFocusX: 50,
    bgFocusY: 50,
  },
  {
    id: "navid",
    name: "Navid",
    accent: "#22D3EE",
    accentSecondary: "#F08A24",
    bgFocusX: 50,
    bgFocusY: 50,
    // Tall hair, and a head that sits right of its crown.
    headBoxAdjust: { dx: 0.025, scale: 1.08 },
  },
  {
    id: "peyman",
    name: "Peyman",
    accent: "#B0305A",
    bgFocusX: 50,
    bgFocusY: 50,
  },
  {
    id: "reina",
    name: "Reina",
    accent: "#E01B2F",
    bgFocusX: 50,
    bgFocusY: 50,
  },
  {
    id: "sam",
    name: "Sam",
    accent: "#2F7BFF",
    bgFocusX: 50,
    bgFocusY: 50,
    // Spikes reach past the measured head on every side.
    headBoxAdjust: { scale: 1.12 },
  },
  {
    id: "soroush",
    name: "Soroush",
    accent: "#3FD6E8",
    bgFocusX: 50,
    bgFocusY: 50,
    // Curls sit wider than the longest opaque run in any single row.
    headBoxAdjust: { dx: 0.02, scale: 1.06 },
  },
];

/**
 * The lineup rules. Every character is drawn at the same height and hung from
 * the same head line, which is only meaningful because the build script trims
 * each Full view to its opaque bounding box.
 */
export const FRAMING = {
  /** Rendered height of every Full view, in vh. */
  fullHeightVh: 165,
  /** Where the top edge of every Full view sits, in vh. Top edge = top of hair. */
  headTopVh: 5,
  /**
   * Where the head anchor sits inside a Full view, as a fraction of its height.
   * The build script measures headCenterX over rows 2%-10%, so 6% is the middle
   * of that band. Used as the y at which the strip centreline is sampled, and as
   * the vertical transform-origin of the hover zoom.
   */
  headAnchorY: 0.06,
  /** Rendered height of the close-up in the selected state, in vh. */
  closeupHeightVh: 92,
} as const;

/**
 * The mobile screen. It shares the roster and the measured anchors with the
 * strips and nothing else: one character owns the screen, the rest are a row of
 * circles, and none of the strip geometry above applies.
 *
 * The asset usage is inverted. The strips show Full views and the selected
 * state shows a close-up; here the selected character IS the Full view, and the
 * close-up only survives as the square head crop behind each circle.
 */
export const MOBILE = {
  /** Rendered height of the selected character's Full view, in vh. */
  fullHeightVh: 88,
  /**
   * Empty space that must remain above it. The Full views are trimmed to their
   * opaque box, so their top edge is the top of the hair; this caps the height
   * rather than moving the figure, so the head can never reach the top edge.
   */
  headClearanceVh: 10,
  /** Circle diameter. The lower bound is a tap target, which is why the row
      scrolls instead of shrinking past it. */
  circle: { minPx: 44, vw: 13, maxPx: 64 },
  /** Gap between circles, in px. */
  gapPx: 12,

  /** How the character arrives: a short rise, and on a switch a slight
      over-scale that settles. Rises are in px, not vh -- this is a nudge, not a
      layout value. */
  entrance: { introRise: 30, switchRise: 40, switchScale: 1.03 },

  /** A tapped circle bursts: the disc blows up as it fades, and a thin accent
      ring carries on outward past where the disc was. */
  pop: { disc: 1.35, ring: 1.9, ringAlpha: 0.9 },

  duration: {
    intro: {
      bg: 0.7,
      full: 0.8,
      /** The character starts while the bg is still arriving, not after it. */
      fullAt: 0.45,
      circles: 0.7,
      circlesAt: 0.75,
      stagger: 0.06,
      name: 0.8,
      nameAt: 1.5,
      /** Longest the opening will sit on black waiting for the art. Past this
          it starts anyway and the wallpaper fades in as it arrives, which is
          better than a phone on a slow connection showing nothing at all. */
      wait: 2,
    },
    switch: {
      pop: 0.25,
      ring: 0.45,
      /** The row closing the popped slot and opening one for the returning
          character. */
      reflow: 0.5,
      stagger: 0.03,
      /** Backgrounds crossfading, and the outgoing character leaving with them. */
      fade: 0.5,
      nameOut: 0.45,
      /** Beat between the backgrounds settling and the new character arriving.
          The screen is the new wallpaper alone for this whole second. */
      hold: 1,
      full: 0.8,
      /** Beat between the character starting to arrive and the name rising. */
      nameGap: 0.65,
      name: 0.7,
    },
  },
} as const;

/** Layout + motion tuning shared by every strip. */
export const TUNING = {
  /** Angle of the diagonal cuts, measured off vertical. Top edge leans right. */
  cutAngle: 11,
  /** Overlap between neighbouring strips, in px, so no hairline gaps appear. */
  overlap: 1,
  /** Width below which the mobile tree replaces the strips entirely. */
  mobileBreakpoint: 768,

  /** bg zoom at rest. Never below 1, or object-fit: cover stops covering. */
  bgIdleScale: 1.08,

  hover: {
    /** flex-grow of a hovered strip; the others stay at 1 and shrink proportionally. */
    grow: 1.6,
    /** bg eases back out, revealing more environment. */
    bgScale: 1,
    /** Full view leans in slightly, pivoting on the head anchor. */
    fullScale: 1.03,
  },

  /** Frosted panel that sweeps across a strip on hover. */
  sweep: {
    /** Width as a % of the strip surface. */
    width: 35,
    blur: 8,
    brightness: 1.2,
    /** Travel in % of the panel's own width; clears both edges including the skew. */
    from: -210,
    to: 400,
    /** Fractions of the sweep duration spent fading in and out. */
    fadeIn: 0.22,
    fadeOut: 0.3,
  },

  /** Left-to-right reveal of the selected character's bg. */
  wipe: {
    /** Width of the soft mask edge, in % of the viewport width. */
    feather: 12,
    /** How much the layer under the strips is darkened, 0-1. Keeps vacated
        space from going black while still leaving the wipe something to reveal. */
    baseDim: 0.6,
    /** How far each exiting strip travels, in % of its own width. */
    exitDistance: 150,
    /** Stagger between exiting strips, radiating out from the selected one. */
    exitStagger: 0.05,
  },

  /** Accent-tinted drop shadow under each Full view. */
  fullShadow: {
    /** Vertical offset and blur, in vh. */
    offsetY: 0.5,
    blur: 1.6,
    alpha: 0.45,
  },

  duration: {
    hoverIn: 0.6,
    hoverOut: 0.5,
    sweep: 0.8,
    exit: 0.7,
    wipe: 1,
    closeup: 0.9,
    name: 0.8,
    /** Beat between the close-up landing and the name rising. */
    nameDelay: 1,
    /** Going back is a dedicated timeline, not a reverse: replaying the 1s
        nameDelay backwards would leave a dead second mid-exit. */
    back: {
      name: 0.45,
      closeup: 0.45,
      button: 0.3,
      wipe: 0.8,
      strips: 0.7,
    },
  },
} as const;

/** Asset paths, derived from the id. Mirrors scripts/build-images.mjs output. */
export const assets = {
  bg: (id: string, ext: "webp" | "avif" = "webp") => `/characters/${id}/bg.${ext}`,
  full: (id: string, h: 1600 | 3200, ext: "webp" | "avif" = "webp") =>
    `/characters/${id}/full-${h}.${ext}`,
  closeup: (id: string, h: 1400 | 2400, ext: "webp" | "avif" = "webp") =>
    `/characters/${id}/closeup-${h}.${ext}`,
  /** Square head crop of the close-up, for the mobile picker. WebP only. */
  avatar: (id: string, s: 256 | 512 = 256) => `/characters/${id}/avatar-${s}.webp`,
};

/** `#RRGGBB` -> `rgba(r, g, b, a)`, so accent colours can carry an alpha. */
export function accentRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
