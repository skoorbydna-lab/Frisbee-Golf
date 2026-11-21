const vm = require('vm'), fs = require('fs');
const Core = require('./core.js');
let src = fs.readFileSync('/tmp/s1.js','utf8');
src = src.replace(/frame\(\);\n\}\)\(\);\s*$/, "frame(); window.__dg={get state(){return state}, get players(){return players}, get cur(){return cur}, get myIdx(){return myIdx}, get holeIdx(){return holeIdx}, forceHole:()=>{ if(!flying) flying=C.newFlight({x:0,y:1,z:0},{x:0,y:0,z:0},0); strokes=2; holed(); }};\n})();");
if(!src.includes('__dg')) throw 'hook';
// ---- mini THREE: real Vector3, everything else stubbed ----
function stub(name){ const store={}; const f=function(){}; return new Proxy(f,{ get(t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p===Symbol.iterator) return function*(){}; if(p==='then') return undefined; if(p==='length') return 0; if(p in store) return store[p]; const s=stub(name+'.'+String(p)); store[p]=s; return s; }, set(t,p,v){ store[p]=v; return true; }, apply(){ return stub(name+'()'); }, construct(){ return stub('new '+name); } }); }
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);} add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;} sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;} length(){return Math.hypot(this.x,this.y,this.z);} normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);} distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);} setY(y){this.y=y;return this;} applyMatrix4(){return this;} }
function makeTHREE(){ const base = stub('THREE'); return new Proxy({}, {get(t,p){ if(p==='Vector3') return V3; if(p==='Clock') return class{ getDelta(){ return 1/60; } }; return base[p]; }}); }
// ---- fake PeerJS bus ----
const peers = {}, wire = [];
let anon = 0;
function makePeerClass(ctxTimers){
  return class Peer{
    constructor(id){ this.id = id || ('anon-'+(++anon)); this.h={}; if(peers[this.id]){ wire.push(()=>this.emit('error',{type:'unavailable-id'})); return; } peers[this.id]=this; wire.push(()=>this.emit('open')); }
    on(e,f){ (this.h[e]=this.h[e]||[]).push(f); } emit(e,a){ (this.h[e]||[]).forEach(f=>f(a)); }
    connect(id){ const me=this, target=peers[id]; const a=new Conn(id), b=new Conn(me.id); a.other=b; b.other=a;
      if(!target){ wire.push(()=>me.emit('error',{type:'peer-unavailable'})); return a; }
      wire.push(()=>{ target.emit('connection', b); a.open=b.open=true; a.emit('open'); b.emit('open'); }); return a; }
    destroy(){ delete peers[this.id]; }
  };
}
class Conn{ constructor(peer){ this.peer=peer; this.h={}; this.open=false; } on(e,f){ (this.h[e]=this.h[e]||[]).push(f); } emit(e,a){ (this.h[e]||[]).forEach(f=>f(a)); }
  send(m){ const o=this.other, d=JSON.parse(JSON.stringify(m)); wire.push(()=>o.emit('data', d)); } close(){ this.open=false; } }
