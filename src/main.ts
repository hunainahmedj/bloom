import './style.css';
import { CameraController } from './camera';
import { handGesture, mapVideoPoint, mapVideoSpan } from './coordinates';
import { InteractionController, PINCH_CLOSE } from './interaction';
import { facePose } from './pose';
import { CrownScene } from './scene';
import { CROWN_STYLES, type CrownStyle } from './crown';
import { HandMenu } from './hand-menu';
import { MOODS,type Mood } from './moods';
import { SceneFullscreen } from './fullscreen';
import { TrackingClient } from './tracking';
import { bindPageLifecycle } from './lifecycle';
import { TrackingSmoother } from './smoothing';
import type { TrackingResult } from './tracking-types';
import type { FacePose, Gesture, Point } from './types';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = el('status'), startButton = el<HTMLButtonElement>('start');

function initialize(): void {
  const stage = el('stage'), canvas = el<HTMLCanvasElement>('scene'), video = el<HTMLVideoElement>('camera');
  const stopButton = el<HTMLButtonElement>('stop'), resetButton = el<HTMLButtonElement>('reset');
  const wearButton = el<HTMLButtonElement>('wear'), hint = el('hint'), mode = el('mode');
  const setDownButton = el<HTMLButtonElement>('set-down');
  const cursor = el('cursor'), placement = el('placement'), fingertipNodes = el('fingertips');
  const tipMarkers = Array.from(fingertipNodes.children) as HTMLElement[];
  const scene = new CrownScene(canvas);
  const effectsButton=el<HTMLButtonElement>('effects');
  const settings=el('scene-settings'),settingsButton=el<HTMLButtonElement>('settings-toggle');
  const settingsPointer=el('settings-pointer'),handMenu=new HandMenu();
  const clearHandUI=()=>{handMenu.reset();settingsPointer.hidden=true;for(const b of stage.querySelectorAll<HTMLElement>('[data-hand-target]')){b.classList.remove('hand-hover');b.style.removeProperty('--dwell');}};
  const fullscreen=new SceneFullscreen(stage,el<HTMLButtonElement>('fullscreen'));
  el('fullscreen').addEventListener('click',()=>{setSettingsOpen(false);void fullscreen.toggle();});
  const updateInset=()=>{const inset=settings.hidden?35:settings.offsetHeight+30;scene.setBottomInset(inset);stage.style.setProperty('--panel-height',`${inset}px`);};
  const setSettingsOpen=(open:boolean)=>{
    settings.hidden=!open;stage.classList.toggle('settings-hidden',!open);
    settingsButton.setAttribute('aria-expanded',String(open));settingsButton.setAttribute('aria-label',open?'Close look options':`Change look, ${el('selected-look').textContent}`);
    settingsButton.title=open?'Close look options':'Change flowers and camera filters';
    if(!open&&settings.contains(document.activeElement))settingsButton.focus();
    clearHandUI();updateInset();
  };
  settingsButton.addEventListener('click',()=>setSettingsOpen(settings.hidden));
  stage.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!settings.hidden){event.preventDefault();event.stopPropagation();setSettingsOpen(false);}
  },true);
  setSettingsOpen(false);
  const finishSelection=()=>{if(session==='live')setSettingsOpen(false);};
  const panelObserver=new ResizeObserver(updateInset);panelObserver.observe(settings);
  const bloomButton=el<HTMLButtonElement>('bloom'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const updateBloomControl=()=>{
    bloomButton.disabled=motion.matches||effectsButton.getAttribute('aria-pressed')!=='true';
    bloomButton.title=motion.matches?'Animation follows your reduced-motion preference':bloomButton.disabled?'Turn effects on to animate the flowers':'Replay the flowers opening';
  };
  motion.addEventListener('change',updateBloomControl);updateBloomControl();
  effectsButton.addEventListener('click',()=>{
    const enabled=effectsButton.getAttribute('aria-pressed')!=='true';
    effectsButton.setAttribute('aria-pressed',String(enabled));
    effectsButton.innerHTML=`<span aria-hidden="true">✧</span><span class="effects-label">Effects ${enabled?'on':'off'}</span>`;
    effectsButton.setAttribute('aria-label',`Effects ${enabled?'on':'off'}`);stage.dataset.effects=String(enabled);
    scene.setEffects(enabled);updateBloomControl();
  });
  const styleButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-style]'));
  for(const button of styleButtons)button.addEventListener('click',()=>{
    const style=button.dataset.style as CrownStyle;
    for(const choice of styleButtons)choice.setAttribute('aria-pressed',String(choice===button));
    el('style-description').textContent=CROWN_STYLES[style].description;
    el('selected-look').textContent=CROWN_STYLES[style].name;
    if(settings.hidden)settingsButton.setAttribute('aria-label',`Change look, ${CROWN_STYLES[style].name}`);
    scene.setStyle(style);
    finishSelection();
  });
  const moodButtons=Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-mood]'));
  for(const button of moodButtons)button.addEventListener('click',()=>{
    const mood=button.dataset.mood as Mood;
    for(const choice of moodButtons)choice.setAttribute('aria-pressed',String(choice===button));
    stage.dataset.mood=mood;video.style.filter=MOODS[mood].filter;scene.setMood(mood);
    finishSelection();
  });
  scene.setMood('natural');
  bloomButton.addEventListener('click',()=>{scene.bloom();finishSelection();});
  const camera = new CameraController(), tracker = new TrackingClient();
  const controller = new InteractionController({ x: .76, y: .58 }, .3, { summonOnOpen: true, palmClearance: true });
  const smoother = new TrackingSmoother();
  let session: 'preview' | 'starting' | 'live' = 'preview';
  let generation = 0, face: FacePose | null = null, hands: Gesture[] = [], rawResult: TrackingResult | null = null;
  let lastResultAt = -Infinity, lastFrameTime = -1, nextInference = 0, previousTime = performance.now();
  let pointer: { id: number; x: number; y: number; grabbed: boolean } | null = null;
  let raf = 0;

  const sceneCamera=el<HTMLButtonElement>('scene-camera');
  const updateSceneCamera=()=>{sceneCamera.setAttribute('aria-label',session==='preview'?'Start camera in scene':session==='starting'?'Cancel camera startup':'Stop camera in scene');sceneCamera.title=session==='preview'?'Start camera':'Stop camera';};
  sceneCamera.addEventListener('click',()=>session==='preview'?void start():stop());
  const viewport = () => ({ width: stage.clientWidth, height: stage.clientHeight });
  const videoSize = () => ({ width: video.videoWidth || 960, height: video.videoHeight || 720 });
  function message(text: string, error = false) { status.textContent = text; status.classList.toggle('error', error);
    const overlay=el('stage-status');overlay.textContent=text;overlay.classList.toggle('error',error);overlay.hidden=!error&&session!=='starting';
  }

  function mapResult(result: TrackingResult): void {
    const size = viewport(), source = videoSize();
    const mappedFace = result.face ? facePose(result.face, result.matrix, source, size) : null;
    const mappedHands = result.hands.map(hand => {
      const gesture = handGesture(hand.landmarks, source.width / source.height, hand.worldLandmarks, true, hand.handedness);
      return { id: hand.id, uiPointing:gesture.uiPointing, ratio: gesture.ratio, point: mapVideoPoint(gesture.point, source, size, true),
        fingers: { ...gesture.fingers, palmCenter: gesture.fingers.palmCenter ? mapVideoPoint(gesture.fingers.palmCenter, source, size, true) : undefined, gapRadius: gesture.fingers.gapRadius === undefined ? undefined : mapVideoSpan(gesture.fingers.gapRadius, source, size), point: mapVideoPoint(gesture.fingers.point, source, size, true),
          nodes: gesture.fingers.nodes.map(p => mapVideoPoint(p, source, size, true)) },
        palm: { ...gesture.palm, point: mapVideoPoint(gesture.palm.point, source, size, true), span: mapVideoSpan(gesture.palm.span, source, size) } };
    });
    ({ face, hands } = smoother.process(mappedFace, mappedHands, result.timestamp));
  }

  tracker.onResult = result => {
    if (session !== 'live') return;
    rawResult = result; lastResultAt = result.timestamp; mapResult(result);
  };
  tracker.onError = error => {
    if (session === 'preview') return;
    stop();
    message(`Tracking stopped. ${error.message}`, true);
  };

  function stop(): void {
    generation++;
    tracker.stop(); camera.stop();
    session = 'preview'; face = null; hands = []; rawResult = null; pointer = null;
    controller.newSession(); smoother.reset();clearHandUI(); scene.preview(true);updateSceneCamera();
    stage.classList.remove('live'); video.hidden = true;
    stopButton.hidden = true; startButton.hidden = false; startButton.disabled = false;
    startButton.querySelector('span')!.textContent = 'Start camera';
    el('tracking-badges').hidden = true; el('camera-tools').hidden = true;
    cursor.hidden = true; fingertipNodes.hidden = true; placement.hidden = true;
    el('size-readout').hidden = true;
    mode.innerHTML = '<span></span>3D preview'; hint.textContent = 'Drag to explore. Change look for flowers & filters.';
    message('Camera stopped. You can still explore the crown.');
  }

  async function start(): Promise<void> {
    if (session !== 'preview') return;
    setSettingsOpen(false);
    const current = ++generation;
    session = 'starting';updateSceneCamera(); startButton.disabled = true; stopButton.hidden = false;
    startButton.querySelector('span')!.textContent = 'Starting…';
    message('Allow camera access when your browser asks.');
    try {
      await camera.start(video);
      if (current !== generation) return;
      message('Loading face and hand tracking. This may take a few seconds.');
      video.hidden = false; stage.classList.add('live'); scene.preview(false);
      controller.newSession(); smoother.reset(); mode.innerHTML = '<span></span>Loading tracking';
      await tracker.start();
      if (current !== generation) return;
      session = 'live';updateSceneCamera(); lastResultAt = -Infinity; lastFrameTime = -1; nextInference = 0;
      startButton.hidden = true; startButton.disabled = false;
      el('tracking-badges').hidden = false; el('camera-tools').hidden = false;
      mode.innerHTML = '<span></span>Camera live';
      message('Open your hand to summon the crown between your fingertips. Spread to grow; curl to shrink.');
    } catch (error) {
      if (current !== generation) return;
      stop();
      const name = error instanceof DOMException ? error.name : '';
      const text = name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera in your browser’s site settings, then try again.'
        : name === 'NotFoundError' ? 'No camera was found. Connect a camera and try again, or explore the 3D crown here.'
        : name === 'NotReadableError' ? 'Your camera is unavailable. Close other apps using it, then try again.'
        : error instanceof Error ? error.message : 'The camera could not start. Try again or explore the crown.';
      message(text, true);
    }
  }

  startButton.addEventListener('click', start);
  stopButton.addEventListener('click', stop);
  resetButton.addEventListener('click', () => {
    controller.reset(performance.now()); scene.resetRotation();
    message(session === 'live' ? 'Crown reset. Close and reopen your hand to summon it.' : 'Crown reset. Drag to explore, or start your camera to try it on.');
  });
  wearButton.addEventListener('click', () => {
    if (!controller.state.visible || !face || performance.now() - lastResultAt > 250) return;
    if (controller.state.mode === 'worn') controller.reset(performance.now());
    else controller.wear(face);
    finishSelection();
  });
  setDownButton.addEventListener('click', () => {controller.release(null, performance.now());finishSelection();});

  const point = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  canvas.addEventListener('pointerdown', event => {
    if(!settings.hidden)setSettingsOpen(false);
    if (session === 'starting' || pointer) return;
    const grabbed = session === 'live' && controller.grab(point(event), 'pointer', performance.now());
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, grabbed };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (session === 'preview') scene.rotate(event.clientX - pointer.x, event.clientY - pointer.y);
    else if (pointer.grabbed) controller.move(point(event), 'pointer', performance.now());
    pointer.x = event.clientX; pointer.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.grabbed) controller.release(performance.now() - lastResultAt <= 250 ? face : null, performance.now());
    pointer = null;
  });
  canvas.addEventListener('pointercancel', () => { if (pointer?.grabbed) controller.release(null, performance.now()); pointer = null; });
  canvas.addEventListener('lostpointercapture', () => { if (pointer?.grabbed) controller.release(null, performance.now()); pointer = null; });
  canvas.addEventListener('keydown', event => {
    if (session === 'preview' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); scene.rotate(event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0, event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0);
    }
    if (event.key === 'Escape'&&!fullscreen.active) { controller.reset(performance.now()); scene.resetRotation(); }
  });

  const observer = new ResizeObserver(() => { scene.resize(viewport());updateInset(); handMenu.reset(); smoother.reset(); if (rawResult) mapResult(rawResult); });
  observer.observe(stage); scene.resize(viewport());

  function render(now: number): void {
    const dt = Math.min((now - previousTime) / 1000, .1); previousTime = now;
    if (session === 'live') {
      const fresh = now - lastResultAt <= 250;
      const currentFace = fresh ? face : null, currentHands = fresh ? hands : [];
      const rect=stage.getBoundingClientRect();
      const targetButtons=Array.from(stage.querySelectorAll<HTMLButtonElement>('[data-hand-target]'));
      const targets=targetButtons.filter(b=>!b.disabled).map(b=>{const r=b.getBoundingClientRect();return {id:b.dataset.handTarget!,x:(r.left-rect.left)/rect.width,y:(r.top-rect.top)/rect.height,width:r.width/rect.width,height:r.height/rect.height};}).filter(r=>r.width>0&&r.height>0);
      const selection=handMenu.update({now,observedAt:lastResultAt,hands:currentHands,targets,enabled:controller.state.mode==='worn'&&controller.state.visible&&!!currentFace});
      for(const button of targetButtons){button.classList.toggle('hand-hover',selection.target===button.dataset.handTarget);button.style.setProperty('--dwell',String(selection.target===button.dataset.handTarget?selection.progress:0));}
      settingsPointer.hidden=!selection.point;
      if(selection.point){settingsPointer.style.left=`${selection.point.x*100}%`;settingsPointer.style.top=`${selection.point.y*100}%`;settingsPointer.style.setProperty('--dwell',String(selection.progress));}
      if(selection.activated){targetButtons.find(b=>b.dataset.handTarget===selection.activated)?.click();if(session!=='live'){raf=requestAnimationFrame(render);return;}}
      controller.update({ now, observedAt: lastResultAt, face: currentFace, hands: currentHands.filter(h=>h.id!==selection.consumedHandId), aspect: stage.clientWidth / stage.clientHeight });
      if (now >= nextInference && video.currentTime !== lastFrameTime) {
        lastFrameTime = video.currentTime; nextInference = now + 33;
        void tracker.submit(video, now);
      }
      const state = controller.state;
      const instruction = controller.recoveringHand ? 'Keep your hand in view—still holding your crown.'
        : state.mode === 'worn' ? (state.visible ? (settings.hidden?'Point & hold on Change look to choose flowers or filters. Grab the crown to remove.':'Point & hold on a look or mood to choose. Grab the crown to remove.') : 'Bring your face back into view.')
        : state.mode === 'palm' ? (controller.placementProgress > 0 ? 'Hold here to put it on…' : 'Move your fingertips. Spread to grow; curl to shrink.')
        : state.mode === 'held' ? 'Open your hand to hold it between your fingertips.'
        : !state.visible ? 'Open your hand to summon your crown.'
        : !currentFace ? 'Bring your face into view.' : !currentHands.length ? 'Show your hand, or drag the crown.' : 'Close your fist or pinch near the crown.';
      if (hint.textContent !== instruction) hint.textContent = instruction;
      el('face-badge').classList.toggle('found', !!currentFace);
      el('hand-badge').classList.toggle('found', !!currentHands.length);
      wearButton.disabled = !currentFace || !state.visible;
      wearButton.textContent = state.mode === 'worn' ? 'Take crown off' : 'Put crown on';
      setDownButton.disabled = state.mode !== 'held' && state.mode !== 'palm';
      el('size-readout').hidden = !state.visible;
      el('size-readout').textContent = state.mode === 'worn' ? 'Fitted to your head' : `Crown size ${Math.round((state.sizeFactor ?? 1) * 100)}%`;
      cursor.hidden = !currentHands.length||!!selection.point;
      const activeHand = currentHands.find(hand => hand.id === controller.activeHandId) ?? currentHands[0];
      fingertipNodes.hidden = !activeHand?.fingers||!!selection.point;
      if (activeHand?.fingers) {
        activeHand.fingers.nodes.forEach((node,i) => {
          const marker = tipMarkers[i]; if (!marker) return;
          marker.style.left = `${node.x * 100}%`; marker.style.top = `${node.y * 100}%`;
        });
        if (state.mode === 'palm') cursor.hidden = true;
      }
      if (activeHand) {
        const cursorPoint = state.mode === 'palm' && activeHand.fingers ? activeHand.fingers.point : state.mode === 'palm' && activeHand.palm ? activeHand.palm.point : activeHand.point;
        cursor.style.left = `${cursorPoint.x * 100}%`; cursor.style.top = `${cursorPoint.y * 100}%`;
        cursor.classList.toggle('pinching', activeHand.ratio < PINCH_CLOSE);
        cursor.classList.toggle('palm-hold', state.mode === 'palm');
      }
      placement.hidden = !currentFace || state.mode === 'worn';
      if (currentFace) {
        placement.style.left = `${(currentFace.crown.x - currentFace.width * .6) * 100}%`;
        placement.style.top = `${(currentFace.crown.y - currentFace.height * .3) * 100}%`;
        placement.style.width = `${currentFace.width * 120}%`; placement.style.height = `${currentFace.height * 60}%`;
        placement.classList.toggle('near', controller.placementProgress > 0);
        placement.style.setProperty('--progress', `${controller.placementProgress}`);
      }
      scene.render(state, currentFace, dt);
    } else scene.render(controller.state, null, dt);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);
  bindPageLifecycle(window, {
    suspend() { stop(); cancelAnimationFrame(raf); observer.disconnect();panelObserver.disconnect(); },
    resume() { observer.observe(stage);panelObserver.observe(settings); scene.resize(viewport()); previousTime = performance.now(); raf = requestAnimationFrame(render); },
    dispose() { panelObserver.disconnect();fullscreen.dispose();motion.removeEventListener('change',updateBloomControl);scene.dispose(); },
  });
}

try { initialize(); }
catch {
  startButton.disabled = true;
  status.textContent = '3D rendering is unavailable. Try a recent browser with hardware acceleration enabled.';
  status.classList.add('error');
}
