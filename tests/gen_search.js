// Finds generator seeds that make good holes: sane terrain + a bot can finish them near par.
const C = require('../src/core.js');
const DT = 1/120;
function simulate(w, from, aimX, aimZ, disc, power, pitch){
  const D = C.DISCS[disc], sp = D.max*(0.3 + 0.7*power), dx = aimX-from.x, dz = aimZ-from.z, L = Math.hypot(dx,dz)||1;
  const f = C.newFlight({x:from.x, y:from.y+1.5, z:from.z}, {x:dx/L*Math.cos(pitch)*sp, y:Math.sin(pitch)*sp, z:dz/L*Math.cos(pitch)*sp}, 0);
  let st = 'flight';
  for(let i=0;i<30000;i++){ const e = st==='flight' ? C.stepFlight(w,f,D,DT) : C.stepRoll(w,f,DT); if(e==='land'){ st='roll'; continue; } if(e) return {e, f}; }
  return {e:'stuck', f};
}
const cal = {}; { const w = C.makeWorld(C.RANGE); w.trees = []; w.wind = {x:0,z:0};
  for(const d of ['driver','mid','putter']){ cal[d] = []; for(let p=0.05;p<=1.001;p+=0.05){ const r = simulate(w, {x:0,y:w.T(0,0).h,z:0}, 0, -100, d, p, 0.2); const q = r.f.firstLand || r.f.pos; cal[d].push([p, Math.hypot(q.x,q.z), Math.hypot(r.f.pos.x, r.f.pos.z)]); } } }
function pick(dist, carry){ const ix = carry ? 1 : 2; const disc = dist < 30 ? 'putter' : dist < 80 ? 'mid' : 'driver'; const t = cal[disc]; let best = t[t.length-1];
  for(const q of t){ if(q[ix] >= dist*0.97){ best = q; break; } } return {disc, power:best[0], max:t[t.length-1][ix]}; }
function botPlay(H, w, runs){
  const B = w.basket; let tot = 0, fin = 0;
  for(let run=0; run<runs; run++){
    let pos = {x:0, y:w.T(0,0).h, z:0}, strokes = 0, wp = 1;
    while(strokes < 12){
      if(Math.hypot(B.x-pos.x, B.z-pos.z) < 8){ strokes++; fin++; break; }
      while(wp < H.path.length-1 && Math.hypot(H.path[wp][0]-pos.x, H.path[wp][1]-pos.z) < 12) wp++;
      let tgt = H.path[Math.min(wp, H.path.length-1)];
      const reach = pick(1e9, H.sea).max*0.95;
      const clear = q=>{ for(let k=1;k<20;k++){ const x = pos.x + (q[0]-pos.x)*k/20, z = pos.z + (q[1]-pos.z)*k/20; if(w.T(x,z).h > Math.max(pos.y, w.T(q[0],q[1]).h) + 4) return false; } return true; };
      for(let k=H.path.length-1;k>=wp;k--){ const q = H.path[k]; if(Math.hypot(q[0]-pos.x, q[1]-pos.z) <= reach && clear(q)){ tgt = q; break; } }
      let dist = Math.hypot(tgt[0]-pos.x, tgt[1]-pos.z); if(H.sea) dist *= 0.97 - (strokes % 3)*0.03;
      const ch = pick(dist, H.sea), jitter = (run-1.5)*0.8 + Math.sin(strokes*2.3 + run)*1.2;
      const r = simulate(w, pos, tgt[0]+jitter, tgt[1], ch.disc, ch.power, 0.2);
      strokes++;
      if(r.e==='in'){ fin++; break; }
      if(r.e.startsWith('ob')){ strokes++; continue; }
      pos = {x:r.f.pos.x, y:r.f.pos.y, z:r.f.pos.z};
    }
    tot += strokes;
  }
  return {avg:tot/runs, fin};
}
function sane(H, w){
  const slope = (x,z)=>Math.hypot(w.T(x+1,z).h - w.T(x-1,z).h, w.T(x,z+1).h - w.T(x,z-1).h)/2;
  const tee = w.T(0,0).type; if(tee==='water' || tee==='gorge') return 'tee in water';
  const bt = w.T(w.basket.x, w.basket.z).type; if(bt==='water' || bt==='gorge' || bt==='rock') return 'basket bad ' + bt;
  if(slope(0,0) > 0.12) return 'tee slope'; if(slope(w.basket.x, w.basket.z) > 0.12) return 'basket slope';
  // along the route
  let water = 0, wall = 0, n = 0; const P = H.path;
  for(let i=0;i<P.length-1;i++){ const L = Math.hypot(P[i+1][0]-P[i][0], P[i+1][1]-P[i][1]);
    for(let d=0; d<L; d+=4){ const x = P[i][0] + (P[i+1][0]-P[i][0])*d/L, z = P[i][1] + (P[i+1][1]-P[i][1])*d/L, t = w.T(x,z); n++;
      if(t.type==='water' || t.type==='gorge') water++; if(H.theme==='canyon' && t.h > 6) wall++; } }
  const hasCross = (H.features||[]).some(f=>f.k==='stream' || f.k==='chasm');
  if(!H.sea && water > (hasCross ? 5 : 0)) return 'water on fairway ' + water;
  if(wall > 0) return 'canyon wall on route ' + wall;
  return null;
}
const type = process.argv[2], quota = {3:4, 4:6, 5:2}, got = {3:0, 4:0, 5:0}, chosen = [];
let seed = Number(process.argv[3] || 1);
for(let k=0; chosen.length < 12 && seed < 2000; seed++){
  const H = C.genHole(type, chosen.length, seed);
  if(got[H.par] >= quota[H.par]) continue;
  const w = C.makeWorld(H); w.wind = {x:0, z:0};
  const bad = sane(H, w); if(bad) continue;
  const b = botPlay(H, w, 4);
  if(b.fin < 4 || b.avg > H.par + 2) continue;
  got[H.par]++; chosen.push({seed, par:H.par, name:H.name, avg:b.avg});
  console.log(`  ${H.name.padEnd(18)} seed ${seed} par ${H.par} bot ${b.avg.toFixed(1)}`);
}
console.log(type, 'SEEDS', JSON.stringify(chosen.map(c=>c.seed)), 'pars', JSON.stringify(chosen.map(c=>c.par)));
