const E = require('../src/engine.js');
const w = E.newWorld(); const o = {x:0.3, angle:0, speed:8, revs:300*Math.PI/30, axis:0.52};
let lo=-0.1, hi=0.1; for(let k=0;k<25;k++){ const m=(lo+hi)/2; o.angle=m; const r=E.simLine(o); if(!r.atPins || r.atPins.x < 0.07) lo=m; else hi=m; } o.angle=(lo+hi)/2;
w.ball = E.newBall(o); let n=0, t0=null;
const ids = [1,3,5,9];
while(!w.done && n++<600){ E.step(w, 1/60); if(w.ball.hitPins && t0==null) t0 = w.t;
  if(t0!=null && n%6===0 && w.t - t0 < 2.2){ console.log((w.t-t0).toFixed(2), ids.map(id=>{ const p = w.pins.find(q=>q.id===id); if(!p || p.state==='gone') return `${id}:gone`; return `${id}:${p.state[0]} tilt${(p.tilt*57.3).toFixed(0)} y${(p.c[1]*100).toFixed(0)} v${Math.hypot(...p.v).toFixed(1)} spin${p.w[1].toFixed(0)} w${Math.hypot(p.w[0],p.w[2]).toFixed(0)}`; }).join(' | ')); } }
console.log('left', E.standingIds(w));
