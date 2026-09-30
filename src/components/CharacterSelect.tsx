"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CHARACTERS, TUNING } from "@/data/characters";
import type { EntryMode } from "./CharacterExperience";
import { HEAD_TOP_F } from "@/lib/framing";
import { preloadStage } from "@/lib/sources";
import CharacterStrip from "./CharacterStrip";
import FramingDebug from "./FramingDebug";
import SelectedStage from "./SelectedStage";

gsap.registerPlugin(useGSAP);

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Dev guard for the "no empty or black area in any strip" rule. object-fit:
 * cover makes coverage a mathematical certainty, so what this actually catches
 * is a bg that failed to load or was never built.
 */
function checkBgCoverage(strips: HTMLElement[]) {
  for (const strip of strips) {
    const id = strip.dataset.id;
    const surface = strip.querySelector<HTMLElement>("[data-surface]");
    const bg = strip.querySelector<HTMLImageElement>("[data-bg]");
    if (!surface) continue;

    if (!bg) {
      console.warn(`[character-select] ${id}: no bg layer, strip will show through to black`);
      continue;
    }
    if (!bg.complete || bg.naturalWidth === 0) {
      console.warn(`[character-select] ${id}: bg failed to load (${bg.currentSrc || bg.src})`);
      continue;
    }

    const box = surface.getBoundingClientRect();
    const scale = Number(getComputedStyle(bg).getPropertyValue("--bg-idle-scale")) || 1;
    const cover = Math.max(box.width / bg.naturalWidth, box.height / bg.naturalHeight);
    const paintedW = bg.naturalWidth * cover * scale;
    const paintedH = bg.naturalHeight * cover * scale;
    if (paintedW < box.width - 0.5 || paintedH < box.height - 0.5) {
      console.warn(
        `[character-select] ${id}: bg does not cover its strip ` +
          `(painted ${paintedW.toFixed(0)}x${paintedH.toFixed(0)} vs box ` +
          `${box.width.toFixed(0)}x${box.height.toFixed(0)})`,
      );
    }
  }
}

/**
 * Drives the mask position that CSS reads as `calc(var(--wipe) * 1%)`.
 * Tweened through a proxy object rather than as a CSS variable directly, so the
 * written value is guaranteed to be a bare number -- GSAP will happily append
 * "px" to a unitless custom property, which would break the calc().
 */
function addWipe(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  from: number,
  to: number,
  duration: number,
  at: number,
) {
  const proxy = { v: from };
  el.style.setProperty("--wipe", String(from));
  tl.to(
    proxy,
    {
      v: to,
      duration,
      ease: "power2.inOut",
      onUpdate: () => el.style.setProperty("--wipe", String(proxy.v)),
    },
    at,
  );
}

type Props = {
  /** The selected character, or null for the lineup. Owned above this tree so
      it survives the remount a breakpoint crossing causes. */
  selectedId: string | null;
  /** Whether arriving at `selectedId` should play the full sequence or land in
      it already finished. */
  entry: EntryMode;
  onSelect: (id: string) => void;
  onBack: () => void;
};

