import { HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { expect, it } from 'vitest';
import { InteractionController } from '../src/interaction';
import { Quaternion, Vector3 } from 'three';
import { fingertipAnchor } from '../src/fingertip-pose';
import { TrackingSmoother } from '../src/smoothing';
import type { Gesture } from '../src/types';
const front = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2).toArray() as [number,number,number,number];
const hand = (): Gesture => ({ id:'a',point:{x:.6,y:.6},ratio:.8,
  palm:{point:{x:.6,y:.7},openness:1,spread:2,roll:0,span:.15,orientation:[0,0,0,1]},
  fingers:{point:{x:.4,y:.4},nodes:Array.from({length:5},()=>({x:.4,y:.4})),orientation:front} });
it('summons at the fingertips and follows their pose even while the palm stays fixed', () => {
  const c = new InteractionController({x:.7,y:.5},.3,{summonOnOpen:true,palmClearance:true});
  const h=hand(); c.update({now:0,face:null,hands:[h]}); c.update({now:200,face:null,hands:[h]});
  expect(c.state.position).toEqual({x:.4,y:.4}); expect(c.state.depth).toBeGreaterThan(0);
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7).multiply(new Quaternion(...front)).toArray() as typeof front;
  h.fingers!.point={x:.3,y:.35}; h.fingers!.orientation=rotation;
  c.update({now:240,face:null,hands:[h]});
  expect(c.state.palmOrientation).toEqual(rotation); expect(c.state.position.x).toBeLessThan(.4);
});
it('freezes the last contact orientation for a collapsed fist and keeps ownership', () => {
  const c = new InteractionController({x:.7,y:.5},.3,{summonOnOpen:true}); const h=hand();
  c.update({now:0,face:null,hands:[h]}); c.update({now:200,face:null,hands:[h]});
  h.palm!.openness=.2; h.palm!.spread=.7; h.ratio=.2; h.fingers!.orientation=undefined;
  c.update({now:450,face:null,hands:[h]});
  expect(c.state.mode).toBe('palm'); expect(c.activeHandId).toBe('a'); expect(c.state.palmOrientation).toEqual(front);
});
it('keeps the smoothed hold anchor centred on the smoothed visible fingertip nodes', () => {
  const s=new TrackingSmoother(),h=hand(); s.process(null,[h],0);
  h.fingers!.nodes[0].x=.8;
  const g=s.process(null,[h],40).hands[0].fingers!;
  expect(g.point.x).toBeCloseTo(fingertipAnchor(g.nodes).x);
  expect(g.point.x).toBeGreaterThan(.4); expect(g.point.x).toBeLessThan(.6);
  expect(Math.hypot(...g.orientation!)).toBeCloseTo(1);
});
it('clears hand scale and hover depth when worn, then follows head distance', () => {
  const c = new InteractionController({x:.7,y:.5},.3); c.state.sizeFactor=2.2; c.state.depth=.4;
  const face={center:{x:.5,y:.5},crown:{x:.5,y:.25},width:.3,height:.4,rotation:[0,0,0] as [number,number,number]};
  c.wear(face); expect(c.state.sizeFactor).toBe(1); expect(c.state.depth).toBe(0); expect(c.state.width).toBeCloseTo(.3*HEAD_CROWN_WIDTH_FACTOR);
  c.update({now:200,face:{...face,width:.4},hands:[]}); expect(c.state.width).toBeCloseTo(.4*HEAD_CROWN_WIDTH_FACTOR);
});

it('a fist re-grab follows its fingertip anchor instead of wrist movement', () => {
  const c = new InteractionController({x:.4,y:.4},.3); const h=hand(); h.palm!.openness=.2;
  c.update({now:0,face:null,hands:[h]}); c.update({now:100,face:null,hands:[h]});
  expect(c.state.mode).toBe('held'); h.fingers!.point={x:.3,y:.35};
  c.update({now:140,face:null,hands:[h]}); expect(c.state.position).toEqual({x:.3,y:.35});
});
