import { expect,it } from 'vitest';
import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { PetalField } from '../src/petal-field';
import type { CrownState } from '../src/types';
const state=():CrownState=>({mode:'palm',position:{x:.5,y:.5},width:.3,visible:true,summonedAt:10});
function positions(field:PetalField){
 const m=field.root.getObjectByName('Drifting petals') as InstancedMesh,mat=new Matrix4(),p:Vector3[]=[];
 for(let i=0;i<m.count;i++){m.getMatrixAt(i,mat);p.push(new Vector3().setFromMatrixPosition(mat));}return p;
}
it('sheds petals on summon and lets them fall in world space instead of following the hand',()=>{
 const f=new PetalField(),c=new Group(),s=state();
 f.update(c,s,.02,false,false,true);const before=positions(f);
 expect(before.length).toBeGreaterThan(0);
 c.position.x=2;f.update(c,s,.1,false,false,true);const after=positions(f);
 expect(after[0].y).toBeLessThan(before[0].y);
 expect(Math.abs(after[0].x-before[0].x)).toBeLessThan(.1);
});
it('clears petals on loss, effects off and reduced motion, with no stale burst on return',()=>{
 for(const reason of ['hidden','disabled','reduced']){
  const f=new PetalField(),c=new Group(),s=state();f.update(c,s,.02,false,false,true);
  expect(positions(f).length).toBeGreaterThan(0);
  if(reason==='hidden')s.visible=false;
  f.update(c,s,.02,false,reason==='reduced',reason!=='disabled');expect(positions(f)).toHaveLength(0);
  s.visible=true;f.update(c,s,.02,false,false,true);expect(positions(f)).toHaveLength(0);
 }
});
it('reuses a bounded pool and keeps shedding while the crown is worn',()=>{
 const f=new PetalField(),c=new Group(),s=state();
 f.update(c,s,.02,false,false,true);
 for(let i=0;i<200;i++){c.position.x+=.025;f.update(c,s,.05,false,false,true);expect(positions(f).length).toBeLessThanOrEqual(18);}
 s.mode='worn';for(let i=0;i<40;i++)f.update(c,s,.1,false,false,true);
 expect(positions(f).length).toBeGreaterThan(0);
});
