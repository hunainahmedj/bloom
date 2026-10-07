import { BufferGeometry, CatmullRomCurve3, Color, DoubleSide, DynamicDrawUsage, Euler, FrontSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { CrownState } from './types';
import { petalGeometry } from './petal-geometry';

export type CrownStyle='garden'|'rose'|'wildflower';
export const CROWN_STYLES:Record<CrownStyle,{name:string;description:string}>={
  garden:{name:'Garden',description:'Golden daisies, ivory petals & fern-like greenery.'},
  rose:{name:'Rose',description:'Full cupped rosettes in coral, raspberry & blush.'},
  wildflower:{name:'Wildflower',description:'Tall lilac bells, tiny stars & meadow sprigs.'},
};
const TAU=Math.PI*2;
interface Petal { flower:Group; batch:InstancedMesh; index:number; angle:number; length:number; radius:number; height:number; fold:number; openPitch:number; delay:number; phase:number; flowerPhase:number }
function leafGeometry():BufferGeometry {
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  const shade=new Color(),dark=new Color('#668254'),light=new Color('#a3b479');
  for(let i=0;i<=12;i++){
    const s=i/12,w=Math.sin(s*Math.PI)*.074,z=s*.38;
    for(let j=0;j<3;j++){
      vertices.push((j-1)*w,j===1?Math.sin(s*Math.PI)*.025:-.005,z);
      shade.copy(dark).lerp(light,j===1?.5:s*.18);colors.push(shade.r,shade.g,shade.b);
    }
    if(i<12){const n=i*3;indices.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function disposeModel(group:Group){
  const geometries=new Set<BufferGeometry>(),materials=new Set<MeshStandardMaterial>();
  group.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m as MeshStandardMaterial);if(o instanceof InstancedMesh)o.dispose();}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();
}

/** Shared meshes keep hundreds of individually hinged petals to a handful of draws. */
export class FlowerCrown extends Group {
  private petals:Petal[]=[];
  private petalBatches:InstancedMesh[]=[];
  private elapsed=2;
  private time=0;
  private lastSummon:number|undefined;
  private style:CrownStyle;
  private petalMatrix=new Matrix4();
  private local=new Matrix4();
  private positionScratch=new Vector3();
  private rotationScratch=new Quaternion();
  private scaleScratch=new Vector3();
  private euler=new Euler(0,0,0,'YXZ');
  constructor(style:CrownStyle='garden'){
    super();this.name='Flower crown';this.style=style;this.build();
  }
  setStyle(style:CrownStyle){
    if(style===this.style)return;
    disposeModel(this);this.style=style;this.build();this.bloom();
  }
  bloom(){this.elapsed=0;}
  settle(){this.elapsed=2;this.writePetals(false);}
  animate(state:CrownState,dt:number,preview:boolean,reducedMotion:boolean,effects:boolean){
    const summon=!preview&&state.summonedAt!==undefined&&state.summonedAt!==this.lastSummon;
    this.lastSummon=state.summonedAt;
    if(!preview&&!state.visible){this.settle();return;}
    if(summon)this.bloom();
    dt=Math.max(0,Math.min(dt,.1));
    const active=effects&&!reducedMotion;
    if(!active)this.elapsed=2;else if(preview||state.visible){this.elapsed+=dt;this.time+=dt;}
    this.writePetals(active,state.mode==='worn'&&!preview);
  }
  private writePetals(animated:boolean,worn=false){
    for(const p of this.petals){
      const t=animated?Math.max(0,Math.min(1,(this.elapsed-p.delay)/1.05)):1;
      const open=t*t*(3-2*t),sway=animated?Math.sin(this.time*1.1+p.phase)*.035*open:0;
      const breathing=animated&&worn&&this.elapsed>2?(Math.sin(this.time*.9+p.flowerPhase)+1)*.085:0;
      const pitch=-p.fold*(1-open)+p.openPitch*open+sway-breathing;
      this.positionScratch.set(Math.sin(p.angle)*p.radius*(.5+.5*open),p.height,Math.cos(p.angle)*p.radius*(.5+.5*open));
      this.euler.set(pitch,p.angle,0);this.rotationScratch.setFromEuler(this.euler);
      this.scaleScratch.set(p.length*(.75+.25*open),p.length,p.length*(.7+.3*open));
      this.local.compose(this.positionScratch,this.rotationScratch,this.scaleScratch);
      this.petalMatrix.multiplyMatrices(p.flower.matrix,this.local);p.batch.setMatrixAt(p.index,this.petalMatrix);
    }
    for(const batch of this.petalBatches)batch.instanceMatrix.needsUpdate=true;
  }
  private build(){
    this.petals=[];this.petalBatches=[];
    const roseStyle=this.style==='rose',wild=this.style==='wildflower',flowerCount=wild?24:roseStyle?12:18;
    const sphere=new SphereGeometry(1,10,6),leaf=leafGeometry();
    const petalMaterial=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,side:FrontSide,roughness:.74});
    const green=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,side:DoubleSide,roughness:.82});
    const vineMaterial=new MeshStandardMaterial({color:'#465732',roughness:.9});
    const path=(twist:boolean)=>new CatmullRomCurve3(Array.from({length:96},(_,i)=>{
      const t=i/96*TAU,r=1+(twist?Math.cos(t*18)*.021:0);
      return new Vector3(Math.cos(t)*r,twist?Math.sin(t*18)*.021:Math.sin(t*3)*.008,Math.sin(t)*r);
    }),true);
    const vine=new Mesh(new TubeGeometry(path(false),128,.022,6,true),vineMaterial);vine.name='vine';
    this.add(vine,new Mesh(new TubeGeometry(path(true),192,.01,4,true),vineMaterial));
    const leaves=new Group();leaves.name='leaves';
    const foliage=new InstancedMesh(leaf,green,wild?48:40);foliage.name='Leaf blades';
    const leafPose=new Group(),matrix=new Matrix4(),color=new Color();
    for(let i=0;i<foliage.count;i++){
      const t=i/foliage.count*TAU;
      leafPose.position.set(Math.cos(t),.005+(i%3)*.035,Math.sin(t));
      leafPose.rotation.set(i%2?-.29:.22,-t+Math.PI/2+(i%2?.66:-.6),.08);
      leafPose.scale.setScalar((wild?.74:.88)+(i%4)*.055);leafPose.updateMatrix();
      foliage.setMatrixAt(i,leafPose.matrix);foliage.setColorAt(i,color.set(['#bbccaa','#819566','#a9bc8b'][i%3]));
    }
    leaves.add(foliage);this.add(leaves);
    const flowers=new Group();flowers.name='flowers';
    const records:{flower:Group;rose:boolean;number:number;size:number}[]=[];
    for(let i=0;i<flowerCount;i++){
      const rose=roseStyle,t=i/flowerCount*TAU;
      const bell=wild&&i%3!==0;
      const flower=new Group();flower.name=rose?'cupped rosette':bell?'meadow bell':'daisy';
      flower.position.set(Math.cos(t)*.98,(wild?.18:rose?.13:.16)+Math.sin(i*2)**2*(wild?.10:rose?.06:.07),Math.sin(t)*.98);
      flower.quaternion.setFromUnitVectors(new Vector3(0,1,0),new Vector3(Math.cos(t)*(rose?.52:wild?.15:.65),.9,Math.sin(t)*(rose?.52:wild?.15:.65)).normalize());
      flower.rotateY(i*.72);flower.updateMatrix();flowers.add(flower);
      records.push({flower,rose,number:i,size:(wild?.58:rose?1.12:1.03)*(1+Math.sin(i*5)*.075)});
    }
    this.add(flowers);
    const daisyCount=records.filter(r=>!r.rose).length*(wild?7:20),roseCount=records.filter(r=>r.rose).length*48;
    const daisies=new InstancedMesh(petalGeometry(wild?'bell':'daisy'),petalMaterial,daisyCount);daisies.name='Daisy petals';
    const roses=new InstancedMesh(petalGeometry(true),petalMaterial,roseCount);roses.name='Rose petals';
    for(const batch of [daisies,roses]){
      // Petals move inside the tested whole-crown bound. Disable stale instance
      // culling rather than rebuilding a sphere for every animated petal frame.
      batch.frustumCulled=false;batch.instanceMatrix.setUsage(DynamicDrawUsage);
      this.add(batch);this.petalBatches.push(batch);
    }
    const centers=new InstancedMesh(sphere,new MeshStandardMaterial({color:'#ffffff',roughness:.94}),flowerCount);centers.name='Flower hearts';
    const seeds=new InstancedMesh(sphere,new MeshStandardMaterial({color:'#e8bb50',roughness:.85}),records.filter(r=>!r.rose).length*19);seeds.name='Pollen seeds';
    const pose=new Group();let daisyIndex=0,roseIndex=0,seedIndex=0;
    for(const r of records){
      const layers=r.rose?6:wild?1:2;
      for(let layer=0;layer<layers;layer++){
        const count=r.rose?8:wild?7:layer===0?12:8;
        for(let j=0;j<count;j++){
          const angle=j/count*TAU+layer*.51+r.number*.13;
          const length=(r.rose?.28-layer*.03:wild?.29:layer===0?.27:.20)*r.size;
          const batch=r.rose?roses:daisies,index=r.rose?roseIndex++:daisyIndex++;
          this.petals.push({flower:r.flower,batch,index,angle,length,radius:(r.rose?.021+layer*.003:.029)*r.size,height:(layer*.04+j*.003)*r.size,fold:r.rose?1.1-layer*.08:1.17,openPitch:r.rose?-.4-layer*.12:wild?-.55:-.28,delay:r.number/flowerCount*.4+layer*.055,phase:r.number*1.8+j*.5,flowerPhase:r.number*1.6});
          const tint=r.rose?(roseStyle?['#ef94a1','#e5a194','#d889aa'][r.number%3]:'#efbdcd'):wild?(r.number%3?'#fff9ec':'#c7b5e6'):r.number%4===0?'#f5cd69':'#fffaf0';
          batch.setColorAt(index,color.set(tint));
        }
      }
      pose.position.set(0,r.rose?.23*r.size:.048*r.size,0);pose.rotation.set(0,0,0);
      pose.scale.set(r.rose?.029*r.size:.08*r.size,r.rose?.03*r.size:.064*r.size,r.rose?.029*r.size:.08*r.size);pose.updateMatrix();
      matrix.multiplyMatrices(r.flower.matrix,pose.matrix);centers.setMatrixAt(r.number,matrix);
      centers.setColorAt(r.number,color.set(r.rose?'#cb819f':'#dfab40'));
      if(!r.rose)for(let j=0;j<19;j++){
        const a=j*2.39996,radius=Math.sqrt(j/19)*.063*r.size;
        pose.position.set(Math.cos(a)*radius,.048*r.size+Math.sqrt(Math.max(0,1-(radius/(.080*r.size))**2))*.065*r.size,Math.sin(a)*radius);
        pose.scale.setScalar(.0075*r.size);pose.updateMatrix();matrix.multiplyMatrices(r.flower.matrix,pose.matrix);seeds.setMatrixAt(seedIndex++,matrix);
      }
    }
    const stemGeometry=new TubeGeometry(new CatmullRomCurve3([new Vector3(0,0,0),new Vector3(.01,.10,0),new Vector3(0,.20,0)]),8,.008,5,false);
    const stems=new InstancedMesh(stemGeometry,vineMaterial,flowerCount);stems.name='Flower stems';
    for(const r of records){pose.position.set(r.flower.position.x,0,r.flower.position.z);pose.rotation.set(0,0,0);pose.scale.set(1,r.flower.position.y/.2,1);pose.updateMatrix();stems.setMatrixAt(r.number,pose.matrix);}
    this.add(stems,centers,seeds);
    if(wild){
      const buds=new InstancedMesh(sphere,new MeshStandardMaterial({color:'#9476be',roughness:.7}),36);buds.name='Meadow buds';
      for(let i=0;i<36;i++){const a=Math.floor(i/3)/12*TAU;pose.position.set(Math.cos(a)*.96,.38+i%3*.045,Math.sin(a)*.96);pose.rotation.set(0,a,0);pose.scale.set(.025,.04,.028);pose.updateMatrix();buds.setMatrixAt(i,pose.matrix);}
      this.add(buds);
    }
    this.writePetals(false);
    this.traverse(o=>{if(o instanceof Mesh)o.renderOrder=1;});
  }
}
export function createCrown(style:CrownStyle='garden'):FlowerCrown {return new FlowerCrown(style);}
