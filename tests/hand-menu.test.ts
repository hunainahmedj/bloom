import { expect,it } from 'vitest';
import { HandMenu } from '../src/hand-menu';
import type { Gesture } from '../src/types';
const targets=[{id:'rose',x:.1,y:.7,width:.25,height:.2},{id:'party',x:.6,y:.7,width:.25,height:.2}];
const hand=(id='a',x=.2,pointing=true):Gesture=>({id,point:{x,y:.8},ratio:.9,uiPointing:pointing,fingers:{point:{x,y:.8},nodes:[{x,y:.8},{x,y:.8},{x,y:.8},{x,y:.8},{x,y:.8}]}});
it('selects a hovered option after a deliberate pointing dwell, once until leaving',()=>{
 const menu=new HandMenu(),input=(time:number,x=.2)=>({now:time,observedAt:time,hands:[hand('a',x)],targets,enabled:true});
 expect(menu.update(input(0)).activated).toBeNull();for(let t=100;t<400;t+=100)menu.update(input(t));expect(menu.update(input(400)).progress).toBeGreaterThan(.4);
 for(let t=500;t<700;t+=100)menu.update(input(t));expect(menu.update(input(700)).activated).toBe('rose');expect(menu.update(input(1000)).activated).toBeNull();
 menu.update(input(1100,.45));menu.update(input(1200));for(let t=1300;t<1900;t+=100)menu.update(input(t));expect(menu.update(input(1900)).activated).toBe('rose');
});
it('does not activate from an open palm, a stale frame or repeated render frames',()=>{
 const menu=new HandMenu();
 expect(menu.update({now:0,observedAt:0,hands:[hand('a',.2,false)],targets,enabled:true}).consumedHandId).toBeNull();
 menu.update({now:100,observedAt:100,hands:[hand()],targets,enabled:true});
 expect(menu.update({now:900,observedAt:100,hands:[hand()],targets,enabled:true}).activated).toBeNull();
 expect(menu.update({now:900,observedAt:100,hands:[hand()],targets,enabled:true}).progress).toBe(0);
});
it('resets dwell when the hand, target, tracking or worn state changes',()=>{
 for(const reason of ['hand','target','hidden','lost']){
  const menu=new HandMenu();menu.update({now:0,observedAt:0,hands:[hand()],targets,enabled:true});
  menu.update({now:500,observedAt:500,hands:reason==='lost'?[]:[hand(reason==='hand'?'b':'a',reason==='target'?.7:.2)],targets,enabled:reason!=='hidden'});
  expect(menu.update({now:750,observedAt:750,hands:[hand()],targets,enabled:true}).activated).toBeNull();
 }
});
it('reserves a pointing hand for settings even before it reaches an option',()=>{
 const menu=new HandMenu();expect(menu.update({now:0,observedAt:0,hands:[hand('a',.45)],targets,enabled:true}).consumedHandId).toBe('a');
});
it('does not consume a closed pinch that should remove the worn crown',()=>{
 const menu=new HandMenu(),pinch={...hand(),ratio:.1};
 expect(menu.update({now:0,observedAt:0,hands:[pinch],targets,enabled:true}).consumedHandId).toBeNull();
});
