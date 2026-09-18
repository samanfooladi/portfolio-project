"use client";

/**
 * Frosted panel that sweeps across a strip on hover. It carries no animation of
 * its own: CharacterSelect builds one paused timeline per strip and restarts it,
 * so a fast re-hover replays from the start instead of stacking tweens.
 */
export default function GlassSweep() {
  return <span className="glass-sweep" data-sweep aria-hidden="true" />;
}
