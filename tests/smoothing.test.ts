import { expect, it } from 'vitest';
import { OneEuroFilter, TrackingSmoother } from '../src/smoothing';

it('reduces stationary landmark jitter instead of moving the crown with every small error', () => {
  const f = new OneEuroFilter(1.5, 5);
  f.filter(.5, 0);
  const values = [.504, .496, .503, .497].map((value, i) => f.filter(value, (i + 1) * 40));
  expect(Math.max(...values) - Math.min(...values)).toBeLessThan(.004);
});
it('follows a deliberate fast movement without the lag of a fixed low-pass filter', () => {
  const adaptive = new OneEuroFilter(1.5, 5), fixed = new OneEuroFilter(1.5, 0);
  adaptive.filter(.2, 0); fixed.filter(.2, 0);
  const a = adaptive.filter(.7, 40), b = fixed.filter(.7, 40);
  expect(a).toBeGreaterThan(b + .15);
  expect(a).toBeLessThanOrEqual(.7);
});
it('does not smooth the same observation again when its timestamp is replayed', () => {
  const f = new OneEuroFilter(1.5, 5);
  f.filter(.2, 0);
  const first = f.filter(.7, 40);
  expect(f.filter(.7, 40)).toBe(first);
});
it('resets after a long tracking gap rather than dragging from the old hand position', () => {
  const f = new OneEuroFilter(1.5, 5);
  f.filter(.2, 0);
  expect(f.filter(.8, 1000)).toBe(.8);
});
it('keeps different hands independent and resets filters between camera sessions', () => {
  const s = new TrackingSmoother();
  const hand = (id: string, x: number) => ({ id, point: { x, y: .5 }, ratio: .8 });
  s.process(null, [hand('a', .2)], 0);
  const result = s.process(null, [hand('b', .8), hand('a', .204)], 40);
  expect(result.hands[0].point.x).toBe(.8);
  expect(result.hands[1].point.x).toBeLessThan(.204);
  s.reset();
  expect(s.process(null, [hand('a', .9)], 80).hands[0].point.x).toBe(.9);
});
it('smooths palm rotation across the angle wrap instead of flipping through zero', () => {
  const s = new TrackingSmoother();
  const hand = (roll: number) => ({ id: 'a', point: { x: .5, y: .5 }, ratio: .8,
    palm: { point: { x: .5, y: .5 }, spread: 2, openness: 1, roll } });
  s.process(null, [hand(3.1)], 0);
  const roll = s.process(null, [hand(-3.1)], 40).hands[0].palm!.roll;
  expect(roll).toBeGreaterThan(3.1);
  expect(roll).toBeLessThan(3.2);
});
it('smooths full 3D palm rotation and treats opposite quaternion signs as the same pose', () => {
  const s = new TrackingSmoother();
  const hand = (orientation: [number, number, number, number]) => ({ id: 'a', point: { x: .5, y: .5 }, ratio: .8,
    palm: { point: { x: .5, y: .5 }, spread: 2, openness: 1, roll: 0, orientation } });
  s.process(null, [hand([0, 0, 0, 1])], 0);
  const q = s.process(null, [hand([0, Math.SQRT1_2, 0, Math.SQRT1_2])], 40).hands[0].palm!.orientation!;
  expect(q[1]).toBeGreaterThan(0);
  expect(q[1]).toBeLessThan(Math.SQRT1_2);
  expect(Math.hypot(...q)).toBeCloseTo(1);
  s.reset();
  s.process(null, [hand([0, Math.SQRT1_2, 0, Math.SQRT1_2])], 0);
  expect(s.process(null, [hand([0, -Math.SQRT1_2, 0, -Math.SQRT1_2])], 40).hands[0].palm!.orientation![1]).toBeCloseTo(Math.SQRT1_2);
});
