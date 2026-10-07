import { HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { describe, expect, it } from 'vitest';
import { InteractionController } from '../src/interaction';
import type { FacePose } from '../src/types';

const face: FacePose = { center: { x: .5, y: .48 }, crown: { x: .5, y: .25 }, width: .3, height: .4, rotation: [0, 0, 0] };
const closed = (x = .75, y = .55, id = 'Left') => ({ id, point: { x, y }, ratio: .2 });
const open = (x = .75, y = .55, id = 'Left') => ({ id, point: { x, y }, ratio: .7 });
const make = () => new InteractionController({ x: .75, y: .55 }, .28);

describe('crown interaction', () => {
  it('does not refresh face age when replaying the same observed frame', () => {
    const c = make(); c.wear(face);
    for (const now of [0, 100, 200, 251]) c.update({ now, observedAt: 0, face, hands: [] });
    expect(c.state.visible).toBe(false);
  });
  it('does not refresh hand age when replaying cached landmarks', () => {
    const c = make();
    for (const now of [0, 100, 200, 300, 1201]) c.update({ now, observedAt: 0, face, hands: [closed()] });
    expect(c.state.mode).toBe('floating');
  });
  it('uses capture time even when a tracking result arrives late', () => {
    const c = make(); c.wear(face);
    c.update({ now: 400, observedAt: 100, face, hands: [] });
    expect(c.state.visible).toBe(false);
  });
  it('grabs only when a pinch begins near the crown', () => {
    const c = make();
    c.update({ now: 0, face, hands: [closed(.1, .9)] });
    expect(c.state.mode).toBe('floating');
    c.update({ now: 20, face, hands: [closed()] });
    expect(c.state.mode).toBe('floating');
    c.update({ now: 40, face, hands: [open()] });
    c.update({ now: 60, face, hands: [closed()] });
    expect(c.state.mode).toBe('held');
  });
  it('preserves the grab offset instead of jumping to the fingers', () => {
    const c = make();
    expect(c.grab({ x: .8, y: .55 }, 'pointer', 0)).toBe(true);
    expect(c.state.position.x).toBe(.75);
    c.move({ x: .6, y: .35 }, 'pointer', 10);
    expect(c.state.position.x).toBeCloseTo(.55);
    expect(c.state.position.y).toBeCloseTo(.35);
  });
  it('attaches when released above the head and follows head motion', () => {
    const c = make();
    c.grab(c.state.position, 'pointer', 0);
    c.move(face.crown, 'pointer', 20);
    c.release(face);
    expect(c.state.mode).toBe('worn');
    c.update({ now: 30, face: { ...face, crown: { x: .6, y: .28 } }, hands: [] });
    expect(c.state.position).toEqual({ x: .6, y: .28 });
    expect(c.state.width).toBeCloseTo(.3 * HEAD_CROWN_WIDTH_FACTOR);
  });
  it('remains floating when released away from the head', () => {
    const c = make();
    c.grab(c.state.position, 'pointer', 0);
    c.release(face);
    expect(c.state.mode).toBe('floating');
  });
  it('does not attach when no face is tracked', () => {
    const c = make();
    c.grab(c.state.position, 'pointer', 0);
    c.move(face.crown, 'pointer', 10);
    c.release(null);
    expect(c.state.mode).toBe('floating');
  });
  it('can remove a worn crown by grabbing it again', () => {
    const c = make();
    c.wear(face);
    expect(c.grab(face.crown, 'pointer', 0)).toBe(true);
    expect(c.state.mode).toBe('held');
  });
  it('uses separate pinch and release thresholds', () => {
    const c = make();
    c.update({ now: 0, face, hands: [closed()] });
    c.update({ now: 20, face, hands: [{ ...closed(), ratio: .4 }] });
    expect(c.state.mode).toBe('held');
    c.update({ now: 40, face, hands: [open()] });
    expect(c.state.mode).toBe('floating');
  });
  it('keeps the original hand in control when another hand enters', () => {
    const c = make();
    c.update({ now: 0, face, hands: [closed()] });
    c.update({ now: 50, face, hands: [closed(.2, .1, 'Right'), closed(.7, .5)] });
    expect(c.state.position).toEqual({ x: .7, y: .5 });
  });
  it('holds through a brief hand gap and releases after 1200 ms without attaching', () => {
    const c = make();
    c.update({ now: 0, face, hands: [closed()] });
    c.update({ now: 50, face, hands: [closed(.5, .25)] });
    c.update({ now: 300, face, hands: [] });
    expect(c.state.mode).toBe('held');
    c.update({ now: 1251, face, hands: [] });
    expect(c.state.mode).toBe('floating');
  });
  it('hides a worn crown after 250 ms of face loss and restores on recovery', () => {
    const c = make();
    c.wear(face);
    c.update({ now: 0, face, hands: [] });
    c.update({ now: 200, face: null, hands: [] });
    expect(c.state.visible).toBe(true);
    c.update({ now: 251, face: null, hands: [] });
    expect(c.state.visible).toBe(false);
    c.update({ now: 300, face, hands: [] });
    expect(c.state.visible).toBe(true);
    expect(c.state.mode).toBe('worn');
  });
  it('cannot grab an invisible crown', () => {
    const c = make();
    c.wear(face);
    c.update({ now: 0, face, hands: [] });
    c.update({ now: 300, face: null, hands: [] });
    expect(c.grab(face.crown, 'pointer', 301)).toBe(false);
  });
  it('reset cancels a grab and restores the initial crown', () => {
    const c = make();
    c.grab(c.state.position, 'pointer', 0);
    c.move({ x: .2, y: .1 }, 'pointer', 30);
    c.reset();
    expect(c.state).toMatchObject({ mode: 'floating', position: { x: .75, y: .55 }, width: .28, visible: true });
    c.move({ x: .1, y: .1 }, 'pointer', 40);
    expect(c.state.position.x).toBe(.75);
  });
});
