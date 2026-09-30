"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TUNING } from "@/data/characters";
import {
  characterFromUrl,
  hasCharacterParam,
  initialSelectedId,
  pushCharacterParam,
  pushedSelection,
  replaceCharacterParam,
} from "@/lib/selection";
import CharacterSelect from "./CharacterSelect";
import MobileCharacterView from "./MobileCharacterView";

const MOBILE_QUERY = `(max-width: ${TUNING.mobileBreakpoint - 1}px)`;

/**
 * How the desktop tree should arrive at the selected state.
 *
 * `animate` is the full sequence: strips leave, the bg wipes across, the
 * close-up and the name rise. It is only ever right when the strips are
 * actually on screen to leave.
 *
 * `immediate` is everything already in place, faded up. That is the honest
 * reading of a reload on `?character=`, of a link to one, and of a resize back
 * across the breakpoint -- in none of those was there a lineup to sweep away,
 * and playing one would invent a transition the user never triggered.
 */
export type EntryMode = "animate" | "immediate";

/**
 * Chooses between the two trees, and owns the selected character above them.
 *
 * The trees share the roster and the measured anchors and nothing else -- the
 * strips, the hover and the selection sequence are desktop only, and the mobile
 * screen is not a narrower version of them. So crossing the breakpoint really
 * does unmount one and mount the other, and anything held inside either one
 * would not survive it. The selection is therefore held here, above the switch,
 * and handed down.
 *
 * Its durable home is the URL: `?character=<id>` is what the desktop selected
 * state IS, which is what makes it survive a reload, a remount, and a devtools
 * pane that drags the viewport across the breakpoint and back. It also gets the
 * browser's back button for free, since the in-app Back is routed through
 * history rather than run alongside it.
 *
 * Neither tree is rendered on the server. The viewport is not knowable there,
 * and rendering the strips by default would cost a phone eight backgrounds and
 * eight Full views before the mobile tree could replace them.
 */
export default function CharacterExperience() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  /** The single source of truth. `null` means the desktop select screen; the
      mobile tree is never handed one, since it has no unselected state. */
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryMode>("immediate");

  /** Read by the breakpoint listener, which outlives the render it was
      attached in and must not be rebuilt every time the character changes. */
  const characterRef = useRef<string | null>(null);
  useEffect(() => {
    characterRef.current = characterId;
  }, [characterId]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    /** `null` until the first run: the viewport was not knowable before it. */
    let wasMobile: boolean | null = null;

    const apply = () => {
      const nowMobile = mq.matches;
      // matchMedia only fires on a crossing, but the opening call comes through
      // here too and a re-attach after StrictMode's double mount would repeat
      // the last one.
      if (wasMobile === nowMobile) return;
      const opening = wasMobile === null;
      wasMobile = nowMobile;
      setIsMobile(nowMobile);

      if (opening) {
        // Whatever the URL names decides the opening state. Batched with
        // setIsMobile above, so the tree's first render already has it.
        const fromUrl = characterFromUrl();
        if (!fromUrl && hasCharacterParam()) {
          // Names a character that is not in the roster. Show the select
          // screen and stop the address bar claiming otherwise.
          replaceCharacterParam(null);
        }
        // Desktop opens on the select screen unless the URL says otherwise --
        // the mobile screen's remembered choice is not a desktop selection.
        // The mobile tree has no such state, so it always opens on someone.
        setCharacterId(fromUrl ?? (nowMobile ? initialSelectedId() : null));
        setEntry("immediate");
        return;
      }

      // A crossing inside one session. The character comes along; only the
      // screen around it changes, so nothing is replayed at the far side.
      setEntry("immediate");
      if (nowMobile) {
        // The param is the desktop's. Going the other way the mobile tree
        // writes its own store, from the id it mounts with.
        replaceCharacterParam(null);
        if (!characterRef.current) setCharacterId(initialSelectedId());
      } else if (characterRef.current) {
        // Not a push: a resize is not a navigation, and Back must still lead
        // out of the selected state rather than back to this same width.
        replaceCharacterParam(characterRef.current);
      }
    };

    apply();
    // Also covers rotating a phone into landscape, which is wide enough to be
    // the desktop tree.
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // The browser's back and forward buttons, which are the same thing as the
  // in-app Back: it does not clear the selection itself, it walks history and
  // lets this put the state back in sync.
  useEffect(() => {
    const onPop = () => {
      const id = characterFromUrl();
      // Coming back to a character means the strips are on screen to sweep
      // away, so the forward direction gets the full sequence.
      setEntry(id ? "animate" : "immediate");
      setCharacterId(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setEntry("animate");
    setCharacterId(id);
    pushCharacterParam(id);
  }, []);

  const handleBack = useCallback(() => {
    // Routed through history so the in-app button and the browser's own take
    // exactly the same path. Without an entry of our own to return to -- a
    // reload on `?character=`, a shared link, a resize across the breakpoint --
    // going back would leave the site, so the current entry is rewritten.
    if (pushedSelection()) {
      window.history.back();
      return;
    }
    replaceCharacterParam(null);
    setCharacterId(null);
  }, []);

  /** The mobile tree reports its own switches, so a later crossing back to the
      desktop lands on the character actually on screen. */
  const handleMobileSelect = useCallback((id: string) => setCharacterId(id), []);

  if (isMobile === null) return null;
  return isMobile ? (
    <MobileCharacterView initialId={characterId ?? initialSelectedId()} onSelect={handleMobileSelect} />
  ) : (
    <CharacterSelect
      selectedId={characterId}
      entry={entry}
      onSelect={handleSelect}
      onBack={handleBack}
    />
  );
}
