import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, NormalBlending, PlaneGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import type { CrownState } from './types';
import { PetalField } from './petal-field';
import { MOODS, type Mood } from './moods';

const TAU=Math.PI*2, POLLEN_COUNT=64, TRAIL_COUNT=24;
const pointMaterial=()=>new ShaderMaterial({
  uniforms:{size:{value:3},opacity:{value:1},shape:{value:0}}, transparent:true, depthWrite:false, blending:AdditiveBlending,
  vertexShader:`attribute float strength; attribute vec3 tint; varying float vStrength; varying vec3 vTint; uniform float size;
    void main(){vStrength=strength;vTint=tint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}`,
  fragmentShader:`varying float vStrength;varying vec3 vTint;uniform float opacity;uniform float shape;
    void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);
      if(shape>1.5){p.y=-p.y;r=min(length(p-vec2(-.25,.2)),length(p-vec2(.25,.2)))/.48;float triangle=max(abs(p.x)*1.2,p.y<.2?(.2-p.y)*.8:2.);r=min(r,triangle/.65);}
      else if(shape>.5){r/= .62+.25*cos(atan(p.y,p.x)*5.);}
      float a=(1.-smoothstep(.05,1.,r))*vStrength*opacity;if(a<.01)discard;gl_FragColor=vec4(vTint,a);}`,
});
function particles(count:number){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(count*3),3));
  geometry.setAttribute('strength',new BufferAttribute(new Float32Array(count),1));
  geometry.setAttribute('tint',new BufferAttribute(new Float32Array(Array.from({length:count},(_,i)=>i%4===0?[.68,1,.89]:[1,.79,.39]).flat()),3));
  const points=new Points(geometry,pointMaterial());points.frustumCulled=false;points.renderOrder=2;return points;
}
const ringGeometry=(radius:number,segments:number)=>{
  const positions:number[]=[];
  for(let i=0;i<segments;i++){
    if(i%12>8)continue;
    for(const angle of [i/segments*TAU,(i+1)/segments*TAU])positions.push(Math.cos(angle)*radius,.025,Math.sin(angle)*radius);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));return geometry;
};

