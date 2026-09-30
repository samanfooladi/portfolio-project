import type { Chapter } from "./types";

/**
 * Sam's four chapters, ordered the way his power sheet reads: what he is, the
 * high, what the high costs, and what is underneath it.
 *
 * Everything here is taken from his two reference sheets in `assets-source/sam/`
 * -- nothing is invented, so if a fact looks wrong it is wrong on the sheet too.
 *
 * His own name is styled where it appears; the text below stays plain, and the
 * renderer is what picks "Sam" out of it.
 */
export const SAM_STORY: Chapter[] = [
  {
    id: "identity",
    pose: "shirtless",
    poseKind: "full",
    title: "Sam",
    body: [
      "Hype energy always on. Caring, roots for everyone.",
      "“I act like I’ve always got it together, but honestly I just want everyone around me doing okay. Give me a guitar, a game of CS2, a hard workout, and good people — I’m all in.”",
      "Age: 22",
      "Height: 175 cm",
      "Personality: ENFJ",
      "Plays electric guitar and tombak.",
      "Favorite game CS2, also loves Undertale.",
      "Crossfit gym regular.",
      "A people-pleaser under the confidence.",
    ],
  },
  {
    id: "power",
    pose: "charge",
    poseKind: "full",
    title: "Thrill Drive",
    body: [
      "Excitement, danger and competition amplify strength, speed, reflexes, endurance and pain tolerance.",
      "Battle-flow acceleration sharpens reaction time and pattern-reading.",
      "Momentum conversion: their force, his direction, his attack.",
      "At peak intensity, Sam keeps fighting through damage that would normally stop him.",
      "Hit me harder. I don’t flinch. I don’t stop. I want more.",
      "I live for this. This is me.",
    ],
  },
  {
    id: "cost",
    pose: "crash",
    poseKind: "full",
    title: "The Crash",
    body: [
      "Pain is delayed, not erased.",
      "Exhaustion and accumulated damage return sharply once the excitement fades.",
      "A dull, slow, highly controlled opponent can deny Sam the emotional fuel he needs.",
      "The high fades. The cost hits hard. Every. Time.",
    ],
  },
  {
    id: "behind-the-mask",
    pose: "face-scar",
    poseKind: "bust",
    title: "Behind the Mask",
    body: [
      "People-pleaser mode: on. Confidence. Charm. All smiles. I’m all in.",
      "Not everyone sees this side. I’m not great at this. But I try.",
      "Thrill is my edge. But the crash is real. I accept both.",
    ],
  },
];
