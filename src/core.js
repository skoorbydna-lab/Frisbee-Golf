// ===== Disc Golf Tour — core (pure JS: courses, terrain, obstacles, physics, CPU scoring) =====
const Core = (function(){
'use strict';
const G = 9.81;

// ---------- maths helpers ----------
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, z){ let h = Math.imul(x|0, 374761393) ^ Math.imul(z|0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
  const a = hash2(xi,zi), b = hash2(xi+1,zi), c = hash2(xi,zi+1), d = hash2(xi+1,zi+1);
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
}
function fbm(x, z){ return vnoise(x,z)*0.57 + vnoise(x*2.07+5.3, z*2.07+1.7)*0.29 + vnoise(x*4.3+11.1, z*4.3+7.9)*0.14; }
function smooth(a, b, x){ const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); }
function distToSeg(px,pz,ax,az,bx,bz){ const dx=bx-ax, dz=bz-az; const L=dx*dx+dz*dz; let t=L?((px-ax)*dx+(pz-az)*dz)/L:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(px-(ax+t*dx), pz-(az+t*dz)); }
function distToPath(px,pz,path){ let d=1e9; for(let i=0;i<path.length-1;i++){ const e=distToSeg(px,pz,path[i][0],path[i][1],path[i+1][0],path[i+1][1]); if(e<d) d=e; } return d; }
function gauss(r){ let u=0,v=0; while(u===0) u=r(); while(v===0) v=r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

// ---------- discs ----------
const DISCS = {
  driver:{name:'Driver', max:30, kd:0.0034, lv:27, turn:-1, fade:2.4, skid:0.32, color:'#e8004f'},
  mid:   {name:'Mid-range', max:25, kd:0.0042, lv:24, turn:0, fade:1.2, skid:0.22, color:'#ffb300'},
  putter:{name:'Putter', max:19, kd:0.0055, lv:21, turn:0, fade:0.6, skid:0.12, color:'#0066ff'}
};

// ---------- the nine holes ----------
const OLD_HOLES = [
  {name:'Meadow Rise', par:3, theme:'meadow', diff:0.0, seed:11,
   path:[[0,0],[1,-40],[5,-82]], fw:22, base:0.5, hills:4.5,
   features:[{k:'hill',x:-32,z:-55,r:30,h:7},{k:'hill',x:34,z:-28,r:26,h:6},{k:'hill',x:2,z:-58,r:16,h:3.5},{k:'hill',x:-10,z:-118,r:40,h:9}],
   trees:{count:120, clear:13}, extraTrees:[[-8,-56],[10,-30]], rocks:8, wind:[1.5,0.8]},
  {name:'Mill Pond', par:3, theme:'pond', diff:0.2, seed:23,
   path:[[0,0],[7,-50],[-25,-92]], fw:22, base:2.6, hills:2.2, water:0,
   features:[{k:'pond',x:-21,z:-47,r:15},{k:'pond',x:30,z:-80,r:8}],
   trees:{count:130, clear:13}, extraTrees:[[-6,-75],[15,-72]], rocks:6, wind:[3,-1.2]},
  {name:'Stone Gorge', par:3, theme:'gorge', diff:0.35, seed:37,
   path:[[0,0],[2,-92]], fw:18, base:0.5, hills:1.0,
   features:[{k:'chasm', path:[[-120,-36],[-30,-46],[10,-42],[120,-50]], w:22, depth:24}],
   pillars:[{x:-7,z:-45,r:2.3,top:4},{x:12,z:-44,r:1.7,top:7},{x:-26,z:-46,r:2.6,top:2.5},{x:30,z:-47,r:2,top:5}],
   trees:{count:60, clear:12, kinds:['pine']}, boulders:16, wind:[-2.5,1.5]},
  {name:'Rolling Downs', par:4, theme:'downs', diff:0.35, seed:44,
   path:[[0,0],[-12,-55],[6,-108],[0,-148]], fw:24, base:2, hills:6,
   features:[{k:'hill',x:-30,z:-25,r:30,h:10},{k:'hill',x:18,z:-60,r:26,h:9},{k:'hill',x:-14,z:-88,r:20,h:-5},
             {k:'hill',x:-6,z:-55,r:16,h:6},{k:'hill',x:30,z:-125,r:34,h:12},{k:'hill',x:0,z:-148,r:16,h:4},{k:'hill',x:-34,z:-150,r:30,h:8}],
   trees:{count:110, clear:14, kinds:['oak','oak','pine','birch']}, extraTrees:[[4,-80],[-8,-128]], rocks:10, wind:[3.5,-1.5]},
  {name:'Darkwood', par:4, theme:'forest', diff:0.5, seed:53,
   path:[[0,0],[-6,-55],[18,-100],[12,-142]], fw:13, base:0.5, hills:3.5, windFactor:0.55,
   features:[], trees:{count:560, clear:7.5, gap:2.6, kinds:['pine','pine','oak','birch']},
   extraTrees:[[-3,-30],[8,-78],[16,-121]], rocks:10, wind:[1.5,2]},
  {name:'Island Green', par:3, theme:'sea', diff:0.5, seed:61, sea:true, water:0,
   path:[[0,0],[5,-86]], fw:0,
   islands:[{x:0,z:3,r:19,h:1.8},{x:5,z:-86,r:13.5,h:1.5},{x:-30,z:-50,r:7.5,h:1.0},{x:28,z:-40,r:5.5,h:0.9}],
   palms:true, wind:[4,1.5]},
  {name:'Hilltop Drop', par:3, theme:'hill', diff:0.15, seed:71,
   path:[[0,0],[-4,-55],[-8,-108]], fw:22, base:2.4, hills:2.5, water:0,
   features:[{k:'hill',x:0,z:1,r:38,h:15},{k:'stream',path:[[-120,-66],[-20,-62],[20,-68],[120,-62]],w:7}],
   trees:{count:120, clear:13}, rocks:8, wind:[-3,-2]},
  {name:'Canyon Run', par:4, theme:'canyon', diff:0.4, seed:83,
   path:[[0,0],[12,-50],[-10,-100],[4,-152]], fw:18, base:0.3, hills:0.6, windFactor:0.75,
   features:[{k:'canyon', path:[[0,40],[0,0],[12,-50],[-10,-100],[4,-152],[4,-200]], w:28, h:20}],
   trees:{count:70, clear:30, kinds:['pine']}, boulders:18, wind:[2,-4]},
  {name:'Archipelago', par:4, theme:'sea', diff:0.6, seed:97, sea:true, water:0,
   path:[[0,0],[-14,-68],[6,-152]], fw:0,
   islands:[{x:0,z:3,r:18,h:1.8},{x:-14,z:-68,r:21,h:2.6},{x:26,z:-58,r:8,h:1.0},{x:6,z:-152,r:15,h:1.8},{x:-42,z:-118,r:9,h:1.2},{x:5,z:-103,r:5.5,h:1.2,small:true}],
   lighthouse:{x:-22,z:-75}, palms:true, wind:[-5,2]}
];
const NEW_HOLES = [
  // ---- open / hilly ----
  {name:'Windy Ridge', par:3, theme:'downs', diff:0.35, seed:121,
   path:[[0,0],[5,-50],[-2,-104]], fw:22, base:2, hills:4,
   features:[{k:'hill',x:-30,z:-52,r:26,h:7},{k:'hill',x:-8,z:-55,r:22,h:5.5},{k:'hill',x:14,z:-52,r:22,h:6},{k:'hill',x:36,z:-56,r:24,h:7},
             {k:'hill',x:-2,z:-104,r:14,h:-2},{k:'hill',x:34,z:-10,r:26,h:6},{k:'hill',x:-36,z:-120,r:30,h:7}],
   trees:{count:100, clear:14, kinds:['oak','pine','birch']}, extraTrees:[[-12,-70],[14,-78]], rocks:8, wind:[5,-2.5]},
  // ---- canyons ----
  {name:'Red Rock Switchback', par:4, theme:'canyon', diff:0.55, seed:131,
   path:[[0,0],[0,-36],[-30,-62],[-30,-96],[4,-122],[6,-152]], fw:18, base:0.3, hills:0.5, windFactor:0.7,
   features:[{k:'canyon', path:[[0,40],[0,0],[0,-36],[-30,-62],[-30,-96],[4,-122],[6,-152],[6,-200]], w:26, h:22}],
   trees:{count:60, clear:30, kinds:['pine']}, boulders:16, wind:[3,-2]},
  {name:'The Narrows', par:4, theme:'canyon', diff:0.6, seed:137,
   path:[[0,0],[6,-58],[-5,-112],[3,-166]], fw:13, base:0.3, hills:0.5, windFactor:0.6,
   features:[{k:'canyon', path:[[0,40],[0,0],[6,-58],[-5,-112],[3,-166],[3,-210]], w:18, h:28}],
   trees:{count:50, clear:24, kinds:['pine']}, boulders:22, wind:[-2,-4]},
  {name:'Snake Canyon', par:5, theme:'canyon', diff:0.7, seed:139,
   path:[[0,0],[20,-36],[-14,-72],[18,-108],[-16,-144],[12,-180],[0,-214]], fw:16, base:0.3, hills:0.5, windFactor:0.7,
   features:[{k:'canyon', path:[[0,40],[0,0],[20,-36],[-14,-72],[18,-108],[-16,-144],[12,-180],[0,-214],[0,-260]], w:24, h:24}],
   trees:{count:70, clear:30, kinds:['pine']}, boulders:20, wind:[2,3]},
  {name:'Mesa Leap', par:3, theme:'canyon', diff:0.5, seed:149,
   path:[[0,0],[-4,-50],[3,-100]], fw:18, base:0.3, hills:0.5, windFactor:0.8,
   features:[{k:'canyon', path:[[0,40],[0,0],[-4,-50],[3,-100],[3,-150]], w:30, h:18},
             {k:'chasm', path:[[-80,-44],[-10,-50],[10,-47],[80,-52]], w:14, depth:22}],
   trees:{count:40, clear:30, kinds:['pine']}, boulders:12, wind:[-3,2]},
  // ---- islands ----
  {name:'Stepping Stones', par:4, theme:'sea', diff:0.6, seed:151, sea:true, water:0,
   path:[[0,0],[9,-42],[-6,-78],[10,-110],[0,-142]], fw:0,
   islands:[{x:0,z:3,r:17,h:1.8},{x:9,z:-42,r:10.5,h:1.3},{x:-6,z:-78,r:11,h:1.3},{x:10,z:-110,r:10,h:1.3},{x:0,z:-142,r:14,h:1.6},{x:-34,z:-60,r:9,h:1.2},{x:2,z:-60,r:5,h:1.0,small:true}],
   palms:true, wind:[3,2]},
  {name:'Lagoon Hop', par:3, theme:'sea', diff:0.55, seed:157, sea:true, water:0,
   path:[[0,0],[-10,-74]], fw:0,
   islands:[{x:0,z:3,r:17,h:1.8},{x:-10,z:-74,r:8.5,h:1.3},{x:22,z:-50,r:10,h:1.4},{x:-36,z:-30,r:7,h:1.0},{x:12,z:-100,r:6,h:1.0}],
   palms:true, wind:[-3,-2]},
  {name:'Coral Chain', par:5, theme:'sea', diff:0.7, seed:163, sea:true, water:0,
   path:[[0,0],[-12,-55],[10,-100],[-8,-145],[14,-188],[0,-232]], fw:0,
   islands:[{x:0,z:3,r:17,h:1.8},{x:-12,z:-55,r:12,h:1.4},{x:10,z:-100,r:11,h:1.3},{x:-8,z:-145,r:10,h:1.3},{x:14,z:-188,r:11.5,h:1.4},{x:0,z:-232,r:14,h:1.6},{x:2,z:-122,r:5,h:1.0,small:true},
            {x:34,z:-140,r:8,h:1.1},{x:-40,z:-110,r:7,h:1.0},{x:-32,z:-205,r:9,h:1.2}],
   palms:true, wind:[4,-3]},
  {name:'Lighthouse Finale', par:4, theme:'sea', diff:0.65, seed:167, sea:true, water:0,
   path:[[0,0],[18,-60],[-10,-115],[6,-168]], fw:0,
   islands:[{x:0,z:3,r:17,h:1.8},{x:18,z:-60,r:15,h:2.4},{x:-10,z:-115,r:12,h:1.6},{x:6,z:-168,r:14,h:1.8},{x:5,z:-104,r:5,h:1.1,small:true},{x:-40,z:-70,r:8,h:1.0}],
   lighthouse:{x:28,z:-66}, palms:true, wind:[-4,-3]}
];
const byName = n => OLD_HOLES.concat(NEW_HOLES).find(h=>h.name===n);
// 1–9 front nine, 10–18 back nine: each nine runs open → canyon → island
const HOLES = ['Meadow Rise','Mill Pond','Rolling Downs','Stone Gorge','Canyon Run','Red Rock Switchback','Island Green','Stepping Stones','Archipelago',
               'Hilltop Drop','Darkwood','Windy Ridge','The Narrows','Snake Canyon','Mesa Leap','Lagoon Hop','Coral Chain','Lighthouse Finale'].map(byName);

// ---------- generated holes: each comes from a fixed seed, so it's identical every time ----------
const GEN_NAMES = {
  open:['Bluebell Bank','Foxglove Fields','Hawthorn Hollow','Kestrel Knoll','Larkspur Lea','Oakmere Common','Thistle Down','Heather Rise','Bramble Dell','Willow Brook','Skylark Combe','Rowan Ridge'],
  canyon:['Copper Gulch','Ochre Draw','Sandstone Slot','Coyote Wash','Eagle Pass','Raven Chute','Scorpion Bend','Cinder Gap','Saddle Run','Rust Canyon','Dustdevil Draw','Mesa Verde'],
  island:['Turtle Cay','Pelican Key','Driftwood Shoals','Sandbar Hop','Mango Isle','Conch Point','Tern Atoll','Kelp Strand','Gull Reef','Seashell Cay','Pearl Key','Lagoon Light']
};
function genHole(type, k, seed){
  const r = rng(seed*977 + 13), R = (a,b)=>a + (b-a)*r(), I = (a,b)=>Math.floor(R(a, b+1));
  const H = {name:GEN_NAMES[type][k], seed:seed*7 + 1000 + k, gen:true};
  const walk = (segs, segLen, turn, zig)=>{ const P = [[0,0]]; let hd = 0, x = 0, z = 0, sgn = r()<0.5 ? -1 : 1;
    for(let i=0;i<segs;i++){ if(i){ if(zig){ sgn = -sgn; hd = sgn*R(turn*0.6, turn); } else hd = Math.max(-0.8, Math.min(0.8, hd + R(-turn, turn))); }
      const L = segLen*R(0.85, 1.15); x += Math.sin(hd)*L; z -= Math.cos(hd)*L; P.push([Math.round(x*10)/10, Math.round(z*10)/10]); } return P; };
  const plen = P => P.slice(1).reduce((a,q,i)=>a + Math.hypot(q[0]-P[i][0], q[1]-P[i][1]), 0);
  const at = (P, t)=>{ const L = plen(P); let d = L*t; for(let i=0;i<P.length-1;i++){ const s = Math.hypot(P[i+1][0]-P[i][0], P[i+1][1]-P[i][1]); if(d <= s){ const u = d/s; return [P[i][0] + (P[i+1][0]-P[i][0])*u, P[i][1] + (P[i+1][1]-P[i][1])*u, Math.atan2(P[i+1][0]-P[i][0], -(P[i+1][1]-P[i][1]))]; } d -= s; } const q = P[P.length-1]; return [q[0], q[1], 0]; };
  const parFor = L => L < 112 ? 3 : L < 192 ? 4 : 5;
  if(type==='open'){
    const roll = r(), par0 = roll < 0.45 ? 3 : roll < 0.85 ? 4 : 5;
    const segs = par0===3 ? I(1,2) : par0===4 ? I(2,3) : I(3,4), target = par0===3 ? R(72,108) : par0===4 ? R(132,172) : R(205,245);
    const path = walk(segs, target/segs, 0.55, false); Object.assign(H, {path, par:parFor(plen(path))});
    const forest = r() < 0.2;
    Object.assign(H, forest ? {theme:'forest', fw:R(12,15), base:0.5, hills:R(2,3.5), windFactor:0.55, trees:{count:I(420,540), clear:7.5, gap:2.6, kinds:['pine','pine','oak','birch']}}
                            : {theme:r()<0.5 ? 'downs' : 'meadow', fw:R(19,26), base:R(1.5,2.5), hills:R(2,5), trees:{count:I(70,150), clear:R(12,16), kinds:['oak','oak','pine','birch']}});
    H.features = []; const B = path[path.length-1];
    for(let i=0, n=I(3,7); i<n; i++){ const t = R(0.1,0.95), q = at(path, t), off = R(-45,45); const x = q[0] + Math.cos(q[2])*off, z = q[1] + Math.sin(q[2])*off;
      if(Math.hypot(x,z) < 20 || Math.hypot(x-B[0], z-B[1]) < 20) continue; H.features.push({k:'hill', x:Math.round(x), z:Math.round(z), r:Math.round(R(15,34)), h:Math.round(R(-4,10)*10)/10}); }
    if(!forest && r() < 0.15){ H.features.push({k:'hill', x:0, z:1, r:38, h:Math.round(R(10,15))}); }
    if(!forest && r() < 0.4){
      H.water = 0; H.base = Math.max(H.base, 2.3);
      if(H.par >= 4 && r() < 0.5){ const q = at(path, R(0.4,0.6)), nx = Math.cos(q[2]), nz = Math.sin(q[2]);
        H.features.push({k:'stream', path:[[q[0]-nx*140, q[1]-nz*140],[q[0]+nx*140, q[1]+nz*140]], w:R(6,9)}); }
      else { for(let tries=0; tries<10; tries++){ const q = at(path, R(0.3,0.75)), side = r()<0.5 ? -1 : 1, rad = R(8,14), off = side*(H.fw/2 + rad*0.6 + R(0,6));
        const x = q[0] + Math.cos(q[2])*off, z = q[1] + Math.sin(q[2])*off; if(Math.hypot(x,z) < rad+14 || Math.hypot(x-B[0], z-B[1]) < rad+16) continue;
        H.features.push({k:'pond', x:Math.round(x), z:Math.round(z), r:Math.round(rad)}); break; } }
    }
    const mid = at(path, R(0.4,0.6)); H.extraTrees = r() < 0.6 ? [[Math.round(mid[0] + R(-3,3)), Math.round(mid[1])]] : [];
    H.rocks = I(4,10); H.wind = [Math.round(R(-4,4)*10)/10, Math.round(R(-4,4)*10)/10];
    H.diff = 0.1 + (H.water != null ? 0.15 : 0) + (forest ? 0.3 : 0) + (H.par===5 ? 0.1 : 0);
  }
  else if(type==='canyon'){
    const segs = I(2,6), path = walk(segs, R(30,44), R(0.6,1.1), true), L = plen(path);
    const last = path[path.length-1], prev = path[path.length-2], dx = last[0]-prev[0], dz = last[1]-prev[1], dl = Math.hypot(dx,dz);
    const w = R(18,30), cpath = [[0,40]].concat(path, [[last[0] + dx/dl*50, last[1] + dz/dl*50]]);
    Object.assign(H, {theme:'canyon', path, par:parFor(L), fw:Math.round(w*0.62), base:0.3, hills:0.5, windFactor:R(0.6,0.8),
      features:[{k:'canyon', path:cpath, w:Math.round(w), h:Math.round(R(18,28))}], trees:{count:I(40,70), clear:30, kinds:['pine']}, boulders:I(10,22),
      wind:[Math.round(R(-4,4)*10)/10, Math.round(R(-4,4)*10)/10]});
    if(L > 70 && r() < 0.35){ const q = at(path, R(0.4,0.6)), nx = Math.cos(q[2]), nz = Math.sin(q[2]);
      H.features.push({k:'chasm', path:[[q[0]-nx*80, q[1]-nz*80],[q[0]+nx*80, q[1]+nz*80]], w:Math.round(R(11,15)), depth:22}); }
    H.diff = 0.35 + (segs-2)*0.07 + (H.features.length > 1 ? 0.1 : 0) + (w < 22 ? 0.1 : 0);
  }
  else {
    const hops = I(0,3), isl = [{x:0, z:3, r:17, h:1.8}], path = [[0,0]];
    let x = 0, z = 0, hd = R(-0.3,0.3);
    for(let i=0;i<=hops;i++){
      const last = i===hops, d = hops===0 ? R(70,100) : R(44,62);
      hd = Math.max(-0.7, Math.min(0.7, hd + R(-0.55,0.55))); x += Math.sin(hd)*d; z -= Math.cos(hd)*d;
      const rx = Math.round(x), rz = Math.round(z); path.push([rx, rz]);
      isl.push(last ? {x:rx, z:rz, r:Math.round(R(12.5,15)), h:1.7} : {x:rx, z:rz, r:Math.round(R(10.5,13)), h:Math.round(R(1.2,1.6)*10)/10});
    }
    if(hops >= 1 && r() < 0.6){ const a = path[Math.max(0, path.length-3)], b = path[path.length-1], sx = (a[0]+b[0])/2 + R(-6,6), sz = (a[1]+b[1])/2;
      if(isl.every(q=>Math.hypot(q.x-sx, q.z-sz) > q.r + 12)) isl.push({x:Math.round(sx), z:Math.round(sz), r:5, h:1.0, small:true}); }
    for(let i=0, n=I(1,3); i<n; i++){ const q = at(path, R(0.2,0.8)), side = r()<0.5 ? -1 : 1, off = side*R(28,46), dx = q[0] + Math.cos(q[2])*off, dz = q[1] + Math.sin(q[2])*off, rr = Math.round(R(6,9));
      if(isl.every(o=>Math.hypot(o.x-dx, o.z-dz) > o.r + rr + 8)) isl.push({x:Math.round(dx), z:Math.round(dz), r:rr, h:1.0}); }
    Object.assign(H, {theme:'sea', sea:true, water:0, fw:0, path, par:parFor(plen(path)), islands:isl, palms:true, wind:[Math.round(R(-5,5)*10)/10, Math.round(R(-5,5)*10)/10]});
    if(hops >= 1 && r() < 0.3){ const m = isl[1]; H.lighthouse = {x:Math.round(m.x + m.r*0.45), z:Math.round(m.z - m.r*0.2)}; }
    H.diff = 0.4 + hops*0.08 + (H.par===5 ? 0.1 : 0);
  }
  H.basket = H.path[H.path.length-1]; H.windFactor = H.windFactor || 1;
  return H;
}
// seeds that the test bot proved playable (tests/gen_search.js); slot order matters
const GEN_SEEDS = {open:[1,3,4,5,6,8,10,11,13,14,15,19], canyon:[1,2,6,7,8,11,12,13,14,15,19,25], island:[1,2,6,7,10,12,13,14,16,17,18,20]};
for(const t of ['open','canyon','island']) GEN_SEEDS[t].forEach((sd,k)=>HOLES.push(genHole(t, k, sd)));
HOLES.forEach((H,i)=>{ H.id = i; H.group = H.theme==='sea' ? 'island' : (H.theme==='canyon' || H.theme==='gorge') ? 'canyon' : 'open'; });
// courses (18 holes each). Themed courses weave the six hand-built holes in with twelve generated ones.
const weave = (hand, gen0)=>{
  // deal generated holes alternately to the front and back nine (longest first) so both nines balance
  const srt = gen0.slice().sort((a,b)=>HOLES[b].par - HOLES[a].par || a - b), F = [], B = [];
  srt.forEach((g,i)=>(i % 2 ? B : F).push(g));
  const mix = (h, g)=>[g[2],h[0],g[0],g[4],h[1],g[1],g[3],h[2],g[5]];   // par-5 not first, hand-built holes spaced out
  return mix(hand.slice(0,3), F).concat(mix(hand.slice(3), B));
};
const genIdx = (t, off)=>Array.from({length:12}, (_,k)=>18 + off + k);
const COURSES = {
  classic:{name:'Classic', blurb:'The original mix: open, canyon and island', holes:Array.from({length:18}, (_,i)=>i)},
  open:{name:'Meadowlands', blurb:'18 open, hilly holes with ponds and woods', holes:weave([0,1,2,9,10,11], genIdx('open', 0))},
  canyon:{name:'Red Rock', blurb:'18 canyon holes: bends, narrows and gorges', holes:weave([3,4,5,12,13,14], genIdx('canyon', 12))},
  island:{name:'Coral Isles', blurb:'18 island holes: hop across the sea', holes:weave([6,7,8,15,16,17], genIdx('island', 24))}
};
HOLES.forEach(H=>{ H.basket = H.path[H.path.length-1]; if(H.windFactor==null) H.windFactor = 1; });
// practice range: wide flat field, target baskets at set distances, no out of bounds
const RANGE = {name:'Driving Range', par:0, theme:'range', diff:0, seed:5, range:true,
  path:[[0,0],[0,-170]], fw:40, base:0.5, hills:0.15, windFactor:1, features:[],
  baskets:[[-5,-15],[6,-30],[-8,-50],[9,-75],[-6,-100],[4,-130]],
  trees:{count:90, clear:34, kinds:['oak','oak','pine','birch']}, rocks:0, wind:[0,0]};
RANGE.basket = RANGE.baskets[0];

// ---------- terrain ----------
// returns a function (x,z) -> shared {h, type}
function makeTerrain(H){
  const out = {h:0, type:'grass'};
  const W = H.water != null ? H.water : -999;
  const feats = H.features || [];
  const room = H.room;
  const bx = H.basket[0], bz = H.basket[1], BL = H.baskets || [H.basket];
  const nearB = (x,z)=>{ let d = 1e9; for(const b of BL){ const e = Math.hypot(x-b[0], z-b[1]); if(e < d) d = e; } return d; };
  const gr = rng((H.seed|0)*31 + 5), GREENS = BL.map(b=>({x:b[0], z:b[1], a:gr()*Math.PI*2, g:0.01 + gr()*0.018, o:gr()*100}));
  const greenShape = (x, z)=>{   // metres to add on and around each green: a tilt plus soft rolls, faded out by 13 m
    let add = 0;
    for(const G of GREENS){ const d = Math.hypot(x-G.x, z-G.z); if(d >= 13) continue;
      const k = 1 - smooth(10, 13, d), dx = x-G.x, dz = z-G.z;
      add += k*(G.g*(dx*Math.cos(G.a) + dz*Math.sin(G.a)) + 0.12*(fbm(x*0.12 + G.o, z*0.12 - G.o) - 0.5)*2); }
    return add;
  };
  const raw = function(x, z){
    let h, type;
    if(H.sea){
      h = -4 + fbm(x*0.03, z*0.03)*1.2;
      for(const is of H.islands){
        const d = Math.hypot(x-is.x, z-is.z); if(d > is.r*1.6) continue;
        const e = d/is.r + (fbm(x*0.09+is.x, z*0.09+is.z)-0.5)*0.4;
        const top = is.h + (fbm(x*0.05, z*0.05)-0.5)*0.6;
        const ih = -4 + (top+4)*(1 - smooth(0.6, 1.35, e));
        if(ih > h) h = ih;
      }
      type = h < W ? 'water' : h < W + 0.55 ? 'sand' : 'grass';
      if(type==='grass' && nearB(x, z) < 10) type = 'green';
    } else {
      const dTB = Math.min(Math.hypot(x, z), Math.hypot(x-bx, z-bz));
      h = H.base + (fbm(x*0.02+H.seed, z*0.02-H.seed)-0.5)*2*H.hills*(0.2 + 0.8*smooth(3, 16, dTB));
      type = null;
      if(room){
        const dx = Math.max(room.x0 - x, 0, x - room.x1), dz = Math.max(room.z0 - z, 0, z - room.z1);
        const dr = Math.hypot(dx, dz);
        h = H.base + (h - H.base)*smooth(2, 14, dr);
        if(dr === 0){ h = 0; type = 'concrete'; }
        else if(dr < 1.2) type = 'concrete';
        else type = 'out';
      }
      for(const f of feats){
        if(f.k==='hill'){ const d = Math.hypot(x-f.x, z-f.z); if(d < f.r) h += f.h*(0.5+0.5*Math.cos(Math.PI*d/f.r)); }
        else if(f.k==='pond'){ const d = Math.hypot(x-f.x, z-f.z) + (fbm(x*0.12, z*0.12)-0.5)*4; if(d < f.r*1.4){ const t = 1 - smooth(f.r*0.7, f.r*1.35, d); h = h + (-1.6 - h)*t; } }
        else if(f.k==='stream'){ const d = distToPath(x, z, f.path) + (fbm(x*0.1, z*0.1)-0.5)*3; if(d < f.w){ const t = 1 - smooth(f.w*0.3, f.w*0.9, d); h = h + (-1.3 - h)*t; } }
        else if(f.k==='chasm'){
          const d = distToPath(x, z, f.path) + (fbm(x*0.08, z*0.08)-0.5)*7;
          if(d < f.w/2 + 1.5){ const t = 1 - smooth(f.w/2 - 1.2, f.w/2 + 1.2, d); h = h + (-f.depth + fbm(x*0.2,z*0.2)*3 - h)*t; if(t > 0.5) type = 'gorge'; }
        }
        else if(f.k==='canyon'){
          const d = distToPath(x, z, f.path) + (fbm(x*0.07, z*0.07)-0.5)*8;
          const t = smooth(f.w/2, f.w/2 + 6, d);
          h += f.h*t*(0.85 + 0.3*fbm(x*0.04, z*0.04));
          if(t > 0.12) type = 'rock'; else type = 'canyonfloor';
        }
      }
      if(h < W) type = 'water';
      else if(!type || type==='canyonfloor'){
        const dp = H.fw ? distToPath(x, z, H.path) : 1e9;
        const db = nearB(x, z);
        if(db < 10) type = 'green';
        else if(dp < H.fw/2) type = 'fair';
        else if(!type) type = H.theme==='forest' ? 'forest' : H.theme==='gorge' ? 'stone' : 'grass';
      }
    }
    out.h = h; out.type = type; return out;
  };
  // greens: flatten round each hole (without raising the sea or cutting into canyon walls), then add a tilt and soft rolls
  const baseH = GREENS.map(G=>raw(G.x, G.z).h);
  return function(x, z){
    const o = raw(x, z);
    for(let i=0;i<GREENS.length;i++){
      const G = GREENS[i], d = Math.hypot(x-G.x, z-G.z); if(d >= 13) continue;
      if(o.type==='water' || o.type==='gorge') continue;
      let k = 1 - smooth(9, 13, d);
      k *= 1 - smooth(1.5, 3.5, o.h - baseH[i]);
      if(k <= 0) continue;
      o.h = o.h + (baseH[i] + greenShape(x, z) - o.h)*k;
    }
    return o;
  };
}
const OB_TYPES = {water:'ob-water', gorge:'ob-gorge', out:'ob-out'};

// ---------- obstacles ----------
function makeTree(r, x, z, y0, kind, trees){
  const s = 0.8 + r()*0.6;
  const t = {x, z, y0, kind, s, rot:r()*6.283, blobs:[], col:r()};
  if(kind==='pine'){
    t.th0 = 1.5*s; t.tr = 0.22*s; t.th = t.th0 + 4.2*s;
    for(let i=0;i<3;i++){ const rad = (2.0 - i*0.5)*s, hh = 2.4*s; const y = y0 + t.th0 + i*1.25*s + hh/2 - 0.3; t.blobs.push({x, y:y-hh*0.15, z, r:rad*0.72, cone:{rad, hh, y}}); }
  } else if(kind==='palm'){
    t.th0 = 5.5*s; t.tr = 0.2*s; t.th = t.th0; t.lean = (r()-0.5)*0.5; t.leanDir = r()*6.283;
    const tx = x + Math.cos(t.leanDir)*t.lean*t.th0*0.5, tz = z + Math.sin(t.leanDir)*t.lean*t.th0*0.5;
    t.top = [tx, y0 + t.th0, tz];
    t.blobs.push({x:tx, y:y0 + t.th0, z:tz, r:2.0*s});
  } else {
    const birch = kind==='birch';
    t.th0 = (birch?3.2:2.6)*s; t.tr = (birch?0.18:0.26)*s;
    const n = 2 + Math.floor(r()*2);
    for(let i=0;i<n;i++){
      const rad = (birch?1.2:1.6 + r()*0.9)*s;
      const ox = (r()-0.5)*1.4*s, oz = (r()-0.5)*1.4*s, y = y0 + t.th0 + rad*0.6 + i*0.9*s;
      t.blobs.push({x:x+ox, y, z:z+oz, r:rad*0.95, ball:{rad, ox, oz}});
    }
    t.th = t.th0 + 0.3;
  }
  trees.push(t);
  return t;
}

function genObstacles(H, T){
  const r = rng(H.seed*7 + 3);
  const trees = [], boxes = [], cyls = [], spheres = [], deco = [];
  const B = {x:H.basket[0], z:H.basket[1]};
  // bounds of play
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for(const [x,z] of H.path){ minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); }
  if(H.islands) for(const is of H.islands){ minX=Math.min(minX,is.x-is.r); maxX=Math.max(maxX,is.x+is.r); minZ=Math.min(minZ,is.z-is.r); maxZ=Math.max(maxZ,is.z+is.r); }
  const bounds = {minX:minX-45, maxX:maxX+45, minZ:minZ-40, maxZ:maxZ+25};
  const near = (x,z,list,g)=>list.some(t=>Math.abs(t.x-x)<g && Math.abs(t.z-z)<g && Math.hypot(t.x-x,t.z-z)<g);

  // trees
  if(H.trees && H.trees.count){
    const tc = H.trees, kinds = tc.kinds || ['oak','oak','pine'], gap = tc.gap || 3.2;
    let tries = 0;
    while(trees.length < tc.count && tries++ < tc.count*30){
      const x = bounds.minX - 25 + r()*(bounds.maxX-bounds.minX+50), z = bounds.minZ - 30 + r()*(bounds.maxZ-bounds.minZ+50);
      const g = T(x,z); const ty = g.type, y0 = g.h;
      if(ty==='water'||ty==='gorge'||ty==='concrete'||ty==='fair'||ty==='green'||ty==='sand') continue;
      if(H.theme==='canyon' && ty!=='rock') continue;
      if(H.theme==='canyon' && y0 < 12) continue;
      if(H.room && ty!=='out') continue;
      if(H.fw && distToPath(x,z,H.path) < tc.clear + r()*4) continue;
      if(Math.hypot(x,z) < 8 || Math.hypot(x-B.x,z-B.z) < 7) continue;
      if(near(x,z,trees,gap)) continue;
      makeTree(r, x, z, y0, kinds[Math.floor(r()*kinds.length)], trees);
    }
  }
  for(const [x,z] of (H.extraTrees||[])) makeTree(r, x, z, T(x,z).h, H.theme==='forest'?'pine':'oak', trees);
  // palms on islands
  if(H.palms){
    for(const is of H.islands){
      if(is.small) continue;
      const n = Math.max(2, Math.round(is.r*0.6));
      for(let k=0,tries=0;k<n && tries<200;tries++){
        const a = r()*6.283, d = is.r*(0.25 + r()*0.6); const x = is.x + Math.cos(a)*d, z = is.z + Math.sin(a)*d;
        const g = T(x,z); if(g.type==='water') continue;
        if(Math.hypot(x,z) < 6 || Math.hypot(x-B.x,z-B.z) < 6) continue;
        if(near(x,z,trees,3)) continue;
        if(H.lighthouse && Math.hypot(x-H.lighthouse.x, z-H.lighthouse.z) < 5) continue;
        if(distToPath(x,z,H.path) < 4) continue;
        makeTree(r, x, z, g.h, 'palm', trees); k++;
      }
    }
  }
  // rocks / boulders
  const nb = (H.rocks||0) + (H.boulders||0);
  for(let k=0,tries=0;k<nb && tries<600;tries++){
    let x, z;
    if(H.theme==='canyon'){ const i = Math.floor(r()*(H.path.length-1)); const t = r(); x = H.path[i][0] + (H.path[i+1][0]-H.path[i][0])*t + (r()-0.5)*20; z = H.path[i][1] + (H.path[i+1][1]-H.path[i][1])*t + (r()-0.5)*6; }
    else { x = bounds.minX + r()*(bounds.maxX-bounds.minX); z = bounds.minZ + r()*(bounds.maxZ-bounds.minZ); }
    const g = T(x,z); if(g.type==='water'||g.type==='gorge'||g.type==='green') continue;
    if(H.theme==='canyon' && g.type!=='canyonfloor' && g.type!=='fair') continue;
    if(Math.hypot(x,z) < 9 || Math.hypot(x-B.x,z-B.z) < 9) continue;
    if(H.theme!=='canyon' && H.fw && distToPath(x,z,H.path) < H.fw/2 + 1) continue;
    const big = H.boulders ? (0.9 + r()*1.6) : (0.4 + r()*0.8);
    spheres.push({x, y:g.h + big*0.35, z, r:big, sx:1+r()*0.4, sy:0.7+r()*0.3, sz:1+r()*0.4, rot:r()*6, kind:'rock'});
    k++;
  }
  // gorge pillars
  for(const p of (H.pillars||[])){ const top = T(p.x+6, p.z).h > -5 ? H.base + p.top : p.top; cyls.push({x:p.x, z:p.z, r:p.r, y0:-30, y1:H.base + p.top, kind:'pillar'}); }
  // lighthouse
  if(H.lighthouse){ const g = T(H.lighthouse.x, H.lighthouse.z); cyls.push({x:H.lighthouse.x, z:H.lighthouse.z, r:1.7, y0:g.h-1, y1:g.h+15, kind:'lighthouse', ob:true}); }
  // warehouse
  if(H.room) genWarehouse(H, r, boxes, cyls, deco);
  return {trees, boxes, cyls, spheres, deco, bounds};
}

function box(x0,y0,z0,x1,y1,z1,kind,extra){ return Object.assign({min:[Math.min(x0,x1),Math.min(y0,y1),Math.min(z0,z1)], max:[Math.max(x0,x1),Math.max(y0,y1),Math.max(z0,z1)], kind}, extra||{}); }
function genWarehouse(H, r, boxes, cyls, deco){
  const R = H.room, WH = R.h, X0 = R.x0, X1 = R.x1, Z0 = R.z0, Z1 = R.z1;
  boxes.push(box(X0-0.6,0,Z1, X1+0.6,WH,Z1+0.6,'wall',{ob:true}));
  boxes.push(box(X0-0.6,0,Z0-0.6, X1+0.6,WH,Z0,'wall',{ob:true}));
  boxes.push(box(X0-0.6,0,Z0, X0,WH,Z1,'wall',{ob:true}));
  boxes.push(box(X1,0,Z0, X1+0.6,WH,Z1,'wall',{ob:true}));
  for(let z=Z1, i=0; z>Z0; z-=10, i++){
    boxes.push(box(X0,WH,z-0.25, X1,WH+0.6,z+0.25,'truss',{ob:true}));
    if(i%2===0) boxes.push(box(X0-0.6,WH+0.6,Math.max(Z0,z-10), X1+0.6,WH+0.9,z,'roof',{ob:true}));
  }
  // shipping containers (2.6 m wide/high). Each wall row leaves gaps to thread a throw through.
  const CW = 2.6, cols = ['#c8402f','#2f6fb3','#e0a92a','#3a8a5a','#7a5aa8','#d8642a','#4f6f7f'];
  const cont = (x0,x1,z,stack,alongZ)=>{ for(let k=0;k<stack;k++){ const c = cols[Math.floor(r()*cols.length)];
    if(alongZ) boxes.push(box(z-CW/2, k*CW, x0, z+CW/2, (k+1)*CW, x1, 'container', {col:c, alongZ:true}));
    else boxes.push(box(x0, k*CW, z-CW/2, x1, (k+1)*CW, z+CW/2, 'container', {col:c})); } };
  // row 1: single height — loft over it or slip through a gap
  cont(X0,-19.5,-34,1); cont(-14.5,-2.3,-34,1); cont(2.3,14.5,-34,2); cont(19.5,X1,-34,1);
  // row 2: double stacked wall, gaps in different places
  cont(X0,-23,-72,2); cont(-18.5,-6.3,-72,2); cont(-1.5,10.7,-72,2); cont(15.3,X1,-72,2);
  // row 3: staggered blocks guarding the basket
  cont(-26,-13.8,-98,2); cont(-4,8.2,-95,1); cont(14,26.2,-101,3);
  // containers running lengthways down the sides
  cont(-20,-8,-25,1,true); cont(-60,-48,23,2,true); cont(-118,-106,-21,2,true); cont(-128,-116,22,1,true);
  // steel columns
  for(const x of [-12, 12]) for(const z of [-16, -54, -86, -116]) boxes.push(box(x-0.3,0,z-0.3, x+0.3,WH,z+0.3,'column'));
  // crate stacks
  const stacks = [[-6,-14,1],[8,-50,2],[-27,-56,3],[-24.6,-57.5,1],[28,-86,2],[-8,-112,1],[16,-124,2],[-28,-122,1]];
  for(const [x,z,n] of stacks){ const s = 1.3; for(let i=0;i<n;i++){ const ox = (r()-0.5)*0.2, oz = (r()-0.5)*0.2; boxes.push(box(x-s/2+ox, i*s, z-s/2+oz, x+s/2+ox, (i+1)*s, z+s/2+oz, 'crate', {rot:(r()-0.5)*0.25})); } }
  boxes.push(box(15.5,0,-18.3, 18.5,2.2,-15.7,'forklift'));
  deco.push({kind:'lane', z0:Z0+2, z1:Z1-2});
}

// ---------- world & collision ----------
function makeWorld(H){
  const T = makeTerrain(H);
  const O = genObstacles(H, T);
  const baskets = (H.baskets || [H.basket]).map(b=>({x:b[0], y:T(b[0], b[1]).h, z:b[1]}));
  const ch = windCharacter(H);
  return Object.assign({H, T, basket:baskets[0], baskets, wind:{x:0,z:0}, wf:H.windFactor, events:[], gust:ch.gust, swirl:ch.swirl, time:0, wseed:(H.seed||1)*0.37}, O);
}
function ev(w, e){ if(w.events.length < 8) w.events.push(e); }

// highest surface under (x,z) at or below height y (terrain or the top of a box / column)
function surface(w, x, z, y){
  let s = w.T(x, z).h, on = null;
  for(const b of w.boxes){ if(x>=b.min[0]&&x<=b.max[0]&&z>=b.min[2]&&z<=b.max[2]&&b.max[1]<=y+0.4&&b.max[1]>s){ s=b.max[1]; on=b; } }
  for(const c of w.cyls){ if(Math.abs(x-c.x)<=c.r && Math.abs(z-c.z)<=c.r && Math.hypot(x-c.x,z-c.z)<=c.r && c.y1<=y+0.4 && c.y1>s){ s=c.y1; on=c; } }
  return {s, on};
}

function collide(w, f, px, py, pz, rolling){
  const p = f.pos, v = f.vel;
  // trees
  for(const t of w.trees){
    const dx = p.x-t.x, dz = p.z-t.z;
    if(dx > 7 || dx < -7 || dz > 7 || dz < -7) continue;
    const dh = Math.hypot(dx, dz);
    if(p.y < t.y0 + t.th && p.y > t.y0 - 0.5 && dh < t.tr + 0.1){
      const nx = dx/(dh||1), nz = dz/(dh||1);
      p.x = t.x + nx*(t.tr+0.11); p.z = t.z + nz*(t.tr+0.11);
      const vn = v.x*nx + v.z*nz; if(vn < 0){ v.x -= 1.7*vn*nx; v.z -= 1.7*vn*nz; }
      v.x*=0.3; v.y*=0.3; v.z*=0.3; if(!rolling) v.y = Math.min(v.y, 0);
      if(!f.hit || f.t - f.hitT > 0.25) ev(w,'thunk'); f.hit = true; f.hitT = f.t;
      return;
    }
    if(!rolling) for(const b of t.blobs){
      const ex = p.x-b.x, ey = p.y-b.y, ez = p.z-b.z;
      if(ex*ex+ey*ey+ez*ez < b.r*b.r){
        if(!f.inLeaves){ ev(w,'leaves'); f.inLeaves = true; }
        v.x*=0.94; v.y*=0.94; v.z*=0.94; f.hit = true; f.hitT = f.t; f.leafT = f.t; return;
      }
    }
  }
  // vertical columns (pillars, lighthouse)
  for(const c of w.cyls){
    const dx = p.x-c.x, dz = p.z-c.z; const dh = Math.hypot(dx,dz);
    if(dh < c.r + 0.1 && p.y < c.y1 && p.y > c.y0){
      if(py >= c.y1 - 0.05) continue; // coming from above -> landing handled by surface()
      const nx = dx/(dh||1), nz = dz/(dh||1);
      p.x = c.x + nx*(c.r+0.11); p.z = c.z + nz*(c.r+0.11);
      const vn = v.x*nx + v.z*nz; if(vn < 0){ v.x -= 1.6*vn*nx; v.z -= 1.6*vn*nz; }
      v.x*=0.4; v.z*=0.4; ev(w,'thunk'); f.hit = true; f.hitT = f.t;
    }
  }
  // boxes
  const e = 0.08;
  for(const b of w.boxes){
    if(p.x < b.min[0]-e || p.x > b.max[0]+e || p.y < b.min[1]-e || p.y > b.max[1]+e || p.z < b.min[2]-e || p.z > b.max[2]+e) continue;
    if(py >= b.max[1]-0.05) continue; // from above -> landing
    if(px < b.min[0]-e || px > b.max[0]+e){ p.x = px; v.x *= -0.35; v.y *= 0.7; v.z *= 0.7; }
    else if(pz < b.min[2]-e || pz > b.max[2]+e){ p.z = pz; v.z *= -0.35; v.x *= 0.7; v.y *= 0.7; }
    else if(py < b.min[1]-e){ p.y = py; v.y = -Math.abs(v.y)*0.3; v.x *= 0.7; v.z *= 0.7; }
    else { p.y = b.max[1] + 0.05; }
    ev(w, b.kind==='crate' ? 'thunk' : 'clank'); f.hit = true; f.hitT = f.t;
  }
  // boulders
  for(const s of w.spheres){
    const dx = p.x-s.x, dy = p.y-s.y, dz = p.z-s.z; const R = s.r*0.95 + 0.08;
    if(Math.abs(dx) > R || Math.abs(dz) > R) continue;
    const d = Math.hypot(dx,dy,dz); if(d >= R) continue;
    const nx = dx/(d||1), ny = dy/(d||1), nz = dz/(d||1);
    p.x = s.x + nx*R; p.y = s.y + ny*R; p.z = s.z + nz*R;
    const vn = v.x*nx + v.y*ny + v.z*nz; if(vn < 0){ v.x -= 1.4*vn*nx; v.y -= 1.4*vn*ny; v.z -= 1.4*vn*nz; }
    v.x*=0.6; v.y*=0.6; v.z*=0.6;
    if(!f.hit || f.t - f.hitT > 0.2) ev(w,'thunk'); f.hit = true; f.hitT = f.t;
  }
}

function basketCheck(w, f){
  for(const B of w.baskets){ const r = basketCheck1(w, f, B); if(r){ f.inBasket = B; return r; } }
  return null;
}
function basketCheck1(w, f, B){
  const p = f.pos, v = f.vel; const dx = p.x-B.x, dz = p.z-B.z; const dh = Math.hypot(dx,dz); const y = p.y - B.y;
  if(dh > 0.6) return null;
  if(dh < 0.42 && y > 0.72 && y < 1.48) return 'in';
  if(dh < 0.31 && y > 0.5 && y <= 0.72 && v.y < 0) return 'in';
  if((dh < 0.36 && y >= 1.48 && y < 1.56) || (dh > 0.3 && dh < 0.4 && y > 0.5 && y < 0.75) || (dh < 0.12 && y <= 0.5 && y > 0)){
    const nx = dx/(dh||1), nz = dz/(dh||1); const sp = Math.hypot(v.x,v.y,v.z);
    v.x = nx*sp*0.25; v.z = nz*sp*0.25; v.y = Math.min(v.y,0)*0.3; p.x = B.x + nx*0.45; p.z = B.z + nz*0.45; ev(w,'clank');
  }
  return null;
}

function outside(w, x, z){ const b = w.bounds; return x < b.minX-60 || x > b.maxX+60 || z < b.minZ-60 || z > b.maxZ+60; }

function landType(w, f, on){
  if(on) return on.ob ? 'ob-roof' : null;
  const ty = w.T(f.pos.x, f.pos.z).type;
  if(OB_TYPES[ty]) return OB_TYPES[ty];
  if(outside(w, f.pos.x, f.pos.z)) return 'ob-out';
  return null;
}

function newFlight(pos, vel, relT){ const v0 = Math.hypot(vel.x,vel.y,vel.z); return {pos, vel, v0, relT, t:0, spin:0, hit:false, hitT:0, inLeaves:false, leafT:0, lat:0, rollT:0}; }

// ---------- wind that varies across the course ----------
// stronger higher up, sheltered in forests and canyon bottoms, a bit stronger over water and sand,
// and on swirling holes it bends and pulses from place to place
const WIND_CHAR = {meadow:[0.3,0.15], pond:[0.35,0.2], downs:[0.55,0.3], hill:[0.6,0.4], forest:[0.25,0.25], gorge:[0.5,0.7], canyon:[0.5,0.8], sea:[0.7,0.25], range:[0.3,0.1]};
function windCharacter(H){ const c = WIND_CHAR[H.theme] || WIND_CHAR[H.group] || [0.4, 0.25]; return {gust:H.gust ?? c[0], swirl:H.swirl ?? c[1]}; }
function localWind(w, x, y, z){
  let wx = w.wind.x*w.wf, wz = w.wind.z*w.wf;
  if(!wx && !wz) return [0, 0];
  const t = w.T(x, z), above = Math.max(0.3, y - t.h), ty = t.type;
  let k = Math.min(1.45, Math.max(0.55, Math.pow(above/2.5, 0.22)));
  if(ty==='forest') k *= 0.6;
  else if((ty==='canyonfloor' || ty==='gorge') && above < 8) k *= 0.6;
  else if(ty==='water' || ty==='sand') k *= 1.15;
  const sw = w.swirl || 0;
  if(sw > 0.05){
    const tt = w.time || 0, sd = w.wseed || 0;
    const a = sw*0.9*Math.sin(x*0.045 + tt*0.31 + sd)*Math.cos(z*0.038 - tt*0.23 + sd*1.7);
    const c = Math.cos(a), sn = Math.sin(a), nx = wx*c - wz*sn, nz = wz*c + wx*sn; wx = nx; wz = nz;
    k *= 1 + sw*0.35*Math.sin(x*0.07 - z*0.05 + tt*0.5 + sd);
  }
  return [wx*k, wz*k];
}
function stepFlight(w, f, D, dt){
  const p = f.pos, v = f.vel; const px = p.x, py = p.y, pz = p.z;
  const [wx, wz] = localWind(w, p.x, p.y, p.z);
  const rx = v.x - wx, rz = v.z - wz;
  const hRel = Math.hypot(rx, rz) || 1e-3, spRel = Math.hypot(rx, v.y, rz);
  const h = Math.hypot(v.x, v.z) || 1e-3;
  const climb = Math.max(0, Math.atan2(v.y, hRel) - 0.12);
  const kd = D.kd*(1 + climb*4);
  let ax = -kd*spRel*rx + wx*0.07, ay = -G - kd*spRel*v.y, az = -kd*spRel*rz + wz*0.07;
  if(!(f.leafT && f.t - f.leafT < 0.15)) ay += G*Math.min(0.85, Math.pow(hRel/D.lv, 1.3))*Math.max(0, 1 - climb*2.5);
  const fx = v.x/h, fz = v.z/h; const rgx = -fz, rgz = fx;
  const sf = f.v0/D.max;
  // the disc reacts to its AIRSPEED (a headwind keeps it fast so it turns over, a tailwind slows it so it fades early);
  // a crosswind under the low side of a tilted disc lifts it, wind on the top pushes it down
  const s = Math.min(1.25, hRel/Math.max(f.v0,1));
  const lat = (-D.turn*1.3*s*s*sf*sf) - D.fade*1.8*Math.pow(Math.max(0, 1-s),1.2)*sf + f.relT*3.0*Math.sqrt(Math.min(1,s))*(0.5+0.5*sf);
  if(!(f.leafT && f.t - f.leafT < 0.15)) ay += -f.relT*(wx*rgx + wz*rgz)*0.12*Math.min(1, hRel/D.lv);
  ax += rgx*lat; az += rgz*lat;
  v.x += ax*dt; v.y += ay*dt; v.z += az*dt;
  p.x += v.x*dt; p.y += v.y*dt; p.z += v.z*dt;
  f.t += dt; f.spin += dt*(20 + h); f.lat = lat; if(p.y > (f.maxY ?? -1e9)) f.maxY = p.y;
  if(f.leafT && f.t - f.leafT > 0.3) f.inLeaves = false;
  collide(w, f, px, py, pz, false);
  const b = basketCheck(w, f); if(b) return b;
  const su = surface(w, p.x, p.z, py);
  if(p.y <= su.s + 0.02){
    const prev = surface(w, px, pz, py).s;
    if(su.s - prev > 0.7 && py < su.s - 0.25){ p.x = px; p.z = pz; v.x *= -0.3; v.z *= -0.3; ev(w,'thunk'); f.hit = true; f.hitT = f.t; return null; }
    p.y = su.s + 0.02;
    const ob = landType(w, f, su.on); if(ob) return ob;
    if(!f.firstLand) f.firstLand = {x:p.x, y:p.y, z:p.z, t:f.t};
    const hs = Math.hypot(v.x, v.z), vy = -v.y;
    const gty = su.on ? 'hard' : w.T(p.x, p.z).type;
    const soft = gty==='sand' || gty==='forest';
    const hard = gty==='fair' || gty==='rock' || gty==='stone' || gty==='canyonfloor' || gty==='concrete' || gty==='hard';
    const grip = soft ? 0.4 : hard ? 1 : gty==='green' ? 0.75 : 0.6;    // longer grass grabs the disc; greens hold it
    const bank = f.relT*0.45 + (f.lat||0)*0.04;
    // 1) skip: a fast, shallow landing hops off the ground
    if(!f.hit && hard && (f.bounces||0) < 2 && hs > 7 && vy > 1.2 && vy < hs*0.6){
      f.bounces = (f.bounces||0) + 1; v.y = vy*0.28; v.x *= 0.72; v.z *= 0.72; p.y = su.s + 0.05; ev(w,'land'); return null;
    }
    // 2) roller: lands tilted on its edge and rolls away, curving towards the side it leans
    if(!f.hit && !soft && bank > 0.32 && hs > 7){ f.edge = 1; f.rolled = true; v.x *= 0.62*grip; v.z *= 0.62*grip; }
    // hyzer landing: the low edge digs in, it skids short and kicks left
    else if(!f.hit && bank < -0.32){ f.hyzerKick = true; const k = D.skid*0.8, a = -0.35, c = Math.cos(a), sn = Math.sin(a), vx = v.x*k, vz = v.z*k; v.x = vx*c - vz*sn; v.z = vz*c + vx*sn; f.edge = 0; f.wob = 0.6; }
    // 3) flat landing: slides and spins to a stop
    else { const k = f.hit ? 0.15 : D.skid*1.25*grip; v.x *= k; v.z *= k; f.edge = 0; }
    v.y = 0; if(!(f.wob > 0)) f.wob = 0; f.bank = bank;
    ev(w,'land'); f.on = su.on; return 'land';
  }
  if(f.t > 14 || outside(w, p.x, p.z) || p.y < -40) return 'ob-out';
  return null;
}

function stepRoll(w, f, dt){
  const p = f.pos, v = f.vel; const px = p.x, pz = p.z;
  f.rollT += dt;
  const su = surface(w, p.x, p.z, p.y + 0.3);
  let gx = 0, gz = 0;
  if(!su.on){ const e = 0.6; gx = (w.T(p.x+e,p.z).h - w.T(p.x-e,p.z).h)/(2*e); gz = (w.T(p.x,p.z+e).h - w.T(p.x,p.z-e).h)/(2*e); }
  const slope = Math.hypot(gx, gz);
  // a disc rolling on its edge feels the slope fully; a flat disc grips the grass and only
  // slides on steep ground (friction holds it on anything gentler than about 1 in 3)
  if(f.edge){ v.x -= G*0.8*gx*dt; v.z -= G*0.8*gz*dt; }
  else if(slope > 0.33){ const k = G*0.5*(slope - 0.33)/slope; v.x -= k*gx*dt; v.z -= k*gz*dt; }
  let sp = Math.hypot(v.x, v.z);
  if(f.wob > 0) f.wob = Math.max(0, f.wob - dt*1.4);
  if(!f.edge && f.wob < 0.25 && (sp < 0.25 || f.rollT > 3.5)) return 'rest';
  if(f.rollT > 7) return 'rest';
  if(f.edge){
    // rolling on its edge: low friction, the turn tightens as it slows, then it falls over
    const om = f.edge*(0.15 + 2.4/(sp + 1.5)), a = om*dt, c = Math.cos(a), s = Math.sin(a);
    const vx = v.x, vz = v.z; v.x = vx*c - vz*s; v.z = vz*c + vx*s;
    const dec = Math.min(sp, 2.6*dt); if(sp > 0){ v.x -= v.x/sp*dec; v.z -= v.z/sp*dec; }
    f.spin += dt*sp/0.106;
    if(sp < 1.4 || f.rollT > 5){ f.edge = 0; f.wob = 1; v.x *= 0.3; v.z *= 0.3; ev(w,'land'); }
  } else {
    const dec = Math.min(sp, 4.5*dt); if(sp > 0){ v.x -= v.x/sp*dec; v.z -= v.z/sp*dec; }
  }
  p.x += v.x*dt; p.z += v.z*dt;
  collide(w, f, px, p.y, pz, true);
  const s2 = surface(w, p.x, p.z, p.y + 0.3);
  if(s2.s > p.y + 0.6){ p.x = px; p.z = pz; v.x *= -0.3; v.z *= -0.3; }
  else p.y = s2.s + 0.02;
  for(const B of w.baskets){ const db = Math.hypot(p.x-B.x, p.z-B.z);
  if(db < 0.18){ const n = Math.atan2(p.z-B.z, p.x-B.x); p.x = B.x + Math.cos(n)*0.2; p.z = B.z + Math.sin(n)*0.2; v.x = v.z = 0; } }
  if(!f.edge) f.spin += dt*(sp*6 + 4); f.on = s2.on;
  const ob = landType(w, f, s2.on); if(ob) return ob;
  return null;
}

// ---------- golf: ball, clubs, bounce and roll ----------
const CLUBS = {
  driver:{name:'Driver', loft:13, max:58, spin:0.8},
  iron5:{name:'5 Iron', loft:23, max:44, spin:0.85},
  iron9:{name:'9 Iron', loft:38, max:35, spin:1.0},
  wedge:{name:'Wedge', loft:52, max:27, spin:1.1},
  putter:{name:'Putter', loft:1, max:7, spin:0}
};
// e = bounce, roll = rolling resistance (m/s²), fr = speed lost on each bounce
const SURF = {green:{e:0.25, roll:0.8, fr:0.22}, fair:{e:0.3, roll:2.8, fr:0.35}, grass:{e:0.18, roll:5, fr:0.5}, out:{e:0.18, roll:5, fr:0.5},
  forest:{e:0.15, roll:5.5, fr:0.6}, sand:{e:0.03, roll:14, fr:0.85}, rock:{e:0.5, roll:2.2, fr:0.22}, stone:{e:0.42, roll:2.6, fr:0.25},
  canyonfloor:{e:0.3, roll:2.8, fr:0.35}, concrete:{e:0.55, roll:1.2, fr:0.15}, hard:{e:0.5, roll:1.6, fr:0.2}};
// spinV: +1 full backspin (stops, zips back on short grass) … -1 full topspin (flies lower, runs on)
function newBall(pos, vel, backspin, side, spinV){ const f = newFlight(pos, vel, 0); f.ball = true; f.backspin = backspin; f.side = side; f.bounces = 0; f.spinV = spinV || 0; return f; }
function cupNear(w, p){ let best = null, bd = 1e9; for(const B of w.baskets){ const d = Math.hypot(p.x-B.x, p.z-B.z); if(d < bd){ bd = d; best = B; } } return [best, bd]; }
function stepBall(w, f, dt){
  const p = f.pos, v = f.vel, px = p.x, py = p.y, pz = p.z;
  const [wx, wz] = localWind(w, p.x, p.y, p.z), rx = v.x - wx, rz = v.z - wz;
  const sp = Math.hypot(rx, v.y, rz) || 1e-3, hs = Math.hypot(rx, rz) || 1e-3;
  let ax = -0.0042*sp*rx, ay = -G - 0.0042*sp*v.y, az = -0.0042*sp*rz;
  const lift = 0.0016*f.backspin*sp*sp;                       // backspin holds the ball up
  ay += lift*(hs/sp); ax -= lift*(v.y/sp)*(rx/hs); az -= lift*(v.y/sp)*(rz/hs);
  const lat = f.side*0.0034*sp*sp;                            // sidespin: + curves right (slice), - left (hook)
  ax += (-rz/hs)*lat; az += (rx/hs)*lat;
  v.x += ax*dt; v.y += ay*dt; v.z += az*dt; p.x += v.x*dt; p.y += v.y*dt; p.z += v.z*dt;
  f.backspin *= 1 - 0.05*dt; f.side *= 1 - 0.015*dt; f.t += dt; f.spin += dt*25; if(p.y > (f.maxY ?? -1e9)) f.maxY = p.y;
  collide(w, f, px, py, pz, false);
  const su = surface(w, p.x, p.z, py);
  if(p.y <= su.s + 0.02){
    const prev = surface(w, px, pz, py).s;
    if(su.s - prev > 0.7 && py < su.s - 0.25){ p.x = px; p.z = pz; v.x *= -0.35; v.z *= -0.35; ev(w,'thunk'); return null; }
    p.y = su.s + 0.02;
    if(!f.firstLand) f.firstLand = {x:p.x, y:p.y, z:p.z, t:f.t};
    const ob = landType(w, f, su.on); if(ob) return ob;
    const gty = su.on ? 'hard' : w.T(p.x, p.z).type, S = SURF[gty] || SURF.grass, vy = -v.y;
    const [B, db] = cupNear(w, p); if(db < 0.1 && Math.hypot(v.x, v.z) < 5) return 'in';   // straight in the hole
    if(vy > 1.0){
      const top = Math.max(0, -f.spinV), short = gty==='green' || gty==='fair';
      const bite = short ? Math.min(0.6, f.backspin*0.3*(1 + Math.max(0, f.spinV))) : 0;     // backspin checks it up on short grass
      const fr = S.fr*(1 - 0.2*top);                                                         // topspin skips on
      if(f.bounces===0 && short && f.spinV > 0.25) f.zip = Math.min(5, Math.hypot(v.x, v.z)*0.24*(f.spinV - 0.25)*Math.min(1.6, f.backspin))*(gty==='green' ? 1 : 0.55);
      v.y = vy*S.e*(1 - 0.3*top); v.x *= 1 - fr - bite; v.z *= 1 - fr - bite;
      { const h2 = Math.hypot(v.x, v.z) || 1, k = f.side*0.25*h2; v.x += (-v.z/h2)*k; v.z += (v.x/h2)*k; }
      f.backspin *= 0.5; f.side *= 0.5;
      p.y = su.s + 0.025; f.bounces++; ev(w,'land'); return null;
    }
    v.y = 0; f.on = su.on;
    { const short = gty==='green' || gty==='fair', h = Math.hypot(v.x, v.z);
      if(f.zip && short && h > 0.01){ const z = f.zip; v.x = -v.x/h*z; v.z = -v.z/h*z; f.zip = 0; }              // backspin grabs and spins it back
      else if(f.spinV < -0.2 && h > 0){ const k = 1 + 0.1*(-f.spinV); v.x *= k; v.z *= k; } }                                                                 // topspin runs out
    ev(w,'land'); return 'land';
  }
  if(f.t > 14 || outside(w, p.x, p.z) || p.y < -40) return 'ob-out';
  return null;
}
function stepBallRoll(w, f, dt){
  const p = f.pos, v = f.vel, px = p.x, pz = p.z;
  f.rollT += dt;
  const su = surface(w, p.x, p.z, p.y + 0.3);
  let gx = 0, gz = 0;
  if(!su.on){ const e = 0.5; gx = (w.T(p.x+e,p.z).h - w.T(p.x-e,p.z).h)/(2*e); gz = (w.T(p.x,p.z+e).h - w.T(p.x,p.z-e).h)/(2*e); }
  const slope = Math.hypot(gx, gz), gty = su.on ? 'hard' : w.T(p.x, p.z).type, S = SURF[gty] || SURF.grass;
  v.x -= G*0.6*gx*dt; v.z -= G*0.6*gz*dt;                     // balls run downhill
  let sp = Math.hypot(v.x, v.z);
  const dec = Math.min(sp, S.roll*dt); if(sp > 0){ v.x -= v.x/sp*dec; v.z -= v.z/sp*dec; }
  sp = Math.hypot(v.x, v.z);
  if((sp < 0.05 && slope*G*0.6 < S.roll) || f.rollT > 15) return 'rest';
  p.x += v.x*dt; p.z += v.z*dt; f.spin += dt*sp*12;
  collide(w, f, px, p.y, pz, true);
  const s2 = surface(w, p.x, p.z, p.y + 0.3);
  if(s2.s > p.y + 0.6){ p.x = px; p.z = pz; v.x *= -0.3; v.z *= -0.3; } else p.y = s2.s + 0.02;
  const [B, db] = cupNear(w, p);
  if(db < 0.6 && db > 0.02 && sp < 1.4){ const pull = (0.6 - db)*1.1*dt/db; v.x += (B.x - p.x)*pull; v.z += (B.z - p.z)*pull; }   // the hole gathers a dying putt
  if(db < 0.14){
    if(sp < 2.1){ f.inBasket = B; return 'in'; }
    if(db < 0.08){ const a = (Math.random() - 0.5)*0.9, c = Math.cos(a), s = Math.sin(a), vx = v.x, vz = v.z; v.x = (vx*c - vz*s)*0.7; v.z = (vz*c + vx*s)*0.7; ev(w,'clank'); }   // lip-out
  }
  f.on = s2.on;
  const ob = landType(w, f, s2.on); if(ob) return ob;
  return null;
}

// ---------- tournaments & CPU players ----------
const TOURS = [
  {name:'Village Open', blurb:'Friendly locals. Finish top 3 to unlock the County Classic.', skill:[0.15,0.5], wind:[1,5]},
  {name:'County Classic', blurb:'Club players who know their lines. Top 3 unlocks the Nationals.', skill:[0.4,0.75], wind:[2,7]},
  {name:'National Championship', blurb:'The best in the country, in big wind.', skill:[0.65,1.0], wind:[3,9]}
];
const CPU_NAMES = ['Maya Ruiz','Tom Okafor','Sven Larsen','Priya Shah','Jonny Hale','Aiko Tanaka','Callum Reid','Rosa Bianchi','Dev Patel','Erin Walsh','Luca Moretti','Hannah Price','Kofi Mensah','Freya Lund','Ollie Grant','Nina Kowalski'];
function makeField(tier, seed){
  const r = rng(seed); const T = TOURS[tier];
  const names = CPU_NAMES.slice(); for(let i=names.length-1;i>0;i--){ const j = Math.floor(r()*(i+1)); [names[i],names[j]] = [names[j],names[i]]; }
  return names.slice(0,7).map(n=>({name:n, skill: T.skill[0] + r()*(T.skill[1]-T.skill[0]), scores:[]}));
}
function cpuScore(skill, H, r, windSpeed){
  if(H.par===3 && r() < 0.012*skill) return 1;                         // ace!
  const mu = H.diff + 0.6 - 1.7*skill + windSpeed*0.03;
  const s = Math.round(H.par + mu + gauss(r)*0.75);
  return Math.max(2, Math.min(H.par + 4, s));
}
function holeWinds(tier, seed, holes){
  const r = rng(seed*31 + 7);
  return (holes || HOLES).map(H=>{
    const ch = windCharacter(H);
    if(tier < 0) return {x:H.wind[0], z:H.wind[1], gust:ch.gust, swirl:ch.swirl};
    const W = TOURS[tier].wind; const sp = W[0] + r()*(W[1]-W[0]); const a = r()*Math.PI*2;
    const harder = 0.8 + tier*0.2, v1 = 0.6 + r()*0.8, v2 = 0.6 + r()*0.8;
    return {x:Math.sin(a)*sp, z:Math.cos(a)*sp, gust:Math.min(1, ch.gust*v1*harder), swirl:Math.min(1, ch.swirl*v2*harder)};
  });
}

return {G, rng, localWind, windCharacter, fbm, smooth, distToPath, DISCS, CLUBS, SURF, newBall, stepBall, stepBallRoll, cupNearW:(w,p)=>cupNear(w,p)[0], newBallPreview:null, HOLES, COURSES, RANGE, genHole, GEN_NAMES, makeTerrain, makeWorld, surface, newFlight, stepFlight, stepRoll, TOURS, makeField, cpuScore, holeWinds, OB_TYPES};
})();
if(typeof module !== 'undefined') module.exports = Core;
