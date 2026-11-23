const E = require('../src/engine.js');
function bowl(o){ const w = E.newWorld(); w.ball = E.newBall(o); let n=0; while(!w.done && n++<1200) E.step(w, 1/60); return E.standingIds(w); }
const N = +process.argv[2] || 6, rows = [];
let total = 0, cnt = 0, strikes = 0;
for(let x=-0.24; x<=0.241; x+=0.03){
  const o = {x:0.3, angle:0, speed:8, revs:300*Math.PI/30, axis:0.52};
  let lo=-0.1, hi=0.1; for(let k=0;k<25;k++){ const m=(lo+hi)/2; o.angle=m; const r=E.simLine(o); if(!r.atPins || r.atPins.x < x) lo=m; else hi=m; } o.angle=(lo+hi)/2;
  let st=0, pins=0; const lefts={};
  for(let k=0;k<N;k++){ const l = bowl(o); pins += 10-l.length; if(!l.length) st++; else { const key=l.join('-'); lefts[key]=(lefts[key]||0)+1; } }
  const common = Object.entries(lefts).sort((a,b)=>b[1]-a[1])[0];
  rows.push(`${x>=0?'+':''}${x.toFixed(2)}  strike ${Math.round(st/N*100)}%  avg ${(pins/N).toFixed(1)}  ${common ? 'often '+common[0] : ''}`);
}
console.log(rows.join('\n'));
