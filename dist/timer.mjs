export const PRESETS=[15,25,45,60,120];
export const freshState=()=>({version:2,intention:'',firstStep:'',minutes:25,chime:false,hideTime:false,phase:'setup',total:1500,remaining:1500,endAt:null});
export function validMinutes(value){const n=Number(value);return String(value).trim()!==''&&Number.isInteger(n)&&n>=1&&n<=1440;}
export function remaining(state,now=Date.now()){return state.phase==='running'?Math.max(0,Math.min(state.total,Math.ceil((state.endAt-now)/1000))):state.remaining;}
export function formatTime(seconds){const n=Math.max(0,Math.ceil(seconds)),hours=Math.floor(n/3600),minutes=Math.floor(n%3600/60),secs=String(n%60).padStart(2,'0');return hours?`${hours}:${String(minutes).padStart(2,'0')}:${secs}`:`${String(minutes).padStart(2,'0')}:${secs}`;}
export function durationText(minutes){return minutes%60===0?`${minutes/60} ${minutes===60?'hour':'hours'}`:`${minutes} ${minutes===1?'minute':'minutes'}`;}
export function advance(state,now=Date.now()){if(state.phase==='running'&&remaining(state,now)===0)return{...state,phase:'complete',remaining:0,endAt:null};return state;}
export function begin(state,now=Date.now()){const total=state.minutes*60;return{...state,phase:'running',total,remaining:total,endAt:now+total*1000};}
export function pause(state,now=Date.now()){state=advance(state,now);return state.phase==='running'?{...state,phase:'paused',remaining:remaining(state,now),endAt:null}:state;}
export function resume(state,now=Date.now()){return state.phase==='paused'&&state.remaining>0?{...state,phase:'running',endAt:now+state.remaining*1000}:state;}
export function finish(state){return{...state,phase:'setup',remaining:state.minutes*60,total:state.minutes*60,endAt:null};}
export function restore(saved,legacy,now=Date.now()){
 const base=freshState();
 if(saved&&saved.version===2&&validMinutes(saved.minutes)&&typeof saved.intention==='string'&&typeof saved.firstStep==='string'&&['setup','running','paused','complete'].includes(saved.phase)&&Number.isFinite(saved.total)&&saved.total>=60&&saved.total<=86400&&Number.isFinite(saved.remaining)&&saved.remaining>=0&&saved.remaining<=saved.total&&(saved.phase!=='running'||Number.isFinite(saved.endAt))){
  return advance({...base,intention:saved.intention.slice(0,160),firstStep:saved.firstStep.slice(0,160),minutes:Number(saved.minutes),chime:saved.chime===true,hideTime:saved.hideTime===true,phase:saved.phase,total:saved.total,remaining:saved.remaining,endAt:saved.phase==='running'?saved.endAt:null},now);
 }
 if(legacy&&typeof legacy.goal==='string'){
  base.intention=legacy.goal.slice(0,160);const step=Array.isArray(legacy.steps)?legacy.steps.find((s,i)=>typeof s==='string'&&s.trim()&&!legacy.checks?.[i]):'';base.firstStep=(step||'').slice(0,160);
  if(Number.isFinite(legacy.remaining)&&legacy.remaining>=0&&legacy.remaining<=1800){base.minutes=30;base.total=1800;base.remaining=legacy.remaining;if(Number.isFinite(legacy.end)){base.phase='running';base.endAt=legacy.end;}else if(legacy.remaining===0){base.phase='complete';}else if(legacy.remaining<1800){base.phase='paused';}return advance(base,now);}
 }
 return base;
}
