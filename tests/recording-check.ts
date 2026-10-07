import { Quaternion, Vector3 } from 'three';
import { handGesture } from '../src/coordinates';
import { TrackingSmoother } from '../src/smoothing';
import { InteractionController } from '../src/interaction';
import type { WorkerOutput, TrackingResult } from '../src/tracking-types';
const video = document.getElementById('video') as HTMLVideoElement;
const input = document.getElementById('file') as HTMLInputElement;
const run = document.getElementById('run') as HTMLButtonElement;
const status = document.getElementById('status')!, data = document.getElementById('data')!;
let url = '', worker: Worker | null = null;
const once = (event: string) => new Promise<void>(resolve => video.addEventListener(event,()=>resolve(),{once:true}));
input.onchange = async () => {
  const file=input.files?.[0]; if (!file) return;
  worker?.terminate(); if (url) URL.revokeObjectURL(url); url=URL.createObjectURL(file);
  const loaded=once('loadeddata'); video.src=url; await loaded;
  run.disabled=false; status.textContent=`Ready: ${video.duration.toFixed(2)} seconds, ${video.videoWidth} × ${video.videoHeight}.`;
};
run.onclick = async () => {
  run.disabled=true; input.disabled=true; video.pause();
  worker?.terminate(); worker=new Worker(new URL('../src/tracking.worker.ts',import.meta.url),{type:'module'});
  const samples: unknown[]=[];
  const smoother=new TrackingSmoother(), controller=new InteractionController({x:.75,y:.5},.3,{summonOnOpen:true,palmClearance:true});
  const ask=(message:unknown,transfer:Transferable[]=[])=>new Promise<WorkerOutput>((resolve,reject)=>{
    worker!.onmessage=({data}:MessageEvent<WorkerOutput>)=>data.type==='error'?reject(new Error(data.message)):resolve(data);
    worker!.onerror=e=>reject(new Error(e.message)); worker!.postMessage(message,transfer);
  });
  try {
    status.textContent='Loading local tracking models…';
    await ask({type:'init',base:new URL('/',location.origin).href});
    let rejected=0, detected=0, longestGap=0, gap=0;
    const normal=(q?:number[])=>q?new Vector3(0,1,0).applyQuaternion(new Quaternion(...q)).toArray():null;
    for(let index=0;index/10<video.duration;index++) {
      const t=index/10;
      if(Math.abs(video.currentTime-t)>.001){const sought=once('seeked');video.currentTime=t;await sought;}
      const bitmap=await createImageBitmap(video), timestamp=1000+index*100;
      const response=await ask({type:'frame',bitmap,timestamp},[bitmap]);
      if(response.type!=='result')throw new Error('Missing frame result');
      const result:TrackingResult=response.result, aspect=video.videoWidth/video.videoHeight;
      const gestures=result.hands.map(h=>({id:h.id,...handGesture(h.landmarks,aspect,h.worldLandmarks,false,h.handedness)}));
      const filtered=smoother.process(null,gestures,timestamp);
      controller.update({now:timestamp,observedAt:timestamp,face:null,hands:filtered.hands,aspect});
      if(gestures.length){detected++;gap=0;if(!gestures[0].fingers.orientation)rejected++;} else {gap+=.1;longestGap=Math.max(longestGap,gap);}
      samples.push({time:t,hands:result.hands,palmNormal:normal(gestures[0]?.palm.orientation),fingerNormal:normal(gestures[0]?.fingers.orientation),
        filteredNormal:normal(filtered.hands[0]?.fingers?.orientation),mode:controller.state.mode,owner:controller.activeHandId,position:controller.state.position,
        width:controller.state.width,openness:gestures[0]?.palm.openness,spread:gestures[0]?.palm.spread});
      status.textContent=`Analysing ${t.toFixed(1)} / ${video.duration.toFixed(1)} seconds…`;
    }
    data.textContent=JSON.stringify(samples);
    status.textContent=`PASS: ${samples.length} frames; hand detected in ${detected}; rejected finger orientations ${rejected}; longest missing-hand interval ${longestGap.toFixed(1)}s.`;
  } catch(error){status.textContent=`FAIL: ${error instanceof Error?error.message:error}`;}
  finally{worker?.terminate();worker=null;run.disabled=false;input.disabled=false;}
};
