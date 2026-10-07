import { expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { createCrown } from '../src/crown';
import { CROWN_LOCAL_RADIUS } from '../src/crown-clearance';
import type { CrownState } from '../src/types';
const state=():CrownState=>({mode:'palm',position:{x:.5,y:.5},width:.3,visible:true,summonedAt:10});
function petal(crown:ReturnType<typeof createCrown>){return crown.getObjectByName('Daisy petals') as InstancedMesh;}
function tip(crown:ReturnType<typeof createCrown>){
 const mesh=petal(crown), matrix=new Matrix4();mesh.getMatrixAt(0,matrix);
 return new Vector3(0,0,1).applyMatrix4(matrix);
}
it('opens folded petals after summoning without restarting every frame',()=>{
 const crown=createCrown(),s=state();crown.animate(s,0,false,false,true);
 const closed=tip(crown);
 for(let i=0;i<100;i++)crown.animate(s,.02,false,false,true);
 const open=tip(crown);expect(closed.distanceTo(open)).toBeGreaterThan(.1);
 const settled=tip(crown);crown.animate(s,.02,false,false,true);
 expect(settled.distanceTo(tip(crown))).toBeLessThan(.01);
 s.summonedAt=20;crown.animate(s,0,false,false,true);
 expect(tip(crown).distanceTo(open)).toBeGreaterThan(.1);
});
it('shows fully open flowers immediately when motion or effects are disabled',()=>{
 const a=createCrown(),b=createCrown(),s=state();
 a.animate(s,0,false,true,true);b.animate(s,0,false,false,false);
 expect(tip(a).distanceTo(tip(b))).toBeLessThan(.00001);
 a.animate(s,.1,false,true,true);expect(tip(a).distanceTo(tip(b))).toBeLessThan(.00001);
});
it('encloses every instance through blooming for each selectable crown',()=>{
 for(const style of ['garden','rose','wildflower'] as const){
  const crown=createCrown(style),s=state();
  for(let frame=0;frame<100;frame++){
   crown.animate(s,.02,false,false,true);crown.updateMatrixWorld(true);
   let radius=0;const v=new Vector3(),instance=new Matrix4(),world=new Matrix4();
   crown.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.attributes.position;
    const count=o instanceof InstancedMesh?o.count:1;
    for(let n=0;n<count;n++){
     if(o instanceof InstancedMesh){o.getMatrixAt(n,instance);world.multiplyMatrices(o.matrixWorld,instance);}else world.copy(o.matrixWorld);
     for(let k=0;k<p.count;k++)radius=Math.max(radius,v.fromBufferAttribute(p,k).applyMatrix4(world).length());
    }
   });
   expect(radius).toBeLessThan(CROWN_LOCAL_RADIUS);
  }
 }
});
it('changes the real crown composition while preserving its transform and fit',()=>{
 const crown=createCrown();crown.position.set(1,2,3);crown.scale.setScalar(.4);
 const count=crown.getObjectByName('Rose petals') as InstancedMesh;
 const gardenCount=count.count;
 crown.setStyle('rose');expect((crown.getObjectByName('Rose petals') as InstancedMesh).count).toBeGreaterThan(gardenCount);
 expect(crown.position.toArray()).toEqual([1,2,3]);expect(crown.scale.x).toBe(.4);
 crown.setStyle('wildflower');expect(crown.getObjectByName('flowers')!.children.length).toBeGreaterThan(16);
});
it('does not resume an old or hidden bloom when tracking returns',()=>{
 const crown=createCrown(),s=state();crown.animate(s,.1,false,false,true);
 s.visible=false;crown.animate(s,.05,false,false,true);
 const reference=createCrown();reference.animate(s,0,false,true,true);const settled=tip(reference);
 expect(tip(crown).distanceTo(settled)).toBeLessThan(.00001);
 crown.bloom();crown.animate(s,.05,false,false,true);
 s.visible=true;crown.animate(s,0,false,false,true);
 expect(tip(crown).distanceTo(settled)).toBeLessThan(.005);
});
