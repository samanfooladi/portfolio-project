import type { Chapter } from "./types";

/**
 * Foxy's four chapters. Everything here is taken from her two reference sheets
 * in `assets-source/foxy/` -- nothing is invented, so if a fact looks wrong it
 * is wrong on the sheet too.
 *
 * Her own name is styled where it appears; the text below stays plain, and the
 * renderer is what picks "Foxy" out of it. Other names, Reina's included, are
 * left alone.
 */
export const FOXY_STORY: Chapter[] = [
  {
    id: "identity",
    pose: "front",
    poseKind: "full",
    title: "Foxy",
    body: [
      "Cunning. Detached. Precise. Observant.",
      "“I don’t need luck. I read people.”",
      "Species: Fox-Hybrid (fox ears and tail)",
      "Height: 168 cm",
      "Role: Casino Host / Card-Shuffle Master",
      "Alignment: Neutral",
      "Reina’s right hand.",
    ],
  },
  {
    id: "personality",
    pose: "tea",
    poseKind: "full",
    title: "Character Notes",
    body: [
      "Foxy is Reina’s right hand and the casino’s most trusted host.",
      "A card-shuffle master whose precision masks a mind that is always three moves ahead.",
      "She speaks rarely — her gaze does the talking.",
      "She catches people before they catch on.",
      "Eyes. Pulse. Fingers. Bets. Truth leaks. Foxy takes.",
    ],
  },
  {
    id: "power",
    pose: "bullet-tail",
    poseKind: "full",
    title: "Fox Physiology and Bullet-Tail Defense",
    body: [
      "Fox senses: night vision, enhanced smell, acute hearing, heightened balance, stealth.",
      "Predatory tracking and behavioral reading.",
      "Bullet-tail defense and tail utility.",
      "Low-signature combat and weapon redirection.",
      "Redirect. Unbalance. Create opportunity. End quietly.",
    ],
  },
  {
    id: "stats",
    pose: "profile",
    poseKind: "bust",
    title: "Stats",
    body: [
      "Strength: A-",
      "Speed: A",
      "Agility: A+",
      "Senses: S",
      "Intelligence: A",
      "Tail control: A+",
      "Heavy automatic fire, explosive ammunition, or multi-directional attacks can overwhelm the tail; tail damage disrupts balance and mobility.",
    ],
  },
];
