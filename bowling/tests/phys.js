const E = require('../src/engine.js');
for(const [V, rpm, axDeg] of [[8,0,0],[8,300,30],[8,300,50],[7,350,45],[9,250,40],[6,200,45]]){
  const r = E.simLine({x:0.25, angle:0, speed:V, revs:rpm*2*Math.PI/60, axis:axDeg*Math.PI/180});
  const b = r.ball;
  console.log(`V${V} ${rpm}rpm ax${axDeg}: at pins x=${r.atPins ? r.atPins.x.toFixed(3) : '-'} entry ${(r.atPins ? r.atPins.ang*180/Math.PI : 0).toFixed(1)}° hookZ ${b.hookZ && b.hookZ.toFixed(1)} rollZ ${b.rollZ && b.rollZ.toFixed(1)} speed at pins ${Math.hypot(b.vx,b.vz).toFixed(1)} gutter ${b.gutter}`);
}
