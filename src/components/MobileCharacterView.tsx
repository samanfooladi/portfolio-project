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
import { accentRgba, type Character, CHARACTERS, MOBILE, TUNING } from "@/data/characters";
import { anchorsFor, mobileFramingFor } from "@/lib/framing";
import { initialSelectedId, rememberSelectedId } from "@/lib/selection";
import {
  bgFallback,
  bgSources,
  mobileFullFallback,
  mobileFullSources,
  preloadMobileStage,
  type PictureSource,
} from "@/lib/sources";
import CharacterPicker, { PoppingCircle, type PopRect } from "./CharacterPicker";

const byId = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

const renderSources = (sources: PictureSource[]) =>
  sources.map((s) => (
    <source key={s.type + (s.media ?? "")} type={s.type} media={s.media} srcSet={s.srcSet} />
  ));

/**
 * One character's wallpaper, figure and name, as a single stacked layer.
 *
 * There are always two of these, and a switch never moves a character between
 * them: the arriving character is loaded into whichever layer is currently
 * behind, and the one in front is then faded away. Swapping the src of a layer
 * that is on screen would hold the old bitmap until the new one decoded, which
 * is the empty frame the crossfade exists to avoid.
 */
function StageLayer({ character, role }: { character: Character; role: "front" | "back" }) {
  const full = mobileFramingFor(character);
  const a = anchorsFor(character.id);
  const { fullShadow } = TUNING;

  return (
    <div
      className="mobile-layer"
      data-layer={role}
      aria-hidden="true"
      style={
        {
          zIndex: role === "front" ? 1 : 0,
          "--bg-fx": `${character.bgFocusX}%`,
          "--bg-fy": `${character.bgFocusY}%`,
          "--accent": character.accent,
          "--accent-glow": accentRgba(character.accent, 0.55),
        } as CSSProperties
      }
    >
      {/* 1. The wallpaper, covering the screen. */}
      <div className="mobile-bg" data-bg>
        <picture>
          {renderSources(bgSources(character.id))}
          <img src={bgFallback(character.id)} alt="" draggable={false} />
        </picture>
      </div>

      {/* 2. The character, standing on the bottom edge, head anchor on the
          middle of the screen. Height comes from the anchors, not object-fit. */}
      {full && (
        <picture>
          {renderSources(mobileFullSources(character.id))}
          <img
            className="mobile-full"
            data-full
            src={mobileFullFallback(character.id)}
            alt=""
            draggable={false}
            style={
              {
                "--m-full-w": full.width,
                "--m-full-h": full.height,
                "--m-full-dx": full.dx,
                "--m-full-ox": `${(a.fullHeadCenterX ?? 0.5) * 100}%`,
                filter: `drop-shadow(0 ${fullShadow.offsetY}vh ${fullShadow.blur}vh ${accentRgba(
                  character.accent,
                  fullShadow.alpha,
                )})`,
              } as CSSProperties
            }
          />
        </picture>
      )}

      {/* 3. The name, top left -- the bottom right belongs to the circles. */}
      <div className="mobile-name-mask">
        <h2 className="mobile-name" data-name>
          {character.name}
        </h2>
      </div>
    </div>
  );
}

type Stage = {
  /** The character on screen, or arriving. */
  id: string;
  /** The one leaving, for as long as a switch is running. */
  from: string | null;
  /** Where the tapped circle was, so its copy can burst there. */
  pop: PopRect | null;
  /** Which character each of the two layers holds. */
  slots: [string | null, string | null];
  /** The layer in front. During a switch that is the one leaving. */
  front: 0 | 1;
};

/** Every circle's position right now, keyed by character. */
function measureCircles(root: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-circle]")) {
    rects.set(el.dataset.id!, el.getBoundingClientRect());
  }
  return rects;
}

/**
 * The whole mobile screen: one character, their wallpaper, their name, and the
 * others as circles along the bottom. There is no unselected state to return
 * to, which is why the choice is persisted rather than re-picked on every load.
 */
