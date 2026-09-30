import { anchorsFor } from "./framing";

/**
 * The bits of a story chapter that have to agree with what `npm run images`
 * actually produced, and the one piece of text handling the data deliberately
 * does not carry: where the character's own name sits inside a line.
 */

/**
 * `front` is the only pose with no file of its own. It is the Full view the
 * lineup already ships -- the same artwork -- so it is reused rather than
 * built and stored twice.
 */
export const isSharedPose = (key: string) => key === "front";

/** Trimmed width / height of a pose, or null if the build never wrote one. */
export function poseAspect(id: string, key: string): number | null {
  const a = anchorsFor(id);
  return isSharedPose(key) ? a.fullAspect : (a.poses?.[key]?.aspect ?? null);
}

/**
 * Whether there is art to show. Not theoretical: a pose delivered on an opaque
 * background is skipped by the build, so a chapter can legitimately name a pose
 * that does not exist yet. Its text still stands; only the figure is missing.
 */
export const hasPose = (id: string, key: string) => poseAspect(id, key) != null;

export type Segment = { text: string; isName: boolean };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Cuts a line at every occurrence of the character's own name, so the renderer
 * can style it without the chapter data carrying markup -- write plain prose in
 * `stories/<id>.ts` and the name styles itself.
 *
 * Whole words only, which is what lets "Foxy's" match while leaving the "'s"
 * alone, and case-insensitive with the matched text kept as written, so a name
 * shouted in a tagline still lands.
 */
export function splitOnName(text: string, name: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(`\\b${escapeRe(name)}\\b`, "gi"))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isName: false });
    out.push({ text: m[0], isName: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), isName: false });
  return out;
}
