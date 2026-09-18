"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CHARACTERS, TUNING } from "@/data/characters";
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

export default function CharacterSelect() {
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [debug, setDebug] = useState(false);

  const selectedIndex = selectedId ? CHARACTERS.findIndex((c) => c.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? CHARACTERS[selectedIndex] : null;

  const handleBack = useCallback(() => {
    if (animatingRef.current) return;

    const strips = stripsRef.current;
    const stage = rootRef.current?.querySelector<HTMLElement>("[data-stage]");
    if (!stage) return;

    animatingRef.current = true;
    setIsAnimating(true);

    const wipeEl = stage.querySelector<HTMLElement>("[data-stage-wipe]")!;
    const { duration, wipe, bgIdleScale } = TUNING;
    const back = duration.back;

    timelineRef.current?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        setSelectedId(null);
        setIsAnimating(false);
        animatingRef.current = false;
        lockedRef.current = false;
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

    // Wipe recedes right to left, uncovering the dimmed base layer.
    addWipe(tl, wipeEl, 100, -wipe.feather, back.wipe, 0.4);

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
        void preloadStage(id).then(() => {
          setSelectedId(id);
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

  // The selection timeline can only be built once React has rendered the stage.
  useEffect(() => {
    if (!selectedId) return;
    const index = CHARACTERS.findIndex((c) => c.id === selectedId);
    const strips = stripsRef.current;
    const stage = rootRef.current?.querySelector<HTMLElement>("[data-stage]");
    if (!stage || index < 0) return;

    const wipeEl = stage.querySelector<HTMLElement>("[data-stage-wipe]")!;
    const closeup = stage.querySelector<HTMLElement>("[data-closeup]");
    const name = stage.querySelector<HTMLElement>("[data-name]");
    const backBtn = stage.querySelector<HTMLElement>("[data-back]");
    const selectedFull = strips[index]?.querySelector<HTMLElement>("[data-full]");
    const { duration, wipe } = TUNING;

    gsap.set(closeup, { autoAlpha: 0, y: 40, scale: 1.04 });
    gsap.set(name, { yPercent: 100 });
    gsap.set(backBtn, { autoAlpha: 0, y: -10 });

    timelineRef.current?.kill();
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
  }, [selectedId]);

  // Escape does what the back button does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId) {
        e.preventDefault();
        handleBack();
      }
      if (IS_DEV && (e.key === "g" || e.key === "G")) setDebug((d) => !d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, handleBack]);

  return (
    <div
      ref={rootRef}
      className="select-root"
      data-selected={selectedId ?? undefined}
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
      {selected && <SelectedStage character={selected} onBack={handleBack} debug={debug} />}

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