/** Lightweight procedural light, reusing fixed buffers; no textures or postprocessing. */
export class CrownEffects {
  readonly root=new Group();
  private aura=new Group();
  private petals=new PetalField();
  private pollen=particles(POLLEN_COUNT);
  private trail=particles(TRAIL_COUNT);
  private ring=new LineSegments(ringGeometry(1.53,96),new LineBasicMaterial({color:'#8edcc9',transparent:true,opacity:.38,depthWrite:false}));
  private pulse=new LineSegments(ringGeometry(1.45,120),new LineBasicMaterial({color:'#e6c67d',transparent:true,opacity:0,depthWrite:false}));
  private glow=new Mesh(new PlaneGeometry(3.5,3.5),new ShaderMaterial({
    uniforms:{opacity:{value:.22}},transparent:true,depthWrite:false,side:DoubleSide,blending:NormalBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float opacity;void main(){float r=length(vUv-.5)*2.;float a=exp(-pow((r-.64)/.12,2.))*opacity;gl_FragColor=vec4(mix(vec3(.92,.73,.35),vec3(.53,.89,.77),vUv.x),a);}`,
  }));
  private ages=new Float32Array(TRAIL_COUNT).fill(2);
  private previous=new Vector3();
  private scratch=new Vector3();
  private initialized=false;
  private cursor=0;
  private time=0;
  private pulseAge=2;
  private lastSummon:number|undefined;
  private lastMode='';
  private enabled=true;
  private mood:Mood='natural';
  setMood(mood:Mood){
    this.mood=mood;this.petals.setMood(mood);const colors=MOODS[mood].pollen,color=new Color();
    const tint=this.pollen.geometry.attributes.tint;for(let i=0;i<POLLEN_COUNT;i++){color.set(colors[i%colors.length]);tint.setXYZ(i,color.r,color.g,color.b);}tint.needsUpdate=true;
    this.pollen.material.uniforms.shape.value=MOODS[mood].shape;this.ring.material.color.set(colors[1]);
  }
  constructor(){
    this.root.name='Crown light effects';this.ring.name='Holographic ring';this.glow.name='Soft halo';this.pollen.name='Pollen';this.trail.name='Motion trail';this.pulse.name='Arrival shimmer';this.glow.rotation.x=-Math.PI/2;this.glow.position.y=-.025;
    this.aura.add(this.glow,this.ring,this.pulse,this.pollen);this.root.add(this.aura,this.trail,this.petals.root);
    this.root.visible=false;
  }
  setEnabled(value:boolean){this.enabled=value;if(!value){this.root.visible=false;this.clearTrail();this.petals.clear();this.pulseAge=2;}}
  reset(){this.root.visible=false;this.clearTrail();this.petals.clear();this.pulseAge=2;this.lastSummon=undefined;this.lastMode='';}
  bloom(){this.petals.burst();}
  private clearTrail(){this.ages.fill(2);this.initialized=false;this.trail.geometry.attributes.strength.array.fill(0);this.trail.geometry.attributes.strength.needsUpdate=true;}
  update(crown:Group,state:CrownState,dt:number,preview:boolean,reducedMotion:boolean,height:number,pixelRatio:number){
    this.petals.update(crown,state,dt,preview,reducedMotion,this.enabled);
    const mode=preview?'preview':state.mode;
    const summon=!preview&&state.summonedAt!==undefined&&state.summonedAt!==this.lastSummon;
    const worn=mode==='worn'&&this.lastMode!=='worn';
    this.lastSummon=state.summonedAt;this.lastMode=mode;
    if(!this.enabled||(!preview&&!state.visible)){this.root.visible=false;this.clearTrail();this.pulseAge=2;return;}
    this.root.visible=true;dt=Math.max(0,Math.min(dt,.1));
    if(reducedMotion)this.pulseAge=2;else this.time+=dt;
    this.aura.position.copy(crown.position);this.aura.quaternion.copy(crown.quaternion);this.aura.scale.copy(crown.scale);
    this.ring.rotation.y=reducedMotion?0:this.time*.12;
    this.glow.material.uniforms.opacity.value=mode==='worn'?.09:preview?.13:.22;
    this.ring.visible=mode!=='worn';
    this.ring.material.opacity=preview?.22:.38;
    if((summon||worn)&&!reducedMotion)this.pulseAge=0;
    this.pulseAge+=dt;this.pulse.visible=!reducedMotion&&this.pulseAge<.85;
    this.pulse.scale.setScalar(1+this.pulseAge*.8);this.pulse.material.opacity=Math.max(0,1-this.pulseAge/.85)*(mode==='worn'?.2:.55);
    this.pollen.visible=!reducedMotion;this.trail.visible=!reducedMotion&&(mode==='palm'||mode==='held');
    const position=this.pollen.geometry.attributes.position,strength=this.pollen.geometry.attributes.strength;
    const burst=Math.max(0,1-this.pulseAge/.85);
    for(let i=0;i<POLLEN_COUNT;i++){
      const phase=i*.61803398875,angle=phase*TAU+this.time*(i%2?.13:-.11),radius=1.24+(i%5)*.12+burst*.25;
      const rise=((this.time*.13+phase)%1);
      position.setXYZ(i,Math.cos(angle)*radius,.08+rise*.62,Math.sin(angle)*radius);
      strength.setX(i,Math.sin(rise*Math.PI)*(.35+(i%3)*.16));
    }
    position.needsUpdate=true;strength.needsUpdate=true;
    const size=Math.max(3,Math.min(this.mood==='cutesy'?11:7,crown.scale.x*height*(this.mood==='cutesy'?.035:.024)))*pixelRatio;
    this.pollen.material.uniforms.size.value=size;this.trail.material.uniforms.size.value=size*.8;
    this.pollen.material.uniforms.opacity.value=mode==='worn'?.65:preview?.65:1;
    if(reducedMotion||preview||mode==='worn'){this.clearTrail();return;}
    const trailPosition=this.trail.geometry.attributes.position,trailStrength=this.trail.geometry.attributes.strength;
    for(let i=0;i<TRAIL_COUNT;i++){this.ages[i]+=dt;trailStrength.setX(i,Math.max(0,1-this.ages[i]/.55)*.45);}
    const distance=this.initialized?this.previous.distanceTo(crown.position):0;
    if((mode==='palm'||mode==='held')&&distance>.008&&distance<.8){
      const i=this.cursor++%TRAIL_COUNT,angle=i*2.4;
      this.scratch.set(Math.cos(angle)*1.1,.12,Math.sin(angle)*1.1).multiply(crown.scale).applyQuaternion(crown.quaternion).add(crown.position);
      trailPosition.setXYZ(i,this.scratch.x,this.scratch.y,this.scratch.z);this.ages[i]=0;trailStrength.setX(i,.45);
    }
    this.previous.copy(crown.position);this.initialized=true;
    trailPosition.needsUpdate=true;trailStrength.needsUpdate=true;
  }
  dispose(){
    this.root.traverse(o=>{if(o instanceof Mesh||o instanceof Points||o instanceof LineSegments){o.geometry.dispose();if(o instanceof InstancedMesh)o.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
    this.root.removeFromParent();
  }
}
