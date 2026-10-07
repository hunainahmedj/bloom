import { InteractionController } from '../src/interaction';
import { TrackingSmoother } from '../src/smoothing';
import { CrownScene } from '../src/scene';
import { fingerGrip } from '../src/fingertip-pose';
import { palmOrientation } from '../src/palm-pose';
import { Quaternion, Vector3 } from 'three';
import type { FacePose, Gesture } from '../src/types';
const style = document.createElement('style');
style.textContent = `body{background:#f5f3ec;color:#28352c;font:14px system-ui;margin:24px}main{max-width:760px;margin:auto}h1{font:32px Georgia}.controls{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}button{border:1px solid #b9c4ac;background:#fff;padding:10px;border-radius:5px;color:#40543d}#stage{position:relative;height:480px;background:#e5e9dc;border-radius:12px;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%;z-index:2}#hand{position:absolute;width:120px;height:160px;transform:translate(-50%,-50%);z-index:1;fill:#f0c7ab;stroke:#b78d74;stroke-width:2}#target{position:absolute;left:35%;top:16%;width:30%;height:15%;border:1px dashed #40543d;border-radius:50%;text-align:center;padding-top:10px;color:#738167;font-size:11px}#result{font-variant-numeric:tabular-nums}`;
document.head.append(style);
const stage = document.getElementById('stage')!, result = document.getElementById('result')!, handElement = document.getElementById('hand')!;
const scene = new CrownScene(document.getElementById('scene') as HTMLCanvasElement);
scene.preview(false);
const controller = new InteractionController({ x: .75, y: .6 }, .28, { summonOnOpen: true, palmClearance: true }), smoother = new TrackingSmoother();
const face: FacePose = { center: { x: .5, y: .45 }, crown: { x: .5, y: .23 }, width: .3, height: .4, rotation: [0, 0, 0] };
let observation: Gesture = { id: 'simulated', point: { x: .75, y: .6 }, ratio: .8, palm: { point: { x: .75, y: .6 }, openness: .2, spread: .7, roll: 0, span: .14 } };
let poseLabel = 'front';
let fingerBend = 0;
let currentAngle = 0, currentAxis: 'x' | 'y' | 'z' = 'y';
let posePoints: Vector3[] = [];
const orient = (angle: number, axis: 'x' | 'y' | 'z', label: string) => {
  currentAngle = angle; currentAxis = axis;
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  p[0] = { x: 0, y: .06, z: 0 }; p[9] = { x: 0, y: -.04, z: 0 };
  p[5] = { x: -.04, y: -.04, z: 0 }; p[17] = { x: .04, y: -.04, z: 0 };
  p[4] = { x: -.08, y: -.03, z: 0 }; p[8] = { x: -.04, y: -.12, z: 0 };
  p[12] = { x: 0, y: -.14, z: 0 }; p[16] = { x: .03, y: -.12, z: 0 }; p[20] = { x: .06, y: -.08, z: fingerBend };
  const q = new Quaternion().setFromAxisAngle(new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0), angle);
  const points = p.map((v,i) => new Vector3(v.x,v.y,v.z).multiplyScalar([4,8,12,16,20].includes(i) ? observation.palm!.spread / 2 : 1).applyQuaternion(q));
  posePoints = points;
  const fingers = fingerGrip(points, 1, points, true, 'Left');
  observation.fingers = fingers;
  observation.palm!.orientation = palmOrientation(points, 1, true, true, 'Left')!; poseLabel = label;
};
orient(0, 'y', 'front');
const set = (openness: number, spread: number, ratio = .8) => { observation = { ...observation, ratio, palm: { ...observation.palm!, openness, spread } }; orient(currentAngle,currentAxis,poseLabel); };
document.getElementById('fist')!.onclick = () => set(.2, .7);
document.getElementById('open')!.onclick = () => set(1, 2);
document.getElementById('spread')!.onclick = () => set(1, 3);
document.getElementById('curl')!.onclick = () => set(.2, .7, .2);
document.getElementById('down')!.onclick = () => controller.release(null);
document.getElementById('partial')!.onclick = () => set(.8, 1.5, .2);
document.getElementById('front')!.onclick = () => orient(0, 'y', 'front');
document.getElementById('side')!.onclick = () => orient(Math.PI / 2, 'y', 'side');
document.getElementById('flip')!.onclick = () => orient(Math.PI, 'y', 'flipped');
document.getElementById('roll')!.onclick = () => orient(Math.PI / 2, 'z', 'rolled');
document.getElementById('tilt')!.onclick = () => orient(Math.PI / 3, 'x', 'tilted');
document.getElementById('bend')!.onclick = () => { fingerBend = fingerBend ? 0 : .08; orient(currentAngle, currentAxis, fingerBend ? 'fingers bent, palm unchanged' : 'front'); };
document.getElementById('move')!.onclick = () => { observation.point = { x: .3, y: .65 }; observation.palm!.point = observation.point; };
document.getElementById('head')!.onclick = () => {
  fingerBend = 0; orient(0, 'y', 'front');
  observation.palm!.point = { x: face.crown.x, y: face.crown.y + .14 };
  observation.point = observation.palm!.point;
};
document.getElementById('reset')!.onclick = () => { controller.newSession(); smoother.reset(); maximumScaleOvershoot = 0; fingerBend = 0; observation = { id: 'simulated', point: { x: .75, y: .6 }, ratio: .8, palm: { point: { x: .75, y: .6 }, openness: .2, spread: .7, roll: 0, span: .14 } }; orient(0, 'y', 'front'); };
document.getElementById('lighting')!.onclick=()=>{const dark=stage.style.background!=='rgb(26, 43, 35)';stage.style.background=dark?'rgb(26, 43, 35)':'#e5e9dc';document.getElementById('lighting')!.textContent=dark?'Light background':'Dark background';};
document.getElementById('effects-toggle')!.onclick=()=>{const button=document.getElementById('effects-toggle')!,on=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(on));button.textContent=on?'Effects on':'Effects off';scene.setEffects(on);};
new ResizeObserver(() => { scene.resize({ width: stage.clientWidth, height: stage.clientHeight }); maximumScaleOvershoot = 0; }).observe(stage);
let last = 0, previous = performance.now(), maximumScaleOvershoot = 0;
function render(now: number) {
  if (observation.fingers) {
    const palm = observation.palm!.point;
    const aspect=stage.clientWidth/stage.clientHeight;
    const image=posePoints.map(p=>({x:palm.x-p.x*1.3,y:palm.y+p.y*1.3*aspect,z:p.z*1.3}));
    observation.fingers=fingerGrip(image,aspect,posePoints,true,'Left');
    document.getElementById('nodes')!.innerHTML=observation.fingers.nodes.map(p=>`<span style="position:absolute;left:${p.x*100}%;top:${p.y*100}%;width:9px;height:9px;border:1px solid #526846;border-radius:50%;transform:translate(-50%,-50%);background:#f5f3ec"></span>`).join('');
  }
  if (now - last > 40) {
    const filtered = smoother.process(face, [observation], now);
    controller.update({ now, face: filtered.face, hands: filtered.hands, aspect: stage.clientWidth / stage.clientHeight }); last = now;
  }
  handElement.style.left = `${observation.palm!.point.x * 100}%`; handElement.style.top = `${observation.palm!.point.y * 100}%`;
  handElement.style.transform = `translate(-50%,-50%) scaleX(${.55 + observation.palm!.openness * .45})`;
  result.textContent = `${controller.state.visible ? controller.state.mode : "waiting"} · ${Math.round((controller.state.sizeFactor ?? 1) * 100)}%`;
  document.getElementById('ready')!.textContent = controller.state.mode === 'palm' && now - (controller.state.summonedAt ?? now) > 240 ? 'Ready to resize' : '';
  const normal = controller.state.palmOrientation ? new Vector3(0,1,0).applyQuaternion(new Quaternion(...controller.state.palmOrientation)) : new Vector3();
  document.getElementById('pose-result')!.textContent = `${poseLabel} palm normal (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}); crown position (${controller.state.position.x.toFixed(2)}, ${controller.state.position.y.toFixed(2)}); rendered width ${(scene.crown.scale.x * 2.65 / (2 * stage.clientWidth / stage.clientHeight)).toFixed(3)}, target ${controller.state.width.toFixed(3)}`;
  scene.render(controller.state, face, (now - previous) / 1000); previous = now;
  if (controller.state.mode === 'palm') maximumScaleOvershoot = Math.max(maximumScaleOvershoot, scene.crown.scale.x * 2.65 / (2 * stage.clientWidth / stage.clientHeight) - controller.state.width);
  document.getElementById('clearance-result')!.textContent = `Maximum rendered grip scale overshoot: ${maximumScaleOvershoot.toFixed(6)}`;
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
