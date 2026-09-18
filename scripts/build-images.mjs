#!/usr/bin/env node
/**
 * Rebuilds the character art from `assets-source/` into `public/characters/<id>/`.
 *
 * Each character has up to three source layers -- bg, Full view, close-up --
 * named "<Name> <type>.png" with inconsistent casing and separators. Matching is
 * case-insensitive and treats spaces, underscores and hyphens as equivalent.
 *
 * Alpha layers are trimmed to their opaque bounding box first. The layout rules
 * downstream assume "same rendered height => same apparent scale", which only
 * holds if no character carries transparent padding; several sources do.
 *
 * The close-up also yields a fourth layer that has no source of its own: the
 * square head crop the mobile picker shows in a circle, written as `avatar-*`
 * and recorded as `headBox` in the anchors.
 *
 * Run with: npm run images
 */
import sharp from "sharp";
import { readdir, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { CHARACTERS as ROSTER } from "../src/data/characters.ts";

const SRC_DIR = "assets-source";
const OUT_DIR = path.join("public", "characters");
const ANCHORS_FILE = path.join("src", "data", "character-anchors.json");

/** Display names, in roster order. Source files are matched against these. */
const CHARACTERS = ROSTER.map((c) => c.name);
const BY_NAME = new Map(ROSTER.map((c) => [c.name, c]));

const LAYERS = {
  bg: { token: "bg", widths: [2560], alpha: false, webp: 82, avif: 50 },
  full: { token: "fullview", heights: [1600, 3200], alpha: true, webp: 90, avif: 62 },
  closeup: { token: "closeup", heights: [1400, 2400], alpha: true, webp: 90, avif: 62 },
};

/** Cut from the close-up, not matched to a source file. WebP only: the circle
    is small and its alpha edge matters more than the last few KB. */
const AVATAR = {
  sizes: [256, 512],
  webp: 92,
  /** Height the close-up is reduced to before the crop. The widest head box is
      ~0.8 of the width, which still leaves well over 512px to sample from. */
  source: 2400,
};

/** Low enough to keep soft edges and glows, high enough to drop stray noise. */
const TRIM_THRESHOLD = 10;
/** Spec: opaque means alpha > 128. */
const ANCHOR_ALPHA = 128;
/** Spec: average over rows 2%-10% of the height. */
const ANCHOR_BAND = [0.02, 0.1];
const ANCHOR_SAMPLE_WIDTH = 1024;

/* Head box. Walking down the alpha channel, a portrait is narrow through the
   head and then flares hard where the shoulders start. That flare is the only
   landmark that survives every character -- hair long enough to hide the neck
   means the profile never pinches -- so the head is taken to run from the first
   opaque row down to the row where the flare begins. */

/** The box is stored as fractions, so the profile only has to be fine enough to
    resolve the flare, not the artwork. */
const HEAD_SAMPLE_WIDTH = 320;
/** Rows the flare is measured over, as a fraction of the height, and the jump in
    filled width across them that counts as one. */
const FLARE_WINDOW = 0.05;
const FLARE_RISE = 0.12;
/** Hair flares just as hard at the crown; start the search below it. */
const FLARE_SKIP = 0.18;
const FLARE_LIMIT = 0.75;
/** Where the head ends when no flare is found -- better than cropping to the
    whole image. Reported in the summary so it does not pass unnoticed. */
const FLARE_FALLBACK = 0.45;
/** Slack around the measured head, so it sits inside the circle instead of
    tangent to it, and the share of that slack that goes above the hair. */
const HEAD_PAD_Y = 1.2;
const HEAD_PAD_X = 1.08;
const HEAD_TOP_BIAS = 0.28;

const CONCURRENCY = 3;

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn("  ! " + msg);
};

const normalize = (s) =>
  s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[\s_-]+/g, " ").trim();
const squash = (s) => s.replace(/[^a-z0-9]/g, "");

