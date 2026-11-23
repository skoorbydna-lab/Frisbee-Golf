const E = require('../src/engine.js');
for(const tx of [0.06, 0.09, 0.0, 0.15]){
  const o = {x:0.3, angle:0, speed:8, revs:300*Math.PI/30, axis:0.52};
  let lo=-0.1, hi=0.1; for(let k=0;k<25;k++){ const m=(lo+hi)/2; o.angle=m; const r=E.simLine(o); if(!r.atPins || r.atPins.x < tx) lo=m; else hi=m; } o.angle=(lo+hi)/2;
  const w = E.newWorld(); w.ball = E.newBall(o); let n=0, top=0, maxW=0;
  while(!w.done && n++<1200){ E.step(w, 1/60); for(const p of w.pins) if(p.state!=='gone'){ const ax=[0,0,0]; const tip = p.c[1] + 0.236*Math.abs(Math.cos(p.tilt)); top=Math.max(top, tip); maxW=Math.max(maxW, Math.hypot(...p.w)); } }
  const onDeck = w.pins.filter(p=>p.state!=='gone').length, lying = w.pins.filter(p=>p.state!=='gone' && p.tilt>1).length;
  console.log(`pocket ${tx}: highest point ${(top*100).toFixed(0)} cm, fastest tumble ${maxW.toFixed(0)} rad/s, left standing ${E.standingIds(w).join('-')||'STRIKE'}, lying on deck ${lying}, into pit ${10-onDeck}, ${w.t.toFixed(1)} s`);
}
