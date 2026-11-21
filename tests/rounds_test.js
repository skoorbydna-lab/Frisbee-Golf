const vm = require('vm'), fs = require('fs');
const Core = require('./core.js');
let src = fs.readFileSync(process.argv[2] || '/tmp/s1.js','utf8');
src = src.replace(/frame\(\);\n\}\)\(\);\s*$/, "frame(); window.__dg={ get RH(){return RH}, startRound, get roundIdx(){return roundIdx}, get state(){return state}, get players(){return players}, get cur(){return cur}, get myIdx(){return myIdx}, get holeIdx(){return holeIdx}, forceHole:()=>{ if(!flying) flying=C.newFlight({x:0,y:1,z:0},{x:0,y:0,z:0},0); strokes=2; holed(); }};\n})();");
if(!src.includes('__dg')) throw 'hook';
// ---- mini THREE: real Vector3, everything else stubbed ----
function stub(name){ const store={}; const f=function(){}; return new Proxy(f,{ get(t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p===Symbol.iterator) return function*(){}; if(p==='then') return undefined; if(p==='length') return 0; if(p in store) return store[p]; const s=stub(name+'.'+String(p)); store[p]=s; return s; }, set(t,p,v){ store[p]=v; return true; }, apply(){ return stub(name+'()'); }, construct(){ return stub('new '+name); } }); }
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);} add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;} sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;} length(){return Math.hypot(this.x,this.y,this.z);} normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);} distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);} setY(y){this.y=y;return this;} applyMatrix4(){return this;} }
function makeTHREE(){ const base = stub('THREE'); return new Proxy({}, {get(t,p){ if(p==='Vector3') return V3; if(p==='Clock') return class{ getDelta(){ return 1/60; } }; return base[p]; }}); }
// ---- fake MQTT broker (persistent sessions: messages wait for a client that drops and comes back) ----
const sessions = {}, wire = [];   // clientId -> {topics:Set, client, queue:[]}
const fakeMqtt = { connect(url, opts){
  const id = opts.clientId, h = {};
  const c = { on(e,f){ (h[e]=h[e]||[]).push(f); }, emit(e,...a){ (h[e]||[]).forEach(f=>f(...a)); },
    subscribe(topic, o, cb){ sessions[id].topics.add(topic); wire.push(()=>cb && cb(null)); },
    publish(topic, payload){ const d = String(payload); wire.push(()=>{ for(const k in sessions){ const S = sessions[k]; if(!S.topics.has(topic)) continue; if(S.client) S.client.emit('message', topic, {toString:()=>d}); else S.queue.push([topic,d]); } }); },
    end(){ if(sessions[id] && sessions[id].client===c) sessions[id].client = null; } };
  if(!url.includes('emqx')) return c;   // backup broker unreachable in tests
  const S = sessions[id] || (sessions[id] = {topics:new Set(), client:null, queue:[]});
  wire.push(()=>{ S.client = c; c.emit('connect'); const q = S.queue; S.queue = []; q.forEach(([t,d])=>c.emit('message', t, {toString:()=>d})); });
  return c; },
  drop(id){ if(sessions[id]) sessions[id].client = null; } };
