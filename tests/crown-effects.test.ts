import { expect,it } from 'vitest';
import { Group,Points } from 'three';
import { CrownEffects } from '../src/crown-effects';
import type { CrownState } from '../src/types';
const state=():CrownState=>({mode:'palm',position:{x:.5,y:.5},width:.3,visible:true,summonedAt:100});
it('clears light and trail on hiding or disabling and re-enables without an old burst',()=>{
 const effects=new CrownEffects(),crown=new Group(),s=state();
 const update=()=>effects.update(crown,s,.016,false,false,600,1);
 update();crown.position.x=.1;update();expect(effects.root.visible).toBe(true);
 effects.setEnabled(false);expect(effects.root.visible).toBe(false);
 effects.setEnabled(true);update();expect(effects.root.visible).toBe(true);expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(false);
 const trail=effects.root.getObjectByName('Motion trail') as Points;
 expect(Array.from(trail.geometry.attributes.strength.array).every(x=>x===0)).toBe(true);
 s.visible=false;update();expect(effects.root.visible).toBe(false);effects.dispose();
});
it('keeps reduced-motion effects static with no pollen, trail or arrival animation',()=>{
 const effects=new CrownEffects(),s=state(),crown=new Group();
 effects.update(crown,s,.016,false,true,600,1);
 expect(effects.root.visible).toBe(true);
 for(const name of ['Pollen','Motion trail','Arrival shimmer'])expect(effects.root.getObjectByName(name)!.visible).toBe(false);
 effects.dispose();
});
it('shimmers once on summon and again when the crown is placed on the head',()=>{
 const effects=new CrownEffects(),s=state(),crown=new Group();
 const update=()=>effects.update(crown,s,.1,false,false,600,1);
 update();expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(true);
 for(let i=0;i<12;i++)update();expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(false);
 s.mode='worn';update();expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(true);effects.dispose();
});

it('keeps worn particles visible while removing the rigid ring and hand movement trail',()=>{
 const effects=new CrownEffects(),s=state(),crown=new Group();
 effects.update(crown,s,.016,false,false,600,1);
 const pollen=effects.root.getObjectByName('Pollen') as Points;
 const carriedOpacity=(pollen.material as import('three').ShaderMaterial).uniforms.opacity.value;
 s.mode='worn';effects.update(crown,s,.016,false,false,600,1);
 expect(effects.root.getObjectByName('Holographic ring')!.visible).toBe(false);
 expect(effects.root.getObjectByName('Motion trail')!.visible).toBe(false);
 expect((pollen.material as import('three').ShaderMaterial).uniforms.opacity.value).toBeGreaterThan(carriedOpacity*.5);
 effects.dispose();
});
it('consumes a suppressed shimmer so changing motion preference cannot revive it',()=>{
 const effects=new CrownEffects(),s=state(),crown=new Group();
 effects.update(crown,s,.1,false,false,600,1);expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(true);
 effects.update(crown,s,.1,false,true,600,1);effects.update(crown,s,.1,false,false,600,1);
 expect(effects.root.getObjectByName('Arrival shimmer')!.visible).toBe(false);effects.dispose();
});
