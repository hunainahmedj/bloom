import type { FingerGrip } from './types';
export const CROWN_WIDTH_REFERENCE = 2.65;
// Conservatively encloses all styles, animated petals and outermost leaves.
export const CROWN_LOCAL_RADIUS = 1.42;
export function fitCrownBetweenFingertips(requestedWidth: number, grip: FingerGrip): number {
  if (grip.gapRadius === undefined || !Number.isFinite(grip.gapRadius)) return requestedWidth;
  // Reserve 18% of the measured 3D gap for the fingertips. Using a physical
  // radius keeps the crown usable when separated tips overlap in the image.
  const fitWidth = grip.gapRadius * .82 * CROWN_WIDTH_REFERENCE / CROWN_LOCAL_RADIUS;
  // A closed fist has no open space. Keep a small model visible as it closes.
  return Math.min(requestedWidth, Math.max(.025, fitWidth));
}
