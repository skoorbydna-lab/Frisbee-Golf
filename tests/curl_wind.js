const C = require('../src/core.js');
const w = C.makeWorld(C.RANGE); w.trees = []; w.cyls=[]; w.boxes=[];
function thr(disc, rel, wind, pitch=0.2){
  w.wind = wind; const D = C.DISCS[disc], sp = D.max;
  const f = C.newFlight({x:0,y:w.T(0,0).h+1.5,z:0},{x:0,y:Math.sin(pitch)*sp,z:-Math.cos(pitch)*sp}, rel);
  let st='flight'; for(let i=0;i<30000;i++){ const e = st==='flight'?C.stepFlight(w,f,D,1/120):C.stepRoll(w,f,1/120); if(e==='land'){st='roll';continue;} if(e) break; }
  return `dist ${(-f.pos.z).toFixed(0)} side ${f.pos.x.toFixed(1)}`;
}
console.log('wf', w.wf);
for(const d of ['driver','mid','putter']){
  console.log(d,'flat calm', thr(d,0,{x:0,z:0}),'| hyzer -0.5', thr(d,-0.5,{x:0,z:0}),'| big hyzer -1', thr(d,-1,{x:0,z:0}),'| anhyzer +1', thr(d,1,{x:0,z:0}));
  for(const ws of [3,6,9]) console.log('   flat, crosswind from left',ws,'m/s:', thr(d,0,{x:ws,z:0}), '| headwind', thr(d,0,{x:0,z:ws}), '| tailwind', thr(d,0,{x:0,z:-ws}));
}
