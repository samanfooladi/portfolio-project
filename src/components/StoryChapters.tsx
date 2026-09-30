"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { accentRgba, type Character, TUNING } from "@/data/characters";
import { chaptersFor, SNAP_TO_CHAPTERS, STORY, type Chapter } from "@/data/stories";
import { hasPose, poseAspect, splitOnName } from "@/lib/story";
import { poseFallback, poseSources, preloadPoses } from "@/lib/sources";
import GeometryOverlay from "./GeometryOverlay";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Which side the character stands on. Chapter 1 is on the left and it
 * alternates from there, so the order of the chapters is the only thing that
 * decides it -- reorder them in the data and the sides follow.
 */
const sideOf = (index: number) => (index % 2 === 0 ? "left" : "right");

/**
 * How far the figure has to travel to stand in the other column, in px.
 *
 * Read at the moment it is applied rather than stored: the columns are a share
 * of the viewport, so this is a different number after every resize. Every
 * tween that uses it is function-based and the trigger runs with
 * `invalidateOnRefresh`, so a resize re-asks instead of keeping a stale px.
 */
const travelX = () => window.innerWidth * (1 - STORY.layout.characterColumnVw / 100);

const poseHeight = (chapter: Chapter) => `${STORY.layout.poseHeightVh[chapter.poseKind]}vh`;

/** A `[start, end]` window from the config, as a duration. */
const span = (w: readonly [number, number]) => w[1] - w[0];

/**
 * Fits a staggered run of `count` lines into exactly `window` seconds, so a
 * chapter with seven lines takes the same time as one with three rather than
 * running past the end of its segment.
 */
function lineTiming(window: number, count: number) {
  const gaps = Math.max(0, count - 1);
  const stagger = gaps ? (window * STORY.motion.line.staggerShare) / gaps : 0;
  return { duration: window - stagger * gaps, stagger };
}

/**
 * When each chapter's overlay is on screen, in master-timeline time.
 *
 * A chapter's rest point is the label at `index + 1`; it arrives over the
 * segment before it. The overlay comes in once that segment's text has
 * started and the figure has stopped travelling -- whichever is later -- so it
 * is never carried over the text column, and goes the moment the scroll moves
 * past the rest point, which is where the text starts to leave. A last chapter
 * has nothing after it to leave for.
 */
function overlayWindows(chapters: readonly Chapter[]) {
  const { intro, segment } = STORY.motion;
  return chapters.flatMap((c, i) => {
    if (!c.overlay) return [];
    const settle = i === 0 ? Math.max(intro.textIn[0], intro.poseIn[1]) : Math.max(segment.textIn[0], segment.travel[1]);
    const exit = i === chapters.length - 1 ? Infinity : i + 1 + STORY.geometry.linger;
    return [{ index: i, enter: i + settle, exit }];
  });
}

/**
 * A line of chapter text, with the character's own name picked out of it. The
 * only styling the story has, and the reason the data stays plain prose: titles
 * and body lines both go through here, and other names are left alone.
 */
