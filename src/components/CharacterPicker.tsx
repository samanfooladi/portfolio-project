"use client";

import { useEffect, type CSSProperties } from "react";
import { accentRgba, assets, type Character, CHARACTERS, MOBILE } from "@/data/characters";
import { preloadMobileStage } from "@/lib/sources";

/** Where a tapped circle was, in viewport coordinates, so its copy can pop in
    place after the row has already closed the gap. */
export type PopRect = { x: number; y: number; size: number };

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Delay before the background warming starts. requestIdleCallback would be the
    right tool and is still missing on iOS, which is most of this screen's
    traffic; a short timeout keeps the first paint to itself either way. */
const WARM_DELAY = 400;

const circleVars = (c: Character) =>
  ({
    "--accent": c.accent,
    "--accent-glow": accentRgba(c.accent, 0.5),
  }) as CSSProperties;

/** The head inside a circle. Shared by the row and by the copy that pops. */
function Avatar({ character }: { character: Character }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- the build script
       already writes these at exactly the two sizes rendered here; next/image
       would re-encode a file that needs nothing. */
    <img
      className="picker-avatar"
      src={assets.avatar(character.id, 256)}
      srcSet={`${assets.avatar(character.id, 256)} 256w, ${assets.avatar(character.id, 512)} 512w`}
      sizes={`${MOBILE.circle.maxPx}px`}
      alt=""
      draggable={false}
    />
  );
}

/**
 * The copy of a tapped circle that bursts. The real one is gone by the time
 * this renders -- the row has already reflowed around its absence -- so this is
 * positioned at the rect the real one occupied, and fixed rather than parented
 * to the row, whose scroll container would clip it.
 */
export function PoppingCircle({ character, rect }: { character: Character; rect: PopRect }) {
  return (
    <span
      className="picker-pop"
      data-pop
      aria-hidden="true"
      style={{ ...circleVars(character), left: rect.x, top: rect.y, width: rect.size, height: rect.size }}
    >
      <span className="picker-circle picker-circle--pop" data-pop-disc>
        <Avatar character={character} />
      </span>
      <span className="picker-pop-ring" data-pop-ring />
    </span>
  );
}

/**
 * The row of heads along the bottom edge. Every character except the one on
 * screen, in roster order -- selecting removes a circle and returns another, it
 * never reorders the rest.
 */
export default function CharacterPicker({ selectedId, onSelect }: Props) {
  const others = CHARACTERS.filter((c) => c.id !== selectedId);
  const ids = others.map((c) => c.id).join(" ");

  // Warm what a tap will need. preloadMobileStage dedupes, so re-running this
  // after a selection only picks up the character that just left the screen.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const id of ids.split(" ")) void preloadMobileStage(id);
    }, WARM_DELAY);
    return () => window.clearTimeout(t);
  }, [ids]);

  return (
    <div className="mobile-picker" data-picker>
      {others.map((c) => (
        <button
          key={c.id}
          type="button"
          className="picker-circle"
          data-circle
          data-id={c.id}
          onClick={() => onSelect(c.id)}
          aria-label={`Select ${c.name}`}
          style={circleVars(c)}
        >
          <Avatar character={c} />
        </button>
      ))}
    </div>
  );
}
