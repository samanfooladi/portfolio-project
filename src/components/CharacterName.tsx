"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import {
  darken,
  deepestStop,
  NAME,
  nameStops,
  type Character,
} from "@/data/characters";

type Props = {
  character: Character;
  /**
   * Which corner this is. Only the placement differs -- the lettering is the
   * same on both -- but the pointer tilt is desktop-only, so the component has
   * to know which screen it is on.
   */
  place: "stage" | "mobile";
};

/**
 * The character's name as 3D lettering: their own gradient across the face,
 * and a stack of flat copies behind it standing in for the extrusion.
 *
 * `text-shadow` is not available here. The face is a gradient clipped to the
 * glyphs, which means `color: transparent`, and a transparent glyph casts
 * nothing. So every layer of depth is a real copy of the text, offset a pixel
 * further down and right than the one in front of it and tinted a little
 * darker. Only the face carries the name; the copies are all aria-hidden.
 *
 * The mask around it is exactly this element's box, padding included, so the
 * h2 at yPercent: 100 is completely hidden until the timeline raises it -- and
 * that padding is what keeps the mask off the extrusion and the tilt once it
 * has landed.
 */
export default function CharacterName({ character, place }: Props) {
  const tiltRef = useRef<HTMLSpanElement>(null);
  const { tilt } = NAME;

  // The pointer tilt. Desktop only, and only where a fine pointer is actually
  // driving -- a touch device would leave the name frozen at whatever angle the
  // last tap happened to be at.
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || place !== "stage") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !fine) return;

    // GSAP owns the transform from here, so it starts from the same angles the
    // stylesheet set rather than snapping to zero on the first move.
    gsap.set(el, { rotationX: tilt.x, rotationY: tilt.y });

    const opts = { duration: tilt.ease, ease: "power3.out" } as const;
    const toX = gsap.quickTo(el, "rotationX", opts);
    const toY = gsap.quickTo(el, "rotationY", opts);

    const onMove = (e: PointerEvent) => {
      // -1 to 1 across the viewport, so the lean is to where the pointer is on
      // screen rather than to where it is relative to the name -- the name sits
      // in a corner, and tracking it from there would mostly read as one-sided.
      const dx = (e.clientX / window.innerWidth) * 2 - 1;
      const dy = (e.clientY / window.innerHeight) * 2 - 1;
      // Pointer below centre lifts the near edge, which is the direction that
      // reads as the letters turning to face it.
      toX(tilt.x - dy * tilt.follow);
      toY(tilt.y + dx * tilt.follow);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf(el);
    };
  }, [place, tilt]);

  const deep = deepestStop(character.nameGradient);

  const vars = {
    "--cn-stops": nameStops(character.nameGradient),
    "--cn-outline": darken(deep, NAME.outline.darken, NAME.outline.alpha),
    "--cn-outline-w": `${NAME.outline.width}px`,
    "--cn-shadow": `rgb(0 0 0 / ${NAME.shadow.alpha})`,
    "--cn-shadow-x": `${NAME.shadow.x}px`,
    "--cn-shadow-y": `${NAME.shadow.y}px`,
    "--cn-shadow-blur": `${NAME.shadow.blur}px`,
    "--cn-perspective": `${tilt.perspective}px`,
    "--cn-rx": `${tilt.x}deg`,
    "--cn-ry": `${tilt.y}deg`,
  } as CSSProperties;

  // Far to near, so the nearest copy paints last and sits directly under the
  // face. The index is both the offset in px and how far down the ramp the
  // copy's tint is taken.
  const depth = Array.from({ length: NAME.layers }, (_, i) => NAME.layers - i);

  return (
    <div className={`cname-mask cname-mask--${place}`}>
      <h2 className="cname" data-name style={vars}>
        <span className="cname-3d">
          <span className="cname-tilt" ref={tiltRef}>
            <span className="cname-copy cname-shadow" aria-hidden="true">
              {character.name}
            </span>
            {depth.map((i) => (
              <span
                key={i}
                className="cname-copy"
                aria-hidden="true"
                style={{
                  transform: `translate(${i}px, ${i}px)`,
                  color: darken(deep, NAME.depth.near + (i / NAME.layers) * NAME.depth.ramp),
                }}
              >
                {character.name}
              </span>
            ))}
            <span className="cname-face">{character.name}</span>
          </span>
        </span>
      </h2>
    </div>
  );
}
