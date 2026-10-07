import { expect,it } from 'vitest';
import { Group,Matrix4,Mesh,MeshBasicMaterial,Quaternion,Raycaster,SphereGeometry,Vector3 } from 'three';
import { facePose } from '../src/pose';
import { fitHeadOccluder, HEAD_CROWN_WIDTH_FACTOR } from '../src/head-fit';
import { InteractionController } from '../src/interaction';
import type { Landmark } from '../src/types';
const landmarks=():Landmark[]=>{
 const p=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
 p[10].y=.3;p[152].y=.7;p[234].x=.35;p[454].x=.65;p[33].x=.4;p[263].x=.6;return p;
};
it('sits on the upper head rather than across the forehead',()=>{
 const pose=facePose(landmarks(),null,{width:100,height:100},{width:100,height:100},false);
 expect(pose.crown.y).toBeCloseTo(.18);expect(pose.crownDepth).toBeCloseTo(0);
 const c=new InteractionController({x:.5,y:.5},.3);c.state.sizeFactor=2;c.wear(pose);
 expect(c.state.position).toEqual(pose.crown);expect(c.state.width).toBeCloseTo(pose.width*HEAD_CROWN_WIDTH_FACTOR);expect(c.state.sizeFactor).toBe(1);
});
it('keeps the worn crown and depth mask together through translation, tilt and scale',()=>{
 const crown=new Group(),mask=new Mesh(new SphereGeometry(1,32,24),new MeshBasicMaterial());
 crown.position.set(.3,.4,.2);crown.scale.set(.5,.5,.43);crown.quaternion.setFromAxisAngle(new Vector3(1,0,0),.3);
 fitHeadOccluder(mask,crown);crown.updateMatrixWorld(true);mask.updateMatrixWorld(true);
 const relative=mask.position.clone().sub(crown.position).applyQuaternion(crown.quaternion.clone().invert()).divide(crown.scale);
 const original=relative.clone();crown.position.set(-.5,.8,.1);crown.scale.multiplyScalar(.7);crown.quaternion.setFromAxisAngle(new Vector3(0,0,1),.4);
 fitHeadOccluder(mask,crown);
 expect(mask.position.clone().sub(crown.position).applyQuaternion(crown.quaternion.clone().invert()).divide(crown.scale).distanceTo(original)).toBeLessThan(1e-6);
 expect(mask.quaternion.angleTo(crown.quaternion)).toBeLessThan(1e-6);
});
it('writes a skull surface in front of the rear vine while keeping the front vine visible',()=>{
 const crown=new Group(),mask=new Mesh(new SphereGeometry(1,48,32),new MeshBasicMaterial());
 crown.scale.set(1,1,.86);fitHeadOccluder(mask,crown);mask.updateMatrixWorld(true);
 const ray=new Raycaster(new Vector3(0,0,4),new Vector3(0,0,-1));
 const hit=ray.intersectObject(mask)[0];expect(hit).toBeDefined();
 expect(hit.point.z).toBeGreaterThan(-.86);expect(hit.point.z).toBeLessThan(.86);
});
it('carries the pose-estimated head lift into depth when the face tilts',()=>{
 const c=new InteractionController({x:.5,y:.5},.3);
 const face={center:{x:.5,y:.5},crown:{x:.5,y:.2},width:.3,height:.4,rotation:[.3,0,0] as [number,number,number],crownDepth:.15};
 c.wear(face);expect(c.state.depth).toBeCloseTo(.15);
});
it('keeps a fitted crown at the same physical size when the face turns sideways',()=>{
 const p=landmarks(),yaw=.6,q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
 const moved=p.map(v=>{const world=new Vector3(v.x-.5,.5-v.y,-v.z).applyQuaternion(q);return {x:.5+world.x,y:.5-world.y,z:-world.z};});
 const matrix=new Matrix4().makeRotationFromQuaternion(q).toArray();
 const pose=facePose(moved,matrix,{width:100,height:100},{width:100,height:100},false);
 const c=new InteractionController({x:.5,y:.5},.3);c.wear(pose);
 expect(c.state.width).toBeCloseTo(.3*HEAD_CROWN_WIDTH_FACTOR,5);
});
