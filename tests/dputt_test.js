const C = require('../src/core.js');
const w = C.makeWorld(C.HOLES[0]); w.wind = {x:0,z:0}; const B = w.baskets[0];
function sim(lie, speed, lp=0.18){ const D = C.DISCS.putter, yaw = Math.atan2(-(B.x-lie.x), -(B.z-lie.z));
  const f = C.newFlight({x:lie.x, y:w.T(lie.x,lie.z).h+1.3, z:lie.z}, {x:-Math.sin(yaw)*Math.cos(lp)*speed, y:Math.sin(lp)*speed, z:-Math.cos(yaw)*Math.cos(lp)*speed}, 0);
  let st='flight', res=null; for(let i=0;i<1500;i++){ const e = st==='flight'?C.stepFlight(w,f,D,1/60):C.stepRoll(w,f,1/60); if(e==='land'){st='roll';continue;} if(e){res=e;break;} }
  return {res, d:Math.hypot(f.pos.x-lie.x, f.pos.z-lie.z)}; }
for(const dist of [6, 10, 15, 20, 25, 30]){
  const lie = {x:B.x, z:B.z + dist}; const target = dist, want = Math.max(10, dist*1.6);
  let lo=2, hi=C.DISCS.putter.max; for(let k=0;k<10;k++){ const m=(lo+hi)/2; if(sim(lie,m).d<want) lo=m; else hi=m; } const vmax=hi;
  let ins=0, near=0, first=null; for(let p=0;p<=1;p+=0.01){ const r = sim(lie, vmax*(0.3+0.7*p)); if(r.res==='in'){ ins++; if(first==null) first=p; } else if(Math.abs(r.d-target)<3) near++; }
  console.log(`${dist} m: chains for ${ins}% of the bar${first!=null?` (from ${(first*100).toFixed(0)}%)`:''}, within 3 m for another ${near}%`);
}
