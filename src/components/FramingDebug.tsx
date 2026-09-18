"use client";

import { CHARACTERS, FRAMING } from "@/data/characters";
import { anchorsFor } from "@/lib/framing";

/**
 * Dev-only (press G). The per-strip pieces -- centreline, head dot, bounding
 * box -- live inside each strip because they follow that strip's own geometry;
 * this draws the things that span the whole screen.
 */
export default function FramingDebug() {
  return (
    <div className="framing-debug" aria-hidden="true">
      <span className="framing-line framing-line--head">
        head line · {FRAMING.headTopVh}vh · full height {FRAMING.fullHeightVh}vh
      </span>
      <div className="framing-readout">
        <span className="framing-readout__key">
          <i className="swatch swatch--center" /> centreline
          <i className="swatch swatch--dot" /> head anchor
          <i className="swatch swatch--box" /> strip box
        </span>
        {CHARACTERS.map((c) => {
          const a = anchorsFor(c.id);
          return (
            <span key={c.id}>
              {c.name}: full {a.fullHeadCenterX ?? "—"} · closeup{" "}
              {a.closeupHeadCenterX ?? "—"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
