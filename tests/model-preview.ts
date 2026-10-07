import { CrownScene } from '../src/scene';
import type { CrownStyle } from '../src/crown';
import type { CrownState } from '../src/types';
const stage=document.getElementById('stage')!,scene=new CrownScene(document.getElementById('scene') as HTMLCanvasElement,{showHead:true});
const state:CrownState={mode:'floating',position:{x:.5,y:.3},width:.44,visible:true,headRotation:[.18,0,0]};
let paused=false,step=0,effects=true,style='Garden',previous=performance.now();
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-style]'))b.onclick=()=>{
 scene.setStyle(b.dataset.style as CrownStyle);style=b.textContent!;
 for(const c of document.querySelectorAll('[data-style]'))c.setAttribute('aria-pressed',String(c===b));
};
document.getElementById('bloom')!.onclick=()=>scene.bloom();
document.getElementById('pause')!.onclick=()=>{paused=!paused;const b=document.getElementById('pause')!;b.setAttribute('aria-pressed',String(paused));b.textContent=paused?'Resume animation':'Pause animation';};
document.getElementById('step')!.onclick=()=>step=.25;
document.getElementById('effects')!.onclick=()=>{effects=!effects;scene.setEffects(effects);const b=document.getElementById('effects')!;b.setAttribute('aria-pressed',String(effects));b.textContent=effects?'Effects on':'Effects off';};
document.getElementById('worn')!.onclick=()=>{const worn=state.mode!=='worn';state.mode=worn?'worn':'floating';scene.preview(!worn);document.getElementById('worn')!.setAttribute('aria-pressed',String(worn));};
new ResizeObserver(()=>scene.resize({width:stage.clientWidth,height:stage.clientHeight})).observe(stage);
function render(now:number){
 const dt=paused?step:Math.min(.05,(now-previous)/1000);step=0;previous=now;
 // Render subdivisions let the bounded animation timestep advance a 250ms step.
 for(let t=0;t<Math.max(dt,.00001);t+=.05)scene.render(state,null,Math.min(.05,dt-t));
 const info=scene.renderer.info.render;
 document.getElementById('readout')!.textContent=`${style} · ${state.mode==='worn'?'worn':'preview'} · ${paused?'paused':'animated'} · ${info.calls} draw calls · ${info.triangles.toLocaleString()} triangles`;
 requestAnimationFrame(render);
}requestAnimationFrame(render);
