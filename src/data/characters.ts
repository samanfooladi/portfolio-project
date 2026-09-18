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
};

export const CHARACTERS: Character[] = [
  {
    id: "esmaeel",
    name: "Esmaeel",
    accent: "#E8862A",
    accentSecondary: "#1FA3B5",
    bgFocusX: 50,
    bgFocusY: 50,
  },
  {
    id: "foxy",
    name: "Foxy",
    accent: "#FF9A1F",
    bgFocusX: 50,
    bgFocusY: 50,
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
  },
  {
    id: "soroush",
    name: "Soroush",
    accent: "#3FD6E8",
    bgFocusX: 50,
    bgFocusY: 50,
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

/** Layout + motion tuning shared by every strip. */
export const TUNING = {
  /** Angle of the diagonal cuts, measured off vertical. Top edge leans right. */
  cutAngle: 11,
  /** Overlap between neighbouring strips, in px, so no hairline gaps appear. */
  overlap: 1,
  /** Breakpoint below which strips stack as horizontal bands. */
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
