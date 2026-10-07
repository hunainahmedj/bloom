import { expect,it } from 'vitest';
import { HandIdentityTracker } from '../src/hand-identity';
import { InteractionController } from '../src/interaction';
import type { Gesture } from '../src/types';
const hand=():Gesture=>({id:'a',point:{x:.6,y:.6},ratio:.8,palm:{point:{x:.6,y:.6},openness:1,spread:2,roll:0}});
it('retains and resumes the same grip after a 700 ms hand turn occlusion',()=>{
 const c=new InteractionController({x:.7,y:.5},.3,{summonOnOpen:true}),h=hand();
 c.update({now:0,face:null,hands:[h]});c.update({now:200,face:null,hands:[h]});
 c.update({now:800,face:null,hands:[]}); expect(c.state.mode).toBe('palm');
 h.palm!.point={x:.5,y:.6}; c.update({now:900,face:null,hands:[h]});
 expect(c.activeHandId).toBe('a');expect(c.state.position.x).toBeCloseTo(.5);
 c.update({now:2201,face:null,hands:[]});expect(c.state.mode).toBe('floating');
});
it('does not advance head placement or accept stale movement during recovery',()=>{
 const c=new InteractionController({x:.7,y:.5},.3,{summonOnOpen:true}),h=hand();
 c.update({now:0,face:null,hands:[h]});c.update({now:200,face:null,hands:[h]});
 h.palm!.point.x=.1;c.update({now:800,observedAt:200,face:null,hands:[h]});
 expect(c.state.position.x).toBeCloseTo(.6);expect(c.placementProgress).toBe(0);
});
it('keeps a spatial hand identity across a short occlusion while turning over',()=>{
 const tracker=new HandIdentityTracker();
 const detection={label:'Left',landmarks:Array.from({length:21},()=>({x:.6,y:.6,z:0}))};
 const first=tracker.assign([detection],0)[0];tracker.assign([],400);
 expect(tracker.assign([{...detection,label:'Right'}],800)[0]).toMatchObject({id:first.id,handedness:'Left'});
});

it('keeps identity when turning over shifts the projected wrist by 36% of the frame',()=>{
 const tracker=new HandIdentityTracker();const points=(x:number,y:number)=>Array.from({length:21},()=>({x,y,z:0}));
 const first=tracker.assign([{label:'Left',landmarks:points(.82,.38)}],0)[0];tracker.assign([],100);
 const returned=tracker.assign([{label:'Left',landmarks:points(.87,.73)}],200)[0];expect(returned.id).toBe(first.id);
});

it('does not transfer a recovering grip to a distant opposite hand',()=>{
 const tracker=new HandIdentityTracker();const points=(x:number)=>Array.from({length:21},()=>({x,y:.5,z:0}));
 const first=tracker.assign([{label:'Left',landmarks:points(.2)}],200)[0];tracker.assign([],700);
 const next=tracker.assign([{label:'Right',landmarks:points(.6)}],900)[0];
 expect(next.id).not.toBe(first.id);expect(next.handedness).toBe('Right');
});

it('recovers a nearby turning hand despite a changed label after an occlusion',()=>{
 const tracker=new HandIdentityTracker();
 const points=(x:number,y:number)=>{
  const p=Array.from({length:21},()=>({x,y,z:0}));
  p[0]={x,y:y+.06,z:0};p[9]={x,y:y-.06,z:0};p[5]={x:x-.08,y,z:0};p[17]={x:x+.08,y,z:0};return p;
 };
 const first=tracker.assign([{label:'Left',landmarks:points(.75,.4)}],0)[0];tracker.assign([],200);
 const returned=tracker.assign([{label:'Right',landmarks:points(.816,.52)}],400)[0];
 expect(returned.id).toBe(first.id);expect(returned.handedness).toBe('Left');
});
