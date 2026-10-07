import { expect, it } from 'vitest';
import { InteractionController } from '../src/interaction';
import type { Gesture } from '../src/types';
const hand = (openness = 1, id = 'a'): Gesture => ({ id, point: { x: .2, y: .7 }, ratio: .8,
  palm: { point: { x: .2, y: .7 }, openness, spread: 2, roll: 0 } });
const make = () => new InteractionController({ x: .75, y: .55 }, .28, { summonOnOpen: true, palmClearance: true });
it('waits invisibly then summons at an open hand without grabbing the screen object', () => {
  const c = make(); expect(c.state.visible).toBe(false);
  c.update({ now: 0, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
  c.update({ now: 200, face: null, hands: [hand()] });
  expect(c.state).toMatchObject({ mode: 'palm', visible: true, position: { x: .2, y: .7 }, sizeFactor: 1, summonedAt: 200 });
  expect(c.activeHandId).toBe('a');
});
it('rejects a single noisy open frame, cached observations and hands outside the camera view', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] });
  c.update({ now: 240, observedAt: 0, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
  c.update({ now: 250, face: null, hands: [hand(.3)] });
  c.update({ now: 300, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
  const outside = hand(); outside.palm!.point.x = -.1;
  c.update({ now: 400, face: null, hands: [outside] });
  c.update({ now: 600, face: null, hands: [outside] });
  expect(c.state.visible).toBe(false);
});
it('does not resummon after setting down until the hand closes and opens again', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] });
  c.update({ now: 200, face: null, hands: [hand()] });
  c.release(null);
  c.update({ now: 300, face: null, hands: [hand()] });
  c.update({ now: 500, face: null, hands: [hand()] });
  expect(c.state.mode).toBe('floating');
  c.update({ now: 600, face: null, hands: [hand(.2)] });
  c.update({ now: 700, face: null, hands: [hand()] });
  c.update({ now: 900, face: null, hands: [hand()] });
  expect(c.state.mode).toBe('palm');
  expect(c.state.summonedAt).toBe(900);
});
it('cannot steal an existing crown or automatically remove a worn crown with a second open hand', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] });
  c.update({ now: 200, face: null, hands: [hand()] });
  c.update({ now: 240, face: null, hands: [hand(), hand(1,'b')] });
  c.update({ now: 440, face: null, hands: [hand(), hand(1,'b')] });
  expect(c.activeHandId).toBe('a');
  const face = { center: { x: .5, y: .5 }, crown: { x: .5, y: .25 }, width: .3, height: .4, rotation: [0,0,0] as [number,number,number] };
  c.wear(face);
  c.update({ now: 500, face, hands: [hand(.2,'c')] });
  c.update({ now: 600, face, hands: [hand(1,'c')] });
  c.update({ now: 800, face, hands: [hand(1,'c')] });
  expect(c.state.mode).toBe('worn');
});
it('reset waits for a fresh opening instead of popping straight back into the same open hand', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] });
  c.update({ now: 200, face: null, hands: [hand()] }); c.reset();
  c.update({ now: 300, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
  c.newSession();
  c.update({ now: 400, face: null, hands: [hand()] });
  c.update({ now: 600, face: null, hands: [hand()] });
  expect(c.state.mode).toBe('palm');
});
it('setting down during an incomplete opening requires another close', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] }); c.update({ now: 200, face: null, hands: [hand()] });
  c.update({ now: 250, face: null, hands: [hand(.2)] });
  c.update({ now: 300, face: null, hands: [hand()] }); c.release(null);
  c.update({ now: 400, face: null, hands: [hand()] }); c.update({ now: 600, face: null, hands: [hand()] });
  expect(c.state.mode).toBe('floating');
});
it('reset cancels a pending first opening until the hand closes again', () => {
  const c = make(); c.update({ now: 0, face: null, hands: [hand()] }); c.reset();
  c.update({ now: 100, face: null, hands: [hand()] }); c.update({ now: 300, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
});
it('retains the close-to-rearm requirement across lost tracking and new hand identities', () => {
  const c = make();
  c.update({ now: 0, face: null, hands: [hand()] }); c.update({ now: 200, face: null, hands: [hand()] }); c.release(null);
  c.update({ now: 600, face: null, hands: [] });
  c.update({ now: 700, face: null, hands: [hand(1, 'new')] }); c.update({ now: 900, face: null, hands: [hand(1, 'new')] });
  expect(c.state.mode).toBe('floating');
  c.update({ now: 1000, face: null, hands: [hand(.2, 'new')] });
  c.update({ now: 1100, face: null, hands: [hand(1, 'new')] }); c.update({ now: 1300, face: null, hands: [hand(1, 'new')] });
  expect(c.state.mode).toBe('palm');
});
it('a closed sample captured before reset cannot rearm a pending opening', () => {
  const c = make(); c.update({ now: 0, face: null, hands: [hand()] });
  c.update({ now: 100, observedAt: 0, face: null, hands: [hand()] }); c.reset();
  c.update({ now: 110, observedAt: 90, face: null, hands: [hand(.2)] });
  c.update({ now: 200, observedAt: 180, face: null, hands: [hand()] });
  c.update({ now: 400, observedAt: 380, face: null, hands: [hand()] });
  expect(c.state.visible).toBe(false);
});
it('a closed sample captured before set-down cannot rearm summoning', () => {
  const c = make(); c.update({ now: 0, face: null, hands: [hand()] }); c.update({ now: 200, face: null, hands: [hand()] });
  c.update({ now: 300, observedAt: 200, face: null, hands: [hand()] }); c.release(null);
  c.update({ now: 310, observedAt: 290, face: null, hands: [hand(.2)] });
  c.update({ now: 400, observedAt: 380, face: null, hands: [hand()] });
  c.update({ now: 600, observedAt: 580, face: null, hands: [hand()] });
  expect(c.state.mode).toBe('floating');
});
