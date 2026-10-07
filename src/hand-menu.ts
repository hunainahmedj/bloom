import type { Gesture,Point } from './types';
import { PINCH_RELEASE } from './interaction';
export interface HandTarget {id:string;x:number;y:number;width:number;height:number}
export interface HandMenuInput {now:number;observedAt:number;hands:Gesture[];targets:HandTarget[];enabled:boolean}
interface Selection {target:string|null;progress:number;activated:string|null;point:Point|null;consumedHandId:string|null}
const empty=():Selection=>({target:null,progress:0,activated:null,point:null,consumedHandId:null});
/** Deliberate index-point dwell, measured on fresh observations, never render ticks. */
export class HandMenu {
 private started=0;
 private owner:string|null=null;
 private target:string|null=null;
 private fired=false;
 private observed=-Infinity;
 private result=empty();
 reset(){this.owner=null;this.target=null;this.fired=false;this.observed=-Infinity;this.result=empty();}
 update(input:HandMenuInput):Selection {
  const hand=input.hands.find(h=>h.uiPointing&&h.ratio>=PINCH_RELEASE&&h.fingers?.nodes[1]);
  if(!input.enabled||!hand||input.now-input.observedAt>250){this.reset();return this.result;}
  const point=hand.fingers!.nodes[1];
  const hit=input.targets.find(t=>point.x>=t.x&&point.x<=t.x+t.width&&point.y>=t.y&&point.y<=t.y+t.height)?.id??null;
  if(input.observedAt<=this.observed)return {...this.result,activated:null};
  if(input.observedAt-this.observed>350||hand.id!==this.owner||hit!==this.target){this.started=input.observedAt;this.fired=false;}
  this.observed=input.observedAt;this.owner=hand.id;this.target=hit;
  const progress=hit?Math.min(1,(input.observedAt-this.started)/700):0;
  const activated=hit&&progress===1&&!this.fired?hit:null;if(activated)this.fired=true;
  this.result={target:hit,progress,activated,point,consumedHandId:hand.id};return this.result;
 }
}
