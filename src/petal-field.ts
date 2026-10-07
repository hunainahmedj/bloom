import { Color, DoubleSide, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { CrownState } from './types';
import { petalGeometry } from './petal-geometry';
import { MOODS, type Mood } from './moods';
const CAPACITY=18,LIFE=2.8;
interface FallingPetal {position:Vector3;velocity:Vector3;rotation:Euler;spin:Vector3;age:number;scale:number;tint:Color}

/** A small reusable pool; detached petals keep falling after the hand moves away. */
export class PetalField {
  readonly root=new Group();
  private mesh=new InstancedMesh(petalGeometry(),new MeshStandardMaterial({color:'#ffffff',vertexColors:true,side:DoubleSide,roughness:.78}),CAPACITY);
  private petals:FallingPetal[]=Array.from({length:CAPACITY},()=>({position:new Vector3(),velocity:new Vector3(),rotation:new Euler(),spin:new Vector3(),age:LIFE,scale:0,tint:new Color()}));
  private mood:Mood='natural';
  setMood(mood:Mood){this.mood=mood;}
  private cursor=0;
  private clock=0;
  private previous=new Vector3();
  private initialized=false;
  private lastSummon:number|undefined;
  private queued=false;
  private matrix=new Matrix4();
  private quaternion=new Quaternion();
  private scale=new Vector3();
  constructor(){
    this.root.name='Petal effects';this.mesh.name='Drifting petals';this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.renderOrder=2;this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.root.add(this.mesh);
  }
  burst(){this.queued=true;}
  clear(){this.petals.forEach(p=>p.age=LIFE);this.mesh.count=0;this.initialized=false;this.clock=0;this.queued=false;}
  update(crown:Group,state:CrownState,dt:number,preview:boolean,reducedMotion:boolean,enabled:boolean){
    const summon=!preview&&state.summonedAt!==undefined&&state.summonedAt!==this.lastSummon;this.lastSummon=state.summonedAt;
    if(!enabled||reducedMotion||(!preview&&!state.visible)){this.clear();return;}
    dt=Math.max(0,Math.min(dt,.1));this.clock+=dt;
    const distance=this.initialized?this.previous.distanceTo(crown.position):0;
    if(summon||this.queued){for(let i=0;i<5;i++)this.emit(crown);this.clock=0;this.queued=false;}
    else if((!preview&&state.mode==='worn'&&this.clock>MOODS[this.mood].cadence)||(preview&&this.clock>1.8)||(!preview&&(state.mode==='palm'||state.mode==='held')&&((distance>.01&&distance<.8&&this.clock>.32)||this.clock>1.2))){
      this.emit(crown);this.clock=0;
    }
    this.previous.copy(crown.position);this.initialized=true;
    let count=0;
    for(const p of this.petals){
      p.age+=dt;if(p.age>=LIFE)continue;
      p.velocity.y-=p.scale*1.7*dt;
      p.position.addScaledVector(p.velocity,dt);p.position.x+=Math.sin(p.age*3+p.spin.x)*p.scale*.28*dt;
      p.rotation.x+=p.spin.x*dt;p.rotation.y+=p.spin.y*dt;p.rotation.z+=p.spin.z*dt;
      this.quaternion.setFromEuler(p.rotation);this.scale.setScalar(p.scale*Math.min(1,(LIFE-p.age)/.5));
      this.matrix.compose(p.position,this.quaternion,this.scale);this.mesh.setMatrixAt(count,this.matrix);this.mesh.setColorAt(count,p.tint);count++;
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  private emit(crown:Group){
    const n=this.cursor++,p=this.petals[n%CAPACITY],angle=n*2.39996;
    p.position.set(Math.cos(angle)*1.035,.085,Math.sin(angle)*1.035).multiply(crown.scale).applyQuaternion(crown.quaternion).add(crown.position);
    p.scale=Math.max(.003,crown.scale.x*.13);p.age=0;
    p.velocity.set(Math.cos(angle)*p.scale*.8,-p.scale*.65,Math.sin(angle)*p.scale*.3);
    p.rotation.set(angle,.4,angle*.7);p.spin.set(1.1+n%3*.3,.8+n%2*.4,.5);const palette=MOODS[this.mood].petals;p.tint.set(palette[n%palette.length]);
  }
}
