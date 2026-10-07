import { HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { describe, expect, it } from 'vitest';
import { InteractionController } from '../src/interaction';
import type { FacePose, Gesture } from '../src/types';

const face: FacePose = { center: { x: .5, y: .48 }, crown: { x: .5, y: .25 }, width: .3, height: .4, rotation: [0, 0, 0] };
const hand = (openness = 1, spread = 2, x = .75, y = .55, ratio = .8, id = 'hand-1'): Gesture => ({
  id, point: { x, y }, ratio, palm: { point: { x, y }, openness, spread, roll: .2 },
});
const make = () => new InteractionController({ x: .75, y: .55 }, .28);
function grab(c: InteractionController) {
  c.update({ now: 0, face, hands: [hand(.2)] });
  c.update({ now: 100, face, hands: [hand(.2)] });
}
function open(c: InteractionController) {
  c.update({ now: 140, face, hands: [hand()] });
  c.update({ now: 340, face, hands: [hand()] });
}

describe('palm interaction', () => {
  it('carries palm orientation through both the closed grip and open hold', () => {
    const c = make();
    const q: [number, number, number, number] = [0, .707, 0, .707];
    const rotated = hand(.2); rotated.palm!.orientation = q;
    c.update({ now: 0, face, hands: [rotated] });
    c.update({ now: 100, face, hands: [rotated] });
    expect(c.state.palmOrientation).toEqual(q);
    const opened = hand(); opened.palm!.orientation = [0, 0, 0, 1];
    c.update({ now: 140, face, hands: [opened] });
    expect(c.state.mode).toBe('palm');
    expect(c.state.palmOrientation).toEqual([0, 0, 0, 1]);
  });
  it('keeps the original size while the fist finishes opening', () => {
    const c = make(); grab(c);
    c.update({ now: 140, face, hands: [hand(.7, 1)] });
    for (const now of [180, 220, 260, 300, 340]) c.update({ now, face, hands: [hand(1, 2)] });
    expect(c.state.mode).toBe('palm');
    expect(c.state.sizeFactor).toBeCloseTo(1);
  });
  it('fits a small carried crown to the head without requiring the fingers to reopen', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(.2, .7, .75, .55, .2)] });
    c.update({ now: 420, face, hands: [hand(.2, .7, .5, .25, .2)] });
    c.update({ now: 600, face, hands: [hand(.2, .7, .5, .25, .2)] });
    c.update({ now: 800, face, hands: [hand(.2, .7, .5, .25, .2)] });
    expect(c.state.mode).toBe('worn');
    expect(c.state.width).toBeCloseTo(face.width * HEAD_CROWN_WIDTH_FACTOR);
  });
  it('requires a sustained grip near the crown, ignoring one noisy frame', () => {
    const c = make();
    c.update({ now: 0, face, hands: [hand(.2)] });
    expect(c.state.mode).toBe('floating');
    c.update({ now: 40, face, hands: [hand()] });
    c.update({ now: 140, face, hands: [hand()] });
    expect(c.state.mode).toBe('floating');
    c.update({ now: 200, face, hands: [hand(.2)] });
    c.update({ now: 300, face, hands: [hand(.2)] });
    expect(c.state.mode).toBe('held');
  });
  it('keeps the crown on the palm when a fist opens', () => {
    const c = make(); grab(c); open(c);
    expect(c.state.mode).toBe('palm');
    c.update({ now: 380, face, hands: [hand(1, 2, .6, .6)] });
    expect(c.state.position).toEqual({ x: .6, y: .6 });
    expect(c.activeHandId).toBe('hand-1');
  });
  it('also transfers a released pinch to the palm', () => {
    const c = make();
    c.update({ now: 0, face, hands: [hand(1, 2, .75, .55, .2)] });
    c.update({ now: 100, face, hands: [hand(1, 2, .75, .55, .2)] });
    open(c);
    expect(c.state.mode).toBe('palm');
  });
  it('resizes with finger spread and curl, without dropping a closed fist', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(1, 3)] });
    expect(c.state.width).toBeCloseTo(.42);
    c.update({ now: 420, face, hands: [hand(.2, .7, .75, .55, .2)] });
    c.update({ now: 540, face, hands: [hand(.2, .7, .75, .55, .2)] });
    expect(c.state.width).toBeLessThan(.28);
    expect(c.state.mode).toBe('palm');
  });
  it('automatically fits a large carried crown when placed on the head', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(1, 3)] });
    c.update({ now: 420, face, hands: [hand(1, 3, .5, .25)] });
    c.update({ now: 600, face, hands: [hand(1, 3, .5, .25)] });
    expect(c.state.mode).toBe('palm');
    c.update({ now: 800, face, hands: [hand(1, 3, .5, .25)] });
    expect(c.state.mode).toBe('worn');
    expect(c.state.width).toBeCloseTo(face.width * HEAD_CROWN_WIDTH_FACTOR);
    c.update({ now: 850, face: { ...face, width: .4 }, hands: [] });
    expect(c.state.width).toBeCloseTo(.4 * HEAD_CROWN_WIDTH_FACTOR);
  });
  it('does not accumulate grab or head-placement dwell from cached frames', () => {
    const c = make();
    c.update({ now: 0, observedAt: 0, face, hands: [hand(.2)] });
    c.update({ now: 200, observedAt: 0, face, hands: [hand(.2)] });
    expect(c.state.mode).toBe('floating');
    c.update({ now: 250, face, hands: [hand(.2)] });
    c.update({ now: 280, face, hands: [hand()] });
    c.update({ now: 300, face, hands: [hand(1, 2, .5, .25)] });
    c.update({ now: 620, observedAt: 300, face, hands: [hand(1, 2, .5, .25)] });
    expect(c.state.mode).toBe('palm');
  });
  it('keeps holding through the pinch-like intermediate poses of closing a fist', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(.9, 2, .75, .55, .2)] });
    expect(c.state.mode).toBe('palm');
    c.update({ now: 490, face, hands: [hand(.9, 2, .75, .55, .2)] });
    expect(c.state.mode).toBe('palm');
    expect(c.activeHandId).toBe('hand-1');
    c.update({ now: 530, face, hands: [hand(.9, 2, .75, .55, .2)] });
    expect(c.state.mode).toBe('palm');
    c.update({ now: 570, face, hands: [hand(.3, .7, .75, .55, .2)] });
    expect(c.state.mode).toBe('palm');
    c.release(null);
    expect(c.state.mode).toBe('floating');
  });
  it('releases after real hand loss without snapping onto the nearby head', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(1, 2, .5, .25)] });
    c.update({ now: 1581, face, hands: [] });
    expect(c.state.mode).toBe('floating');
  });
  it('retains ownership when a second hand enters and resets resizing', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(1, 4, .1, .1, .2, 'hand-2'), hand(1, 3, .65, .5)] });
    expect(c.activeHandId).toBe('hand-1');
    expect(c.state.width).toBeCloseTo(.42);
    c.reset();
    expect(c.state.width).toBe(.28);
    expect(c.state.sizeFactor).toBe(1);
  });
  it('requires a continuous grip rather than two detections separated by a gap', () => {
    const c = make();
    c.update({ now: 0, face, hands: [hand(.2)] });
    c.update({ now: 100, face, hands: [] });
    c.update({ now: 200, face, hands: [hand(.2)] });
    expect(c.state.mode).toBe('floating');
  });
  it('restarts head placement after a missed hand detection', () => {
    const c = make(); grab(c); open(c);
    c.update({ now: 380, face, hands: [hand(1, 2, .5, .25)] });
    c.update({ now: 550, face, hands: [] });
    c.update({ now: 700, face, hands: [hand(1, 2, .5, .25)] });
    expect(c.state.mode).toBe('palm');
    expect(c.placementProgress).toBe(0);
    c.update({ now: 750, face, hands: [hand(1, 2, .5, .25)] });
    expect(c.state.mode).toBe('palm');
  });
  it('does not complete a grip after a long camera-frame gap', () => {
    const c = make();
    c.update({ now: 0, face, hands: [hand(.2)] });
    c.update({ now: 300, face, hands: [hand(.2)] });
    expect(c.state.mode).toBe('floating');
  });
});
