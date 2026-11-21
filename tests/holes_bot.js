// A simple bot plays every hole: aims at the next waypoint it can reach, picks a disc and power by distance.
const C = require('../src/core.js');
const DT = 1/120;
function simulate(w, from, aimX, aimZ, disc, power, pitch){
  const D = C.DISCS[disc], sp = D.max*(0.3 + 0.7*power), dx = aimX-from.x, dz = aimZ-from.z, L = Math.hypot(dx,dz)||1;
  const f = C.newFlight({x:from.x, y:from.y+1.5, z:from.z}, {x:dx/L*Math.cos(pitch)*sp, y:Math.sin(pitch)*sp, z:dz/L*Math.cos(pitch)*sp}, 0);
  let st = 'flight';
  for(let i=0;i<30000;i++){ const e = st==='flight' ? C.stepFlight(w,f,D,DT) : C.stepRoll(w,f,DT); if(e==='land'){ st='roll'; continue; } if(e) return {e, f}; }
  return {e:'stuck', f};
}
// calibrate: distance per (disc, power) on flat calm range
const cal = {}; { const w = C.makeWorld(C.RANGE); w.trees = []; w.wind = {x:0,z:0};
  for(const d of ['driver','mid','putter']){ cal[d] = []; for(let p=0.05;p<=1.001;p+=0.05){ const r = simulate(w, {x:0,y:w.T(0,0).h,z:0}, 0, -100, d, p, 0.2); const q = r.f.firstLand || r.f.pos; cal[d].push([p, Math.hypot(q.x, q.z), Math.hypot(r.f.pos.x, r.f.pos.z)]); } } }
function pick(dist, carry){ const ix = carry ? 1 : 2; const disc = dist < 30 ? 'putter' : dist < 80 ? 'mid' : 'driver'; const t = cal[disc]; let best = t[t.length-1];
  for(const q of t){ if(q[ix] >= dist*0.97){ best = q; break; } } return {disc, power:best[0], max:t[t.length-1][ix]}; }
let report = [];
for(const H of C.HOLES){
  const t0 = Date.now(), w = C.makeWorld(H), build = Date.now()-t0; w.wind = {x:0,z:0};
  const B = w.basket, tee = w.T(0,0), bT = w.T(B.x,B.z);
  let tot = 0, obs = 0, holed = 0, N = 6;
  for(let run=0; run<N; run++){
    let pos = {x:0, y:tee.h, z:0}, strokes = 0, wp = 1;
    while(strokes < 12){
      const db = Math.hypot(B.x-pos.x, B.z-pos.z);
      if(db < 8){ strokes++; holed++; break; }   // assume the putt drops
      // furthest waypoint ahead that is within reach
      while(wp < H.path.length-1 && Math.hypot(H.path[wp][0]-pos.x, H.path[wp][1]-pos.z) < 12) wp++;
      let tgt = H.path[Math.min(wp, H.path.length-1)];
      const reach = pick(1e9, H.sea).max*0.95;
      const clear = q=>{ for(let k=1;k<20;k++){ const x = pos.x + (q[0]-pos.x)*k/20, z = pos.z + (q[1]-pos.z)*k/20; if(w.T(x,z).h > Math.max(pos.y, w.T(q[0],q[1]).h) + 4) return false; } return true; };
      for(let k=H.path.length-1;k>=wp;k--){ const q = H.path[k]; if(Math.hypot(q[0]-pos.x, q[1]-pos.z) <= reach && clear(q)){ tgt = q; break; } }
      let dist = Math.hypot(tgt[0]-pos.x, tgt[1]-pos.z);
      if(H.sea) dist *= 0.97 - (strokes % 3)*0.03;
      const ch = pick(dist, H.sea);
      const jitter = (run-2.5)*0.6 + Math.sin(strokes*2.3 + run)*1.2;
      const r = simulate(w, pos, tgt[0]+jitter, tgt[1], ch.disc, ch.power, 0.2);
      strokes++;
      if(r.e==='in'){ holed++; break; }
      if(r.e.startsWith('ob')){ strokes++; obs++; continue; }   // penalty, replay from same spot
      pos = {x:r.f.pos.x, y:r.f.pos.y, z:r.f.pos.z};
    }
    tot += strokes;
  }
  report.push(`${String(H.num).padStart(2)} ${H.name.padEnd(20)} par ${H.par}  len ${Math.round(H.path.slice(1).reduce((a,q,i)=>a+Math.hypot(q[0]-H.path[i][0], q[1]-H.path[i][1]),0))}m  bot avg ${(tot/N).toFixed(1)}  OB ${obs}  finished ${holed}/${N}  tee:${tee.type} basket:${bT.type}  build ${build}ms`);
}
console.log(report.join('\n'));
