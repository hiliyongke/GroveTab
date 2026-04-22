/**
 * useReducedMotionPreference — Detects prefers-reduced-motion
 */

import { useReducedMotion } from 'motion/react';

/** Returns true if the user prefers reduced motion */
export function useReducedMotionPreference(): boolean {
  const motionReduced = useReducedMotion();
  return motionReduced ?? false;
}
