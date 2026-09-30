import { assets } from "@/data/characters";
import { hasPose, isSharedPose } from "@/lib/story";

/**
 * One definition of each layer's <picture> sources, used both by the components
 * and by the preloader. They must not drift: the preloader only warms the cache
 * if it requests the byte-identical file the component will later ask for.
 */

export type PictureSource = { type: string; srcSet: string; media?: string };

/** Switch to the taller art on tall viewports or hi-dpi screens. */
export const TALL_MEDIA = "(min-height: 960px), (min-resolution: 1.5dppx)";

export const bgSources = (id: string): PictureSource[] => [
  { type: "image/avif", srcSet: assets.bg(id, "avif") },
];
export const bgFallback = (id: string) => assets.bg(id);

export const fullSources = (id: string): PictureSource[] => [
  { type: "image/avif", media: TALL_MEDIA, srcSet: assets.full(id, 3200, "avif") },
  { type: "image/webp", media: TALL_MEDIA, srcSet: assets.full(id, 3200) },
  { type: "image/avif", srcSet: assets.full(id, 1600, "avif") },
];
export const fullFallback = (id: string) => assets.full(id, 1600);

/**
 * What the mobile stage asks for. It never reaches for the 3200-tall art: a
 * phone renders the Full view around 700 CSS px, the 1600 file is still more
 * than twice that, and the picker warms every other character in the
 * background -- where the difference is megabytes, not pixels.
 */
export const mobileFullSources = (id: string): PictureSource[] => [
  { type: "image/avif", srcSet: assets.full(id, 1600, "avif") },
];
export const mobileFullFallback = (id: string) => assets.full(id, 1600);

export const closeupSources = (id: string): PictureSource[] => [
  { type: "image/avif", media: TALL_MEDIA, srcSet: assets.closeup(id, 2400, "avif") },
  { type: "image/webp", media: TALL_MEDIA, srcSet: assets.closeup(id, 2400) },
  { type: "image/avif", srcSet: assets.closeup(id, 1400, "avif") },
];
export const closeupFallback = (id: string) => assets.closeup(id, 1400);

/**
 * A story pose. `front` is the Full view under another name -- same artwork,
 * same files -- so it resolves straight to the layer the lineup already warms
 * and the browser never fetches a second copy of it.
 */
export const poseSources = (id: string, key: string): PictureSource[] =>
  isSharedPose(key)
    ? fullSources(id)
    : [
        { type: "image/avif", media: TALL_MEDIA, srcSet: assets.pose(id, key, 3200, "avif") },
        { type: "image/webp", media: TALL_MEDIA, srcSet: assets.pose(id, key, 3200) },
        { type: "image/avif", srcSet: assets.pose(id, key, 1600, "avif") },
      ];

export const poseFallback = (id: string, key: string) =>
  isSharedPose(key) ? fullFallback(id) : assets.pose(id, key, 1600);

const cache = new Map<string, Promise<void>>();

/**
 * Warms one layer by building a real, detached <picture>. Guessing a URL would
 * not do: which of avif/webp and which size the browser picks depends on format
 * support and the media queries, and only a real <picture> resolves that the
 * same way the rendered one will.
 */
function warm(
  sources: PictureSource[],
  fallback: string,
  priority: "auto" | "low" = "auto",
): Promise<void> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none";

    const picture = document.createElement("picture");
    for (const s of sources) {
      const el = document.createElement("source");
      el.type = s.type;
      if (s.media) el.media = s.media;
      el.srcset = s.srcSet;
      picture.append(el);
    }

    const img = document.createElement("img");
    const done = () => {
      host.remove();
      resolve();
    };
    img.addEventListener("load", done, { once: true });
    // A failed preload must not wedge the click; the <img> will retry and the
    // dev bg-coverage check reports a missing file separately.
    img.addEventListener("error", done, { once: true });
    img.fetchPriority = priority;
    picture.append(img);
    host.append(picture);
    document.body.append(host);
    // Set src only once it is in the document, so source selection has run.
    img.src = fallback;
  });
}

/** Keyed by screen as well as id: the two stages warm different layers. */
function once(key: string, start: () => Promise<void>): Promise<void> {
  let p = cache.get(key);
  if (!p) {
    p = start();
    cache.set(key, p);
  }
  return p;
}

/**
 * Preloads everything the selected state needs. Called on hover, awaited on
 * click, so a click that lands before the art is ready simply waits.
 */
export function preloadStage(id: string): Promise<void> {
  return once(`stage:${id}`, () =>
    Promise.all([
      warm(bgSources(id), bgFallback(id)),
      warm(closeupSources(id), closeupFallback(id)),
    ]).then(() => undefined),
  );
}

/**
 * The mobile equivalent: the two layers a tap swaps. Started from the picker
 * the first time a circle renders, at low priority so it queues behind the
 * character actually on screen, and awaited on tap.
 */
export function preloadMobileStage(id: string): Promise<void> {
  return once(`mobile:${id}`, () =>
    Promise.all([
      warm(bgSources(id), bgFallback(id), "low"),
      warm(mobileFullSources(id), mobileFullFallback(id), "low"),
    ]).then(() => undefined),
  );
}

/**
 * Every pose a character's chapters can show, warmed in one go the moment they
 * are selected. All of them sit in the DOM at once and the story crossfades
 * between them under the scroll position, so one arriving late would not read
 * as a slow image -- it would be a hole in the middle of a transition.
 *
 * A chapter naming a pose the build never wrote is skipped rather than
 * requested: `npm run images` already reports the missing file, and a 404 per
 * pose per selection would only bury it.
 */
export function preloadPoses(id: string, keys: string[]): Promise<void> {
  const real = keys.filter((key) => hasPose(id, key));
  return once(`poses:${id}`, () =>
    Promise.all(real.map((key) => warm(poseSources(id, key), poseFallback(id, key)))).then(
      () => undefined,
    ),
  );
}
