// Reprocess local hand-only measurement JSON from tests/recording-check.html.
// The recording and landmark measurements are not included in the app bundle.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { Quaternion,Vector3 } from 'three';
const [input,output]=process.argv.slice(2);
if(!input)throw new Error('Pass a local measurements JSON file and optional output path.');
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {HandIdentityTracker}=await server.ssrLoadModule('/src/hand-identity.ts');
 const {handGesture}=await server.ssrLoadModule('/src/coordinates.ts');
 const {TrackingSmoother}=await server.ssrLoadModule('/src/smoothing.ts');
 const {InteractionController}=await server.ssrLoadModule('/src/interaction.ts');
 const {CROWN_LOCAL_RADIUS,CROWN_WIDTH_REFERENCE}=await server.ssrLoadModule('/src/crown-clearance.ts');
 const frames=JSON.parse(await readFile(input,'utf8')), ids=new HandIdentityTracker(),smooth=new TrackingSmoother();
 const controller=new InteractionController({x:.75,y:.5},.3,{summonOnOpen:true,palmClearance:true});
 const aspect=1290/1132, result=[]; let everHeld=false,detached=0,normalBack=0,minimumMargin=Infinity;
 for(const frame of frames){
  const now=1000+Math.round(frame.time*1000);
  const hands=ids.assign(frame.hands.map(h=>({landmarks:h.landmarks,worldLandmarks:h.worldLandmarks,label:h.handedness})),now);
  const observed=hands.map(h=>({id:h.id,...handGesture(h.landmarks,aspect,h.worldLandmarks,false,h.handedness)}));
  const filtered=smooth.process(null,observed,now);
  const state=controller.update({now,observedAt:now,face:null,hands:filtered.hands,aspect});
  if(state.mode==='palm')everHeld=true;
  if(everHeld&&hands.length&&state.mode==='floating')detached++;
  const normal=state.palmOrientation?new Vector3(0,1,0).applyQuaternion(new Quaternion(...state.palmOrientation)).toArray():null;
  if(hands.length&&normal&&normal[2]<-.15)normalBack++;
  const active=filtered.hands.find(h=>h.id===controller.activeHandId);
  let margin=null;
  if(active?.fingers&&state.mode==='palm'){
   const raw=observed.find(h=>h.id===controller.activeHandId);
   margin=(raw?.fingers?.gapRadius ?? 0)-(active.fingers.gapRadius ?? 0)*.08-state.width*CROWN_LOCAL_RADIUS/CROWN_WIDTH_REFERENCE;
   if(state.width>.0251)minimumMargin=Math.min(minimumMargin,margin);
  }
  result.push({time:frame.time,mode:state.mode,owner:controller.activeHandId,hands:hands.map(h=>h.id),normal,position:{...state.position},width:state.width,margin});
 }
 const summary={frames:frames.length,handFrames:frames.filter(f=>f.hands.length).length,detachedAfterPickup:detached,backFacingFrames:normalBack,minimum3DGapMargin:minimumMargin,
  owners:[...new Set(result.map(r=>r.owner).filter(Boolean))]};
 console.log(JSON.stringify(summary,null,2));
 if(output)await writeFile(output,JSON.stringify({summary,frames:result},null,2));
}finally{await server.close();}
