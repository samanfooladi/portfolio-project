import { assets } from "@/data/characters";

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

export const closeupSources = (id: string): PictureSource[] => [
  { type: "image/avif", media: TALL_MEDIA, srcSet: assets.closeup(id, 2400, "avif") },
  { type: "image/webp", media: TALL_MEDIA, srcSet: assets.closeup(id, 2400) },
  { type: "image/avif", srcSet: assets.closeup(id, 1400, "avif") },
];
export const closeupFallback = (id: string) => assets.closeup(id, 1400);

const cache = new Map<string, Promise<void>>();

/**
 * Warms one layer by building a real, detached <picture>. Guessing a URL would
 * not do: which of avif/webp and which size the browser picks depends on format
 * support and the media queries, and only a real <picture> resolves that the
 * same way the rendered one will.
 */
function warm(sources: PictureSource[], fallback: string): Promise<void> {
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
    picture.append(img);
    host.append(picture);
    document.body.append(host);
    // Set src only once it is in the document, so source selection has run.
    img.src = fallback;
  });
}

/**
 * Preloads everything the selected state needs. Called on hover, awaited on
 * click, so a click that lands before the art is ready simply waits.
 */
export function preloadStage(id: string): Promise<void> {
  let p = cache.get(id);
  if (!p) {
    p = Promise.all([
      warm(bgSources(id), bgFallback(id)),
      warm(closeupSources(id), closeupFallback(id)),
    ]).then(() => undefined);
    cache.set(id, p);
  }
  return p;
}
