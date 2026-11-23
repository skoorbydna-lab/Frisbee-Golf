const E = require('../src/engine.js');
function bowl(o, standing){ const w = E.newWorld(standing); w.ball = E.newBall(o); let n=0; while(!w.done && n++<3000) E.step(w, 1/120); return {left:E.standingIds(w), w}; }
// sweep where the ball arrives: straight balls at different x, and hook balls
for(const hook of [0, 1]){
  const res = [];
  for(let x=-0.30; x<=0.301; x+=0.03){
    const o = hook ? {x:0.25, angle:0, speed:8, revs:300*Math.PI/30, axis:0.52} : {x, angle:0, speed:8, revs:0, axis:0};
    if(hook){ // find start x so it reaches x at pins
      o.x=0.3; let lo=-0.1, hi=0.1; for(let k=0;k<25;k++){ const m=(lo+hi)/2; o.angle=m; const r=E.simLine(o); if(!r.atPins || r.atPins.x < x) lo=m; else hi=m; } o.angle=(lo+hi)/2; }
    const r = bowl(o); const ent = r.w.ball.entry;
    res.push(`${x.toFixed(2)}:${10 - r.left.length}${r.left.length && r.left.length<=4 ? '['+r.left.join(',')+']' : ''}`);
  }
  console.log(hook ? 'HOOK ' : 'STRAIGHT ', res.join('  '));
}
