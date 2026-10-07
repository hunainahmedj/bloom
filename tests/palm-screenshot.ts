import { Vector3, Quaternion } from 'three';
import { HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { fitCrownBetweenFingertips } from '../src/crown-clearance';
import { fingertipHoverPosition } from '../src/palm-hover';
import { handGesture } from '../src/coordinates';
import { facePose } from '../src/pose';
import { CrownScene } from '../src/scene';
import type { CrownState, FacePose } from '../src/types';
import type { WorkerOutput } from '../src/tracking-types';
const input = document.getElementById('file') as HTMLInputElement;
const photo = document.getElementById('photo') as HTMLImageElement;
const stage = document.getElementById('stage')!, result = document.getElementById('result')!;
const scene = new CrownScene(document.getElementById('scene') as HTMLCanvasElement); scene.preview(false);
let detectedFace: FacePose | null = null;
let worker: Worker | null = null, url = '';
let state: CrownState = { mode: 'floating', position: { x: .5, y: .5 }, width: .2, visible: false };
document.getElementById('photo-toggle')!.onclick=()=>{
  const button=document.getElementById('photo-toggle')!,show=button.getAttribute('aria-pressed')!=='true';
  button.setAttribute('aria-pressed',String(show));button.textContent=show?'Hide photo':'Show photo';
  photo.style.visibility=show?'visible':'hidden';stage.style.background=show?'transparent':'#20312a';
  scene.render(state,detectedFace,1/60);
};
input.onchange = async () => {
  worker?.terminate(); if (url) URL.revokeObjectURL(url);
  const file = input.files?.[0]; if (!file) return;
  state.visible = false; detectedFace = null; url = URL.createObjectURL(file); photo.src = url;
  await photo.decode();
  stage.style.aspectRatio = `${photo.naturalWidth}/${photo.naturalHeight}`;
  scene.resize({ width: stage.clientWidth, height: stage.clientHeight });
  worker = new Worker(new URL('../src/tracking.worker.ts', import.meta.url), { type: 'module' });
  result.textContent = 'Loading local tracking models…';
  worker.onerror = event => { result.textContent = `FAIL: ${event.message}`; };
  worker.onmessage = async ({ data }: MessageEvent<WorkerOutput>) => {
    if (data.type === 'ready') {
      const bitmap = await createImageBitmap(file);
      worker!.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap]);
    } else if (data.type === 'result') {
      const hand = data.result.hands[0];
      if (data.result.face) detectedFace = facePose(data.result.face, data.result.matrix,
        { width: photo.naturalWidth, height: photo.naturalHeight }, { width: stage.clientWidth, height: stage.clientHeight }, false);
      if (!hand && detectedFace) {
        state = { mode: 'worn', position: detectedFace.crown, width: (detectedFace.headWidth ?? detectedFace.width) * HEAD_CROWN_WIDTH_FACTOR, depth:detectedFace.crownDepth, visible: true, sizeFactor: 1 };
        scene.render(state, detectedFace, 1 / 60);
        result.textContent = 'PASS: face detected; crown auto-fitted. ' + JSON.stringify(detectedFace);
      } else if (!hand) result.textContent = 'No hand found in screenshot.';
      else {
        const g = handGesture(hand.landmarks, photo.naturalWidth / photo.naturalHeight, hand.worldLandmarks, false, hand.handedness);
        const hover = fingertipHoverPosition(g.fingers, g.palm.span, stage.clientWidth / stage.clientHeight);
        state = { mode: 'palm', position: hover.point, depth: hover.depth, width: fitCrownBetweenFingertips(.3,g.fingers), visible: true, palmOrientation: g.fingers.orientation };
        scene.render(state, null, 1 / 60);
        const normal = g.fingers.orientation ? new Vector3(0,1,0).applyQuaternion(new Quaternion(...g.fingers.orientation!)) : null;
        result.textContent = `PASS: hand detected; world landmarks ${hand.worldLandmarks?.length}.\n` + JSON.stringify({ handedness: hand.handedness, ratio: g.ratio, openness: g.palm.openness, spread: g.palm.spread, palm: g.palm.point, fingerAlignment: hand.worldLandmarks ? [5,9,13,17].map(i=>{
          const p=hand.worldLandmarks!,axis=new Vector3(p[9].x-p[0].x,p[9].y-p[0].y,p[9].z-p[0].z).normalize();
          return new Vector3(p[i+3].x-p[i].x,p[i+3].y-p[i].y,p[i+3].z-p[i].z).normalize().dot(axis);
        }) : null, fingertips: g.fingers.nodes, anchor: g.fingers.point, gapRadius: g.fingers.gapRadius, width: state.width, hover, normal }, null, 2);
      }
      worker!.terminate(); worker = null;
    } else result.textContent = `FAIL: ${data.message}`;
  };
  worker.postMessage({ type: 'init', base: new URL('/', location.origin).href });
};
new ResizeObserver(() => { scene.resize({ width: stage.clientWidth, height: stage.clientHeight }); scene.render(state, detectedFace, 1 / 60); }).observe(stage);
function render() { scene.render(state, detectedFace, 1 / 60); requestAnimationFrame(render); } requestAnimationFrame(render);
