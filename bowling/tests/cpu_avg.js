const E = require('../src/engine.js');
const src = require('fs').readFileSync('src/game.html','utf8');
const body = src.slice(src.indexOf('function planCpu(p){'), src.indexOf('function cpuThrow(){'));
const planCpu = new Function('E', body + '; return planCpu;')(E);
function bowl(o, standing){ const w = E.newWorld(standing); w.ball = E.newBall(o); let n=0; while(!w.done && n++<1200) E.step(w, 1/60); return E.standingIds(w); }
for(const sk of [0.42, 0.68, 0.95]){
  let tot = 0, G = 4, strikes = 0;
  for(let g=0; g<G; g++){
    const p = {cpu:sk, rolls:[], left:null};
    while(!E.gameState(p.rolls).done){
      const gs = E.gameState(p.rolls);
      const o = planCpu(p); const st = bowl(o, gs.fresh || !p.left ? null : p.left);
      const before = gs.fresh || !p.left ? 10 : p.left.length;
      const kn = before - st.length; if(before===10 && kn===10) strikes++;
      p.rolls.push(kn); const a = E.gameState(p.rolls); p.left = a.fresh ? null : st;
    }
    tot += E.scoreGame(p.rolls).total;
  }
  console.log('skill', sk, 'avg', Math.round(tot/G), 'strikes/game', (strikes/G).toFixed(1));
}
