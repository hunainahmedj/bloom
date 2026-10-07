import { expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { fingerGrip } from '../src/fingertip-pose';
import type { Landmark } from '../src/types';
const points = (): Landmark[] => {
  const p = Array.from({length:21}, () => ({x:0,y:0,z:0}));
  p[0] = {x:0,y:.1,z:0}; p[9] = {x:0,y:0,z:0};
  p[5] = {x:-.04,y:0,z:0}; p[17] = {x:.04,y:0,z:0};
  p[4] = {x:-.08,y:-.03,z:0}; p[8] = {x:-.04,y:-.12,z:0};
  p[12] = {x:0,y:-.14,z:0}; p[16] = {x:.03,y:-.12,z:0}; p[20] = {x:.06,y:-.08,z:0};
  return p;
};
it('centres the model between all five fingertip nodes, away from the wrist', () => {
  const g = fingerGrip(points(), 1, undefined, false, 'Left');
  expect(g.nodes).toHaveLength(5); expect(g.point.x).toBeCloseTo(.00375,6); expect(g.point.y).toBeCloseTo(-.0065);
  expect(g.orientation).toBeDefined();
});
it('changes the contact plane when fingertips move while palm bones stay fixed', () => {
  const p = points(), initial = fingerGrip(p,1,undefined,false,'Left'); p[20].z = .07;
  const bent = fingerGrip(p,1,undefined,false,'Left');
  expect(new Quaternion(...initial.orientation!).angleTo(new Quaternion(...bent.orientation!))).toBeGreaterThan(.2);
});
it('responds to an individual fingertip without moving the palm', () => {
  const p = points(), a = fingerGrip(p,1,undefined,false,'Left'); p[12].x += .1;
  expect(fingerGrip(p,1,undefined,false,'Left').point.x).toBeGreaterThan(a.point.x);
});
it('keeps the contact plane on the outward palm side for both hands and mirror settings', () => {
  for (const mirror of [false,true]) for (const label of ['Left','Right']) {
    const p = points().map(p => ({...p,x:p.x*(label==='Right'?-1:1)}));
    const q = fingerGrip(p,1,undefined,mirror,label).orientation!;
    expect(new Vector3(0,1,0).applyQuaternion(new Quaternion(...q)).z).toBeCloseTo(1);
  }
});
it('uses the hand frame when a closed grip collapses the nodes', () => {
  const p = points(); for (const i of [4,8,12,16,20]) p[i] = {x:0,y:0,z:0};
  const g = fingerGrip(p,1); expect(g.orientation).toBeDefined(); expect(Number.isFinite(g.point.x)).toBe(true);
});
it('uses world fingertip depth while taking the anchor from the image', () => {
  const p = points(), world = points(); world[20].z=.07;
  const a = fingerGrip(p,2,world,true,'Left'), b = fingerGrip(p,.5,world,true,'Left');
  expect(a.point).toEqual(b.point); expect(a.orientation).toEqual(b.orientation);
});
it('keeps following the hand through an ambiguous fingertip plane', () => {
  for (const jitter of [-.001,.001]) {
    const p=points(); p[4]={x:0,y:0,z:0}; p[20]={x:.14,y:0,z:0}; p[8]={x:.06,y:-jitter,z:-.05};
    expect(fingerGrip(p,1,undefined,false,'Left').orientation).toBeDefined();
  }
});

it('rotates a curled hand continuously through full turns on all three axes', () => {
  for (const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]) {
    const p=points(); for (const i of [4,8,12,16,20]) p[i]={x:0,y:0,z:0};
    const initial=fingerGrip(p,1,p,false,'Left').orientation;
    expect(initial).toBeDefined();
    for (const angle of [Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]) {
      const rotation=new Quaternion().setFromAxisAngle(axis,angle);
      const moved=p.map(v=>new Vector3(v.x,v.y,v.z).applyQuaternion(rotation));
      const pose=fingerGrip(moved,1,moved,false,'Left').orientation;
      expect(pose).toBeDefined();
      const expectedAxis=new Vector3(axis.x,-axis.y,-axis.z);
      const expected=new Quaternion().setFromAxisAngle(expectedAxis,angle).multiply(new Quaternion(...initial!));
      expect(expected.angleTo(new Quaternion(...pose!))).toBeLessThan(.001);
    }
  }
});
it('limits fingertip deformation so it cannot cancel a palm-to-back turn', () => {
  const p=points(); p[20].z=.16;
  const q=fingerGrip(p,1,p,false,'Left').orientation!;
  const normal=new Vector3(0,1,0).applyQuaternion(new Quaternion(...q));
  expect(normal.z).toBeGreaterThan(Math.cos(Math.PI/6));
});
