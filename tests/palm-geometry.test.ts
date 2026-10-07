import { describe, expect, it } from 'vitest';
import { handGesture } from '../src/coordinates';
import type { Landmark } from '../src/types';

function landmarks(curled = false, fan = .08): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .75, z: 0 }));
  p[0] = { x: .5, y: .8, z: 0 };
  for (let finger = 0; finger < 4; finger++) {
    const base = 5 + finger * 4, x = .41 + finger * .06;
    p[base] = { x, y: .6, z: 0 };
    for (let joint = 1; joint <= 3; joint++) {
      p[base + joint] = { x: x + (finger - 1.5) * fan * joint / 3, y: curled ? [.49, .56, .66][joint - 1] : .6 - joint * .09, z: 0 };
    }
  }
  p[4] = { x: .35, y: .55, z: 0 };
  return p;
}

describe('palm measurements', () => {
  it('distinguishes a fist from straight fingers', () => {
    expect(handGesture(landmarks(), 1).palm.openness).toBeGreaterThan(.9);
    expect(handGesture(landmarks(true, 0), 1).palm.openness).toBeLessThan(.48);
  });
  it('changes sizing with finger spread and curl', () => {
    const together = handGesture(landmarks(false, 0), 1);
    const spread = handGesture(landmarks(false, .08), 1);
    const fist = handGesture(landmarks(true, 0), 1);
    expect(spread.palm.spread).toBeGreaterThan(together.palm.spread * 1.5);
    expect(fist.palm.spread).toBeLessThan(together.palm.spread * .7);
  });
  it('keeps palm position stable while fingertips move', () => {
    expect(handGesture(landmarks(true, 0), 1).palm.point).toEqual(handGesture(landmarks(false, .1), 1).palm.point);
  });
  it('keeps sizing independent of distance to the camera', () => {
    const near = handGesture(landmarks(), 1.33);
    const far = handGesture(landmarks().map(p => ({ x: .3 + p.x * .5, y: .1 + p.y * .5, z: p.z * .5 })), 1.33);
    expect(far.palm.spread).toBeCloseTo(near.palm.spread);
    expect(far.palm.openness).toBeCloseTo(near.palm.openness);
  });
  it('uses depth when fingers point toward the camera', () => {
    const p = landmarks(false, 0);
    for (const base of [5, 9, 13, 17]) for (let joint = 1; joint <= 3; joint++) {
      p[base + joint] = { x: p[base].x, y: p[base].y, z: -joint * .09 };
    }
    expect(handGesture(p, 1).palm.openness).toBeGreaterThan(.9);
  });
  it('keeps finger shape and size steady while the palm rotates in depth', () => {
    const world = landmarks(), rotated = world.map(p => ({ x: p.z, y: p.y, z: -p.x }));
    const a = handGesture(world, 1.5, world);
    const b = handGesture(rotated, .5, rotated);
    expect(b.palm.spread).toBeCloseTo(a.palm.spread);
    expect(b.palm.openness).toBeCloseTo(a.palm.openness);
    expect(b.ratio).toBeCloseTo(a.ratio);
  });
});