// ---- per-device context ----
function device(label){
  class FakeEl { constructor(id){ this.id=id; this.h={}; this.style={}; this.value=''; this.textContent=''; this.innerHTML=''; this.disabled=false; const cl=new Set(); this.classList={add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>{ if(f===undefined?!cl.has(c):f) cl.add(c); else cl.delete(c);},contains:c=>cl.has(c)}; this.dataset={}; this.children=[]; }
    addEventListener(t,f){ (this.h[t]=this.h[t]||[]).push(f); } fire(t,e){ (this.h[t]||[]).forEach(f=>f(e||{preventDefault(){}})); } getContext(){ return stub('ctx'); } setPointerCapture(){} appendChild(c){ this.children.push(c); } querySelectorAll(){ return []; } }
  const els = new Proxy({}, {get:(t,p)=>t[p]||(t[p]=new FakeEl(p))}), timers = []; let raf = null, now = 0;
  const ctx = { Core, THREE: makeTHREE(), console, Math, Date, JSON, Object, Array, String, Number, Map, Set, Promise, Proxy, Symbol, Float32Array, Uint8Array, Infinity, NaN, isNaN, parseInt,
    document:{ getElementById:id=>els[id]||(els[id]=new FakeEl(id)), createElement:t=>new FakeEl(t), querySelectorAll:()=>[], fonts:undefined },
    devicePixelRatio:3, innerWidth:390, innerHeight:844, addEventListener(){}, requestAnimationFrame:cb=>{raf=cb;}, setTimeout:cb=>{timers.push(cb);},
    performance:{now:()=>now}, localStorage:{getItem:()=>null,setItem(){}}, navigator:{}, location:{reload(){}} };
  ctx.window = ctx; ctx.Peer = makePeerClass(timers);
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { label, els, ctx, get dg(){ return ctx.__dg; }, frame(n=1){ for(let i=0;i<n;i++){ now+=16; raf(); } }, flush(){ let k=0; while(timers.length && k++<50){ const f=timers.shift(); if(process.env.DBG) console.log(label,'timer',String(f).slice(0,70).replace(/\n/g,' ')); f(); } }, setNow(t){ now=t; }, get now(){return now;} };
}
function pump(){ let k=0; while(wire.length && k++<1000) wire.shift()(); }
const A = device('Andy'), B = device('Sam');
A.els.onlineBtn.fire('click'); A.els.olName.value='Andy'; A.els.olHost.fire('click'); pump(); A.flush();
const code = A.els.olCodeShow.textContent; console.log('host code', code, '|', A.els.olStatus.textContent);
B.els.onlineBtn.fire('click'); B.els.olName.value='Sam'; B.els.olCode.value=code.toLowerCase(); B.els.olJoin.fire('click'); pump(); pump(); B.flush();
console.log('A status:', A.els.olStatus.textContent, '| B status:', B.els.olStatus.textContent);
A.els.olGo.fire('click'); pump(); A.flush(); B.flush(); A.frame(2); B.frame(2);
console.log('A state', A.dg.state, 'me', A.dg.myIdx, '| B state', B.dg.state, 'me', B.dg.myIdx);
function flick(D){ const c=D.els.c, x=195, y=844*0.72; let t=D.now; D.setNow(t);
  c.fire('pointerdown',{clientX:x,clientY:y,pointerId:1}); for(let j=1;j<=8;j++){ D.setNow(t+=14); c.fire('pointermove',{clientX:x,clientY:y-j*38,pointerId:1}); } D.setNow(t+=14); c.fire('pointerup',{clientX:x,clientY:y-304,pointerId:1}); }
let guard=0, throws={Andy:0,Sam:0};
while(guard++ < 9000){ if(guard % 1500 === 0) console.log('loop', guard, 'A', A.dg.state, A.dg.holeIdx, 'cur', A.dg.cur, '| B', B.dg.state, B.dg.holeIdx, 'cur', B.dg.cur, 'wire', wire.length);
  for(const D of [A,B]){
    const st = D.dg.state;
    if(st==='aim'){ throws[D.label]++; if(throws[D.label] % 4 !== 0) D.dg.forceHole(); else flick(D); }
    D.frame(1); D.flush();
    if(st==='holed' && D.els.nextBtn && !D.els.holeScreen.classList.contains('hidden') && !D.els.nextBtn.disabled && D.dg.state!=='finished') D.els.nextBtn.fire('click');
  }
  pump();
  if(A.dg.state==='finished' && B.dg.state==='finished') break;
}
console.log('loops', guard, 'throw turns', JSON.stringify(throws));
for(const D of [A,B]) console.log(D.label, D.dg.state, 'hole', D.dg.holeIdx+1, D.dg.players.map(p=>p.name+':'+p.scores.join(',')).join(' | '), '→', D.els.hsBig.textContent);
