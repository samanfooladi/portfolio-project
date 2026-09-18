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
 * Run with: npm run images
 */
import sharp from "sharp";
import { readdir, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = "assets-source";
const OUT_DIR = path.join("public", "characters");
const ANCHORS_FILE = path.join("src", "data", "character-anchors.json");

const CHARACTERS = ["Esmaeel", "Foxy", "MH", "Navid", "Peyman", "Reina", "Sam", "Soroush"];

const LAYERS = {
  bg: { token: "bg", widths: [2560], alpha: false, webp: 82, avif: 50 },
  full: { token: "fullview", heights: [1600, 3200], alpha: true, webp: 90, avif: 62 },
  closeup: { token: "closeup", heights: [1400, 2400], alpha: true, webp: 90, avif: 62 },
};

/** Low enough to keep soft edges and glows, high enough to drop stray noise. */
const TRIM_THRESHOLD = 10;
/** Spec: opaque means alpha > 128. */
const ANCHOR_ALPHA = 128;
/** Spec: average over rows 2%-10% of the height. */
const ANCHOR_BAND = [0.02, 0.1];
const ANCHOR_SAMPLE_WIDTH = 1024;
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
  const jobs = [];

  for (const name of CHARACTERS) {
    const id = name.toLowerCase();
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
      "source".padEnd(12) +
      "shipped".padEnd(12) +
      "headCenterX".padEnd(13) +
      "outputs (KB)",
  );
  console.log("-".repeat(104));
  for (const r of rows) {
    const cfg = LAYERS[r.layer];
    const labels = cfg.widths ? [""] : cfg.heights.map((h) => "-" + h);
    const parts = [];
    for (const l of labels) {
      const w = await sizeOf(path.join(OUT_DIR, r.id, r.layer + l + ".webp"));
      const a = await sizeOf(path.join(OUT_DIR, r.id, r.layer + l + ".avif"));
      parts.push(r.layer + l + ": webp " + kb(w) + " / avif " + kb(a));
    }
    console.log(
      r.id.padEnd(9) +
        r.layer.padEnd(9) +
        r.source.padEnd(12) +
        r.output.padEnd(12) +
        String(r.anchor ?? "-").padEnd(13) +
        parts.join("   "),
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
