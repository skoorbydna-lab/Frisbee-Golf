const vm = require('vm'), fs = require('fs');
const Core = require('./core.js');
let src = fs.readFileSync(process.argv[2] || '/tmp/s1.js','utf8');
src = src.replace(/frame\(\);\n\}\)\(\);\s*$/, "frame(); window.__dg={ forceClub:k=>setClub(k),  get RH(){return RH}, get GOLF(){return GOLF}, get discKey(){return discKey}, get flying(){return flying}, get lie(){return lie}, get strokes(){return strokes}, get state(){return state}, get players(){return players}, get cur(){return cur}, get myIdx(){return myIdx}, get holeIdx(){return holeIdx}, forceHole:()=>{ if(!flying) flying=C.newFlight({x:0,y:1,z:0},{x:0,y:0,z:0},0); strokes=2; holed(); }};\n})();");
if(!src.includes('__dg')) throw 'hook';
// ---- mini THREE: real Vector3, everything else stubbed ----
function stub(name){ const store={}; const f=function(){}; return new Proxy(f,{ get(t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p===Symbol.iterator) return function*(){}; if(p==='then') return undefined; if(p==='length') return 0; if(p in store) return store[p]; const s=stub(name+'.'+String(p)); store[p]=s; return s; }, set(t,p,v){ store[p]=v; return true; }, apply(){ return stub(name+'()'); }, construct(){ return stub('new '+name); } }); }
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);} add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;} sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;} lerp(v,a){this.x+=(v.x-this.x)*a;this.y+=(v.y-this.y)*a;this.z+=(v.z-this.z)*a;return this;} length(){return Math.hypot(this.x,this.y,this.z);} normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);} distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);} cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;} addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;} dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;} setY(y){this.y=y;return this;} applyMatrix4(){return this;} }
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
  class FakeEl { setAttribute(k,v){ this[k]=v; } constructor(id){ this.id=id; this.h={}; this.style={}; this.value=''; this.textContent=''; this.innerHTML=''; this.disabled=false; const cl=new Set(['holeScreen','passScreen','pauseScreen','setupScreen','onlineScreen','waitBar','scoutBar','loading','olLobby','top','bottom'].includes(id) ? ['hidden'] : []); this.classList={add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>{ if(f===undefined?!cl.has(c):f) cl.add(c); else cl.delete(c);},contains:c=>cl.has(c)}; this.dataset={}; this.children=[]; }
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

function swing(D, backFrac, upFrac, slant){
  const c = D.els.c, x = 195, y0 = 844*0.72; let t = D.now; D.setNow(t);
  c.fire('pointerdown',{clientX:x, clientY:y0, pointerId:1});
  const yb = Math.min(843, y0 + backFrac*844);
  for(let j=1;j<=10;j++){ D.setNow(t+=25); c.fire('pointermove',{clientX:x, clientY:y0 + (yb-y0)*j/10, pointerId:1}); }
  const ye = yb - upFrac*844;
  for(let j=1;j<=6;j++){ D.setNow(t+=14); c.fire('pointermove',{clientX:x + slant*j, clientY:yb + (ye-yb)*j/6, pointerId:1}); }
  D.setNow(t+=14); c.fire('pointerup',{clientX:x + slant*6, clientY:ye, pointerId:1}); c.fire('pointerup',{pointerId:1});
}
function settle(D){ let g=0; while(!['aim','finished','pass'].includes(D.dg.state) && g++ < 6000){ D.frame(1); D.flush(); if(D.dg.state==='holed' && !D.els.holeScreen.classList.contains('hidden') && !D.els.nextBtn.disabled) D.els.nextBtn.fire('click'); } }
(async()=>{
  // golf practice: Quick 3 mixed, real swings
  const D = device('Andy', {'discgolf-settings':JSON.stringify({sport:'golf', course:'classic', round:'quick'})});
  D.frame(2); D.els.practiceBtn.fire('click'); D.flush(); D.frame(3);
  console.log('golf?', D.dg.GOLF, '| club', D.dg.discKey, '| clubRow hidden?', D.els.clubRow.classList.contains('hidden'), '| hint:', D.els.hint.textContent.slice(0,40));
  let shots = 0, log = [];
  while(D.dg.state!=='finished' && shots < 60){
    if(D.dg.state==='pass'){ D.els.passGo.fire('click'); D.frame(1); continue; }
    if(D.dg.state!=='aim'){ settle(D); continue; }
    const club = D.dg.discKey, before = {x:D.dg.lie.x, z:D.dg.lie.z}, hole = D.dg.RH.length ? D.els.holeName.textContent : '';
    if(D.dg.strokes >= 7){ D.dg.forceHole(); settle(D); continue; }
    const back = club==='putter' ? 0.08 : club==='driver' ? 0.26 : 0.2;
    swing(D, back, 0.45, shots%3===1 ? 6 : 0); shots++;
    settle(D);
    const moved = Math.hypot(D.dg.lie.x-before.x, D.dg.lie.z-before.z);
    log.push(`${club}:${moved.toFixed(0)}m`);
    if(shots===2) console.log('stats card after a swing:', (D.els.statsCard.innerHTML||'(stats off in rounds)').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,200));
  }
  console.log('shots:', log.join(' '));
  console.log('practice finished?', D.dg.state, '| scores', D.dg.players[0].scores.join(','));
  // range with stats
  const R = device('Andy', {'discgolf-settings':JSON.stringify({sport:'golf'})});
  R.frame(2); R.els.rangeBtn.fire('click'); R.flush(); R.frame(3);
  for(const [club, back, slant] of [['driver',0.27,0],['iron5',0.27,0],['wedge',0.2,0],['driver',0.27,10]]){
    R.els.clubRow; R.ctx.document.getElementById('x'); // noop
    const btn = {driver:0, iron5:1, iron9:2, wedge:3, putter:4}[club];
    // pick the club through the game's own handler
    R.dg.forceClub && R.dg.forceClub(club);
    swing(R, back, 0.5, slant); settle(R);
    console.log(`range ${club} slant ${slant}:`, (R.els.statsCard.innerHTML||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,230));
  }
  console.log('range HUD:', R.els.dist.innerHTML.replace(/<[^>]+>/g,' '));
})();
