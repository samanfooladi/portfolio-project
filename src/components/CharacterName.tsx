"use client";

import type { CSSProperties } from "react";
import { accentRgba, type Character } from "@/data/characters";

type Props = { character: Character };

/**
 * Bottom-right name. The mask is exactly the text's box, so the h2 sitting at
 * yPercent: 100 is completely hidden until the timeline raises it. Uppercase
 * display type has no descenders, so no padding is needed to clear the mask.
 */
export default function CharacterName({ character }: Props) {
  return (
    <div className="stage-name-mask" aria-hidden="true">
      <h2
        className="stage-name"
        data-name
        style={
          {
            "--accent": character.accent,
            "--accent-glow": accentRgba(character.accent, 0.55),
          } as CSSProperties
        }
      >
        {character.name}
      </h2>
    </div>
  );
}
