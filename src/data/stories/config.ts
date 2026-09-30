/**
 * Every tunable number the scroll story has, in one place.
 *
 * `layout` is where things sit; `motion` is how the scroll moves between them.
 * Nothing else in the feature carries a magic number, so this is the one file
 * to open when something is a few pixels or a few tenths of a second off.
 *
 * The windows in `motion.segment` are fractions of ONE chapter-to-chapter
 * transition, which the master timeline gives a duration of exactly 1. They
 * overlap on purpose: the old text leaves while the travel is already under
 * way, the poses swap in the middle of it where the blur covers them, and the
 * new text only starts once the character has nearly arrived.
 */
export const STORY = {
  layout: {
    /**
     * The character's column, as a share of the viewport width, measured from
     * its own edge inward. The text gets everything left over, which is what
     * keeps the two from ever meeting: at 45 the figure owns 0-45% and the
     * text 45-100%, and the figure travelling to the far side simply swaps
     * which end is which.
     */
    characterColumnVw: 45,
    /**
     * Rendered height of a pose, in vh. A bust stands shorter than a full
     * body so the two read as the same character at the same distance rather
     * than a head blown up to the height of a standing figure.
     */
    poseHeightVh: { full: 92, bust: 85 } as Record<"full" | "bust", number>,
    /** The text column: how wide the block itself may get, and the breathing
        room it keeps from the screen edge and from the middle. Both px. */
    textMaxWidth: 520,
    textGutter: 48,
  },

  motion: {
    /**
     * Scroll one transition costs, as a share of the viewport height. The page
     * is this long per chapter, so adding a chapter makes the page longer
     * rather than compressing the chapters already in it.
     */
    scrollPerChapterVh: 100,
    /** Seconds the timeline takes to catch up to the scroll position. */
    scrub: 1,
    /** How long it waits after scrolling stops, and how long the ease takes. */
    snap: { delay: 0.3, duration: 0.6 },

    /** Windows inside one transition, as fractions of it. */
    segment: {
      textOut: [0, 0.3],
      travel: [0.08, 0.92],
      crossfade: [0.4, 0.6],
      textIn: [0.72, 1],
    },
    /** Peak blur on the two poses at the middle of their crossfade, in px.
        It is what the swap happens behind. */
    poseBlur: 6,
    /** Slow in, slow out, nothing sharp at either end: a camera pan, not a
        move from A to B. */
    travelEase: "power1.inOut",

    /** Text lines. `rise` is how far they travel, in px; `staggerShare` is how
        much of the window goes on the gap between lines rather than on each
        line's own fade, so the beat stays right whatever the line count. */
    line: { rise: 18, staggerShare: 0.55 },

    /**
     * The hero handing over to chapter 1. The fade here is a placeholder for
     * the liquid dissolve; the chapter's own arrival after it is final.
     */
    intro: {
      heroOut: [0, 0.45],
      poseIn: [0.4, 0.75],
      textIn: [0.72, 1],
      /** How far the hero sinks as it goes, and the pose rises as it arrives. */
      heroSink: 60,
      poseRise: 40,
    },
  },

  /**
   * The geometry overlay: wireframe "calculation" figures drawn around a
   * character for as long as their chapter is on screen. What the figures are
   * and where they sit is data on the chapter; how they look and move is here.
   */
  geometry: {
    /** Line width in screen px, whatever size the figure is drawn at. */
    stroke: 1.25,
    /** The faint outer glow on every line: blur radius in px, and its alpha. */
    glow: { blur: 3, alpha: 0.4 },
    /**
     * Depth without a 3D library. Nearer is larger, brighter and faster, and
     * every figure's own drift is scaled by its layer. Opacities stay inside
     * 35-60% so the lines read as something being revealed, not drawn on.
     */
    layers: {
      far: { scale: 0.82, opacity: 0.35, speed: 0.7, amp: 0.7 },
      mid: { scale: 1, opacity: 0.46, speed: 1, amp: 1 },
      near: { scale: 1.14, opacity: 0.56, speed: 1.35, amp: 1.3 },
      front: { scale: 1, opacity: 0.6, speed: 1, amp: 1 },
    } as Record<"far" | "mid" | "near" | "front", { scale: number; opacity: number; speed: number; amp: number }>,
    /** How far a figure's opacity dips at the bottom of its pulse, as a share
        of its own opacity, and how much slower than its drift the pulse runs. */
    pulse: { depth: 0.3, slower: 1.7 },
    /** How much slower than its drift a swaying figure sways. */
    swaySlower: 2.3,
    /** Plotting in, in seconds: the whole run, and the gap between figures. */
    draw: { duration: 0.8, stagger: 0.035 },
    /** Leaving: seconds, and how far everything shrinks as it fades. */
    exit: { duration: 0.45, shrink: 0.965 },
    /** The set square does not float. It breathes: px, seconds per breath. */
    breathe: { amp: 2, dur: 4.2 },
    /** Its measurement line's dashes travel toward the foot, in user units a
        second, and the dash pattern they travel in. */
    dash: { speed: 14, on: 3, off: 2.5 },
    /** Its degree readout moves to a nearby value this often (s), never
        further than `spread` degrees from where it started. */
    readout: { interval: 0.75, spread: 0.4 },
    /**
     * When the overlay is shown. It arrives once the text has started and the
     * figure has stopped travelling -- whichever is later -- so it can never be
     * carried across the text column. It leaves the moment the scroll moves
     * this far past the chapter's rest point, which is where its text starts
     * to go.
     */
    linger: 0.02,
  },
} as const;

/**
 * Whether letting go mid-transition eases to the nearest chapter instead of
 * leaving the character stranded half way across the screen.
 */
export const SNAP_TO_CHAPTERS = true;
