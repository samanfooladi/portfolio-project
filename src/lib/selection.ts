import { CHARACTERS } from "@/data/characters";

/**
 * The mobile screen always has a character selected -- there is no lineup to go
 * back to -- so the choice has to survive a reload. Desktop does not use any of
 * this: it opens on the strips every time, by design.
 */

const STORAGE_KEY = "selectedCharacter";

const isKnown = (id: string | null): id is string =>
  CHARACTERS.some((c) => c.id === id);

const randomId = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;

/**
 * The character to open with: the stored one, or a random one on a first visit.
 * A stored id that is no longer in the roster counts as a first visit, so
 * renaming or dropping a character cannot leave the screen pointing at nothing.
 *
 * Meant to be called from a useState initialiser, i.e. during the first client
 * render, so the first paint is already the right character and no other one
 * ever flashes. Storage throws in private modes and with site data blocked;
 * that is read as "nothing stored", never as an error worth surfacing.
 */
export function initialSelectedId(): string {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; fall through to a random pick.
  }
  return isKnown(stored) ? stored : randomId();
}

export function rememberSelectedId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Nothing to do: the pick just will not survive this reload.
  }
}
