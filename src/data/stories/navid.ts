import type { Chapter } from "./types";
import { NAVID_PLAN_GEOMETRY } from "./overlays/navid-plan";

/**
 * Navid's four chapters: who he is, what the sense gives him, what he makes of
 * it, and where it runs out.
 *
 * Everything here is taken from his two reference sheets in
 * `assets-source/navid/` with one deliberate exception: the character sheet
 * gives his height as 183 cm and the power sheet as 171 cm. 171 is correct, so
 * that is the number used, and the character sheet's is ignored.
 *
 * His own name is styled where it appears; the text below stays plain, and the
 * renderer is what picks "Navid" out of it.
 */
export const NAVID_STORY: Chapter[] = [
  {
    id: "identity",
    pose: "stand",
    poseKind: "full",
    title: "Navid",
    body: [
      "Analytical. Guarded. Confident. Introspective.",
      "Age: 22",
      "Height: 171 cm",
      "Build: Lean athletic",
      "Type: INTJ",
      "Gaming, football, coding.",
      "Calm exterior. Constant awareness.",
    ],
  },
  {
    id: "sense",
    pose: "sense",
    poseKind: "bust",
    title: "Omen Sense",
    body: [
      "Navid senses an imminent severe disaster as dread, physical pressure, a cold sensation or ringing.",
      "A cold pressure. A distant ringing. Something is wrong.",
      "It is not precognition. It gives no source, no direction, no timing and no solution.",
      "The Snap: the onset. Half a second is all it gives.",
    ],
  },
  {
    id: "planning",
    pose: "plan",
    poseKind: "full",
    title: "Interpret & Plan",
    body: [
      "The signal only becomes useful through Navid’s own tactical interpretation.",
      "He translates it into angles, routes and options.",
      "Brief warning flashes in combat enable evasive, kick-based counters known as Pocket Step.",
      "Pocket Step: minimal motion, maximum evasion.",
      "Short window. Clean line. He answers.",
    ],
    overlay: { kind: "geometry", figures: NAVID_PLAN_GEOMETRY },
  },
  {
    id: "limits",
    pose: "evade",
    poseKind: "full",
    title: "Not Enough",
    body: [
      "Minor harm may produce no warning at all.",
      "Multiple simultaneous threats can overload or blur the signal.",
      "Some hits get through. It’s on him.",
      "The sense says something is wrong without saying which choice is right.",
    ],
  },
];
