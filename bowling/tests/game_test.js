const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync('/tmp/tp0.js','utf8') + '\n' + fs.readFileSync('/tmp/tp1.js','utf8');
function stub(){ const store={}; const f=function(){}; return new Proxy(f,{ get(t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p===Symbol.iterator) return function*(){}; if(p==='then') return undefined; if(p==='length') return 0; if(p in store) return store[p]; return store[p]=stub(); }, set(t,p,v){ store[p]=v; return true; }, apply(){ return stub(); }, construct(){ return stub(); } }); }
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);}
  lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} project(){ this.x=0; this.y=-0.5; return this; } setFromSphericalCoords(){return this;} }
const THREE = new Proxy({}, {get(t,p){ if(p==='Vector3') return V3; if(p==='Clock') return class{ getDelta(){ return 1/60; } }; if(p==='CapsuleGeometry') return undefined; return stub(); }});
class FakeEl{ constructor(id){ this.id=id; this.h={}; this.style={}; this.dataset={}; this.innerHTML=''; this.textContent=''; this.value=''; const cl=new Set(id==='menu'?[]:['hidden'].filter(()=>['setup','how','end','pause','stats','skipBtn'].includes(id))); this.classList={add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>{ if(f===undefined?!cl.has(c):f) cl.add(c); else cl.delete(c); },contains:c=>cl.has(c)}; }
  querySelectorAll(){ return []; } addEventListener(t,f){ (this.h[t]=this.h[t]||[]).push(f); } fire(t,e){ (this.h[t]||[]).forEach(f=>f(e||{})); if(this['on'+t]) this['on'+t](e||{}); } getContext(){ return stub(); } setPointerCapture(){} setTransform(){} }
const els = {}; const timers=[]; let now=0, raf=null;
const ctx = { ENGINE:undefined, THREE, console, Math, Date, JSON, Object, Array, String, Number, Set, Map, Proxy, Symbol, Promise, isNaN, Infinity,
  document:{ getElementById:id=>els[id]||(els[id]=new FakeEl(id)), createElement:t=>new FakeEl(t), querySelectorAll:()=>[], addEventListener(){}, head:{appendChild(){}} }, URLSearchParams, history:{replaceState(){}}, location:{search:'', pathname:'/'},
  innerWidth:390, innerHeight:844, devicePixelRatio:3, addEventListener(){}, requestAnimationFrame:cb=>{raf=cb;},
  setTimeout:(cb,ms)=>{ const o={cb,due:now+(ms||0)}; timers.push(o); return o; }, clearTimeout(o){ const i=timers.indexOf(o); if(i>=0) timers.splice(i,1); },
  performance:{now:()=>now}, localStorage:{s:{}, getItem(k){ return this.s[k] ?? null; }, setItem(k,v){ this.s[k]=String(v); }}, navigator:{} };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const T = ctx.__tp;
function step(n=1){ for(let i=0;i<n;i++){ now+=1000/60; raf(); for(;;){ const k=timers.findIndex(o=>o.due<=now); if(k<0) break; timers.splice(k,1)[0].cb(); } } }
// human throw by swipe: touch ball, hold, swipe up with a bend, release when the ring closes
function swipe(bend=0, fast=1){
  const c = els.c, x=195, y=844*0.35; c.fire('pointerdown',{clientX:x,clientY:y,pointerId:1});
  for(let j=1;j<=10;j++){ step(2); c.fire('pointermove',{clientX:x, clientY:y + j*14, pointerId:1}); }
  const yl = y + 140, n=8; for(let j=1;j<=n;j++){ const f=j/n; step(1); c.fire('pointermove',{clientX:x + bend*Math.sin(f*Math.PI)*60, clientY:yl - f*300*fast, pointerId:1}); }
  step(1); c.fire('pointerup',{clientX:x, clientY:yl-300*fast, pointerId:1});
}
els.mCpu.fire('click'); els.setupGo.fire('click'); step(2);
let guard=0;
while(T.state!=='over' && guard++<60){
  const p = T.players[T.cur];
  if(T.state==='aim'){ swipe(guard%3===0 ? 1 : 0.3, 1.1); }
  let g=0; while(T.state!=='aim' && T.state!=='over' && g++<2000) step(1);
}
console.log('turns', guard, 'state', T.state);
for(const p of T.players) console.log(p.name, p.rolls.join(','), '→', require('../src/engine.js').scoreGame(p.rolls).total);
console.log('end:', els.endTitle.textContent, '|', els.endBody.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
console.log('card:', els.frames.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,200));
// practice
els.endMenu.fire('click'); els.mPractice.fire('click'); step(2); swipe(1,1.2); let g=0; while(T.state!=='aim' && g++<2000) step(1);
console.log('practice stats:', els.stats.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