/** Map every source file onto a character + layer. */
async function indexSources() {
  let files;
  try {
    files = (await readdir(SRC_DIR)).filter((f) => /\.(png|webp|jpe?g|tiff?)$/i.test(f));
  } catch {
    console.error("No " + SRC_DIR + "/ directory. Put the source art there and re-run.");
    process.exit(1);
  }

  const found = {};
  for (const name of CHARACTERS) found[name] = {};

  for (const file of files) {
    const n = normalize(file);
    const owner = CHARACTERS.find((c) => n.startsWith(normalize(c) + " "));
    if (!owner) {
      warn("unmatched source file, ignored: " + file);
      continue;
    }
    const rest = squash(n.slice(normalize(owner).length));
    let layer = Object.keys(LAYERS).find((k) => squash(LAYERS[k].token) === rest);
    if (!layer) {
      // tolerate typos such as "close-upx"
      layer = Object.keys(LAYERS).find(
        (k) =>
          rest.startsWith(squash(LAYERS[k].token)) ||
          squash(LAYERS[k].token).startsWith(rest),
      );
      if (layer) {
        warn('"' + file + '" is not exactly "' + owner + " " + LAYERS[layer].token + '"; read as ' + layer);
      }
    }
    if (!layer) {
      warn("unknown layer type in: " + file);
      continue;
    }
    if (found[owner][layer]) warn("duplicate " + layer + " for " + owner + "; keeping " + found[owner][layer]);
    else found[owner][layer] = path.join(SRC_DIR, file);
  }
  return found;
}

const open = (file, trim) => {
  const p = sharp(file, { limitInputPixels: false });
  return trim ? p.trim({ threshold: TRIM_THRESHOLD }) : p;
};

/**
 * Horizontal centre of the opaque pixels across the top band, as a fraction of
 * width. Measured on the trimmed image, which is what actually gets rendered.
 */
