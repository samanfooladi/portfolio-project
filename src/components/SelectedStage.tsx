"use client";

import type { CSSProperties } from "react";
import { accentRgba, type Character, TUNING } from "@/data/characters";
import { anchorsFor, closeupFramingFor } from "@/lib/framing";
import {
  bgFallback,
  bgSources,
  closeupFallback,
  closeupSources,
} from "@/lib/sources";
import BackButton from "./BackButton";
import CharacterName from "./CharacterName";

type Props = {
  character: Character;
  onBack: () => void;
  debug: boolean;
};

const renderSources = (sources: { type: string; srcSet: string; media?: string }[]) =>
  sources.map((s) => (
    <source key={s.type + (s.media ?? "")} type={s.type} media={s.media} srcSet={s.srcSet} />
  ));

/**
 * Everything the selected state adds on top of the strips.
 *
 * Rendered BEFORE the strips in the DOM so the base layer paints underneath
 * them without needing a negative z-index; the layers that must sit on top
 * carry explicit z-indexes instead.
 */
export default function SelectedStage({ character, onBack, debug }: Props) {
  const cu = closeupFramingFor(character);
  const a = anchorsFor(character.id);
  const { fullShadow, wipe } = TUNING;

  const bgVars = {
    "--bg-fx": `${character.bgFocusX}%`,
    "--bg-fy": `${character.bgFocusY}%`,
  } as CSSProperties;

  return (
    <div className="stage" data-stage>
      {/* Under the strips. Whatever they vacate on their way out shows the
          character's own environment, dimmed -- never black. Dimming also gives
          the wipe on top something to actually reveal, in both directions. */}
      <div className="stage-bg stage-bg--base" data-stage-base style={bgVars}>
        <picture>
          {renderSources(bgSources(character.id))}
          <img src={bgFallback(character.id)} alt="" draggable={false} />
        </picture>
      </div>

      {/* Over the strips. Swept in left to right by a feathered mask. */}
      <div
        className="stage-bg stage-bg--wipe"
        data-stage-wipe
        style={{ ...bgVars, "--wipe": -wipe.feather, "--wipe-feather": wipe.feather } as CSSProperties}
      >
        <picture>
          {renderSources(bgSources(character.id))}
          <img src={bgFallback(character.id)} alt="" draggable={false} />
        </picture>
      </div>

      {cu && (
        <picture>
          {renderSources(closeupSources(character.id))}
          <img
            className="stage-closeup"
            data-closeup
            src={closeupFallback(character.id)}
            alt=""
            draggable={false}
            style={
              {
                "--cu-w": cu.width,
                "--cu-h": cu.height,
                "--cu-dx": cu.dx,
                "--cu-ox": `${(a.closeupHeadCenterX ?? 0.5) * 100}%`,
                filter: `drop-shadow(0 ${fullShadow.offsetY}vh ${fullShadow.blur * 1.5}vh ${accentRgba(
                  character.accent,
                  fullShadow.alpha,
                )})`,
              } as CSSProperties
            }
          />
        </picture>
      )}

      <CharacterName character={character} />
      <BackButton onBack={onBack} />

      {debug && <span className="debug-screen-center" />}
    </div>
  );
}
