import { expect,it } from 'vitest';
import { Box3, InstancedMesh, Matrix4, Vector3 } from 'three';
import { createCrown } from '../src/crown';
import { petalGeometry } from '../src/petal-geometry';
it('gives every fully open crown a visible side profile',()=>{
 for(const style of ['garden','rose','wildflower'] as const){
  const crown=createCrown(style),box=new Box3().setFromObject(crown);
  expect(box.max.y-box.min.y).toBeGreaterThan(.4);
 }
});
it('gives petals closed thickness rather than a single sheet',()=>{
 const g=petalGeometry(true);g.computeBoundingBox();const index=g.index!,edges=new Map<string,number>();
 for(let i=0;i<index.count;i+=3)for(const [a,b] of [[index.getX(i),index.getX(i+1)],[index.getX(i+1),index.getX(i+2)],[index.getX(i+2),index.getX(i)]]){
  const key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1);
 }
 expect([...edges.values()].every(n=>n===2)).toBe(true);
});
it('makes Garden a daisy composition and Rose an exclusively rosette composition',()=>{
 const garden=createCrown('garden'),rose=createCrown('rose');
 expect((garden.getObjectByName('Rose petals') as InstancedMesh).count).toBe(0);
 expect((rose.getObjectByName('Daisy petals') as InstancedMesh).count).toBe(0);
 expect((rose.getObjectByName('Rose petals') as InstancedMesh).count).toBeGreaterThan(200);
});
it('keeps flowers moving while worn long after the initial bloom',()=>{
 const crown=createCrown('rose'),s={mode:'worn' as const,position:{x:.5,y:.4},width:.3,visible:true};
 for(let i=0;i<50;i++)crown.animate(s,.1,false,false,true);
 const m=crown.getObjectByName('Rose petals') as InstancedMesh,matrix=new Matrix4();m.getMatrixAt(0,matrix);const before=new Vector3(0,0,1).applyMatrix4(matrix);
 let movement=0;
 for(let i=0;i<30;i++){crown.animate(s,.1,false,false,true);m.getMatrixAt(0,matrix);movement=Math.max(movement,before.distanceTo(new Vector3(0,0,1).applyMatrix4(matrix)));}
 expect(movement).toBeGreaterThan(.006);
});
