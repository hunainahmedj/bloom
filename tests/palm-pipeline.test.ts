import { HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { expect, it } from 'vitest';
import { InteractionController } from '../src/interaction';
import { TrackingSmoother } from '../src/smoothing';
import type { FacePose } from '../src/types';

it('carries a fist through smoothed opening, resize, curl and head placement', () => {
  const c = new InteractionController({ x: .75, y: .6 }, .28), s = new TrackingSmoother();
  const face: FacePose = { center: { x: .5, y: .45 }, crown: { x: .5, y: .23 }, width: .3, height: .4, rotation: [0, 0, 0] };
  const observe = (now: number, openness: number, spread: number, ratio = .8, x = .75, y = .6) => {
    const frame = s.process(face, [{ id: 'a', point: { x, y }, ratio, palm: { point: { x, y }, openness, spread, roll: 0 } }], now);
    c.update({ now, ...frame });
  };
  for (let now = 0; now <= 120; now += 40) observe(now, .2, .4);
  expect(c.state.mode).toBe('held');
  for (let now = 160; now <= 600; now += 40) observe(now, 1, 2);
  expect(c.state.mode).toBe('palm');
  expect(c.state.sizeFactor).toBeGreaterThanOrEqual(.98);
  expect(c.state.sizeFactor).toBeLessThanOrEqual(1.02);
  for (let now = 640; now <= 1000; now += 40) observe(now, 1, 3);
  expect(c.state.sizeFactor).toBeGreaterThan(1.48);
  expect(c.state.sizeFactor).toBeLessThan(1.53);
  for (let now = 1040; now <= 1320; now += 40) observe(now, .2, .7, .2);
  expect(c.state.mode).toBe('palm');
  expect(c.state.sizeFactor).toBeCloseTo(.45);
  for (let now = 1360; now <= 1880; now += 40) observe(now, .2, .7, .2, .5, .23);
  expect(c.state.mode).toBe('worn');
  expect(c.state.width).toBeCloseTo(.3 * HEAD_CROWN_WIDTH_FACTOR);
});
