// two phones, one fake MQTT broker: host + guest play a full online game
const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync('/tmp/tp0.js','utf8') + '\n' + fs.readFileSync('/tmp/tp1.js','utf8');
function stub(){ const store={}; const f=function(){}; return new Proxy(f,{ get(t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p===Symbol.iterator) return function*(){}; if(p==='then') return undefined; if(p==='length') return 0; if(p in store) return store[p]; return store[p]=stub(); }, set(t,p,v){ store[p]=v; return true; }, apply(){ return stub(); }, construct(){ return stub(); } }); }
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);}
  lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} project(){ this.x=0; this.y=-0.5; return this; } setFromSphericalCoords(){return this;} }
const THREE = new Proxy({}, {get(t,p){ if(p==='Vector3') return V3; if(p==='Clock') return class{ getDelta(){ return 1/60; } }; if(p==='CapsuleGeometry') return undefined; return stub(); }});
const sessions = {}, wire = [];
const fakeMqtt = { connect(url, opts){ const id = opts.clientId, h = {};
  const c = { on(e,f){ (h[e]=h[e]||[]).push(f); }, emit(e,...a){ (h[e]||[]).forEach(f=>f(...a)); }, subscribe(topic, o, cb){ sessions[id].topics.add(topic); wire.push(()=>cb && cb(null)); },
    publish(topic, payload){ const d = String(payload); wire.push(()=>{ for(const k in sessions){ const S = sessions[k]; if(!S.topics.has(topic)) continue; if(S.client) S.client.emit('message', topic, {toString:()=>d}); else S.queue.push([topic,d]); } }); }, end(){ if(sessions[id] && sessions[id].client===c) sessions[id].client = null; } };
  if(!url.includes('emqx')) return c;
  const S = sessions[id] || (sessions[id] = {topics:new Set(), client:null, queue:[]});
  wire.push(()=>{ S.client = c; c.emit('connect'); const q = S.queue; S.queue = []; q.forEach(([t,d])=>c.emit('message', t, {toString:()=>d})); }); return c; } };
function device(label, store0){
  class FakeEl{ constructor(id){ this.id=id; this.h={}; this.style={}; this.innerHTML=''; this.textContent=''; this.value=''; const cl=new Set(['setup','how','end','pause','stats','skipBtn','online','board','olLobby'].includes(id)?['hidden']:[]); this.classList={add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>{ if(f===undefined?!cl.has(c):f) cl.add(c); else cl.delete(c); },contains:c=>cl.has(c)}; }
    addEventListener(t,f){ (this.h[t]=this.h[t]||[]).push(f); } fire(t,e){ (this.h[t]||[]).forEach(f=>f(e||{})); if(this['on'+t]) this['on'+t](e||{}); } getContext(){ return stub(); } setPointerCapture(){} insertAdjacentHTML(w,h){ this.innerHTML += h; } }
  const els = new Proxy({}, {get:(t,p)=>t[p]||(t[p]=new FakeEl(p))}), timers=[]; let now=0, raf=null; const store = store0 || {};
  const ctx = { THREE, console, Math, Date, JSON, Object, Array, String, Number, Set, Map, Proxy, Symbol, Promise, isNaN, Infinity, URLSearchParams, history:{replaceState(){}},
    document:{ getElementById:id=>els[id]||(els[id]=new FakeEl(id)), createElement:t=>new FakeEl(t), querySelectorAll:()=>[], addEventListener(){}, head:{appendChild(){}} },
    innerWidth:390, innerHeight:844, devicePixelRatio:3, addEventListener(){}, requestAnimationFrame:cb=>{raf=cb;},
    setTimeout:(cb,ms)=>{ const o={cb,due:now+(ms||0)}; timers.push(o); return o; }, clearTimeout(o){ const i=timers.indexOf(o); if(i>=0) timers.splice(i,1); },
    performance:{now:()=>now}, localStorage:{getItem:k=>store[k] ?? null, setItem:(k,v)=>{ store[k]=String(v); }, removeItem:k=>{ delete store[k]; }}, navigator:{}, location:{search:'', origin:'https://x', pathname:'/bowling/'}, mqtt:fakeMqtt };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  return {label, els, ctx, store, get T(){ return ctx.__tp; }, step(n=1){ for(let i=0;i<n;i++){ now+=1000/60; raf(); for(;;){ const k=timers.findIndex(o=>o.due<=now); if(k<0) break; timers.splice(k,1)[0].cb(); } } } };
}
const A = device('Andy'); let B = device('Sam');
const tick = ()=>new Promise(r=>setImmediate(r));
async function settle(n=10){ for(let i=0;i<n;i++){ let k=0; while(wire.length && k++<1000) wire.shift()(); A.step(1); B.step(1); await tick(); } }
function swipe(D, bend=0){ const c = D.els.c, x=195, y=844*0.35; c.fire('pointerdown',{clientX:x,clientY:y,pointerId:1});
  for(let j=1;j<=10;j++){ D.step(2); c.fire('pointermove',{clientX:x, clientY:y + j*14, pointerId:1}); }
  const yl = y + 140; for(let j=1;j<=8;j++){ const f=j/8; D.step(1); c.fire('pointermove',{clientX:x + bend*Math.sin(f*Math.PI)*60 + f*8, clientY:yl - f*300, pointerId:1}); }
  D.step(1); c.fire('pointerup',{clientX:x+8, clientY:yl-300, pointerId:1}); }
(async()=>{
  A.els.olName.value = 'Andy'; A.els.olHost.fire('click'); await settle(20);
  const code = A.els.olCodeShow.textContent; console.log('code', code, '|', A.els.olStatus.textContent);
  B.els.olName.value = 'Sam'; B.els.olCode.value = code; B.els.olJoin.fire('click'); await settle(30);
  console.log('lobby A:', A.els.olPlayers.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' '), '| B status:', B.els.olStatus.textContent);
  A.els.olGo.fire('click'); await settle(10);
  console.log('started:', A.T.mode, B.T.mode, 'A state', A.T.state, 'B state', B.T.state);
  let guard = 0;
  while(guard++ < 300 && !(A.T.state==='over' && B.T.state==='over')){
    if(guard===12){ console.log('-- Sam refreshes the page --', 'rolls before', B.T.players.map(p=>p.rolls.length)); B = device('Sam', B.store); for(let w=0;w<6;w++){ await settle(60); console.log('   t+',w, 'B:', B.T.mode, B.T.state, '| A:', A.T.state, A.T.cur, JSON.stringify(A.ctx.__dbg())); } console.log('   Sam after sync:', B.T.mode, B.T.state, B.T.players.map(p=>p.rolls.length), '| A:', A.T.state, A.T.cur, JSON.stringify(A.ctx.__dbg && A.ctx.__dbg())); }
    for(const D of [A, B]) if(D.T.state==='aim'){ swipe(D, guard%2); }
    await settle(120);
  }
  for(const D of [A, B]) console.log(D.label, 'sees:', D.T.players.map(p=>p.name + ' ' + p.rolls.join(',') + ' = ' + require('../src/engine.js').scoreGame(p.rolls).total).join(' | '));
  console.log('end titles:', A.els.endTitle.textContent, '|', B.els.endTitle.textContent, 'loops', guard);
})();
