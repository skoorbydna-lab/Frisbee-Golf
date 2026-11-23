const fs = require('fs'); let src = fs.readFileSync('tests/game_test.js','utf8');
src = src.slice(0, src.indexOf("els.mCpu.fire('click');"));
src += `
function lateSwipe(){ const c = els.c, x=195, y=844*0.35; c.fire('pointerdown',{clientX:x,clientY:y,pointerId:1});
  for(let j=1;j<=10;j++){ step(2); c.fire('pointermove',{clientX:x, clientY:y + j*14, pointerId:1}); }
  step(80);
  const yl = y + 140; for(let j=1;j<=8;j++){ step(1); c.fire('pointermove',{clientX:x, clientY:yl - j/8*300, pointerId:1}); }
  step(1); c.fire('pointerup',{clientX:x, clientY:yl-300, pointerId:1}); }
els.mSolo.fire('click'); step(2);
lateSwipe(); console.log('hint after release:', els.hint.innerHTML);
let g=0, msgs=[]; while(T.state!=='aim' && g++<2000){ step(1); if(els.msg.innerHTML && !msgs.includes(els.msg.innerHTML)) msgs.push(els.msg.innerHTML); }
console.log('messages:', msgs.join(' | ').replace(/<[^>]+>/g,' '));
console.log('rolls', T.players[0].rolls, 'pins standing now', T.world.pins.filter(p=>p.state==='up').length);
swipe(0, 1.1); g=0; while(T.state!=='aim' && g++<2000) step(1); console.log('normal ball rolls', T.players[0].rolls);
`;
fs.writeFileSync('/tmp/foul_run.js', src.replace("require('../src/engine.js')", "require('" + process.cwd() + "/src/engine.js')"));
