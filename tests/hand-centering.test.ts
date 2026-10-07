import { expect,it } from 'vitest';
import { Quaternion,Vector3 } from 'three';
import { fingerGrip, fingertipAnchor } from '../src/fingertip-pose';
import { TrackingSmoother } from '../src/smoothing';
import type { Landmark } from '../src/types';
const flatHand=():Landmark[]=>{
 const p=Array.from({length:21},()=>({x:.6,y:.6,z:0}));
 p[0]={x:.62,y:.83,z:0};p[5]={x:.5,y:.57,z:0};p[9]={x:.6,y:.56,z:0};p[13]={x:.69,y:.59,z:0};p[17]={x:.77,y:.64,z:0};
 p[4]={x:.36,y:.75,z:0};p[8]={x:.44,y:.28,z:0};p[12]={x:.6,y:.2,z:0};p[16]={x:.72,y:.24,z:0};p[20]={x:.86,y:.39,z:0};return p;
};
it('centres a flat open hand over the palm instead of pulling toward the thumb',()=>{
 const g=fingerGrip(flatHand(),1,undefined,false,'Left');
 expect(g.point.x).toBeGreaterThan(.6);expect(g.point.x).toBeLessThan(.67);
 expect(g.point.y).toBeGreaterThan(.5);expect(g.point.y).toBeLessThan(.62);
});
it('preserves the thumb/finger gap for a cupped grip',()=>{
 const p=flatHand();for(const i of [5,9,13,17])p[i+3]={x:p[i].x,y:p[i].y-.035,z:-.15};
 const g=fingerGrip(p,1,p,false,'Left');expect(g.point).toEqual(fingertipAnchor(g.nodes));
});
it('uses hand shape rather than camera-facing angle to choose its centre',()=>{
 const p=flatHand(),g=fingerGrip(p,1,p,false,'Left'),q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1.4);
 const rotated=p.map(v=>new Vector3(v.x,v.y,v.z).applyQuaternion(q));
 const moved=fingerGrip(rotated,1,rotated,false,'Left');
 const expected=new Vector3(g.point.x,g.point.y,0).applyQuaternion(q);
 expect(moved.point.x).toBeCloseTo(expected.x);expect(moved.point.y).toBeCloseTo(expected.y);
});
it('preserves flat-hand centering after the actual tracking smoother',()=>{
 const g=fingerGrip(flatHand(),1,undefined,false,'Left');
 const filtered=new TrackingSmoother().process(null,[{id:'a',ratio:1,point:g.point,fingers:g}],0).hands[0].fingers!;
 expect(filtered.point).toEqual(g.point);expect(filtered.point.x).toBeGreaterThan(.6);
});
