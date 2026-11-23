const E = require('../src/engine.js');
let maxY = 0, worst = 0;
for(let k=0;k<12;k++){ const w = E.newWorld(); w.ball = E.newBall({x:0.3, angle:-0.006 - k*0.0015, speed:7 + (k%3)*1.2, revs:31, axis:0.5});
  let n=0, my=0; while(!w.done && n++<1200){ E.step(w, 1/60); for(const p of w.pins) if(p.state!=='gone') my = Math.max(my, p.c[1] - 0.145); }
  maxY = Math.max(maxY, my); console.log(`ball ${k}: highest pin lift ${(my*100).toFixed(0)} cm, left ${E.standingIds(w).join('-') || 'STRIKE'}`); }
