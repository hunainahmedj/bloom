import { afterEach, expect, it, vi } from 'vitest';
import type { InstancedMesh, Scene } from 'three';
import type { CrownState } from '../src/types';
let rendered:Scene;
vi.mock('three',async importOriginal=>{
 const real=await importOriginal<typeof import('three')>();
 return {...real,WebGLRenderer:class{
  ratio=1;setPixelRatio(value:number){this.ratio=value;}getPixelRatio(){return this.ratio;}setClearColor(){}setSize(){}dispose(){}
  render(scene:Scene){rendered=scene;}
 }};
});
import { CrownScene } from '../src/scene';
afterEach(()=>vi.unstubAllGlobals());
function setup(){
 vi.stubGlobal('devicePixelRatio',1);vi.stubGlobal('matchMedia',()=>({matches:false}));
 const scene=new CrownScene({} as HTMLCanvasElement);scene.resize({width:800,height:600});scene.preview(false);return scene;
}
const state=():CrownState=>({mode:'palm',position:{x:.5,y:.5},width:.3,visible:true,summonedAt:10});
it('clears detached petals immediately when stopping the camera returns to preview',()=>{
 const scene=setup(),s=state();scene.render(s,null,.02);
 const petals=()=>rendered.getObjectByName('Drifting petals') as InstancedMesh;
 expect(petals().count).toBeGreaterThan(0);
 scene.preview(true);expect(petals().count).toBe(0);
 scene.render({...s,visible:false,summonedAt:undefined},null,.02);expect(petals().count).toBe(0);scene.dispose();
});
it('skips the summon scale animation when effects are disabled',()=>{
 const scene=setup(),s=state();scene.setEffects(false);scene.render(s,null,.02);
 const first=scene.crown.scale.x;for(let i=0;i<15;i++)scene.render(s,null,.02);
 expect(first).toBeCloseTo(.3*2*(800/600)/2.65,8);
 expect(scene.crown.scale.x).toBeCloseTo(first,8);scene.dispose();
});
it('does not replay an old summon reveal when effects are re-enabled',()=>{
 const scene=setup(),s=state();scene.setEffects(false);scene.render(s,null,.02);
 const full=scene.crown.scale.x;scene.setEffects(true);scene.render(s,null,.02);
 expect(scene.crown.scale.x).toBeCloseTo(full,8);scene.dispose();
});
it('keeps the drawing buffer bounded on a very large fullscreen display',()=>{
 const scene=setup();vi.stubGlobal('devicePixelRatio',2);scene.resize({width:8533,height:2400});
 const ratio=scene.renderer.getPixelRatio();expect(8533*2400*ratio*ratio).toBeLessThanOrEqual(3_000_001);scene.dispose();
});
