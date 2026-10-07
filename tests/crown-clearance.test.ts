import { expect,it } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { fitCrownBetweenFingertips,CROWN_LOCAL_RADIUS,CROWN_WIDTH_REFERENCE } from '../src/crown-clearance';
import { fingertipGapRadius } from '../src/fingertip-pose';
import { fingertipHoverPosition } from '../src/palm-hover';
import { TrackingSmoother } from '../src/smoothing';
import { createCrown } from '../src/crown';
import type { Orientation } from '../src/types';
const center={x:.5,y:.5}, grip={point:center,nodes:[],gapRadius:.14};
it('reserves a 3D margin for the tips including the outermost leaves and hover lift',()=>{
 const width=fitCrownBetweenFingertips(.6,grip);
 const radius=width*CROWN_LOCAL_RADIUS/CROWN_WIDTH_REFERENCE;
 for (const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]) {
  const orientation=new Quaternion().setFromAxisAngle(axis,1.2).toArray() as Orientation;
  const hover=fingertipHoverPosition({...grip,orientation},.2,.6);
  const lift=Math.hypot(hover.point.x-center.x,(hover.point.y-center.y)/.6,hover.depth/(2*.6));
  expect(grip.gapRadius-radius-lift).toBeGreaterThanOrEqual(grip.gapRadius*.099);
 }
});
it('keeps smaller user sizes and shrinks as the physical grip closes',()=>{
 expect(fitCrownBetweenFingertips(.08,grip)).toBe(.08);
 const a=fitCrownBetweenFingertips(.6,grip),b=fitCrownBetweenFingertips(.6,{...grip,gapRadius:.06});
 expect(b).toBeLessThan(a);expect(b).toBeGreaterThan(0);
 expect(fitCrownBetweenFingertips(.6,{...grip,gapRadius:0})).toBe(.025);
});
it('does not collapse the gap when a rigid hand rotates edge on or flips',()=>{
 const world=Array.from({length:21},()=>new Vector3());
 world[0].set(0,.06,0);world[9].set(0,-.04,0);world[5].set(-.04,-.04,0);world[17].set(.04,-.04,0);
 world[4].set(-.08,0,0);world[8].set(-.04,-.12,0);world[12].set(0,-.14,0);world[16].set(.03,-.12,0);world[20].set(.06,-.08,0);
 const measure=(angle:number,axis:Vector3,aspect:number)=>{
  const q=new Quaternion().setFromAxisAngle(axis,angle),rotated=world.map(p=>p.clone().applyQuaternion(q));
  const image=rotated.map(p=>({x:.5+p.x*2,y:.5+p.y*2*aspect,z:p.z*2}));
  return fingertipGapRadius(image,aspect,rotated)!;
 };
 const expected=measure(0,new Vector3(1,0,0),1);
 for(const aspect of [.5,1.5]) for(const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)])
  for(const angle of [Math.PI/3,Math.PI/2,Math.PI,Math.PI*1.5]) expect(measure(angle,axis,aspect)).toBeCloseTo(expected,5);
});
it('uses a bound enclosing the fully open instanced petals and leaves',()=>{
 const crown=createCrown();crown.updateMatrixWorld(true);const v=new Vector3(),instance=new Matrix4(),world=new Matrix4();let maximum=0;
 crown.traverse(mesh=>{if(!(mesh instanceof Mesh))return;const a=mesh.geometry.attributes.position;
  for(let n=0;n<(mesh instanceof InstancedMesh?mesh.count:1);n++){
   if(mesh instanceof InstancedMesh){mesh.getMatrixAt(n,instance);world.multiplyMatrices(mesh.matrixWorld,instance);}else world.copy(mesh.matrixWorld);
   for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(world);maximum=Math.max(maximum,v.length());}
  }
 });
 expect(maximum).toBeLessThan(CROWN_LOCAL_RADIUS);
});

it('fits a closing grip immediately while smoothing its expansion',()=>{
 const smoother=new TrackingSmoother();
 const hand=(gapRadius:number)=>({id:'a',point:center,ratio:.8,fingers:{...grip,gapRadius}});
 smoother.process(null,[hand(.14)],0);
 const closed=smoother.process(null,[hand(.05)],40).hands[0].fingers!;
 expect(closed.gapRadius).toBe(.05);
 expect(fitCrownBetweenFingertips(.3,closed)*CROWN_LOCAL_RADIUS/CROWN_WIDTH_REFERENCE).toBeCloseTo(.05*.82);
 const opened=smoother.process(null,[hand(.14)],80).hands[0].fingers!;
 expect(opened.gapRadius).toBeLessThan(.14);expect(opened.gapRadius).toBeGreaterThan(.05);
});
