import type { Chapter } from "./types";
import { FOXY_STORY } from "./foxy";
import { NAVID_STORY } from "./navid";
import { SAM_STORY } from "./sam";

/**
 * Who has a story. A character missing from here has no chapters, and no
 * chapters means no scroll at all: their selected state is exactly what it was
 * before the stories existed.
 */
const STORIES: Record<string, Chapter[]> = {
  foxy: FOXY_STORY,
  sam: SAM_STORY,
  navid: NAVID_STORY,
};

export function chaptersFor(id: string): Chapter[] {
  return STORIES[id] ?? [];
}

export function hasStory(id: string): boolean {
  return chaptersFor(id).length > 0;
}

export type { Chapter };
export { STORY, SNAP_TO_CHAPTERS } from "./config";
