import { afterEach,expect,it,vi } from 'vitest';
import type { Scene } from 'three';
let rendered:Scene;
vi.mock('three',async importOriginal=>{
 const real=await importOriginal<typeof import('three')>();
 return {...real,WebGLRenderer:class{
  setPixelRatio(){}getPixelRatio(){return 1;}setClearColor(){}setSize(){}dispose(){}
  render(scene:Scene){rendered=scene;}
 }};
});
import { CrownScene } from '../src/scene';
import { InteractionController } from '../src/interaction';
afterEach(()=>vi.unstubAllGlobals());
it('retains the worn rotation and depth mask through a 33 ms face gap, then hides both on expiry',()=>{
 vi.stubGlobal('devicePixelRatio',1);vi.stubGlobal('matchMedia',()=>({matches:false}));
 const scene=new CrownScene({} as HTMLCanvasElement);scene.preview(false);scene.resize({width:800,height:600});
 const face={center:{x:.5,y:.5},crown:{x:.5,y:.2},width:.3,height:.4,rotation:[.3,.2,.1] as [number,number,number],crownDepth:.15};
 const c=new InteractionController({x:.5,y:.5},.3);c.wear(face);c.update({now:1000,face,hands:[]});
 scene.render(c.state,face,1/60);const rotation=scene.crown.quaternion.clone();
 const mask=()=>rendered.getObjectByName('Head occluder')!;
 expect(mask().visible).toBe(true);
 c.update({now:1033,face:null,hands:[]});scene.render(c.state,null,1/60);
 expect(scene.crown.visible).toBe(true);expect(mask().visible).toBe(true);expect(scene.crown.quaternion.angleTo(rotation)).toBeLessThan(1e-6);
 c.update({now:1251,face:null,hands:[]});scene.render(c.state,null,1/60);
 expect(scene.crown.visible).toBe(false);expect(mask().visible).toBe(false);scene.dispose();
});
