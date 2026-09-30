"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { STORY } from "@/data/stories";
import type { GeometryFigure } from "@/data/stories/types";

gsap.registerPlugin(useGSAP);

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Wireframe "calculation" figures drawn around a character while one chapter
 * is on screen: arcs, trajectories, constellations, solids given away by their
 * edges, and one drafting triangle on the ground in front of them.
 *
 * Every figure is its own small <svg> rather than a group in one big one. The
 * drift, sway and pulse are transform and opacity on those elements, which the
 * compositor can move without repainting anything -- a single SVG would be
 * repainted, glow filter and all, on every frame. What does repaint is small
 * and brief: strokes plotting in on arrival, and the one measurement line
 * whose dashes travel.
 *
 * All of the looping motion comes from one proxy tween whose time is the only
 * input, so any moment of it can be rendered exactly -- which is also what
 * makes a frame-by-frame capture of it possible.
 */

type Props = {
  figures: readonly GeometryFigure[];
  /** Whether the chapter the overlay belongs to is the one on screen. */
  active: boolean;
  /** Trimmed width / height of the pose, and its height on screen: together
      they are the box every figure's position is a fraction of. */
  aspect: number;
  heightVh: number;
};

type Shape = { h: number; body: ReactNode; label?: number };

const rad = (d: number) => (d * Math.PI) / 180;
const n = (v: number) => +v.toFixed(2);
const TAU = Math.PI * 2;

/** Roughly 12px text at 1440 wide, whatever size the figure is drawn at. It
    scales with the viewport from there, like everything else in the overlay. */
const labelSize = (size: number) => n(1.9 / size);

// ---------------------------------------------------------------------------
// The shapes. Each works on a viewBox 100 units wide and returns its height.
// Every stroke carries pathLength=1, so plotting it in is the same dash trick
// for every shape: dasharray 1, offset from 1 down to 0.
// ---------------------------------------------------------------------------

function arc(f: Extract<GeometryFigure, { type: "arc" }>): Shape {
  const c = 50;
  const r = 42;
  const p = (a: number, rr: number) => `${n(c + rr * Math.cos(rad(a)))} ${n(c + rr * Math.sin(rad(a)))}`;
  const large = f.to - f.from > 180 ? 1 : 0;
  let ticks = "";
  for (let k = 0; k <= f.ticks; k++) {
    const a = f.from + ((f.to - f.from) * k) / f.ticks;
    const len = k % Math.max(1, Math.round(f.ticks / 2)) === 0 ? 6 : 3;
    ticks += `M${p(a, r)}L${p(a, r + len)}`;
  }
  // In the middle of the angle by default. Given an angle, the label moves
  // outside the arc there instead -- for an arc whose middle is hidden.
  const labelAt = f.labelAngle ?? (f.from + f.to) / 2;
  const labelR = f.labelAngle === undefined ? 25 : r + 12;
  return {
    h: 100,
    label: labelSize(f.size),
    body: (
      <>
        <path className="geo-stroke" pathLength={1} d={`M${p(f.from, r)}A${r} ${r} 0 ${large} 1 ${p(f.to, r)}`} />
        <path className="geo-stroke" pathLength={1} d={`M${p(f.from, r)}L${c} ${c}L${p(f.to, r)}`} />
        <path className="geo-stroke" pathLength={1} d={`M${p(f.from, 12)}A12 12 0 ${large} 1 ${p(f.to, 12)}`} />
        <path className="geo-stroke" pathLength={1} d={ticks} />
        {f.label && (
          <text className="geo-label" x={n(c + labelR * Math.cos(rad(labelAt)))} y={n(c + labelR * Math.sin(rad(labelAt)))}>
            {f.label}
          </text>
        )}
      </>
    ),
  };
}

