import { Quaternion, Vector3 } from 'three';
import type { Palm, Point, FingerGrip } from './types';
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// Local +Y lifts away from the palm; local -Z moves into the finger/thumb gap.
// Span is measured in viewport-width units, so the clearance follows hand distance.
export function palmHoverPosition(palm: Palm, aspect: number): { point: Point; depth: number } {
  if (!palm.orientation || !palm.span || !Number.isFinite(palm.span) || !Number.isFinite(aspect) || aspect <= 0)
    return { point: { ...palm.point }, depth: 0 };
  const rotation = new Quaternion(...palm.orientation).normalize();
  const offset = new Vector3(0, .45, -.65).applyQuaternion(rotation)
    .multiplyScalar(clamp(palm.span, .04, .45) * 2 * aspect);
  return { point: {
    x: clamp(palm.point.x + offset.x / (2 * aspect), .03, .97),
    y: clamp(palm.point.y - offset.y / 2, .03, .97),
  }, depth: offset.z };
}

// The balanced fingertip anchor locates the gap; cap the lift within its reserved margin.
export function fingertipHoverPosition(grip: FingerGrip, span: number | undefined, aspect: number): { point: Point; depth: number } {
  if (!grip.orientation || !span || !Number.isFinite(span) || !Number.isFinite(aspect) || aspect <= 0)
    return { point: { ...grip.point }, depth: 0 };
  const lift = Math.min(clamp(span, .04, .45) * .15, grip.gapRadius === undefined ? Infinity : grip.gapRadius * .08);
  const offset = new Vector3(0, lift, 0).applyQuaternion(new Quaternion(...grip.orientation).normalize())
    .multiplyScalar(2 * aspect);
  return { point: { x: clamp(grip.point.x + offset.x / (2 * aspect), .03, .97),
    y: clamp(grip.point.y - offset.y / 2, .03, .97) }, depth: offset.z };
}
