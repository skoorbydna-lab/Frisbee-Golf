// how forgiving is putting? for putts of various lengths, what spread of pace and aim still drops
const C = require('../src/core.js');
const sp = p=>Math.sqrt(2*0.8*(0.3 + 20*p*p));
function putt(w, from, yaw, p){
  const s = sp(p), f = C.newBall({x:from.x, y:from.y, z:from.z}, {x:-Math.sin(yaw)*s, y:0, z:-Math.cos(yaw)*s}, 0, 0);
  f.firstLand = {...from}; f.pos.y -= 0.02;
  for(let i=0;i<3000;i++){ const e = C.stepBallRoll(w, f, 1/60); if(e) return e; } return 'stuck';
}
const rows = [];
for(const hi of [0,20]){
  const w = C.makeWorld(C.HOLES[hi], {golf:true}); w.wind = {x:0,z:0}; const B = w.baskets[0];
  for(const d of [1.5, 3, 6, 10]) for(const a of [0, 2.1]){
    const x = B.x + Math.sin(a)*d, z = B.z + Math.cos(a)*d, from = {x, y:w.T(x,z).h + 0.04, z};
    const yaw0 = Math.atan2(-(B.x-x), -(B.z-z));
    // best yaw (break), then pace window and aim window
    let best = null;
    for(let dy=-0.3; dy<=0.3; dy+=0.01) for(let p=0.02;p<=1;p+=0.02){ if(putt(w, from, yaw0+dy, p)==='in'){ const c = Math.abs(dy); if(!best || c < best.c) best = {dy, p, c}; } }
    if(!best){ rows.push(`hole${hi} ${d}m: none`); continue; }
    let pw = 0; for(let p=0.02;p<=1;p+=0.005) if(putt(w, from, yaw0+best.dy, p)==='in') pw += 0.5;
    let aw = 0; for(let dy=-0.3; dy<=0.3; dy+=0.002) if(putt(w, from, yaw0+dy, best.p)==='in') aw += 0.002*180/Math.PI;
    rows.push(`hole${hi} ${d}m: pace window ${pw.toFixed(1)}% (≈${(best.p*100).toFixed(0)}%), aim window ${aw.toFixed(1)}°`);
  }
}
console.log(rows.join('\n'));