async function headCenterX(file) {
  const { data, info } = await open(file, true)
    .resize({ width: ANCHOR_SAMPLE_WIDTH, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const y0 = Math.floor(height * ANCHOR_BAND[0]);
  const y1 = Math.max(y0 + 1, Math.floor(height * ANCHOR_BAND[1]));

  let sum = 0;
  let count = 0;
  let minX = width;
  let maxX = -1;
  for (let y = y0; y < y1; y++) {
    const row = y * width * channels;
    for (let x = 0; x < width; x++) {
      if (data[row + x * channels + 3] > ANCHOR_ALPHA) {
        sum += x;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (!count) return null;
  return {
    centroid: (sum / count + 0.5) / width,
    span: ((minX + maxX) / 2 + 0.5) / width,
  };
}

/**
 * Square head crop for `file`, as fractions of the trimmed close-up.
 *
 * Row width is measured as the longest unbroken run of opaque pixels, not the
 * distance between the outermost ones: a raised hand beside the face or the two
 * tips of a pair of ears would otherwise read as head width and blow the box up.
 */
async function headBoxFor(file, centerX, adjust = {}) {
  const { data, info } = await open(file, true)
    .resize({ width: HEAD_SAMPLE_WIDTH, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const fill = new Float64Array(height);
  const run = new Int32Array(height);

  for (let y = 0; y < height; y++) {
    const row = y * width * channels;
    let filled = 0;
    let current = 0;
    let longest = 0;
    for (let x = 0; x < width; x++) {
      if (data[row + x * channels + 3] > ANCHOR_ALPHA) {
        filled++;
        if (++current > longest) longest = current;
      } else {
        current = 0;
      }
    }
    fill[y] = filled / width;
    run[y] = longest;
  }

  let top = 0;
  while (top < height && fill[top] < 0.01) top++;
  if (top >= height) return null;

  const span = Math.max(1, Math.round(height * FLARE_WINDOW));
  const last = Math.min(Math.round(height * FLARE_LIMIT), height - span);
  let chin = -1;
  for (let y = Math.round(height * FLARE_SKIP); y < last; y++) {
    if (fill[y + span] - fill[y] >= FLARE_RISE) {
      chin = y;
      break;
    }
  }
  const measured = chin >= 0;
  if (!measured) chin = Math.round(height * FLARE_FALLBACK);

  let headW = 0;
  for (let y = top; y <= chin; y++) headW = Math.max(headW, run[y]);
  const headH = chin - top;

  // Square in pixels, which is not square in fractions: x and w are divided by
  // the width, y and h by the height.
  const side = Math.max(headH * HEAD_PAD_Y, headW * HEAD_PAD_X) * (adjust.scale ?? 1);
  const x = centerX * width - side / 2 + (adjust.dx ?? 0) * side;
  const y = top - (side - headH) * HEAD_TOP_BIAS + (adjust.dy ?? 0) * side;

  return {
    box: {
      x: +(x / width).toFixed(4),
      y: +(y / height).toFixed(4),
      w: +(side / width).toFixed(4),
      h: +(side / height).toFixed(4),
    },
    measured,
    chin: +(chin / height).toFixed(3),
    headW: +(headW / width).toFixed(3),
    headH: +(headH / height).toFixed(3),
  };
}

/**
 * Cuts `box` out of the close-up as a square WebP, once per avatar size.
 *
 * The crop reaches past the top edge by design -- the box leaves clearance above
 * the hair and the trim has already cut the image flush to it -- so the art is
 * padded with transparency first. Padding cannot share a pipeline with the
 * crop: sharp applies a lone extract() before extend(), whichever order they
 * are called in.
 */
async function writeAvatars(src, box, dir) {
  const trimmed = await open(src, true)
    .resize({ height: AVATAR.source, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const { width, height } = await sharp(trimmed).metadata();

  const side = Math.max(1, Math.round(box.w * width));
  const left = Math.round(box.x * width);
  const top = Math.round(box.y * height);
  const pad = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    right: Math.max(0, left + side - width),
    bottom: Math.max(0, top + side - height),
  };

  const padded =
    pad.left || pad.top || pad.right || pad.bottom
      ? await sharp(trimmed)
          .extend({ ...pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
      : trimmed;

  for (const size of AVATAR.sizes) {
    await sharp(padded)
      .extract({ left: left + pad.left, top: top + pad.top, width: side, height: side })
      .resize(size, size)
      .webp({ quality: AVATAR.webp, effort: 5, alphaQuality: 100 })
      .toFile(path.join(dir, "avatar-" + size + ".webp"));
  }
}

async function runPool(jobs) {
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const job = queue.shift();
      await job();
    }
  });
  await Promise.all(workers);
}

async function main() {
  const t0 = Date.now();
  console.log("Reading " + SRC_DIR + "/\n");
  const sources = await indexSources();

  const anchors = {};
  const rows = [];
  const heads = [];
  const jobs = [];

  for (const name of CHARACTERS) {
    const character = BY_NAME.get(name);
    const id = character.id;
    const dir = path.join(OUT_DIR, id);
    await mkdir(dir, { recursive: true });
    anchors[id] = {};

    for (const [layer, cfg] of Object.entries(LAYERS)) {
      const src = sources[name][layer];
      if (!src) {
        warn(name + ": no " + layer + " source, layer skipped");
        if (cfg.alpha) {
          anchors[id][layer + "HeadCenterX"] = null;
          anchors[id][layer + "Aspect"] = null;
        }
        if (layer === "closeup") anchors[id].headBox = null;
        continue;
      }

      const raw = await sharp(src, { limitInputPixels: false }).metadata();

      if (cfg.alpha) {
        const anchor = await headCenterX(src);
        if (!anchor) {
          warn(name + " " + layer + ": no opaque pixels in the top band");
          anchors[id][layer + "HeadCenterX"] = null;
        } else {
          anchors[id][layer + "HeadCenterX"] = +anchor.centroid.toFixed(4);
          anchors[id][layer + "HeadSpanX"] = +anchor.span.toFixed(4);
        }
      }

      // The avatars are cut from this same close-up, so they are queued here
      // rather than given a layer of their own with no source to match.
      if (layer === "closeup") {
        const center = anchors[id].closeupHeadCenterX;
        const head = center == null ? null : await headBoxFor(src, center, character.headBoxAdjust);
        anchors[id].headBox = head ? head.box : null;
        if (!head) {
          warn(name + ": no head box could be measured, avatars skipped");
        } else {
          if (!head.measured) {
            warn(name + ": no shoulder flare found, head box falls back to " + FLARE_FALLBACK + " of the height");
          }
          heads.push({ id, ...head, adjust: character.headBoxAdjust });
          jobs.push(() => writeAvatars(src, head.box, dir));
          rows.push({
            id,
            layer: "avatar",
            source: "from close-up",
            labels: AVATAR.sizes.map((n) => "-" + n),
            formats: ["webp"],
            largest: path.join(dir, "avatar-" + AVATAR.sizes[AVATAR.sizes.length - 1] + ".webp"),
            output: "-",
            anchor: null,
            alpha: false,
          });
        }
      }

      const sizes = cfg.widths
        ? cfg.widths.map((w) => ({ label: "", resize: { width: w } }))
        : cfg.heights.map((h) => ({ label: "-" + h, resize: { height: h } }));

      rows.push({
        id,
        layer,
        source: raw.width + "x" + raw.height,
        // Filled in after encoding: a pipeline's .metadata() reports the SOURCE
        // size, not the result of a queued trim, so the only honest measurement
        // of the trimmed art is the file we actually wrote.
        largest: path.join(OUT_DIR, id, layer + sizes[sizes.length - 1].label + ".webp"),
        labels: sizes.map((size) => size.label),
        formats: ["webp", "avif"],
        output: "-",
        anchor: cfg.alpha ? anchors[id][layer + "HeadCenterX"] : null,
        alpha: cfg.alpha,
      });

      for (const size of sizes) {
        for (const fmt of ["webp", "avif"]) {
          const out = path.join(dir, layer + size.label + "." + fmt);
          jobs.push(async () => {
            const pipe = open(src, cfg.alpha).resize({
              ...size.resize,
              fit: "inside",
              withoutEnlargement: true,
            });
            if (fmt === "webp") {
              await pipe.webp({ quality: cfg.webp, effort: 5, alphaQuality: 100 }).toFile(out);
            } else {
              await pipe.avif({ quality: cfg.avif, effort: 4 }).toFile(out);
            }
          });
        }
      }
    }
  }

  console.log("\nEncoding " + jobs.length + " files (concurrency " + CONCURRENCY + ")...");
  await runPool(jobs);

  // Measure what was actually written. The trimmed aspect ratio is what the
  // layout needs to turn a rendered height into a rendered width.
  for (const r of rows) {
    try {
      const m = await sharp(r.largest).metadata();
      r.output = m.width + "x" + m.height;
      if (r.alpha) anchors[r.id][r.layer + "Aspect"] = +(m.width / m.height).toFixed(4);
    } catch {
      warn("could not read back " + r.largest);
    }
  }

  await mkdir(path.dirname(ANCHORS_FILE), { recursive: true });
  await writeFile(ANCHORS_FILE, JSON.stringify(anchors, null, 2) + "\n");

  const sizeOf = async (p) => {
    try {
      return (await stat(p)).size;
    } catch {
      return null;
    }
  };
  const kb = (b) => (b === null ? "  -  " : (b / 1024).toFixed(0).padStart(5));

  console.log("\n" + "-".repeat(104));
  console.log(
    "char".padEnd(9) +
      "layer".padEnd(9) +
      "source".padEnd(14) +
      "shipped".padEnd(12) +
      "headCenterX".padEnd(13) +
      "outputs (KB)",
  );
  console.log("-".repeat(104));
  for (const r of rows) {
    const parts = [];
    for (const l of r.labels) {
      const encoded = [];
      for (const fmt of r.formats) {
        encoded.push(fmt + " " + kb(await sizeOf(path.join(OUT_DIR, r.id, r.layer + l + "." + fmt))));
      }
      parts.push(r.layer + l + ": " + encoded.join(" / "));
    }
    console.log(
      r.id.padEnd(9) +
        r.layer.padEnd(9) +
        r.source.padEnd(14) +
        r.output.padEnd(12) +
        String(r.anchor ?? "-").padEnd(13) +
        parts.join("   "),
    );
  }
  console.log("-".repeat(104));

  // The head box is what the mobile picker circles are cut to, so it gets its
  // own readout: the numbers only make sense next to the head they were
  // measured from. A starred chin is a fallback, not a measurement.
  console.log(
    "\n" +
      "char".padEnd(9) +
      "chin".padEnd(8) +
      "head w x h".padEnd(16) +
      "headBox  x / y / w / h".padEnd(40) +
      "adjust",
  );
  console.log("-".repeat(104));
  for (const h of heads) {
    const adjust = Object.entries(h.adjust ?? {})
      .map(([k, v]) => k + " " + v)
      .join("  ");
    console.log(
      h.id.padEnd(9) +
        (h.chin.toFixed(3) + (h.measured ? "" : "*")).padEnd(8) +
        (h.headW.toFixed(3) + " x " + h.headH.toFixed(3)).padEnd(16) +
        [h.box.x, h.box.y, h.box.w, h.box.h]
          .map((v) => v.toFixed(4).padStart(9))
          .join("")
          .padEnd(40) +
        (adjust || "-"),
    );
  }
  console.log("-".repeat(104));
  console.log("\nAnchors written to " + ANCHORS_FILE);
  console.log(
    "Done in " +
      ((Date.now() - t0) / 1000).toFixed(1) +
      "s" +
      (warnings.length ? " with " + warnings.length + " warning(s)." : "."),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
