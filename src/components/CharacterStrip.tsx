"use client";

import type { CSSProperties } from "react";
import { accentRgba, assets, type Character, TUNING } from "@/data/characters";
import { centerlineAngleDeg, fullFramingFor } from "@/lib/framing";
import GlassSweep from "./GlassSweep";

type Props = {
  character: Character;
  index: number;
  /** Diagonal divider is skipped on the first strip, whose left edge is straight. */
  showDivider: boolean;
  /** First and last strips meet the screen edge with a straight, unleaning cut. */
  straightEdge: boolean;
  debug: boolean;
};

/** Switch to the taller art on tall viewports or hi-dpi screens. */
const TALL = "(min-height: 960px), (min-resolution: 1.5dppx)";

export default function CharacterStrip({
  character,
  index,
  showDivider,
  straightEdge,
  debug,
}: Props) {
  const full = fullFramingFor(character, straightEdge);
  const { fullShadow } = TUNING;

  return (
    <div
      className="strip"
      data-strip
      data-index={index}
      data-id={character.id}
      style={
        {
          "--accent": character.accent,
          "--bg-fx": `${character.bgFocusX}%`,
          "--bg-fy": `${character.bgFocusY}%`,
          "--center-angle": `${centerlineAngleDeg(straightEdge)}deg`,
          ...(full
            ? {
                "--full-w": full.width,
                "--full-h": full.height,
                "--full-top": full.top,
                "--full-dx": full.dx,
                "--full-ox": `${full.originX}%`,
                "--full-oy": `${full.originY}%`,
                "--head-f": full.headF,
                "--head-dx": full.headDx,
              }
            : {}),
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="strip-surface"
        data-surface
        aria-label={`Select ${character.name}`}
      >
        {/* 1. Environment. Fills the whole strip box, including the parts the
            diagonal clips away, so no corner can ever come up empty. It is
            never moved to align the character -- only bgFocusX/Y frame it. */}
        <picture>
          <source type="image/avif" srcSet={assets.bg(character.id, "avif")} />
          <img
            className="strip-bg"
            data-bg
            src={assets.bg(character.id)}
            alt=""
            draggable={false}
          />
        </picture>

        {/* 2. The character. Positioned by measured anchors, not object-fit;
            whatever falls outside the parallelogram is clipped by the surface. */}
        {full && (
          <picture>
            <source
              type="image/avif"
              media={TALL}
              srcSet={assets.full(character.id, 3200, "avif")}
            />
            <source type="image/webp" media={TALL} srcSet={assets.full(character.id, 3200)} />
            <source type="image/avif" srcSet={assets.full(character.id, 1600, "avif")} />
            <img
              className="strip-full"
              data-full
              src={assets.full(character.id, 1600)}
              alt=""
              draggable={false}
              style={
                {
                  filter: `drop-shadow(0 ${fullShadow.offsetY}vh ${fullShadow.blur}vh ${accentRgba(
                    character.accent,
                    fullShadow.alpha,
                  )})`,
                } as CSSProperties
              }
            />
          </picture>
        )}

        {/* 3. Hover sweep. */}
        <GlassSweep />

        {showDivider && <span className="strip-divider" />}
        {debug && <span className="debug-centerline" />}
        {debug && full && <span className="debug-head-dot" />}
      </button>

      {/* Outside the surface, so the clip-path does not hide the wedges the
          diagonal removes -- those still have to be covered by the bg. */}
      {debug && <span className="debug-strip-box" />}
    </div>
  );
}