export default function MobileCharacterView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  /** Read by the tap handler and by the timeline's onComplete, both of which
      outlive any single render. */
  const lockRef = useRef(false);
  /** Circle positions captured before React reflowed the row. */
  const beforeRef = useRef<Map<string, DOMRect>>(new Map());

  // Read during the first render, not in an effect: this tree only ever renders
  // on the client, so the stored character is on screen from the first paint.
  const [stage, setStage] = useState<Stage>(() => {
    const id = initialSelectedId();
    return { id, from: null, pop: null, slots: [id, null], front: 0 };
  });

  const selected = byId(stage.id);
  const leaving = stage.from ? byId(stage.from) : null;

  useEffect(() => {
    rememberSelectedId(stage.id);
  }, [stage.id]);

  const select = useCallback(
    (id: string) => {
      if (lockRef.current || id === stage.id) return;
      lockRef.current = true;
      // Hold everything until the art is decodable rather than crossfading to a
      // layer with nothing in it. Usually already warm: the picker preloads
      // every circle it renders.
      void preloadMobileStage(id).then(() => {
        const root = rootRef.current;
        if (!root) {
          lockRef.current = false;
          return;
        }
        // Measured now, while the row is still arranged around the old
        // selection. Every slot tween below is a delta from these.
        beforeRef.current = measureCircles(root);
        const tapped = root
          .querySelector<HTMLElement>(`[data-circle][data-id="${id}"]`)
          ?.getBoundingClientRect();

        setStage((s) => {
          const back = (1 - s.front) as 0 | 1;
          const slots: [string | null, string | null] = [...s.slots];
          slots[back] = id;
          return {
            id,
            from: s.id,
            pop: tapped ? { x: tapped.x, y: tapped.y, size: tapped.width } : null,
            slots,
            front: s.front,
          };
        });
      });
    },
    [stage.id],
  );

  // A layout effect, not an effect: the arriving layer is put into its start
  // state in here, and a paint in between would flash the new character at full
  // opacity on top of the old one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { duration, entrance, pop } = MOBILE;

    const layer = (role: "front" | "back") =>
      root.querySelector<HTMLElement>(`[data-layer="${role}"]`);
    const part = (host: HTMLElement | null, sel: string) =>
      host?.querySelector<HTMLElement>(sel) ?? null;

    // The second layer is created by the first switch and then never goes away,
    // so "there is nothing behind" means this is the opening. Read from the DOM
    // rather than latched in a ref: StrictMode runs this effect twice on mount
    // and both passes have to build the same timeline.
    const departing = layer("back") && layer("front");
    const intro = departing === null;
    const arriving = intro ? layer("front") : layer("back");

    const inBg = part(arriving, "[data-bg]");
    const inFull = part(arriving, "[data-full]");
    const inName = part(arriving, "[data-name]");
    const outBg = part(departing, "[data-bg]");
    const outFull = part(departing, "[data-full]");
    const outName = part(departing, "[data-name]");
    const circles = [...root.querySelectorAll<HTMLElement>("[data-circle]")];

    timelineRef.current?.kill();

    if (intro) {
      // Nothing is on screen yet, so everything starts hidden and the timeline
      // waits for the art instead of fading in an empty layer.
      gsap.set(inBg, { autoAlpha: 0 });
      gsap.set(inFull, { autoAlpha: 0, y: reduced ? 0 : entrance.introRise });
      // autoAlpha as well as the mask: the accent glow has a 1.1em blur that
      // bleeds back through the mask even with the text entirely below it.
      gsap.set(inName, { autoAlpha: 0, yPercent: reduced ? 0 : 100 });
      // Cleared before measuring: StrictMode builds this timeline twice, and
      // the second pass would otherwise measure a row the first pass had
      // already pushed off the bottom of the screen and conclude it was home.
      gsap.set(circles, { clearProps: "transform" });
      const below = circles.length
        ? window.innerHeight - circles[0].getBoundingClientRect().top
        : 0;
      gsap.set(circles, reduced ? { autoAlpha: 0 } : { y: below });

      const d = duration.intro;
      const tl = gsap.timeline({ paused: true });
      tl.to(inBg, { autoAlpha: 1, duration: d.bg, ease: "power2.out" }, 0)
        .to(inFull, { autoAlpha: 1, y: 0, duration: d.full, ease: "power3.out" }, d.fullAt)
        .to(
          circles,
          reduced
            ? { autoAlpha: 1, duration: d.circles }
            : {
                y: 0,
                duration: d.circles,
                // Overshoots by a few px and settles. Any more reads as a toy.
                ease: "back.out(1.7)",
                stagger: d.stagger,
              },
          d.circlesAt,
        )
        .to(
          inName,
          reduced
            ? { autoAlpha: 1, duration: d.name }
            : { autoAlpha: 1, yPercent: 0, duration: d.name, ease: "power4.out" },
          d.nameAt,
        );

      timelineRef.current = tl;
      let cancelled = false;
      const start = () => {
        if (!cancelled) tl.play();
      };
      // Whichever comes first: the art, or the patience cap.
      void preloadMobileStage(stage.id).then(start);
      const fallback = window.setTimeout(start, d.wait * 1000);
      return () => {
        cancelled = true;
        window.clearTimeout(fallback);
        tl.kill();
      };
    }

    const d = duration.switch;
    gsap.set(inBg, { autoAlpha: 1 });
    gsap.set(inFull, {
      autoAlpha: 0,
      y: reduced ? 0 : entrance.switchRise,
      scale: reduced ? 1 : entrance.switchScale,
    });
    gsap.set(inName, { autoAlpha: 0, yPercent: reduced ? 0 : 100 });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(circles, { clearProps: "transform,opacity,visibility" });
        lockRef.current = false;
        // Drops the layer that left and the popped circle's copy, and hands the
        // front to the character now on screen.
        setStage((s) => ({ ...s, from: null, pop: null, front: (1 - s.front) as 0 | 1 }));
      },
    });

    // 1. The tapped circle bursts where it stood.
    const disc = root.querySelector<HTMLElement>("[data-pop-disc]");
    const ring = root.querySelector<HTMLElement>("[data-pop-ring]");
    if (disc) {
      tl.to(
        disc,
        reduced
          ? { autoAlpha: 0, duration: d.pop }
          : { scale: pop.disc, autoAlpha: 0, duration: d.pop, ease: "back.in(1.7)" },
        0,
      );
    }
    if (ring && !reduced) {
      tl.fromTo(
        ring,
        { scale: 1, autoAlpha: pop.ringAlpha },
        { scale: pop.ring, autoAlpha: 0, duration: d.ring, ease: "power2.out" },
        0,
      );
    }

    // 2. The row closes over the gap, and the character that just left the
    //    screen returns to its slot, entering from outside the left edge.
    const before = beforeRef.current;
    circles.forEach((el, i) => {
      const was = before.get(el.dataset.id!);
      const now = el.getBoundingClientRect();
      if (!was) {
        const offscreen = -(now.right + MOBILE.gapPx);
        tl.fromTo(
          el,
          { x: reduced ? 0 : offscreen, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: d.reflow, ease: "power3.out" },
          0,
        );
      } else if (!reduced && Math.abs(was.x - now.x) > 0.5) {
        tl.fromTo(
          el,
          { x: was.x - now.x },
          { x: 0, duration: d.reflow, ease: "power3.out" },
          i * d.stagger,
        );
      }
    });

    // 3. At the same time the old wallpaper dissolves into the new one, taking
    //    the old character and name with it. The new wallpaper is already
    //    underneath at full opacity, so no frame is ever empty.
    tl.to(outBg, { autoAlpha: 0, duration: d.fade, ease: "power2.inOut" }, 0)
      .to(outFull, { autoAlpha: 0, duration: d.fade, ease: "power2.in" }, 0)
      .to(
        outName,
        reduced
          ? { autoAlpha: 0, duration: d.nameOut }
          : { yPercent: 100, duration: d.nameOut, ease: "power3.in" },
        0,
      )
      // Out of sight is not enough, for the same reason: kill it once it has
      // cleared the mask, or its glow sits in the corner for the rest of the
      // sequence.
      .set(outName, { autoAlpha: 0 }, d.nameOut);

    // 4. A beat of nothing but the new wallpaper, then the character arrives.
    const arrivesAt = d.fade + d.hold;
    tl.to(
      inFull,
      reduced
        ? { autoAlpha: 1, duration: d.full }
        : { autoAlpha: 1, y: 0, scale: 1, duration: d.full, ease: "power3.out" },
      arrivesAt,
    );

    // 5. The name last, once the character has nearly settled.
    tl.to(
      inName,
      reduced
        ? { autoAlpha: 1, duration: d.name }
        : { autoAlpha: 1, yPercent: 0, duration: d.name, ease: "power4.out" },
      arrivesAt + d.nameGap,
    );

    timelineRef.current = tl;
    return () => {
      tl.kill();
      lockRef.current = false;
      if (timelineRef.current === tl) timelineRef.current = null;
    };
  }, [stage.id]);

  // Rotating the phone invalidates every position the running timeline measured
  // from. Nothing is cached between switches -- the next one measures the row
  // again -- so finishing the current one lands the screen correctly at the new
  // size, which killing it halfway would not.
  useEffect(() => {
    const onResize = () => {
      const tl = timelineRef.current;
      if (tl?.isActive()) tl.progress(1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={rootRef}
      className="mobile-root"
      data-mobile
      data-selected={selected.id}
      style={
        {
          "--m-circle": `clamp(${MOBILE.circle.minPx}px, ${MOBILE.circle.vw}vw, ${MOBILE.circle.maxPx}px)`,
          "--m-gap": `${MOBILE.gapPx}px`,
        } as CSSProperties
      }
    >
      {stage.slots.map((id, i) =>
        id ? (
          <StageLayer key={i} character={byId(id)} role={i === stage.front ? "front" : "back"} />
        ) : null,
      )}

      <CharacterPicker selectedId={selected.id} onSelect={select} />

      {/* The circle that was tapped is the one arriving, not the one leaving:
          the character leaving is the one whose circle returns to the row. */}
      {leaving && stage.pop && <PoppingCircle character={selected} rect={stage.pop} />}
    </div>
  );
}
