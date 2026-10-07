import { expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { palmOrientation } from '../src/palm-pose';
import type { Landmark } from '../src/types';
const points = (): Landmark[] => {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  p[0] = { x: 0, y: .06, z: 0 }; p[9] = { x: 0, y: -.04, z: 0 };
  p[5] = { x: -.04, y: -.04, z: 0 }; p[17] = { x: .04, y: -.04, z: 0 };
  return p;
};
const normal = (p: Landmark[], mirror = true, world = true, aspect = 1) => {
  const q = palmOrientation(p, aspect, mirror, world);
  expect(q).not.toBeNull();
  return new Vector3(0, 1, 0).applyQuaternion(new Quaternion(...q!));
};
it('lays the crown in the palm plane rather than keeping a fixed camera-facing tilt', () => {
  expect(Math.abs(normal(points()).z)).toBeCloseTo(1);
});
it('turns edge-on when the palm turns sideways in depth', () => {
  const p = points().map(v => ({ x: v.z, y: v.y, z: -v.x }));
  expect(Math.abs(normal(p).x)).toBeCloseTo(1);
  expect(Math.abs(normal(p).z)).toBeLessThan(.001);
});
it('follows forward/backward palm pitch as well as screen rotation', () => {
  const p = points().map(v => ({ x: v.x, y: v.z, z: -v.y }));
  expect(Math.abs(normal(p).y)).toBeCloseTo(1);
});
it('does not change orientation when fingers curl or the hand translates', () => {
  const p = points(), q = palmOrientation(p, 1, true, true)!;
  const curled = p.map((v, i) => ({ x: v.x + .3, y: v.y + .2, z: v.z + (i > 17 || [6,7,8,10,11,12,14,15,16].includes(i) ? .05 : 0) }));
  expect(new Quaternion(...q).angleTo(new Quaternion(...palmOrientation(curled, 1, true, true)!))).toBeLessThan(.001);
});
it('mirrors a tilted palm exactly once and remains independent of viewport shape', () => {
  const p = points().map(v => ({ x: v.x * .7, y: v.y, z: v.x * .7 }));
  const a = normal(p, true), b = normal(p, false);
  expect(a.x * a.z).toBeCloseTo(-b.x * b.z);
  expect(normal(p, true, true, 2)).toEqual(normal(p, true, true, .5));
});
it('returns no pose for degenerate knuckles rather than generating NaNs', () => {
  expect(palmOrientation(Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })))).toBeNull();
});
it('keeps the flower side facing out of both palms, with and without selfie mirroring', () => {
  const left = points(), right = left.map(p => ({ ...p, x: -p.x }));
  for (const mirror of [false, true]) {
    for (const [p, label] of [[left, 'Left'], [right, 'Right']] as const) {
      const q = palmOrientation(p, 1, mirror, true, label)!;
      expect(new Vector3(0,1,0).applyQuaternion(new Quaternion(...q)).z).toBeCloseTo(1);
    }
  }
});
