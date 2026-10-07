import { AmbientLight, Color, DirectionalLight, Euler, HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, OrthographicCamera, Quaternion, Scene, SphereGeometry, Vector3, WebGLRenderer } from 'three';
import type { CrownState, FacePose, Size } from './types';
import { CROWN_WIDTH_REFERENCE } from './crown-clearance';
import { createCrown, type CrownStyle, type FlowerCrown } from './crown';
import { CrownEffects } from './crown-effects';
import { MOODS,type Mood } from './moods';
import { fitHeadOccluder, HEAD_CROWN_DEPTH_SCALE } from './head-fit';

export class CrownScene {
  readonly renderer: WebGLRenderer;
  readonly crown: FlowerCrown;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, .1, 100);
  private occluder = new Mesh(new SphereGeometry(1, 32, 24), new MeshBasicMaterial({ colorWrite: false }));
  private effects = new CrownEffects();
  private effectsEnabled=true;
  private ambient=new AmbientLight('#ffffff',1.2);
  private hemisphere=new HemisphereLight('#fff6e5','#53624c',2.2);
  private key=new DirectionalLight('#fffaf0',3.1);
  private fill=new DirectionalLight('#e8edf8',1.2);
  private height = 600;
  private bottomInset=0;
  setBottomInset(pixels:number){this.bottomInset=Math.max(0,pixels);}
  setMood(mood:Mood){this.key.color.set(MOODS[mood].light);this.effects.setMood(mood);}
  private aspect = 1;
  private angle = -.25;
  private tilt = .62;
  private isPreview = true;
  private lastMode = '';
  private motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  private targetRotation = new Quaternion();
  private targetPosition = new Vector3();
  private targetScale = 1;
  private lastSummonedAt: number | undefined;
  private revealElapsed = 1;

  constructor(canvas: HTMLCanvasElement, options: { showHead?: boolean } = {}) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(new Color('#000000'), 0);
    this.camera.position.z = 8;
    this.key.position.set(-3,5,7);this.fill.position.set(3,1,-2);
    this.scene.add(this.ambient,this.hemisphere,this.key,this.fill);
    this.crown = createCrown();
    this.crown.renderOrder = 1;
    this.crown.traverse(o => { if (o instanceof Mesh) o.renderOrder = 1; });
    this.occluder.name='Head occluder';
    this.occluder.material.colorWrite=!!options.showHead;
    this.occluder.material.color.set('#38443e');
    this.occluder.renderOrder = 0; this.occluder.visible = false;
    this.scene.add(this.occluder, this.crown, this.effects.root);
  }

  resize({ width, height }: Size): void {
    this.aspect = width / height; this.height = height;
    this.camera.left = -this.aspect; this.camera.right = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2,Math.sqrt(3_000_000/Math.max(1,width*height))));
    this.renderer.setSize(width, height, false);
  }

  preview(value: boolean): void {
    this.isPreview = value;
    this.lastMode = '';
    this.effects.reset();this.crown.settle();
    if (value) this.resetRotation();
  }

  setEffects(enabled: boolean): void { this.effectsEnabled=enabled;this.effects.setEnabled(enabled); }
  setStyle(style:CrownStyle):void {this.crown.setStyle(style);this.effects.bloom();}
  bloom():void {this.crown.bloom();this.effects.bloom();}

  rotate(dx: number, dy: number): void {
    this.angle += dx * .009;
    this.tilt = Math.max(-.4, Math.min(1.4, this.tilt + dy * .006));
  }
  resetRotation(): void { this.angle = -.25; this.tilt = .62; }

  render(state: CrownState, face: FacePose | null, dt: number): void {
    this.crown.visible = this.isPreview || state.visible;
    this.occluder.visible = !this.isPreview && state.mode === 'worn' && state.visible;
    if (this.isPreview) {
      this.targetPosition.set(0, .035+this.bottomInset/this.height, 0);
      this.targetScale = Math.min(this.aspect * .64, .69*(1-this.bottomInset/this.height));
      this.targetRotation.setFromEuler(new Euler(this.tilt, this.angle, -.075, 'YXZ'));
    } else {
      this.targetPosition.set((state.position.x - .5) * 2 * this.aspect, (.5 - state.position.y) * 2, state.depth ?? 0);
      if (state.summonedAt !== this.lastSummonedAt) {
        this.lastSummonedAt = state.summonedAt;
        this.revealElapsed = state.summonedAt === undefined ? 1 : 0;
      }
      this.revealElapsed += dt;
      if(this.reducedMotion||!this.effectsEnabled)this.revealElapsed=1;
      const progress = Math.min(1, this.revealElapsed / .24);
      const reveal = .18 + .82 * (1 - Math.pow(1 - progress, 3));
      this.targetScale = state.width * 2 * this.aspect / CROWN_WIDTH_REFERENCE * reveal;
      if(state.mode==='worn') {
        const r=state.headRotation ?? face?.rotation;
        if(r)this.targetRotation.setFromEuler(new Euler(r[0]+.08,r[1],r[2],'YXZ'));
      } else if(state.palmOrientation)this.targetRotation.set(...state.palmOrientation);
      else {
        const r=state.mode==='palm'?[.95,0,state.palmRoll??0]:[.5,-.2,-.08];
        this.targetRotation.setFromEuler(new Euler(r[0]+.08,r[1],r[2],'YXZ'));
      }

    }
    const mode = this.isPreview ? 'preview' : state.mode;
    // Carried poses already pass through the landmark/quaternion smoother. A
    // second render lag lets the old, larger crown overlap closing fingertips.
    const blend = this.reducedMotion || mode === 'palm' || mode !== this.lastMode ? 1 : 1 - Math.exp(-dt * 30);
    this.crown.position.lerp(this.targetPosition, blend);
    this.crown.scale.lerp(new Vector3(this.targetScale,this.targetScale,this.targetScale*(mode==='worn'?HEAD_CROWN_DEPTH_SCALE:1)), blend);
    this.crown.quaternion.slerp(this.targetRotation, blend);
    if(this.occluder.visible)fitHeadOccluder(this.occluder,this.crown);
    const worn=mode==='worn';
    this.ambient.intensity=worn?.45:.55;this.hemisphere.intensity=worn?.85:1.05;
    this.key.intensity=worn?2.1:2.3;this.fill.intensity=worn?.45:.65;
    this.lastMode = mode;
    this.crown.animate(state,dt,this.isPreview,this.reducedMotion,this.effectsEnabled);
    this.effects.update(this.crown,state,dt,this.isPreview,this.reducedMotion,this.height,this.renderer.getPixelRatio());
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.effects.dispose();
    const geometries = new Set<any>(), materials = new Set<any>();
    this.scene.traverse(o => {
      if (o instanceof Mesh) {
        geometries.add(o.geometry);if(o instanceof InstancedMesh)o.dispose();
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) materials.add(material);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.renderer.dispose();
  }
}
