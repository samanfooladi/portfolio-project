"use client";

import { useEffect, useState } from "react";
import { TUNING } from "@/data/characters";
import CharacterSelect from "./CharacterSelect";
import MobileCharacterView from "./MobileCharacterView";

const MOBILE_QUERY = `(max-width: ${TUNING.mobileBreakpoint - 1}px)`;

/**
 * Chooses between the two trees. They share the roster and the measured anchors
 * and nothing else -- the strips, the hover and the selection sequence are
 * desktop only, and the mobile screen is not a narrower version of them.
 *
 * Neither is rendered on the server. The viewport is not knowable there, and
 * rendering the strips by default would cost a phone eight backgrounds and
 * eight Full views before the mobile tree could replace them.
 */
export default function CharacterExperience() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mq.matches);
    apply();
    // Also covers rotating a phone into landscape, which is wide enough to be
    // the desktop tree.
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (isMobile === null) return null;
  return isMobile ? <MobileCharacterView /> : <CharacterSelect />;
}
