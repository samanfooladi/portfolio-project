import { CHARACTERS } from "@/data/characters";

/**
 * Where the selected character lives between renders, reloads and remounts.
 *
 * Two stores, because the two screens mean different things by "selected":
 *
 * - The URL is the desktop's. `?character=<id>` IS the selected state -- a
 *   reload, a remount or a Back all read from or write to it, and the browser's
 *   own back button therefore does exactly what the in-app one does.
 * - localStorage is the mobile screen's. It has no unselected state to return
 *   to, so a first visit has to open on something, and that choice should be
 *   the one it opened on last time rather than a fresh roll of the dice.
 *
 * Neither is read directly by the two trees. <CharacterExperience> owns the
 * selection above the switch between them and hands it down, so crossing the
 * breakpoint carries the character across instead of remounting into whatever
 * a store happens to say.
 */

const STORAGE_KEY = "selectedCharacter";
const PARAM = "character";

export const isKnownId = (id: string | null | undefined): id is string =>
  CHARACTERS.some((c) => c.id === id);

const randomId = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;

/**
 * The character to open the mobile screen with: the stored one, or a random one
 * on a first visit. A stored id that is no longer in the roster counts as a
 * first visit, so renaming or dropping a character cannot leave the screen
 * pointing at nothing.
 *
 * Storage throws in private modes and with site data blocked; that is read as
 * "nothing stored", never as an error worth surfacing.
 */
export function initialSelectedId(): string {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; fall through to a random pick.
  }
  return isKnownId(stored) ? stored : randomId();
}

export function rememberSelectedId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Nothing to do: the pick just will not survive this reload.
  }
}

/**
 * The character named by the current URL, if it names a real one.
 *
 * An id that is not in the roster -- a typo, or a link to a character that has
 * since been dropped -- is treated as no selection at all, and the caller is
 * expected to clear the param so the address bar stops claiming otherwise.
 */
export function characterFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get(PARAM);
  return isKnownId(id) ? id : null;
}

/** True when the URL carries a `character` param, valid or not. */
export function hasCharacterParam(): boolean {
  return new URLSearchParams(window.location.search).has(PARAM);
}

function urlWith(id: string | null): string {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Marks the history entries this app pushed. Back only has an entry of its own
 * to return to when a selection put one there; arriving on `?character=` by
 * link, reload or a resize across the breakpoint did not, and Back has to
 * rewrite the current entry instead of walking off the site.
 */
type SelectionHistoryState = { characterPushed?: true };

export function pushCharacterParam(id: string): void {
  const state: SelectionHistoryState = { characterPushed: true };
  window.history.pushState(state, "", urlWith(id));
}

/** Rewrites the current entry. Used where a new one would be wrong: the opening
    load, a breakpoint crossing, and clearing a param nobody pushed. */
export function replaceCharacterParam(id: string | null): void {
  window.history.replaceState(window.history.state, "", urlWith(id));
}

export function pushedSelection(): boolean {
  return (window.history.state as SelectionHistoryState | null)?.characterPushed === true;
}
