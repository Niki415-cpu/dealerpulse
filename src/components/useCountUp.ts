"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a headline number up to its target on mount and whenever it changes.
 *
 * Used only on the overview KPI row — a dashboard where every number on every page
 * ticks reads as a gimmick, while the one number the CEO looks at first earns it.
 * Honours prefers-reduced-motion by jumping straight to the value.
 */
export function useCountUp(target: number, duration = 520): number {
  const [value, setValue] = useState(0);
  // What is on screen right now, so a re-run (or a range change mid-flight)
  // continues from where the number actually is rather than restarting at zero.
  const shownRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target) || prefersReducedMotion()) {
      shownRef.current = Number.isFinite(target) ? target : 0;
      setValue(target);
      return;
    }

    const from = shownRef.current;
    if (from === target) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutQuart — the same "settles slow" shape as the CSS entrance curve.
      const eased = 1 - Math.pow(1 - t, 4);
      const next = from + (target - from) * eased;
      shownRef.current = next;
      setValue(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return value;
}