export default function CharacterSelect({ selectedId, entry, onSelect, onBack }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripsRef = useRef<HTMLElement[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  /**
   * Read by the native hover/click handlers, which outlive any single render.
   * `locked` stays true for the whole selected state so hover cannot fire behind
   * the stage; `animating` is only true while a timeline owns the screen. Back
   * has to test the second one, or it could never run.
   */
  const lockedRef = useRef(false);
  const animatingRef = useRef(false);
  /** The native click handlers below are attached once, and outlive every
      identity `onSelect` may take. */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /**
   * What is on screen, which lags `selectedId` on the way out: clearing the
   * prop starts the exit, and the stage only stops being rendered once that
   * has finished playing. Going in there is no lag -- the stage has to exist
   * before a timeline can be built against it.
   */
  const [shownId, setShownId] = useState<string | null>(selectedId);
  const [isAnimating, setIsAnimating] = useState(false);
  const [debug, setDebug] = useState(false);
  /** The mode the arrival on screen was requested with, frozen at the moment
      it was requested so a later prop change cannot rewrite a running one. */
  const [entryMode, setEntryMode] = useState<EntryMode>(entry);
  /** The last `selectedId` this tree has taken up, so the two directions can
      be told apart from one render to the next. */
  const [ackId, setAckId] = useState<string | null>(selectedId);
  /** True from the moment the exit is handed to a timeline until that timeline
      has cleared the stage, so a second request cannot start another. */
  const exitingRef = useRef(false);
  /**
   * How the exit puts the scroll story away, filled in by <StoryChapters> and
   * null for a character that has none. It lives here rather than on the Back
   * button because the button is not the only way out: Escape and the
   * browser's own back button both land on the exit too, and this way all
   * three take one path instead of three that have to keep agreeing.
   */
  const storyResetRef = useRef<(() => void) | null>(null);

  /**
   * Taking up a new selection, during render rather than in an effect: React
   * re-runs this component before committing, so the pass that still had the
   * old character never reaches the screen.
   *
   * Only the arriving direction is settled here. Leaving is a timeline, and a
   * timeline is a side effect -- `shownId` outlives the selection being
   * dropped and is cleared on the exit's last frame instead.
   */
  if (selectedId !== ackId) {
    setAckId(selectedId);
    if (selectedId) {
      setEntryMode(entry);
      setShownId(selectedId);
    }
  }

  const selectedIndex = shownId ? CHARACTERS.findIndex((c) => c.id === shownId) : -1;
  const selected = selectedIndex >= 0 ? CHARACTERS[selectedIndex] : null;

  /**
   * Plays the selected state out and, once it has, stops rendering the stage.
   *
   * Not wired to the Back button directly. Both that button and the browser's
   * own back go through history, which clears `selectedId` above this tree;
   * this runs off that clearing, so the two are the same path rather than two
   * paths that have to be kept agreeing.
   */
  const runExit = useCallback(() => {
    // Before anything is animated: the page jumps back to the top and the
    // story's trigger is dropped, so the chapters do not play themselves out
    // underneath an exit that knows nothing about them.
    storyResetRef.current?.();

    const strips = stripsRef.current;
    const stage = rootRef.current?.querySelector<HTMLElement>("[data-stage]");
    if (!stage) {
      setShownId(null);
      exitingRef.current = false;
      return;
    }

    animatingRef.current = true;
    setIsAnimating(true);

    // An arrival that faded the stage as a whole leaves an opacity behind, and
    // an opacity below 1 makes the stage a stacking context -- which would put
    // the wipe underneath the returning strips instead of over them.
    gsap.set(stage, { clearProps: "opacity,visibility" });

    const wipeEl = stage.querySelector<HTMLElement>("[data-stage-wipe]")!;
    const { duration, wipe, bgIdleScale } = TUNING;
    const back = duration.back;

    timelineRef.current?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        setShownId(null);
        setIsAnimating(false);
        animatingRef.current = false;
        lockedRef.current = false;
        exitingRef.current = false;
      },
    });
    timelineRef.current = tl;

    tl.to(stage.querySelector("[data-name]"), { yPercent: 100, duration: back.name, ease: "power3.in" }, 0)
      .to(stage.querySelector("[data-back]"), { autoAlpha: 0, y: -10, duration: back.button, ease: "power2.in" }, 0)
      .to(
        stage.querySelector("[data-closeup]"),
        { autoAlpha: 0, y: 30, scale: 1.03, duration: back.closeup, ease: "power2.in" },
        0.15,
      );

    // Wipe recedes right to left, uncovering the dimmed base layer. From
    // wherever it actually is, not from 100: the browser's back button can
    // arrive part way through an arrival, which the in-app one could not, and
    // assuming the wipe had landed would snap it across before receding.
    // parseFloat, not Number: an unset property reads as "", which Number
    // would quietly turn into a fully receded wipe.
    const wipeFrom = parseFloat(wipeEl.style.getPropertyValue("--wipe"));
    addWipe(tl, wipeEl, Number.isNaN(wipeFrom) ? 100 : wipeFrom, -wipe.feather, back.wipe, 0.4);

    // Strips return while the wipe is still receding, so the dimmed base is
    // only ever on screen briefly.
    strips.forEach((strip, i) => {
      if (i === selectedIndex) return;
      const dist = Math.abs(i - selectedIndex);
      tl.to(
        strip,
        { xPercent: 0, autoAlpha: 1, duration: back.strips, ease: "power3.out" },
        0.55 + (dist - 1) * wipe.exitStagger,
      );
    });

    // The selected strip only moved if this arrival was the animated one; an
    // immediate arrival hid it along with the rest, so it has to come back too.
    // Where it never left, this tween is a no-op onto the values it already has.
    if (strips[selectedIndex]) {
      tl.to(
        strips[selectedIndex],
        { xPercent: 0, autoAlpha: 1, duration: back.strips, ease: "power3.out" },
        0.55,
      );
    }

    // Undo any hover state the strips were left in.
    tl.to(strips, { flexGrow: 1, duration: back.strips, ease: "power3.out" }, 0.55)
      .to(
        strips.map((s) => s.querySelector("[data-bg]")),
        { scale: bgIdleScale, duration: back.strips, ease: "power3.out" },
        0.55,
      )
      .to(
        strips.map((s) => s.querySelector("[data-full]")),
        { autoAlpha: 1, scale: 1, duration: back.strips, ease: "power3.out" },
        0.55,
      );
  }, [selectedIndex]);

  // Everything animated lives in here: the sweep timelines, the hover/click
  // handlers and the listeners that drive them. Listeners are native rather than
  // React props so a hover never re-renders a strip, and every tween this
  // creates is owned by the arrays below and killed in the returned cleanup.
  useGSAP(
    () => {
      const strips = gsap.utils.toArray<HTMLElement>("[data-strip]");
      stripsRef.current = strips;
      const { sweep, cutAngle, duration, hover, bgIdleScale } = TUNING;
      const d = duration.sweep;

      const sweeps = strips.map((strip) => {
        const el = strip.querySelector<HTMLElement>("[data-sweep]");
        gsap.set(el, { skewX: -cutAngle, xPercent: sweep.from, autoAlpha: 0 });

        return gsap
          .timeline({ paused: true })
          .fromTo(el, { xPercent: sweep.from }, { xPercent: sweep.to, duration: d, ease: "power2.inOut" }, 0)
          .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d * sweep.fadeIn, ease: "power1.out" }, 0)
          .to(el, { autoAlpha: 0, duration: d * sweep.fadeOut, ease: "power1.in" }, d * (1 - sweep.fadeOut));
      });

      const tweens: gsap.core.Tween[][] = strips.map(() => []);

      const setHover = (index: number, hovering: boolean) => {
        if (lockedRef.current) return;
        const strip = strips[index];
        const time = hovering ? duration.hoverIn : duration.hoverOut;
        const ease = "power3.out";

        tweens[index] = [
          gsap.to(strip, { flexGrow: hovering ? hover.grow : 1, duration: time, ease, overwrite: "auto" }),
          gsap.to(strip.querySelector("[data-bg]"), {
            scale: hovering ? hover.bgScale : bgIdleScale,
            duration: time,
            ease,
            overwrite: "auto",
          }),
          gsap.to(strip.querySelector("[data-full]"), {
            scale: hovering ? hover.fullScale : 1,
            duration: time,
            ease,
            overwrite: "auto",
          }),
        ];

        if (hovering) {
          sweeps[index]?.restart();
          // Warm the selected-state art now, so a click does not stall on it.
          void preloadStage(strips[index].dataset.id!);
        }
      };

      const select = (index: number) => {
        if (lockedRef.current || animatingRef.current) return;
        lockedRef.current = true;
        animatingRef.current = true;
        setIsAnimating(true);
        const id = strips[index].dataset.id!;
        // If the hover preload has not finished (or never started, e.g. a
        // keyboard activation), wait rather than wiping to a blank layer.
        // The selection itself is not ours to hold: it goes up, into the URL,
        // and comes back down as a prop.
        void preloadStage(id).then(() => {
          onSelectRef.current(id);
        });
      };

      const detach = strips.map((strip, index) => {
        const surface = strip.querySelector<HTMLElement>("[data-surface]");
        if (!surface) return () => {};
        const enter = () => setHover(index, true);
        const leave = () => setHover(index, false);
        const click = () => select(index);
        surface.addEventListener("mouseenter", enter);
        surface.addEventListener("mouseleave", leave);
        surface.addEventListener("click", click);
        return () => {
          surface.removeEventListener("mouseenter", enter);
          surface.removeEventListener("mouseleave", leave);
          surface.removeEventListener("click", click);
        };
      });

      let onResize: (() => void) | undefined;
      if (IS_DEV) {
        const run = () => checkBgCoverage(strips);
        Promise.all(
          strips.map((s) => {
            const bg = s.querySelector<HTMLImageElement>("[data-bg]");
            return bg && !bg.complete
              ? new Promise((r) => bg.addEventListener("load", r, { once: true }))
              : null;
          }),
        ).then(run);
        onResize = () => run();
        window.addEventListener("resize", onResize);
      }

      return () => {
        detach.forEach((off) => off());
        sweeps.forEach((tl) => tl.kill());
        tweens.flat().forEach((t) => t.kill());
        if (onResize) window.removeEventListener("resize", onResize);
      };
    },
    { scope: rootRef },
  );

  // The leaving direction. The selection is already gone above this tree --
  // the URL no longer names anyone -- and this plays the screen out to match.
  useEffect(() => {
    if (selectedId || !shownId || exitingRef.current) return;
    exitingRef.current = true;
    runExit();
  }, [selectedId, shownId, runExit]);

  // The selection timeline can only be built once React has rendered the
  // stage. A layout effect, not an effect: an immediate arrival hides the
  // strips, and a paint in between would flash the whole lineup on a reload
  // that was never meant to show one.
  useLayoutEffect(() => {
    if (!shownId) return;
    const index = CHARACTERS.findIndex((c) => c.id === shownId);
    const strips = stripsRef.current;
    const stage = rootRef.current?.querySelector<HTMLElement>("[data-stage]");
    if (!stage || index < 0) return;

    const wipeEl = stage.querySelector<HTMLElement>("[data-stage-wipe]")!;
    const closeup = stage.querySelector<HTMLElement>("[data-closeup]");
    const name = stage.querySelector<HTMLElement>("[data-name]");
    const backBtn = stage.querySelector<HTMLElement>("[data-back]");
    const selectedFull = strips[index]?.querySelector<HTMLElement>("[data-full]");
    const { duration, wipe } = TUNING;

    timelineRef.current?.kill();
    exitingRef.current = false;
    lockedRef.current = true;
    animatingRef.current = true;
    setIsAnimating(true);

    if (entryMode === "immediate") {
      // Nothing to sweep away and nothing to reveal: this state was arrived at,
      // not transitioned into. Every layer is put where the full sequence would
      // have left it and the whole stage is faded up over one short beat.
      strips.forEach((strip, i) => {
        if (i === index) {
          // Hidden where it stands rather than sent off with the others: it is
          // under a stage that is about to fade up from nothing, and a strip
          // showing through that fade is the lineup this arrival exists to
          // skip. The exit brings it back with the rest.
          gsap.set(strip, { autoAlpha: 0 });
          return;
        }
        const dir = i < index ? -1 : 1;
        gsap.set(strip, { xPercent: dir * wipe.exitDistance, autoAlpha: 0 });
      });
      gsap.set(selectedFull, { autoAlpha: 0 });
      wipeEl.style.setProperty("--wipe", "100");
      gsap.set(closeup, { autoAlpha: 1, y: 0, scale: 1 });
      gsap.set(name, { yPercent: 0 });
      gsap.set(backBtn, { autoAlpha: 1, y: 0 });
      gsap.set(stage, { autoAlpha: 0 });

      const settle = () => {
        // The opacity goes away rather than landing on 1: below 1 it makes the
        // stage a stacking context, and leaving the declaration behind invites
        // the next reader to assume it never was one.
        gsap.set(stage, { clearProps: "opacity,visibility" });
        setIsAnimating(false);
        animatingRef.current = false;
      };

      const tl = gsap.timeline({ paused: true, onComplete: settle });
      tl.to(stage, { autoAlpha: 1, duration: duration.restore, ease: "power2.out" }, 0);
      timelineRef.current = tl;

      // Fading up art that has not decoded yet is a fade to black, so the beat
      // waits for it -- but not indefinitely, since the screen behind it is
      // blank either way.
      let cancelled = false;
      const start = () => {
        if (!cancelled) tl.play();
      };
      void preloadStage(shownId).then(start);
      const fallback = window.setTimeout(start, duration.restoreWait * 1000);

      return () => {
        cancelled = true;
        window.clearTimeout(fallback);
        tl.kill();
        if (timelineRef.current === tl) timelineRef.current = null;
      };
    }

    gsap.set(closeup, { autoAlpha: 0, y: 40, scale: 1.04 });
    gsap.set(name, { yPercent: 100 });
    gsap.set(backBtn, { autoAlpha: 0, y: -10 });

    // lockedRef stays true: the idle screen is still behind the stage.
    const tl = gsap.timeline({
      onComplete: () => {
        setIsAnimating(false);
        animatingRef.current = false;
      },
    });
    timelineRef.current = tl;

    // 1. The others leave, radiating outward from the clicked strip.
    strips.forEach((strip, i) => {
      if (i === index) return;
      const dir = i < index ? -1 : 1;
      const dist = Math.abs(i - index);
      tl.to(
        strip,
        {
          xPercent: dir * wipe.exitDistance,
          autoAlpha: 0,
          duration: duration.exit,
          ease: "power3.in",
        },
        (dist - 1) * wipe.exitStagger,
      );
    });

    // 2. At the same time, the bg sweeps in from the left over everything.
    addWipe(tl, wipeEl, -wipe.feather, 100, duration.wipe, 0);
    tl.to(selectedFull, { autoAlpha: 0, duration: duration.wipe * 0.7, ease: "power2.in" }, 0.1);

    // 3. Close-up rises into the middle once the wipe has landed.
    tl.to(
      closeup,
      { autoAlpha: 1, y: 0, scale: 1, duration: duration.closeup, ease: "power3.out" },
      duration.wipe,
    );

    // 4. A full second later, the name.
    tl.to(name, { yPercent: 0, duration: duration.name, ease: "power4.out" }, `+=${duration.nameDelay}`);

    // 5. Back button, just after the name starts.
    tl.to(backBtn, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, "<0.1");

    return () => {
      tl.kill();
      if (timelineRef.current === tl) timelineRef.current = null;
    };
  }, [shownId, entryMode]);

  /** What the Back button and Escape both do: ask for the selection to be
      dropped. The exit plays when it actually is. */
  const requestBack = useCallback(() => {
    if (animatingRef.current) return;
    onBack();
  }, [onBack]);

  // Escape does what the back button does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && shownId) {
        e.preventDefault();
        requestBack();
      }
      if (IS_DEV && (e.key === "g" || e.key === "G")) setDebug((d) => !d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shownId, requestBack]);

  return (
    <div
      ref={rootRef}
      className="select-root"
      data-selected={shownId ?? undefined}
      data-animating={isAnimating || undefined}
      style={
        {
          "--cut-angle": `${TUNING.cutAngle}deg`,
          "--ov": `${TUNING.overlap}px`,
          "--bg-idle-scale": TUNING.bgIdleScale,
          "--base-dim": TUNING.wipe.baseDim,
          "--head-top-f": HEAD_TOP_F,
          "--sweep-w": `${TUNING.sweep.width}%`,
          "--sweep-filter": `blur(${TUNING.sweep.blur}px) brightness(${TUNING.sweep.brightness})`,
        } as CSSProperties
      }
    >
      {/* Before the strips in the DOM: the stage's base layer must paint under
          them, while its other layers carry explicit z-indexes to sit on top. */}
      {selected && (
        <SelectedStage
          character={selected}
          onBack={requestBack}
          debug={debug}
          // The story may not build over an arrival that is still playing:
          // both write the close-up and the name.
          storyEnabled={!isAnimating}
          storyResetRef={storyResetRef}
        />
      )}

      {CHARACTERS.map((character, i) => (
        <CharacterStrip
          key={character.id}
          character={character}
          index={i}
          showDivider={i > 0}
          straightEdge={i === 0 || i === CHARACTERS.length - 1}
          debug={debug}
        />
      ))}

      {IS_DEV && debug && <FramingDebug />}
    </div>
  );
}
