import { Euler,Matrix4,Quaternion,Vector3 } from 'three';
import { CrownScene } from '../src/scene';
import { facePose } from '../src/pose';
import { InteractionController } from '../src/interaction';
import { TrackingSmoother } from '../src/smoothing';
const stage=document.getElementById('stage')!,readout=document.getElementById('readout')!;
const scene=new CrownScene(document.getElementById('scene') as HTMLCanvasElement,{showHead:true});scene.preview(false);
const controller=new InteractionController({x:.5,y:.3},.3),smooth=new TrackingSmoother();
let pitch=.16,yaw=0,roll=0,label='front';
const face=()=>{
 const q=new Quaternion().setFromEuler(new Euler(pitch,yaw,roll,'YXZ'));
 const p=Array.from({length:478},()=>new Vector3());
 p[10].set(0,.45,0);p[152].set(0,-.45,0);p[234].set(-.31,0,0);p[454].set(.31,0,0);p[33].set(-.17,.16,.18);p[263].set(.17,.16,.18);
 const aspect=stage.clientWidth/stage.clientHeight;
 const points=p.map(v=>{const r=v.applyQuaternion(q);return {x:.5+r.x/(2*aspect),y:.58-r.y/2,z:-r.z/(2*aspect)};});
 const size={width:stage.clientWidth,height:stage.clientHeight};
 return facePose(points,new Matrix4().makeRotationFromQuaternion(q).toArray(),size,size,false);
};
const turn=(x:number,y:number,z:number,name:string)=>{pitch=x;yaw=y;roll=z;label=name;};
document.getElementById('front')!.onclick=()=>turn(.16,0,0,'front');
document.getElementById('left')!.onclick=()=>turn(.16,-.6,0,'left');
document.getElementById('right')!.onclick=()=>turn(.16,.6,0,'right');
document.getElementById('down')!.onclick=()=>turn(.65,0,0,'down');
document.getElementById('up')!.onclick=()=>turn(-.35,0,0,'up');
document.getElementById('roll')!.onclick=()=>turn(.16,0,.35,'roll');
document.getElementById('effects')!.onclick=()=>{const b=document.getElementById('effects')!,on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.textContent=on?'Effects on':'Effects off';scene.setEffects(on);};
new ResizeObserver(()=>scene.resize({width:stage.clientWidth,height:stage.clientHeight})).observe(stage);
let tracked=face();controller.wear(tracked);let previous=performance.now(),sample=0;
function render(now:number){
 const f=face();if(now-sample>33){const filtered=smooth.process(f,[],now);tracked=filtered.face!;controller.update({now,face:filtered.face,hands:[],aspect:stage.clientWidth/stage.clientHeight});sample=now;}
 scene.render(controller.state,tracked,Math.min(.1,(now-previous)/1000));previous=now;
 readout.textContent=`${label} · ${controller.state.mode} · head fit ${Math.round((controller.state.sizeFactor??1)*100)}% · crown y ${controller.state.position.y.toFixed(3)} · depth ${(controller.state.depth??0).toFixed(3)}`;
 requestAnimationFrame(render);
}
requestAnimationFrame(render);
