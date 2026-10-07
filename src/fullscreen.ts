/** Native fullscreen where supported; an in-page immersive view otherwise. */
export class SceneFullscreen {
 private fallback=false;
 private previousOverflow='';
 private changed=()=>this.sync();
 private key=(e:KeyboardEvent)=>{
  if(e.key==='Escape'&&this.active){
    e.preventDefault();
    if(this.fallback)this.leaveFallback();
    else void document.exitFullscreen().catch(()=>{});
  }
  else if(e.key==='Tab'&&this.active){
    const items=Array.from(this.stage.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length);
    const first=items[0],last=items[items.length-1],current=document.activeElement;
    if(!first)return;
    if((e.shiftKey&&current===first)||(!e.shiftKey&&current===last)||!this.stage.contains(current)){
      e.preventDefault();(e.shiftKey?last:first).focus();
    }
  }
 };
 constructor(private stage:HTMLElement,private button:HTMLButtonElement){
  document.addEventListener('fullscreenchange',this.changed);window.addEventListener('keydown',this.key);this.sync();
 }
 get active(){return this.fallback||document.fullscreenElement===this.stage;}
 async toggle(){
  if(this.fallback){this.leaveFallback();return;}
  if(document.fullscreenElement===this.stage){await document.exitFullscreen();return;}
  try{if(!this.stage.requestFullscreen)throw new Error('Fullscreen unavailable');await this.stage.requestFullscreen();}
  catch{this.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';this.fallback=true;this.stage.classList.add('expanded');this.sync();this.button.focus();}
 }
 private leaveFallback(){this.fallback=false;this.stage.classList.remove('expanded');document.body.style.overflow=this.previousOverflow;this.sync();}
 private sync(){const on=this.fallback||document.fullscreenElement===this.stage;this.button.setAttribute('aria-pressed',String(on));this.button.setAttribute('aria-label',on?'Exit fullscreen':'Enter fullscreen');this.button.title=on?'Exit fullscreen':'Enter fullscreen';}
 dispose(){document.removeEventListener('fullscreenchange',this.changed);window.removeEventListener('keydown',this.key);if(this.fallback)this.leaveFallback();}
}