function trajectory(f: Extract<GeometryFigure, { type: "trajectory" }>, maskId: string): Shape {
  const h = 30;
  const [x0, y0, x1, y1] = [3, 26, 97, 6];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  // Push the control point off the chord along its normal, towards the top.
  const cx = (x0 + x1) / 2 + (dy / len) * f.bend * 40;
  const cy = (y0 + y1) / 2 - (dx / len) * f.bend * 40;
  const d = `M${x0} ${y0}Q${n(cx)} ${n(cy)} ${x1} ${y1}`;
  // Arrowhead along the tangent at the end, which points from the control
  // point to the end point.
  const tx = x1 - cx;
  const ty = y1 - cy;
  const tl = Math.hypot(tx, ty);
  const ux = tx / tl;
  const uy = ty / tl;
  const head = (s: number) => `${n(x1 - ux * 4 + -uy * s * 2.4)} ${n(y1 - uy * 4 + ux * s * 2.4)}`;
  const { on, off } = STORY.geometry.dash;
  return {
    h,
    body: (
      <>
        {/* Dashed, and still able to plot in: the line is drawn solid, and a
            dashed copy of it in a mask is what cuts it into dashes. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-10} y={-20} width={120} height={h + 40}>
          <path d={d} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray={`${on} ${off}`} />
        </mask>
        <path className="geo-stroke" pathLength={1} d={d} mask={`url(#${maskId})`} />
        <circle className="geo-stroke" pathLength={1} cx={x0} cy={y0} r={1.4} />
        {f.arrow && <path className="geo-stroke" pathLength={1} d={`M${head(1)}L${x1} ${y1}L${head(-1)}`} />}
      </>
    ),
  };
}

function constellation(f: Extract<GeometryFigure, { type: "constellation" }>): Shape {
  const links = f.links.map(([a, b]) => `M${f.nodes[a][0]} ${f.nodes[a][1]}L${f.nodes[b][0]} ${f.nodes[b][1]}`).join("");
  return {
    h: 100,
    body: (
      <>
        <path className="geo-stroke" pathLength={1} d={links} />
        {f.nodes.map(([x, y], i) => (
          <circle key={i} className="geo-stroke" pathLength={1} cx={x} cy={y} r={2} />
        ))}
      </>
    ),
  };
}

function polygon(f: Extract<GeometryFigure, { type: "polygon" }>): Shape {
  const pts = Array.from({ length: f.sides }, (_, i) => {
    const a = rad(-90 + (360 * i) / f.sides);
    return [n(50 + 44 * Math.cos(a)), n(50 + 44 * Math.sin(a))] as const;
  });
  // Walk the vertices and stop `open` edges short of closing.
  const edges = f.sides - f.open;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i <= edges; i++) d += `L${pts[i % f.sides][0]} ${pts[i % f.sides][1]}`;
  return {
    h: 100,
    body: (
      <>
        <path className="geo-stroke" pathLength={1} d={d} />
        {pts.map(([x, y], i) => (
          <circle key={i} className="geo-stroke" pathLength={1} cx={x} cy={y} r={1.4} />
        ))}
      </>
    ),
  };
}

const CUBE = {
  v: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const))),
  e: [] as [number, number][],
};
for (let i = 0; i < 8; i++)
  for (let j = i + 1; j < 8; j++) {
    const diff = CUBE.v[i].filter((c, k) => c !== CUBE.v[j][k]).length;
    if (diff === 1) CUBE.e.push([i, j]);
  }
const TETRA = {
  v: [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ] as const,
  e: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ] as [number, number][],
};

function solid(f: Extract<GeometryFigure, { type: "solid" }>): Shape {
  const { v, e } = f.shape === "cube" ? CUBE : TETRA;
  const [cy, sy, cp, sp] = [Math.cos(rad(f.yaw)), Math.sin(rad(f.yaw)), Math.cos(rad(f.pitch)), Math.sin(rad(f.pitch))];
  // Turn about the vertical, then tip towards the viewer. Orthographic: at
  // this size perspective would only read as a drawing error.
  const p = v.map(([x, y, z]) => {
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    return [x1, -(y * cp - z1 * sp), y * sp + z1 * cp] as const;
  });
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = 84 / (maxX - minX);
  const h = n((maxY - minY) * k + 16);
  const at = (i: number) => `${n(8 + (p[i][0] - minX) * k)} ${n(8 + (p[i][1] - minY) * k)}`;
  // Edges whose far end is behind the middle go in a dimmer path: the one
  // depth cue a wireframe gets without hidden-line removal.
  const front = e.filter(([a, b]) => (p[a][2] + p[b][2]) / 2 <= 0.25);
  const back = e.filter(([a, b]) => (p[a][2] + p[b][2]) / 2 > 0.25);
  const path = (list: [number, number][]) => list.map(([a, b]) => `M${at(a)}L${at(b)}`).join("");
  return {
    h,
    body: (
      <>
        <path className="geo-stroke geo-stroke--back" pathLength={1} d={path(back)} />
        <path className="geo-stroke" pathLength={1} d={path(front)} />
      </>
    ),
  };
}

function measure(f: Extract<GeometryFigure, { type: "measure" }>): Shape {
  let ticks = "";
  for (let x = 14; x < 96; x += 10) ticks += `M${x} 14L${x} 11.5`;
  return {
    h: 22,
    label: labelSize(f.size),
    body: (
      <>
        <path className="geo-stroke" pathLength={1} d={`M4 14L96 14M4 9L4 19M96 9L96 19${ticks}`} />
        {f.label && (
          <text className="geo-label" x={50} y={6.5}>
            {f.label}
          </text>
        )}
      </>
    ),
  };
}

/**
 * The drafting triangle, standing on its long edge on the floor and turned
 * away so it recedes -- projected once, here, from three dimensions. Nothing
 * about it is recomputed while it is on screen.
 */
function setSquare(
  f: Extract<GeometryFigure, { type: "setSquare" }>,
  aspect: number,
  scale: number,
  maskId: string,
): Shape & { line: { x1: number; y1: number; x2: number; y2: number } } {
  const L = 1;
  const H = L * Math.tan(rad(34));
  const yaw = rad(f.yaw);
  const pitch = rad(14);
  const dist = 3.2;
  const P = (u: number, v: number) => {
    const X = u * Math.cos(yaw);
    const Z = u * Math.sin(yaw);
    const Y = v;
    // Looking slightly down at the floor, so the far end rises towards the
    // horizon rather than sinking below the ground it stands on.
    const y2 = Y * Math.cos(pitch) + Z * Math.sin(pitch);
    const z2 = Y * Math.sin(pitch) + Z * Math.cos(pitch);
    const s = 3 / (z2 + dist);
    return [X * s, -y2 * s] as const;
  };

  // The inner cut-out: the same triangle, every edge moved in by `d`.
  const d = 0.075;
  const hyp = Math.hypot(H, L);
  const innerU = (H * L - d * hyp - L * d) / H;
  const innerV = (H * L - d * hyp - H * d) / L;
  const outer = [P(0, 0), P(L, 0), P(0, H)];
  const inner = [P(d, d), P(innerU, d), P(d, innerV)];
  const ticks: (readonly [number, number])[][] = [];
  for (let u = 0.06, i = 0; u < 0.95; u += 0.045, i++) ticks.push([P(u, 0), P(u, i % 5 === 0 ? 0.055 : 0.03)]);
  for (let v = 0.06, i = 0; v < H - 0.06; v += 0.045, i++) ticks.push([P(0, v), P(i % 5 === 0 ? 0.055 : 0.03, v)]);

  const all = [...outer, ...inner, ...ticks.flat()];
  const minX = Math.min(...all.map((q) => q[0]));
  const maxX = Math.max(...all.map((q) => q[0]));
  const minY = Math.min(...all.map((q) => q[1]));
  const maxY = Math.max(...all.map((q) => q[1]));
  const k = 96 / (maxX - minX);
  // No padding at the bottom: the lowest point is the corner on the floor, and
  // the figure is placed by its bottom edge, so this is what lands on it.
  const h = n((maxY - minY) * k + 2);
  const at = ([x, y]: readonly [number, number]) => [n(2 + (x - minX) * k), n(2 + (y - minY) * k)] as const;
  const poly = (pts: (readonly [number, number])[]) =>
    pts.map((q, i) => `${i ? "L" : "M"}${at(q)[0]} ${at(q)[1]}`).join("") + "Z";
  const tickPath = ticks.map(([a, b]) => `M${at(a)[0]} ${at(a)[1]}L${at(b)[0]} ${at(b)[1]}`).join("");

  // Where the target lands in this viewBox. One unit is scale * size / 100 of
  // the pose box's width, and the box's bottom centre is (x, y).
  const unit = (scale * f.size) / 100;
  const left = f.x - 50 * unit;
  const top = f.y / aspect - h * unit;
  const tx = n((f.target[0] - left) / unit);
  const ty = n((f.target[1] / aspect - top) / unit);
  // From the apex, which is the corner nearest the foot.
  const [ax, ay] = at(outer[2]);
  const len = Math.hypot(tx - ax, ty - ay);
  const nx = -(ty - ay) / len;
  const ny = (tx - ax) / len;
  const cap = (s: number) => `${n(tx + nx * s * 3)} ${n(ty + ny * s * 3)}`;
  const { on, off } = STORY.geometry.dash;
  const size = labelSize(f.size);

  return {
    h,
    label: size,
    line: { x1: ax, y1: ay, x2: tx, y2: ty },
    body: (
      <>
        <path className="geo-stroke" pathLength={1} d={poly(outer)} />
        <path className="geo-stroke" pathLength={1} d={poly(inner)} />
        <path className="geo-stroke geo-stroke--back" pathLength={1} d={tickPath} />
        {/* The measurement line: drawn solid, cut into dashes by a mask whose
            dash offset is what travels. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-400} y={-400} width={900} height={900}>
          <path
            data-geo-march
            d={`M${ax} ${ay}L${tx} ${ty}`}
            fill="none"
            stroke="#fff"
            strokeWidth={4}
            strokeDasharray={`${on} ${off}`}
          />
        </mask>
        <path className="geo-stroke" pathLength={1} d={`M${ax} ${ay}L${tx} ${ty}`} mask={`url(#${maskId})`} />
        <path className="geo-stroke" pathLength={1} d={`M${cap(1)}L${cap(-1)}`} />
        <circle className="geo-stroke" pathLength={1} cx={tx} cy={ty} r={1.2} />
        <text
          className="geo-label"
          data-geo-readout
          x={n((ax + tx) / 2 + nx * size * 1.1)}
          y={n((ay + ty) / 2 + ny * size * 1.1)}
        >
          {`${f.readout.toFixed(1)}°`}
        </text>
      </>
    ),
  };
}

/** Deterministic noise in [-1, 1] for one readout step: the same step always
    reads the same, so a frame can be rendered again exactly. */
const noise = (step: number) => {
  const x = Math.sin(step * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export default function GeometryOverlay({ figures, active, aspect, heightVh }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const controlRef = useRef<{ show: () => void; hide: () => void } | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { geometry } = STORY;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const mm = gsap.matchMedia();

      mm.add(
        { reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" },
        (ctx) => {
          const reduce = Boolean(ctx.conditions?.reduce);
          const layers = gsap.utils.toArray<HTMLElement>(".geo", root);
          const boxes = gsap.utils.toArray<HTMLElement>(".geo-box", root);
          const svgs = gsap.utils.toArray<SVGSVGElement>("[data-geo-svg]", root);
          const strokes = gsap.utils.toArray<SVGElement>(".geo-stroke", root);
          const labels = gsap.utils.toArray<SVGElement>(".geo-label", root);
          const march = root.querySelector<SVGPathElement>("[data-geo-march]");
          const readout = root.querySelector<SVGTextElement>("[data-geo-readout]");
          const squareFig = figures.find((f) => f.type === "setSquare");

          // Indexed by the figure's place in the list, not by DOM order: the
          // front layer renders after the back one, wherever it sits in the list.
          const set: { y: (v: number) => void; rotation: (v: number) => void; opacity: (v: number) => void }[] = [];
          svgs.forEach((el) => {
            set[Number(el.dataset.geoI)] = {
              y: gsap.quickSetter(el, "y", "px") as (v: number) => void,
              rotation: gsap.quickSetter(el, "rotation", "deg") as (v: number) => void,
              opacity: gsap.quickSetter(el, "opacity") as (v: number) => void,
            };
          });

          let lastStep = Number.NaN;
          /** Every figure at loop time `t`, from `t` alone. */
          const frame = (t: number) => {
            figures.forEach((f, i) => {
              const L = geometry.layers[f.layer];
              if (f.type === "setSquare") {
                set[i].y(reduce ? 0 : geometry.breathe.amp * Math.sin((TAU * t) / geometry.breathe.dur));
                set[i].rotation(f.rotate ?? 0);
                set[i].opacity(L.opacity);
                return;
              }
              const dur = f.drift.dur / L.speed;
              const phase = f.drift.phase;
              const sway = f.sway ? f.sway * Math.sin(TAU * (t / (dur * geometry.swaySlower) + phase * 1.7)) : 0;
              const pulse = 0.5 * (1 + Math.sin(TAU * (t / (dur * geometry.pulse.slower) + phase * 2.3)));
              set[i].y(reduce ? 0 : f.drift.amp * L.amp * Math.sin(TAU * (t / dur + phase)));
              set[i].rotation((f.rotate ?? 0) + (reduce ? 0 : sway));
              set[i].opacity(L.opacity * (reduce ? 1 : 1 - geometry.pulse.depth * pulse));
            });
            if (reduce) return;
            if (march) {
              const period = geometry.dash.on + geometry.dash.off;
              march.setAttribute("stroke-dashoffset", String(-((t * geometry.dash.speed) % period)));
            }
            if (readout && squareFig?.type === "setSquare") {
              const step = Math.floor(t / geometry.readout.interval);
              if (step !== lastStep) {
                lastStep = step;
                const v = squareFig.readout + geometry.readout.spread * noise(step);
                readout.textContent = `${v.toFixed(1)}°`;
              }
            }
          };

          // Hidden until shown; a static, finished drawing under reduced motion.
          gsap.set(layers, { autoAlpha: 0 });
          gsap.set(strokes, { strokeDashoffset: reduce ? 0 : 1 });
          gsap.set(labels, { opacity: reduce ? 1 : 0 });
          frame(0);

          const clock = { t: 0 };
          const LONG = 1e5;
          const loop = gsap.to(clock, {
            t: LONG,
            duration: LONG,
            ease: "none",
            paused: true,
            onUpdate: () => frame(clock.t),
          });

          let shown = false;
          let draw: gsap.core.Timeline | null = null;
          let leave: gsap.core.Timeline | null = null;

          const show = () => {
            if (shown) return;
            shown = true;
            leave?.kill();
            gsap.set(boxes, { scale: 1 });
            if (reduce) {
              gsap.to(layers, { autoAlpha: 1, duration: 0.3, ease: "power1.out", overwrite: true });
              return;
            }
            gsap.set(layers, { autoAlpha: 1 });
            // Plotted in figure by figure, in list order, all inside the run.
            const { duration, stagger } = geometry.draw;
            const each = Math.max(0.2, duration - stagger * (figures.length - 1));
            draw = gsap.timeline();
            const figs = gsap.utils
              .toArray<HTMLElement>(".geo-fig", root)
              .sort((a, b) => Number(a.dataset.geoI) - Number(b.dataset.geoI));
            figs.forEach((fig, i) => {
              const s = fig.querySelectorAll(".geo-stroke");
              const l = fig.querySelectorAll(".geo-label");
              draw!.fromTo(s, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: each, ease: "power2.out" }, i * stagger);
              if (l.length) draw!.fromTo(l, { opacity: 0 }, { opacity: 1, duration: each * 0.6 }, i * stagger + each * 0.4);
            });
            frame(clock.t);
            loop.play();
          };

          const hide = () => {
            if (!shown) return;
            shown = false;
            draw?.kill();
            leave = gsap.timeline({
              onComplete: () => {
                loop.pause();
                gsap.set(strokes, { strokeDashoffset: reduce ? 0 : 1 });
                gsap.set(labels, { opacity: reduce ? 1 : 0 });
                gsap.set(boxes, { scale: 1 });
              },
            });
            leave.to(layers, { autoAlpha: 0, duration: geometry.exit.duration, ease: "power1.in" }, 0);
            if (!reduce) leave.to(boxes, { scale: geometry.exit.shrink, duration: geometry.exit.duration, ease: "power1.in" }, 0);
          };

          controlRef.current = { show, hide };
          if (activeRef.current) show();

          // Dev only: renders the overlay exactly as it looks `seconds` after
          // appearing -- plotting in, then drifting -- without a frame clock,
          // so it can be captured frame by frame where the page cannot run
          // one. Returns the readout, as a check that time really moved.
          if (IS_DEV) {
            (root as HTMLElement & { geometryAt?: (s: number) => string | null }).geometryAt = (s) => {
              if (!shown) show();
              draw?.pause().time(s);
              loop.pause().time(s);
              frame(s);
              return readout?.textContent ?? null;
            };
          }

          return () => {
            loop.kill();
            draw?.kill();
            leave?.kill();
            controlRef.current = null;
          };
        },
      );

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [figures, aspect] },
  );

  useEffect(() => {
    activeRef.current = active;
    controlRef.current?.[active ? "show" : "hide"]();
  }, [active]);

  const vars = {
    "--geo-h": `${heightVh}vh`,
    "--geo-aspect": aspect,
    "--geo-stroke": `${geometry.stroke}px`,
    "--geo-glow": `${geometry.glow.blur}px`,
    "--geo-glow-a": geometry.glow.alpha,
  } as CSSProperties;

  const render = (f: GeometryFigure, i: number) => {
    const scale = geometry.layers[f.layer].scale;
    const maskId = `geo${uid}m${i}`;
    let shape: Shape;
    switch (f.type) {
      case "arc":
        shape = arc(f);
        break;
      case "trajectory":
        shape = trajectory(f, maskId);
        break;
      case "constellation":
        shape = constellation(f);
        break;
      case "polygon":
        shape = polygon(f);
        break;
      case "solid":
        shape = solid(f);
        break;
      case "measure":
        shape = measure(f);
        break;
      case "setSquare":
        shape = setSquare(f, aspect, scale, maskId);
        break;
    }
    const grounded = f.type === "setSquare";
    return (
      <div
        key={i}
        className="geo-fig"
        data-geo-i={i}
        style={{
          left: `${f.x * 100}%`,
          top: `${f.y * 100}%`,
          width: `${f.size * 100}%`,
          translate: grounded ? "-50% -100%" : "-50% -50%",
          scale: String(scale),
          transformOrigin: grounded ? "50% 100%" : "50% 50%",
        }}
      >
        <svg
          className="geo-svg"
          data-geo-svg
          data-geo-i={i}
          viewBox={`0 0 100 ${shape.h}`}
          style={shape.label ? ({ "--geo-label": shape.label } as CSSProperties) : undefined}
        >
          {shape.body}
        </svg>
      </div>
    );
  };

  // Figures keep their list index everywhere -- the quick setters are matched
  // to them by it -- so the two layers filter the list rather than split it.
  const back = figures.map((f, i) => (f.layer === "front" ? null : render(f, i)));
  const front = figures.map((f, i) => (f.layer === "front" ? render(f, i) : null));

  return (
    <div ref={rootRef} className="geo-root" style={vars} aria-hidden="true">
      <div className="geo geo--back">
        <div className="geo-box">{back}</div>
      </div>
      <div className="geo geo--front">
        <div className="geo-box">{front}</div>
      </div>
    </div>
  );
}
