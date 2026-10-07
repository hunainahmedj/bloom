import { CrownScene } from '../src/scene';
import { InteractionController } from '../src/interaction';
import { handGesture } from '../src/coordinates';
import { HandMenu } from '../src/hand-menu';
import { TrackingSmoother } from '../src/smoothing';
import type { Gesture,Landmark } from '../src/types';
const stage=document.getElementById('stage')!,pointer=document.getElementById('pointer')!,scene=new CrownScene(document.getElementById('scene') as HTMLCanvasElement,{showHead:true});scene.preview(false);
const controller=new InteractionController({x:.5,y:.5},.3),menu=new HandMenu(),smoother=new TrackingSmoother();
const face={center:{x:.5,y:.5},crown:{x:.5,y:.23},width:.32,height:.4,rotation:[.18,0,0] as [number,number,number]};controller.wear(face);
let aiming:string|null=null,pinch=false,style='Garden',mood='Natural',action='none',previous=performance.now(),observed=-Infinity;
document.getElementById('aim-rose')!.onclick=()=>{aiming='style-rose';pinch=false;};
document.getElementById('aim-party')!.onclick=()=>{aiming='mood-party';pinch=false;};
document.getElementById('release')!.onclick=()=>{aiming=null;pinch=false;};
document.getElementById('pinch')!.onclick=()=>{aiming=null;pinch=true;};
document.getElementById('reset')!.onclick=()=>{controller.wear(face);aiming=null;pinch=false;menu.reset();smoother.reset();};
document.getElementById('style-rose')!.onclick=()=>{scene.setStyle('rose');style='Rose';document.getElementById('style-rose')!.setAttribute('aria-pressed','true');};
document.getElementById('mood-party')!.onclick=()=>{scene.setMood('party');mood='Party';document.getElementById('mood-party')!.setAttribute('aria-pressed','true');};
new ResizeObserver(()=>scene.resize({width:stage.clientWidth,height:stage.clientHeight})).observe(stage);
function observation(x:number,y:number):Gesture{
 const world:Landmark[]=Array.from({length:21},()=>({x:0,y:0,z:0}));world[0]={x:0,y:.09,z:0};world[4]={x:.07,y:.01,z:0};
 for(const [n,k] of [5,9,13,17].entries()){
  const x=-.045+n*.03;world[k]={x,y:0,z:0};world[k+1]={x,y:-.04,z:0};world[k+2]={x,y:-.015,z:.025};world[k+3]={x,y:.015,z:.03};
 }
 world[6]={x:-.045,y:-.04,z:0};world[7]={x:-.045,y:-.08,z:0};world[8]={x:-.045,y:-.12,z:0};if(pinch)world[4]={...world[8]};
 const image=world.map(v=>({x:x+(v.x-world[8].x),y:y+(v.y-world[8].y)*stage.clientWidth/stage.clientHeight,z:v.z}));
 return {id:'simulated',...handGesture(image,stage.clientWidth/stage.clientHeight,world,true,'Left')};
}
function render(now:number){
 const rect=stage.getBoundingClientRect();
 const targets=['style-rose','mood-party'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return {id,x:(r.left-rect.left)/rect.width,y:(r.top-rect.top)/rect.height,width:r.width/rect.width,height:r.height/rect.height};});
 if(now-observed>40){
  const target=targets.find(t=>t.id===aiming),p=target?{x:target.x+target.width/2,y:target.y+target.height/2}:controller.state.position;
  const filtered=smoother.process(face,aiming||pinch?[observation(p.x,p.y)]:[],now);
  const select=menu.update({now,observedAt:now,hands:filtered.hands,targets,enabled:controller.state.mode==='worn'&&controller.state.visible});
  pointer.hidden=!select.point;if(select.point){pointer.style.left=`${select.point.x*100}%`;pointer.style.top=`${select.point.y*100}%`;pointer.style.setProperty('--dwell',String(select.progress));}
  if(select.activated){action=select.activated;document.getElementById(select.activated)!.click();}
  controller.update({now,observedAt:now,face:filtered.face,hands:filtered.hands.filter(h=>h.id!==select.consumedHandId),aspect:stage.clientWidth/stage.clientHeight});observed=now;
 }
 scene.render(controller.state,face,Math.min(.1,(now-previous)/1000));previous=now;
 document.getElementById('readout')!.textContent=`${controller.state.mode} · style ${style} · mood ${mood} · last selection ${action} · ${pinch?'pinching':aiming?'pointing':'no hand'}`;
 requestAnimationFrame(render);
}requestAnimationFrame(render);
