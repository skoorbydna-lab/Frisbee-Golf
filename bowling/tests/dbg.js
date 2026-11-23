const E = require('../src/engine.js');
const X = +process.argv[2];
const o = {x:0.25, angle:0, speed:8, revs:300*Math.PI/30, axis:0.52};
let lo=-0.5, hi=0.5; for(let k=0;k<25;k++){ const m=(lo+hi)/2; o.x=m; const r=E.simLine(o); if(!r.atPins || r.atPins.x < X) lo=m; else hi=m; } o.x=(lo+hi)/2;
const w = E.newWorld(); w.ball = E.newBall(o); let n=0; const hits=[];
const prevState = {}; 
while(!w.done && n++<3000){ E.step(w, 1/120); for(const p of w.pins){ if(prevState[p.id]!==p.state){ hits.push(`${w.t.toFixed(2)} pin${p.id}:${p.state} ball(${w.ball.x.toFixed(2)},${w.ball.z.toFixed(2)})`); prevState[p.id]=p.state; } } }
console.log(hits.filter(h=>!h.includes(':up ')).slice(0,30).join('\n'));
console.log('left', E.standingIds(w), 'entry', JSON.stringify(w.ball.entry));