const styled = (text: string, name: string) =>
  splitOnName(text, name).map((seg, i) =>
    seg.isName ? (
      <strong className="story-name" key={i}>
        {seg.text}
      </strong>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );

const renderSources = (sources: { type: string; srcSet: string; media?: string }[]) =>
  sources.map((s) => (
    <source key={s.type + (s.media ?? "")} type={s.type} media={s.media} srcSet={s.srcSet} />
  ));

type Props = {
  character: Character;
  /**
   * False while a selection timeline owns the screen. The story must not build
   * over an arrival that is still playing: both write the close-up and the
   * name, and a scrubbed timeline settling at its own zero would snap the hero
   * into place part way through it rising.
   */
  enabled: boolean;
  /**
   * Filled in with "put the story back to the top and let go". Called by the
   * exit, which is the one path Back, Escape and the browser's own back button
   * all end up on.
   */
  resetRef: RefObject<(() => void) | null>;
};

/**
 * The scroll story. Desktop only by virtue of living inside the selected state
 * -- the mobile tree is a different screen and never renders it.
 *
 * Two things move independently, which is why they are built separately:
 *
 * - ONE figure, holding every pose stacked in a single grid cell. It travels
 *   between the two columns and crossfades from one pose into the next part way
 *   across, which is only possible while they share a box. Their height comes
 *   from the figure rather than from each image, so a full body becoming a bust
 *   is a value to interpolate rather than a swap you can see.
 * - One text block per chapter, parked for good on the side the figure is not
 *   on. They never move; their lines only fade.
 *
 * All of it hangs off ONE scrubbed master timeline. React renders the DOM and
 * then stops touching anything animated, and the scroll position is the only
 * state there is -- which is why scrolling back up is simply the same timeline
 * running backwards, with nothing to keep in sync.
 *
 * The view does not need pinning. `.select-root` is already `position: fixed`,
 * so it stays put on its own; what the page needs is something to scroll, and
 * that is the spacer below -- portalled to <body> because a child of a fixed,
 * clipped element cannot make a document longer.
 */
export default function StoryChapters({ character, enabled, resetRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const chapters = chaptersFor(character.id);

  const [posesReady, setPosesReady] = useState(false);
  /** The portalled spacer, once it is in the document: the trigger element. */
  const [spacer, setSpacer] = useState<HTMLElement | null>(null);
  /** Dev bar only. The scroll position is the real state. */
  const [current, setCurrent] = useState(-1);
  /** The chapter whose overlay is showing, or -1. Written from the timeline,
      and only when it changes -- a couple of times a pass, not every frame. */
  const [overlayAt, setOverlayAt] = useState(-1);

  const { layout, motion } = STORY;
  const { fullShadow } = TUNING;

  /**
   * What the story tints, which is not always what the rest of the app tints.
   * A character's main accent belongs to their 3D name, their strip and their
   * picker circle, all of which sit over art it was sampled to suit. The story
   * sits over the same wallpaper for four whole chapters, and a colour the
   * wallpaper already is disappears into it -- Sam's electric blue does exactly
   * that -- so a character carrying a second colour hands the story that one.
   */
  const storyAccent = character.accentSecondary ?? character.accent;

  // Warmed as one batch the moment the character is selected, because the
  // transitions crossfade between poses and cannot wait on a file mid-way.
  // Keyed on the character upstream, so there is no previous character's
  // readiness to clear here -- this instance only ever knows one of them.
  useEffect(() => {
    let live = true;
    void preloadPoses(
      character.id,
      chaptersFor(character.id).map((c) => c.pose),
    ).then(() => {
      if (live) setPosesReady(true);
    });
    return () => {
      live = false;
    };
  }, [character.id]);

  /**
   * The document only scrolls while a story is on screen. Everywhere else this
   * app is a fixed, clipped viewport and must stay that way, so the allowance
   * is an attribute with this component's lifetime rather than a stylesheet
   * change. Scroll restoration goes with it: a reload on `?character=` opens at
   * the hero, not wherever the last visit left off.
   */
  useEffect(() => {
    if (!chapters.length) return;
    const html = document.documentElement;
    const previous = history.scrollRestoration;
    html.dataset.storyScroll = "";
    history.scrollRestoration = "manual";
    return () => {
      delete html.dataset.storyScroll;
      history.scrollRestoration = previous;
      window.scrollTo(0, 0);
    };
  }, [chapters.length]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !spacer || !enabled || !posesReady || !chapters.length) return;

      // A reload lands wherever the browser felt like; the story always opens
      // at the hero.
      window.scrollTo(0, 0);

      const figure = root.querySelector<HTMLElement>("[data-story-figure]")!;
      const hint = root.querySelector<HTMLElement>("[data-story-hint]");
      const stage = root.closest<HTMLElement>("[data-stage]");
      const hero = [
        stage?.querySelector<HTMLElement>("[data-closeup]"),
        stage?.querySelector<HTMLElement>("[data-name]"),
      ].filter(Boolean) as HTMLElement[];

      const poseOf = (chapter: Chapter) =>
        root.querySelector<HTMLElement>(`[data-pose="${chapter.pose}"]`);
      const linesOf = (index: number) =>
        gsap.utils.toArray<HTMLElement>(
          `[data-story-text="${chapters[index].id}"] [data-story-line]`,
          root,
        );

      const build = (reduce: boolean) => {
        const poses = chapters.map(poseOf).filter(Boolean) as HTMLElement[];

        // The state the timeline runs forward from. Set rather than assumed:
        // this also runs again whenever the motion preference flips.
        gsap.set(figure, { x: 0 });
        gsap.set(poses, {
          autoAlpha: 0,
          y: 0,
          filter: "blur(0px)",
          height: poseHeight(chapters[0]),
        });
        gsap.set(gsap.utils.toArray<HTMLElement>("[data-story-line]", root), {
          autoAlpha: 0,
          y: 0,
        });
        gsap.set(hint, { autoAlpha: 1 });

        const windows = overlayWindows(chapters);
        const tl = gsap.timeline({
          // Runs on every render of the timeline, scrubbed or seeked, in both
          // directions -- so an overlay follows the playhead rather than the
          // scroll events, and Back rewinding to zero puts it away too.
          onUpdate: windows.length
            ? () => {
                const t = tl.time();
                const next = windows.find((w) => t >= w.enter && t <= w.exit)?.index ?? -1;
                setOverlayAt((prev) => (prev === next ? prev : next));
              }
            : undefined,
          scrollTrigger: {
            trigger: spacer,
            start: "top top",
            end: "bottom bottom",
            scrub: motion.scrub,
            // The travel distance is a share of the viewport, so every tween
            // that uses it is function-based and has to be re-asked on refresh
            // rather than kept as the px it resolved to at build time.
            invalidateOnRefresh: true,
            snap: SNAP_TO_CHAPTERS
              ? {
                  snapTo: "labels",
                  delay: motion.snap.delay,
                  duration: motion.snap.duration,
                }
              : undefined,
            // Dev only. A scrubbed timeline has no state to inspect other
            // than where it currently is, so it is written where a console can
            // read it -- as attributes rather than React state, because this
            // runs on every frame of every scroll.
            onUpdate: IS_DEV
              ? (self) => {
                  const t = self.progress * chapters.length;
                  root.dataset.storyProgress = self.progress.toFixed(4);
                  root.dataset.storyLength = String(tl.duration());
                  setCurrent(t < 0.5 ? -1 : Math.min(chapters.length - 1, Math.round(t) - 1));
                }
              : undefined,
          },
        });
        timelineRef.current = tl;
        // Dev only, and a debug handle rather than a mechanism: seeking this
        // renders a chapter synchronously, which is the only way to look at one
        // where the page cannot be scrolled by hand.
        if (IS_DEV) (root as HTMLElement & { storyTimeline?: gsap.core.Timeline }).storyTimeline = tl;

        /** Lines leaving: up and out, one after another. */
        const textOut = (index: number, at: number, window: readonly [number, number]) => {
          const lines = linesOf(index);
          const { duration, stagger } = lineTiming(span(window), lines.length);
          tl.to(
            lines,
            {
              autoAlpha: 0,
              y: reduce ? 0 : -motion.line.rise,
              duration,
              stagger,
              ease: "power1.in",
            },
            at + window[0],
          );
        };

        /** Lines arriving: the same beat, the other way up. */
        const textIn = (index: number, at: number, window: readonly [number, number]) => {
          const lines = linesOf(index);
          const { duration, stagger } = lineTiming(span(window), lines.length);
          tl.fromTo(
            lines,
            { autoAlpha: 0, y: reduce ? 0 : motion.line.rise },
            {
              autoAlpha: 1,
              y: 0,
              duration,
              stagger,
              ease: "power2.out",
              immediateRender: false,
            },
            at + window[0],
          );
        };

        // ---- Transition A: the hero handing over to chapter 1. ----
        // The sink and fade stand in for the liquid dissolve; what follows it
        // -- the pose rising in, then the text -- is the finished thing.
        const intro = motion.intro;
        tl.addLabel("hero", 0);
        if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.12, ease: "none" }, 0);
        if (hero.length) {
          tl.to(
            hero,
            {
              autoAlpha: 0,
              y: reduce ? 0 : intro.heroSink,
              duration: span(intro.heroOut),
              ease: "power1.in",
            },
            intro.heroOut[0],
          );
        }
        const first = poseOf(chapters[0]);
        if (first) {
          tl.fromTo(
            first,
            { autoAlpha: 0, y: reduce ? 0 : intro.poseRise },
            {
              autoAlpha: 1,
              y: 0,
              duration: span(intro.poseIn),
              ease: "power2.out",
              immediateRender: false,
            },
            intro.poseIn[0],
          );
        }
        textIn(0, 0, intro.textIn);
        tl.addLabel("chapter-0", 1);

        // ---- Transition B, once per remaining chapter. ----
        const seg = motion.segment;
        for (let i = 1; i < chapters.length; i++) {
          const at = i;
          const from = chapters[i - 1];
          const to = chapters[i];

          // 1. The text on screen leaves first.
          textOut(i - 1, at, seg.textOut);

          // 2. The character crosses to the other side. Under a reduced-motion
          //    preference it simply changes sides behind the crossfade.
          const x = () => (sideOf(i) === "right" ? travelX() : 0);
          if (reduce) {
            tl.set(figure, { x }, at + (seg.crossfade[0] + seg.crossfade[1]) / 2);
          } else {
            tl.to(
              figure,
              { x, duration: span(seg.travel), ease: motion.travelEase },
              at + seg.travel[0],
            );
          }

          // 3. Half way across, the pose becomes the next one. Two chapters
          //    sharing a pose have nothing to swap, so nothing is built.
          const a = poseOf(from);
          const b = poseOf(to);
          const c0 = at + seg.crossfade[0];
          const dur = span(seg.crossfade);

          if (a && b && a !== b) {
            tl.to(a, { autoAlpha: 0, duration: dur, ease: "none" }, c0);
            tl.fromTo(
              b,
              { autoAlpha: 0 },
              { autoAlpha: 1, duration: dur, ease: "none", immediateRender: false },
              c0,
            );
            if (!reduce) {
              // Blur peaks exactly where the swap is, so the swap happens
              // behind it rather than in front of it.
              tl.to(
                [a, b],
                { filter: `blur(${motion.poseBlur}px)`, duration: dur / 2, ease: "power1.in" },
                c0,
              );
              tl.to(
                [a, b],
                { filter: "blur(0px)", duration: dur / 2, ease: "power1.out" },
                c0 + dur / 2,
              );
            }
          }

          // A full body becoming a bust is a height change, and the poses are
          // stood on the floor -- so interpolating the one value moves the size
          // and the vertical position together, with nothing left to pop.
          if (from.poseKind !== to.poseKind) {
            tl.to(poses, { height: poseHeight(to), duration: dur, ease: "power1.inOut" }, c0);
          }

          // 4. The new text, on the side just vacated.
          textIn(i, at, seg.textIn);
          tl.addLabel(`chapter-${i}`, at + 1);
        }

        // Nothing is tweened over the last stretch, but the timeline has to
        // reach its full length or the final label would sit past the end.
        tl.set({}, {}, chapters.length);
      };

      // Rebuilt rather than patched when the preference changes, and reverted
      // by matchMedia on cleanup -- which is what kills the trigger.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => build(true));
      mm.add("(prefers-reduced-motion: no-preference)", () => build(false));

      return () => {
        mm.revert();
        timelineRef.current = null;
        setOverlayAt(-1);
      };
    },
    { scope: rootRef, dependencies: [spacer, enabled, posesReady, character.id] },
  );

  /**
   * What Back, Escape and the browser's back button all reach through the
   * exit: put the screen back to the hero with no chapters playing out, drop
   * the trigger, and return the page to the top. The normal back animation
   * then runs from the state it has always run from.
   */
  useEffect(() => {
    resetRef.current = () => {
      const tl = timelineRef.current;
      // Order matters. Killing a ScrollTrigger kills the animation bound to it,
      // and a dead timeline cannot rewind itself -- so the screen is put back
      // to the hero first and the trigger dropped after.
      tl?.progress(0);
      tl?.scrollTrigger?.kill();
      window.scrollTo(0, 0);
    };
    return () => {
      resetRef.current = null;
    };
  }, [resetRef]);

  if (!chapters.length) return null;

  const vars = {
    // Only what the poses fall back to before the timeline takes their height
    // over; from then on GSAP writes `height` on them directly.
    "--pose-h": poseHeight(chapters[0]),
    "--story-col": `${layout.characterColumnVw}vw`,
    "--story-text-max": `${layout.textMaxWidth}px`,
    "--story-gutter": `${layout.textGutter}px`,
    "--story-accent": storyAccent,
  } as CSSProperties;

  const scrollTo = (index: number) => {
    const st = timelineRef.current?.scrollTrigger;
    const total = timelineRef.current?.duration();
    if (!st || !total) return;
    const time = index < 0 ? 0 : index + 1;
    window.scrollTo({ top: st.start + (time / total) * (st.end - st.start), behavior: "smooth" });
  };

  return (
    <>
      <div
        ref={rootRef}
        className="story"
        data-story
        data-poses-ready={posesReady || undefined}
        style={vars}
      >
        <div className="story-figure" data-story-figure>
          <div
            className="story-poses"
            style={{
              filter: `drop-shadow(0 ${fullShadow.offsetY}vh ${fullShadow.blur * 1.5}vh ${accentRgba(
                storyAccent,
                fullShadow.alpha,
              )})`,
            }}
          >
            {chapters.map((chapter) =>
              hasPose(character.id, chapter.pose) ? (
                <picture key={chapter.id}>
                  {renderSources(poseSources(character.id, chapter.pose))}
                  <img
                    className="story-pose"
                    data-pose={chapter.pose}
                    src={poseFallback(character.id, chapter.pose)}
                    alt=""
                    draggable={false}
                  />
                </picture>
              ) : null,
            )}
          </div>

          {/* Inside the figure, so it goes where the character goes. Laid out
              against its own chapter's pose, not whichever one is showing. */}
          {chapters.map((chapter, i) => {
            const aspect = poseAspect(character.id, chapter.pose);
            return chapter.overlay?.kind === "geometry" && aspect ? (
              <GeometryOverlay
                key={chapter.id}
                figures={chapter.overlay.figures}
                active={overlayAt === i}
                aspect={aspect}
                heightVh={layout.poseHeightVh[chapter.poseKind]}
              />
            ) : null;
          })}
        </div>

        {chapters.map((chapter, i) => (
          <div
            key={chapter.id}
            className="story-text"
            data-story-text={chapter.id}
            /* The text always takes the side the figure is not on. */
            data-side={sideOf(i) === "left" ? "right" : "left"}
          >
            <div className="story-block">
              <h2 className="story-title" data-story-line>
                {styled(chapter.title, character.name)}
              </h2>
              {chapter.body.map((line, l) => (
                <p className="story-line" data-story-line key={l}>
                  {styled(line, character.name)}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Says the page scrolls. Gone the moment it does. */}
        <div className="story-hint" data-story-hint aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {IS_DEV && (
          <div className="story-devbar">
            <button type="button" onClick={() => scrollTo(-1)} data-on={current < 0 || undefined}>
              0 hero
            </button>
            {chapters.map((chapter, i) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => scrollTo(i)}
                data-on={i === current || undefined}
              >
                {i + 1} {chapter.id}
                {hasPose(character.id, chapter.pose) ? "" : " (no art)"}
              </button>
            ))}
            <span>
              {posesReady ? "poses" : "loading"} / {enabled ? "live" : "waiting"} /{" "}
              {spacer ? "spacer" : "no spacer"}
            </span>
          </div>
        )}
      </div>

      {/* The only thing on the page with any height. `.select-root` is fixed
          and clipped, so nothing inside it could give the document something
          to scroll. */}
      {/* Never rendered on the server: <CharacterExperience> has no viewport
          to decide on there and renders nothing at all until it does. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            ref={setSpacer}
            className="story-scroll"
            aria-hidden="true"
            style={
              {
                "--story-pages": 1 + chapters.length * (motion.scrollPerChapterVh / 100),
              } as CSSProperties
            }
          />,
          document.body,
        )}
    </>
  );
}
