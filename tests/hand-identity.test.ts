import { expect, it } from 'vitest';
import { HandIdentityTracker } from '../src/hand-identity';
const hand = (x: number, label: string) => ({ label, landmarks: Array.from({ length: 21 }, () => ({ x, y: .5, z: 0 })) });
it('keeps spatial identity when labels change or detections reorder', () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.assign([hand(.2, 'Left'), hand(.8, 'Right')], 0);
  const next = tracker.assign([hand(.78, 'Left'), hand(.22, 'Right')], 30);
  expect(next[0].id).toBe(first[1].id);
  expect(next[1].id).toBe(first[0].id);
});
it('never gives two detections the same identity even with duplicate labels', () => {
  const tracker = new HandIdentityTracker();
  const result = tracker.assign([hand(.2, 'Left'), hand(.8, 'Left')], 0);
  expect(new Set(result.map(h => h.id)).size).toBe(2);
});
it('preserves the first identity when a second hand enters', () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.assign([hand(.4, 'Left')], 0);
  const result = tracker.assign([hand(.8, 'Left'), hand(.41, 'Left')], 30);
  expect(result[1].id).toBe(first[0].id);
  expect(result[0].id).not.toBe(first[0].id);
});
it('recovers a briefly missing hand and expires old identities', () => {
  const tracker = new HandIdentityTracker();
  const first = tracker.assign([hand(.4, 'Left')], 0);
  tracker.assign([], 100);
  expect(tracker.assign([hand(.42, 'Right')], 200)[0].id).toBe(first[0].id);
  tracker.assign([], 1400);
  expect(tracker.assign([hand(.42, 'Left')], 1500)[0].id).not.toBe(first[0].id);
});
it('keeps world pose paired with its hand and latches handedness through noisy labels', () => {
  const tracker = new HandIdentityTracker();
  const a = { ...hand(.2, 'Left'), worldLandmarks: hand(.3, '').landmarks };
  const b = { ...hand(.8, 'Right'), worldLandmarks: hand(.9, '').landmarks };
  const first = tracker.assign([a, b], 0);
  const next = tracker.assign([{ ...b, label: 'Left' }, { ...a, label: 'Right' }], 40);
  expect(next[0].id).toBe(first[1].id);
  expect(next[0].worldLandmarks).toBe(b.worldLandmarks);
  expect(next[0].handedness).toBe('Right');
  expect(next[1].handedness).toBe('Left');
});
