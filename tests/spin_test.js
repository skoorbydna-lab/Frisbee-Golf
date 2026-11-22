const C = require('../src/core.js');
const w = C.makeWorld(C.RANGE, {golf:true}); w.wind = {x:0,z:0}; w.trees = [];
function shot(club, v, h){
  const K = C.CLUBS[club], power = 1, speed = K.max, loft = K.loft*Math.PI/180;
  const back = K.spin*(v >= 0 ? 1 + 0.9*v : 1 + 0.6*v), side = h*0.45;
  const f = C.newBall({x:0, y:w.T(0,0).h+0.04, z:0}, {x:0, y:Math.sin(loft)*speed, z:-Math.cos(loft)*speed}, back, side, v);
  let st='flight', land=null, top=0;
  for(let i=0;i<4000;i++){ const e = st==='flight' ? C.stepBall(w,f,1/60) : C.stepBallRoll(w,f,1/60); top=Math.max(top,f.pos.y); if(e==='land'){ st='roll'; continue; } if(e) break; }
  const L = f.firstLand; return `${club} v${v} h${h}: carry ${Math.hypot(L.x,L.z).toFixed(0)} total ${(-f.pos.z).toFixed(0)} apex ${top.toFixed(0)} side ${f.pos.x.toFixed(1)} type@land ${w.T(L.x,L.z).type}`;
}
for(const c of ['driver','iron5','wedge']) for(const [v,h] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) console.log(shot(c,v,h));
