import { expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { palmHoverPosition } from '../src/palm-hover';
import type { Palm, Orientation } from '../src/types';
const front = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const palm = (q = front): Palm => ({ point: { x: .5, y: .6 }, span: .2, orientation: q.toArray() as Orientation, openness: 1, spread: 2, roll: 0 });
it('leaves a real gap outside the palm plane and shifts toward the space near the fingers', () => {
  const result = palmHoverPosition(palm(), 1);
  expect(result.point.y).toBeLessThan(.5);
  expect(result.depth).toBeGreaterThan(.1);
  expect(result.point.x).toBeCloseTo(.5);
});
it('rotates clearance with the palm rather than adding a fixed screen offset', () => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), Math.PI / 2).multiply(front);
  const result = palmHoverPosition(palm(q), 1);
  expect(result.point.x).toBeGreaterThan(.55);
  expect(result.point.y).toBeLessThan(.5);
  expect(Math.abs(result.depth)).toBeLessThan(.001);
});
it('scales the gap with hand size and correctly maps portrait coordinates', () => {
  const a = palmHoverPosition(palm(), 1);
  const b = palmHoverPosition({ ...palm(), span: .1 }, 1);
  expect(.6 - b.point.y).toBeCloseTo((.6 - a.point.y) / 2);
  const portrait = palmHoverPosition(palm(), .5);
  expect(.6 - portrait.point.y).toBeCloseTo((.6 - a.point.y) / 2);
});
it('keeps the anchor usable near viewport edges and without a valid pose', () => {
  const nearEdge = palmHoverPosition({ ...palm(), point: { x: .5, y: .01 } }, 1);
  expect(nearEdge.point.y).toBeGreaterThanOrEqual(.03);
  expect(palmHoverPosition({ ...palm(), orientation: undefined }, 1).point).toEqual({ x: .5, y: .6 });
});