// ---- per-device context ----
function device(label, store){
  store = store || {};
  class FakeEl { constructor(id){ this.id=id; this.h={}; this.style={}; this.value=''; this.textContent=''; this.innerHTML=''; this.disabled=false; const cl=new Set(['holeScreen','passScreen','pauseScreen','setupScreen','onlineScreen','waitBar','scoutBar','loading','olLobby','top','bottom'].includes(id) ? ['hidden'] : []); this.classList={add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>{ if(f===undefined?!cl.has(c):f) cl.add(c); else cl.delete(c);},contains:c=>cl.has(c)}; this.dataset={}; this.children=[]; }
    addEventListener(t,f){ (this.h[t]=this.h[t]||[]).push(f); } fire(t,e){ (this.h[t]||[]).forEach(f=>f(e||{preventDefault(){}})); } getContext(){ return stub('ctx'); } setPointerCapture(){} appendChild(c){ this.children.push(c); } querySelectorAll(){ return []; } }
  const els = new Proxy({}, {get:(t,p)=>t[p]||(t[p]=new FakeEl(p))}), timers = []; let raf = null, now = 0;
  const ctx = { Core, THREE: makeTHREE(), console, Math, Date, JSON, Object, Array, String, Number, Map, Set, Promise, Proxy, Symbol, Float32Array, Uint8Array, Infinity, NaN, isNaN, parseInt,
    document:{ body:{classList:{contains:()=>false,toggle(){}}}, addEventListener(){}, getElementById:id=>els[id]||(els[id]=new FakeEl(id)), createElement:t=>new FakeEl(t), querySelectorAll:()=>[], fonts:undefined },
    devicePixelRatio:3, innerWidth:390, innerHeight:844, addEventListener(){}, requestAnimationFrame:cb=>{raf=cb;}, setTimeout:(cb,ms)=>{ const o={cb,due:now+(ms||0)}; timers.push(o); return o; }, clearTimeout:o=>{ const i=timers.indexOf(o); if(i>=0) timers.splice(i,1); }, URLSearchParams, history:{replaceState(){}},
    performance:{now:()=>now}, localStorage:{getItem:k=>k in store ? store[k] : null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];}}, navigator:{}, location:{reload(){}, search:'', origin:'https://x', pathname:'/'} };
  ctx.window = ctx; ctx.mqtt = fakeMqtt;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { label, els, ctx, get dg(){ return ctx.__dg; }, frame(n=1){ for(let i=0;i<n;i++){ now+=16; raf(); } }, flush(){ let k=0; for(;;){ const i=timers.findIndex(o=>o.due<=now); if(i<0||k++>200) break; const o=timers.splice(i,1)[0]; o.cb(); } }, setNow(t){ now=t; }, get now(){return now;}, store };
}
function pump(){ let k=0; while(wire.length && k++<1000) wire.shift()(); }
const tick = ()=>new Promise(r=>setImmediate(r));
async function settle(n=20){ for(let i=0;i<n;i++){ pump(); A.flush(); B.flush(); A.frame(1); B.frame(1); await tick(); } }

function playOut(D, label){
  let g = 0;
  while(D.dg.state!=='finished' && g++ < 4000){
    const st = D.dg.state;
    if(st==='aim') D.dg.forceHole();
    if(st==='pass') D.els.passGo.fire('click');
    D.frame(1); D.flush();
    if(D.dg.state==='holed' && !D.els.holeScreen.classList.contains('hidden') && !D.els.nextBtn.disabled) D.els.nextBtn.fire('click');
  }
  const p = D.dg.players[0];
  console.log(label, '→', D.dg.state, '| holes', D.dg.RH.map(h=>h.num).join(','), '| scores', p.scores.length, '| card has Out/In:', /Out/.test(D.els.card.innerHTML) && /In/.test(D.els.card.innerHTML));
}
(async()=>{
  // All 18 practice
  let D = device('Andy', {'discgolf-settings':JSON.stringify({round:'all'})});
  D.frame(2); D.els.practiceBtn.fire('click'); D.flush(); D.frame(3); playOut(D, 'All 18 practice');
  // Back 9 tournament
  D = device('Andy', {'discgolf-settings':JSON.stringify({round:'back'})});
  D.frame(2); D.els.tourList.children[0].h.click[0](); D.flush(); D.frame(3); playOut(D, 'Back 9 tournament');
  console.log('   CPU score count:', D.ctx.eval ? '' : '', D.els.lb.innerHTML.match(/<tr/g).length, 'rows');
  // Quick 3 of each type
  for(const q of ['island','canyon','open','mix']){
    D = device('Andy', {'discgolf-settings':JSON.stringify({round:'quick', quick:q})});
    D.frame(2); D.els.practiceBtn.fire('click'); D.flush(); D.frame(3);
    console.log(`Quick 3 ${q}:`, D.dg.RH.map(h=>`${h.num} ${h.name} [${h.group}]`).join(' | '));
    playOut(D, `  Quick 3 ${q} played`);
  }
})();
