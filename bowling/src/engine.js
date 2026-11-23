// ===== Ten-pin bowling engine: lane, ball (skid → hook → roll), pins, scoring. No graphics. =====
// Coordinates: x across the lane (+ right), z down the lane (foul line z = 0, pins at negative z), metres.
const LANE = {
  half: 0.5271,            // lane is 41.5 in wide
  gutterW: 0.235,          // each gutter
  len: 18.288,             // foul line to head pin
  oil: 12.2,               // oil pattern length (40 ft): the ball skids on it, then hooks on the dry back end
  arrows: 4.57,            // targeting arrows 15 ft down
  board: 0.0268,           // one board (39 boards across)
  pit: 19.45               // past this the pins and ball drop into the pit
};
const BALL_R = 0.1085, PIN_R = 0.0605, PIN_H = 0.381, G = 9.81;
const MU_OIL = 0.03, MU_DRY = 0.12;

function pinSpots(){
  const out = [], dz = 0.2639, dx = 0.3048;
  let id = 1;
  for(let r=0;r<4;r++) for(let i=0;i<=r;i++) out.push({id:id++, x:(i - r/2)*dx, z:-(LANE.len + r*dz)});
  // standard numbering: 1 head; 2,3; 4,5,6; 7..10 (left to right from the bowler)
  return out;
}
const SPOTS = pinSpots();
function hyp2(a, b){ return Math.sqrt(a*a + b*b); }
function hyp3(a, b, c){ return Math.sqrt(a*a + b*b + c*c); }
// seeded randomness so every phone in an online game spots the rack the same way
let seedS = 1;
function setSeed(n){ seedS = (Math.floor(n) % 2147483646) + 1; }
function rand(){ seedS = seedS*16807 % 2147483647; return (seedS - 1)/2147483646; }

// release: x position at the foul line, angle (rad, + = towards the right), speed m/s,
// revs (rad/s), axis (rad: + = hooks left for this sign convention), mass kg
function newBall(o){
  if(o.init){ const I = o.init; return {x:I[0], z:-0.3, y:BALL_R, vx:I[1], vz:I[2], wx:I[3], wy:I[4], wz:I[5], m:7.2, gutter:0, gone:false, t:0, hitPins:false, entry:null, path:[], rolling:false, rollZ:null, hookZ:null, maxDx:0, startX:I[0], v0:hyp2(I[1], I[2])}; }
  const th = o.angle || 0, V = o.speed, W = o.revs || 0, a = o.axis || 0;
  const dx = Math.sin(th), dz = -Math.cos(th);
  const rx = dz, rz = -dx;                // roll axis direction for travel along (dx, dz)
  const sx = -dx*0 - Math.sin(th), sz = Math.cos(th);   // side-spin axis (hook to the left of travel when a > 0)
  return {x:o.x || 0, z:-0.3, y:BALL_R, vx:dx*V, vz:dz*V,
          wx:W*(Math.cos(a)*rx + Math.sin(a)*sx), wy:0, wz:W*(Math.cos(a)*rz + Math.sin(a)*sz),
          m:o.mass || 7.2, gutter:0, gone:false, t:0, hitPins:false, entry:null, path:[], rolling:false, rollZ:null, hookZ:null, maxDx:0, startX:o.x || 0, v0:V};
}

function frictionAt(z){ return -z < LANE.oil ? MU_OIL : MU_DRY; }

function stepBall(b, dt, ev){
  if(b.gone) return;
  b.t += dt;
  if(b.gutter){                       // rolls down the gutter, no hook
    b.x += (b.gutter*(LANE.half + LANE.gutterW*0.5) - b.x)*Math.min(1, dt*12);
    b.vx = 0; b.z += b.vz*dt;
    if(-b.z > LANE.pit){ b.gone = true; ev.push('pit'); }
    return;
  }
  const R = BALL_R, I = 0.4*b.m*R*R;
  const mu = frictionAt(b.z);
  // slip of the contact point: v + w × r, r = (0, -R, 0)
  const ux = b.vx + b.wz*R, uz = b.vz - b.wx*R, us = hyp2(ux, uz);
  const dvMax = mu*G*dt;
  if(us > 1e-4){
    // would friction overshoot pure rolling this step? then settle exactly into roll (angular momentum about contact conserved)
    const k = 1 + b.m*R*R/I;            // slip changes k times faster than v
    if(us <= dvMax*k){
      const mI = I/(R*R);
      const vrx = -b.wz*R, vrz = b.wx*R;     // velocity that the spin alone would roll at
      b.vx = (b.m*b.vx + mI*vrx)/(b.m + mI); b.vz = (b.m*b.vz + mI*vrz)/(b.m + mI);
      b.wz = -b.vx/R; b.wx = b.vz/R;
      if(!b.rolling){ b.rolling = true; b.rollZ = b.z; }
    } else {
      const Fx = -mu*b.m*G*ux/us, Fz = -mu*b.m*G*uz/us;
      b.vx += Fx/b.m*dt; b.vz += Fz/b.m*dt;
      // torque r × F = (-R Fz, 0, R Fx)
      b.wx += (-R*Fz)/I*dt; b.wz += (R*Fx)/I*dt;
      if(b.hookZ == null && Math.abs(Fx/b.m) > 0.8 && mu > 0.1) b.hookZ = b.z;
    }
  }
  // rolling resistance, small
  const sp = hyp2(b.vx, b.vz);
  if(sp > 0){ const d = Math.min(sp, 0.012*G*dt*(b.rolling ? 1 : 0.5)); b.vx -= b.vx/sp*d; b.vz -= b.vz/sp*d; if(b.rolling){ b.wz = -b.vx/R; b.wx = b.vz/R; } }
  b.x += b.vx*dt; b.z += b.vz*dt;
  if(Math.abs(b.x) > LANE.half && -b.z < LANE.len - 0.3){ b.gutter = Math.sign(b.x); ev.push('gutter'); }
  if(-b.z > LANE.pit){ b.gone = true; ev.push('pit'); }
  if(sp < 0.05 && b.t > 1){ b.gone = true; }
}

// ===================== 3D rigid-body pins =====================
// Each pin is a real rigid body: mass 1.53 kg, centre of mass 0.145 m up, with a flat base rim to stand on and a
// chain of spheres following its shape for hitting the ball, the lane and each other. Contacts are solved with
// sequential impulses (normal + friction), so pins wobble, topple, fly, bounce and roll properly.
const PIN_M = 1.53, PIN_COM = 0.145;
const PIN_SPH = [[0.035,0.034],[0.085,0.054],[0.135,0.0605],[0.185,0.05],[0.235,0.033],[0.29,0.026],[0.34,0.029]].map(([y,r])=>({y:y - PIN_COM, r}));
const R2 = 0.7071067811865476, PIN_RIM = [[1,0],[R2,R2],[0,1],[-R2,R2],[-1,0],[-R2,-R2],[0,-1],[R2,-R2]].map(([c,sn])=>[c*0.026, -PIN_COM, sn*0.026]);
const PIN_I = [0.0193, 0.0016, 0.0193];      // body-frame inertia (x, y = long axis, z)
const BALL_M = 7.2, BALL_I = 0.4*BALL_M*BALL_R*BALL_R;

function qRot(q, v){ // rotate vector v by quaternion q=[x,y,z,w]
  const [x,y,z,w] = q, [vx,vy,vz] = v;
  const ix = w*vx + y*vz - z*vy, iy = w*vy + z*vx - x*vz, iz = w*vz + x*vy - y*vx, iw = -x*vx - y*vy - z*vz;
  return [ix*w + iw*-x + iy*-z - iz*-y, iy*w + iw*-y + iz*-x - ix*-z, iz*w + iw*-z + ix*-y - iy*-x];
}
function qInv(q){ return [-q[0], -q[1], -q[2], q[3]]; }
function qNorm(q){ const l = Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]) || 1; q[0]/=l; q[1]/=l; q[2]/=l; q[3]/=l; }
function cross(a, b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot(a, b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function invI(body, v){ // world inverse inertia × v
  if(body.ball) return [v[0]/BALL_I, v[1]/BALL_I, v[2]/BALL_I];
  const l = qRot(qInv(body.q), v); return qRot(body.q, [l[0]/PIN_I[0], l[1]/PIN_I[1], l[2]/PIN_I[2]]);
}
function makePinBody(s){
  const jx = (rand() - 0.5)*0.008, jz = (rand() - 0.5)*0.008;      // no machine spots a rack perfectly
  return {id:s.id, x:s.x + jx, z:s.z + jz, c:[s.x + jx, PIN_COM, s.z + jz], q:(()=>{ const q = [0, (rand() - 0.5)*0.5, 0, 1]; qNorm(q); return q; })(), v:[0,0,0], w:[0,0,0], state:'up', y:0, vx:0, vz:0, tilt:0, tdir:0, sleep:0, hit:false};
}
function newRack(standing){ return SPOTS.filter(s=>!standing || standing.includes(s.id)).map(makePinBody); }
function pinAxis(p){ return qRot(p.q, [0,1,0]); }
function groundY(x, z){ // lane / deck surface height; gutters dip, past the pit there's nothing
  if(-z > LANE.pit) return -5;
  if(Math.abs(x) > LANE.half && Math.abs(x) < LANE.half + LANE.gutterW) return -0.06;
  return 0;
}
// contact list entries: {a, b (null = static), n (from b to a), p (world point), pen, e, mu}
function addContact(C, a, b, n, pt, pen, e, mu){ C.push({a, b, n, pt, pen, e, mu, jn:0, jt1:0, jt2:0}); }
function collectContacts(w){
  const C = [], P = w.pins.filter(p=>p.state!=='gone'), wall = LANE.half + LANE.gutterW + 0.06;
  for(const p of P){
    // world positions of the rim points and shape spheres
    p._sph = PIN_SPH.map(s=>{ const o = qRot(p.q, [0, s.y, 0]); return [p.c[0]+o[0], p.c[1]+o[1], p.c[2]+o[2], s.r]; });
    for(const r of PIN_RIM){ const o = qRot(p.q, r), pt = [p.c[0]+o[0], p.c[1]+o[1], p.c[2]+o[2]], g = groundY(pt[0], pt[2]);
      if(pt[1] < g + 0.0005) addContact(C, p, null, [0,1,0], pt, g - pt[1], 0.05, 0.34); }
    for(const sp of p._sph){
      const g = groundY(sp[0], sp[2]); if(sp[1] - sp[3] < g) addContact(C, p, null, [0,1,0], [sp[0], g, sp[2]], g - (sp[1] - sp[3]), 0.1, 0.16);
      // kickback walls and the back curtain
      if(Math.abs(sp[0]) + sp[3] > wall && -sp[2] > LANE.len - 1.2){ const sg = Math.sign(sp[0]); addContact(C, p, null, [-sg,0,0], [sg*wall, sp[1], sp[2]], Math.abs(sp[0]) + sp[3] - wall, 0.5, 0.04); }
      if(-sp[2] + sp[3] > LANE.pit + 0.7 && sp[1] > -0.4){ addContact(C, p, null, [0,0,1], [sp[0], sp[1], -(LANE.pit + 0.7)], -sp[2] + sp[3] - LANE.pit - 0.7, 0.1, 0.4); }
    }
  }
  // pin against pin
  for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){
    const a = P[i], b = P[j]; if(Math.abs(a.c[0]-b.c[0]) > 0.5 || Math.abs(a.c[2]-b.c[2]) > 0.5 || Math.abs(a.c[1]-b.c[1]) > 0.5) continue;
    let best = null;
    for(const s1 of a._sph) for(const s2 of b._sph){
      const dx = s1[0]-s2[0], dy = s1[1]-s2[1], dz = s1[2]-s2[2], d = hyp3(dx,dy,dz), pen = (s1[3] + s2[3])*1.06 - d;
      if(pen > 0 && d > 1e-6){ const ny = Math.max(-0.5, Math.min(0.5, dy/d)), nl = hyp3(dx/d, ny, dz/d), n = [dx/d/nl, ny/nl, dz/d/nl]; addContact(C, a, b, n, [s2[0] + n[0]*s2[3], s2[1] + n[1]*s2[3], s2[2] + n[2]*s2[3]], pen, 0.62, 0.12); }
    }
  }
  // ball against pins
  const bl = w.ball;
  if(bl && !bl.gone && !bl.gutter && -bl.z > LANE.len - 0.5){
    const bc = [bl.x, BALL_R, bl.z];
    for(const p of P) for(const sp of p._sph){
      const dx = bc[0]-sp[0], dy = bc[1]-sp[1], dz = bc[2]-sp[2], d = hyp3(dx,dy,dz), pen = BALL_R + sp[3] - d;
      if(pen > 0 && d > 1e-6){
        if(!bl.hitPins){ bl.hitPins = true; bl.entry = {x:bl.x, ang:Math.atan2(bl.vx, -bl.vz), pin:p.id}; w.events.push('strikehit'); }
        const hl = hyp2(dx, dz) || 1e-6, n = [dx/hl, 0, dz/hl], cy = Math.max(sp[1] - sp[3]*0.7, Math.min(sp[1] + sp[3]*0.7, BALL_R));
        addContact(C, w._ballBody, p, n, [sp[0] + n[0]*sp[3], cy, sp[2] + n[2]*sp[3]], pen, 0.72, 0.04);
      }
    }
  }
  return C;
}
function velAt(body, r){ if(!body) return [0,0,0]; const wr = cross(body.w, r); return [body.v[0]+wr[0], body.v[1]+wr[1], body.v[2]+wr[2]]; }
function applyImp(body, r, J, sign){
  if(!body) return; const im = body.ball ? 1/BALL_M : 1/PIN_M;
  body.v[0] += sign*J[0]*im; body.v[1] += sign*J[1]*im; body.v[2] += sign*J[2]*im;
  const dw = invI(body, cross(r, J)); body.w[0] += sign*dw[0]; body.w[1] += sign*dw[1]; body.w[2] += sign*dw[2];
}
function effMass(body, r, n){ if(!body) return 0; const im = body.ball ? 1/BALL_M : 1/PIN_M; return im + dot(n, cross(invI(body, cross(r, n)), r)); }
function solve(C, h){
  for(const c of C){
    c.ra = [c.pt[0]-c.a.c[0], c.pt[1]-c.a.c[1], c.pt[2]-c.a.c[2]]; c.rb = c.b ? [c.pt[0]-c.b.c[0], c.pt[1]-c.b.c[1], c.pt[2]-c.b.c[2]] : null;
    c.kn = 1/(effMass(c.a, c.ra, c.n) + (c.b ? effMass(c.b, c.rb, c.n) : 0));
    const va = velAt(c.a, c.ra), vb = c.b ? velAt(c.b, c.rb) : [0,0,0];
    const vn = (va[0]-vb[0])*c.n[0] + (va[1]-vb[1])*c.n[1] + (va[2]-vb[2])*c.n[2];
    c.bias = (vn < -0.4 ? -c.e*vn : 0) + Math.min(0.3, 0.08*Math.max(0, c.pen - 0.001)/h);
    // tangent directions
    const t1 = Math.abs(c.n[1]) < 0.9 ? cross(c.n, [0,1,0]) : cross(c.n, [1,0,0]); const l1 = hyp3(t1[0], t1[1], t1[2]); c.t1 = t1.map(v=>v/l1); c.t2 = cross(c.n, c.t1);
    c.k1 = 1/(effMass(c.a, c.ra, c.t1) + (c.b ? effMass(c.b, c.rb, c.t1) : 0)); c.k2 = 1/(effMass(c.a, c.ra, c.t2) + (c.b ? effMass(c.b, c.rb, c.t2) : 0));
  }
  for(let it=0; it<8; it++){
    for(const c of C){
      const va = velAt(c.a, c.ra), vb = c.b ? velAt(c.b, c.rb) : [0,0,0], dv = [va[0]-vb[0], va[1]-vb[1], va[2]-vb[2]];
      const vn = dot(dv, c.n);
      let dj = (c.bias - vn)*c.kn; const j0 = c.jn; c.jn = Math.max(0, j0 + dj); dj = c.jn - j0;
      if(dj){ const J = [c.n[0]*dj, c.n[1]*dj, c.n[2]*dj]; applyImp(c.a, c.ra, J, 1); applyImp(c.b, c.rb, J, -1); }
      const lim = c.mu*c.jn;
      for(const [tk, kk, key] of [[c.t1, c.k1, 'jt1'], [c.t2, c.k2, 'jt2']]){
        const va2 = velAt(c.a, c.ra), vb2 = c.b ? velAt(c.b, c.rb) : [0,0,0];
        const vt = (va2[0]-vb2[0])*tk[0] + (va2[1]-vb2[1])*tk[1] + (va2[2]-vb2[2])*tk[2];
        let dt_ = -vt*kk; const t0 = c[key]; c[key] = Math.max(-lim, Math.min(lim, t0 + dt_)); dt_ = c[key] - t0;
        if(dt_){ const J = [tk[0]*dt_, tk[1]*dt_, tk[2]*dt_]; applyImp(c.a, c.ra, J, 1); applyImp(c.b, c.rb, J, -1); }
      }
    }
  }
  return C;
}
function stepPins(w, h){
  const P = w.pins, bl = w.ball, ev = w.events;
  // nothing to do while the rack is asleep and the ball is still on its way
  const near = bl && !bl.gone && !bl.gutter && -bl.z > LANE.len - 0.5;
  if(!near && P.every(p=>p.state==='gone' || (p.state==='up' && p.sleep > 30))) return;
  // the ball joins the solver as a sphere while it's among the pins (its rolling on the lane is handled by stepBall)
  if(bl){ if(!w._ballBody) w._ballBody = {ball:true, c:[0,0,0], q:[0,0,0,1], v:[0,0,0], w:[0,0,0]};
    const B = w._ballBody; B.c = [bl.x, BALL_R, bl.z]; B.v = [bl.vx, 0, bl.vz]; B.w = [bl.wx, bl.wy, bl.wz]; }
  for(const p of P){ if(p.state==='gone' || p.sleep > 30) continue; p.v[1] -= G*h; }
  const C = solve(collectContacts(w), h);
  // contact sounds
  for(const c of C){ if(c.b && !c.a.ball && c.jn > 0.06) { if(!w._clack || w.t - w._clack > 0.03){ ev.push('clack'); w._clack = w.t; } } }
  if(bl && w._ballBody){ const B = w._ballBody; bl.vx = B.v[0]; bl.vz = B.v[2]; }
  for(const p of P){
    if(p.state==='gone') continue;
    const sp = hyp3(p.v[0], p.v[1], p.v[2]) + hyp3(p.w[0], p.w[1], p.w[2])*0.1;
    if(sp < 0.02 && p.state==='up'){ p.sleep++; if(p.sleep > 30){ p.v = [0,0,0]; p.w = [0,0,0]; continue; } } else p.sleep = 0;
    if(p.v[1] > 0.8) p.v[1] = 0.8;
    { const wm = hyp3(p.w[0], p.w[1], p.w[2]); if(wm > 22){ const k = 22/wm; p.w[0] *= k; p.w[1] *= k; p.w[2] *= k; } }
    if(p.c[1] > 0.3 && p.v[1] > 0) p.v[1] = 0;
    p.c[0] += p.v[0]*h; p.c[1] += p.v[1]*h; p.c[2] += p.v[2]*h;
    const [wx,wy,wz] = p.w, q = p.q; // q += 0.5 * (0,w) * q * h
    const dq = [ wx*q[3] + wy*q[2] - wz*q[1], wy*q[3] + wz*q[0] - wx*q[2], wz*q[3] + wx*q[1] - wy*q[0], -wx*q[0] - wy*q[1] - wz*q[2] ];
    q[0] += dq[0]*0.5*h; q[1] += dq[1]*0.5*h; q[2] += dq[2]*0.5*h; q[3] += dq[3]*0.5*h; qNorm(q);
    // a little air/rolling damping so lying pins come to rest
    { const ax = pinAxis(p), sa = dot(p.w, ax), k = Math.min(1, 4*h); p.w[0] -= ax[0]*sa*k; p.w[1] -= ax[1]*sa*k; p.w[2] -= ax[2]*sa*k; }
    const lying = p.tilt > 1.2 && p.c[1] < 0.08, damp = Math.max(0, 1 - (lying ? 1.5 : 0.4)*h); p.w[0] *= damp; p.w[1] *= damp; p.w[2] *= damp;

    // summary fields for the game
    const ax = pinAxis(p); p.tilt = Math.acos(Math.max(-1, Math.min(1, ax[1]))); p.tdir = Math.atan2(ax[0], ax[2]);
    const base = [p.c[0] - ax[0]*PIN_COM, p.c[1] - ax[1]*PIN_COM, p.c[2] - ax[2]*PIN_COM]; p.x = base[0]; p.z = base[2]; p.y = base[1]; p.vx = p.v[0]; p.vz = p.v[2];
    if(p.state==='up' && p.tilt > 0.25){ p.state = 'falling'; ev.push('pin'); }
    if(p.state==='falling' && p.tilt > 1.2) p.state = 'down';
    if(p.state==='falling' && p.tilt < 0.12 && sp < 0.05) p.state = 'up';       // it rocked and stood back up
    if(p.c[1] < -0.35 || -p.c[2] > LANE.pit + 1.2){ p.state = 'gone'; ev.push('pit'); }
  }
}

function newWorld(standing){ return {ball:null, pins:newRack(standing), t:0, events:[], done:false, settle:0}; }
const FIXED = 1/120;
function step(w, dt){
  w.acc = (w.acc || 0) + dt;
  while(w.acc >= FIXED - 1e-9 && !w.done){ w.acc -= FIXED; fixedStep(w); }
}
function fixedStep(w){
  const sub = 4, h = FIXED/sub;
  for(let i=0;i<sub;i++){
    if(w.ball){ stepBall(w.ball, h, w.events); if(w.ball.path.length < 2000 && (w.ball.path.length===0 || Math.abs(w.ball.path[w.ball.path.length-1][1] - w.ball.z) > 0.15)) w.ball.path.push([w.ball.x, w.ball.z]); }
    stepPins(w, h);
    w.t += h;
  }
  const moving = w.pins.some(p=>p.state!=='gone' && (hyp3(p.v[0], p.v[1], p.v[2]) > 0.04 || hyp3(p.w[0], p.w[1], p.w[2]) > 0.4));
  const ballDone = !w.ball || w.ball.gone;
  w.settle = ballDone && !moving ? w.settle + FIXED : 0;
  if(ballDone) w.goneT = (w.goneT || 0) + FIXED;
  if(w.settle > 0.5 || w.goneT > 3.5 || w.t > 12) w.done = true;
}
// a pin counts as standing if it's upright on the deck
function standingIds(w){ return w.pins.filter(p=>p.state!=='gone' && p.tilt < 0.3 && Math.abs(p.x) < LANE.half + 0.02 && -p.z < LANE.pit && p.y > -0.02).map(p=>p.id); }

// fast ball-only path (for aiming and the CPU): where does it cross the head pin line?
function simLine(o){
  const b = newBall(o), ev = [];
  let atPins = null;
  for(let i=0;i<4000 && !b.gone;i++){ stepBall(b, 1/400, ev); if(!atPins && -b.z >= LANE.len){ atPins = {x:b.x, ang:Math.atan2(b.vx, -b.vz), gutter:b.gutter}; } }
  return {atPins, ball:b};
}

// is what's left a split? head pin down and the standing pins fall into groups with a gap between them
function isSplit(standing){
  if(standing.includes(1) || standing.length < 2) return false;
  const pos = id=>SPOTS[id-1];
  const groups = [];
  for(const id of standing){
    const p = pos(id); let g = groups.find(G=>G.some(q=>Math.hypot(pos(q).x - p.x, pos(q).z - p.z) < 0.32));
    if(g) g.push(id); else groups.push([id]);
  }
  // merge groups touching each other
  let merged = true;
  while(merged){ merged = false;
    for(let i=0;i<groups.length && !merged;i++) for(let j=i+1;j<groups.length && !merged;j++)
      if(groups[i].some(a=>groups[j].some(c=>Math.hypot(pos(a).x - pos(c).x, pos(a).z - pos(c).z) < 0.32))){ groups[i].push(...groups[j]); groups.splice(j,1); merged = true; } }
  return groups.length > 1;
}

// ---- scoring ----
function scoreGame(rolls){        // rolls: pins knocked per ball
  const frames = []; let i = 0, total = 0;
  for(let f=0; f<10; f++){
    if(i >= rolls.length){ frames.push({rolls:[], score:null}); continue; }
    if(f < 9){
      if(rolls[i]===10){
        const b1 = rolls[i+1], b2 = rolls[i+2];
        const sc = b1 != null && b2 != null ? 10 + b1 + b2 : null;
        if(sc != null) total += sc;
        frames.push({rolls:[10], strike:true, score:sc != null ? total : null}); i += 1;
      } else {
        const a = rolls[i], b = rolls[i+1];
        if(b == null){ frames.push({rolls:[a], score:null}); i += 1; continue; }
        const spare = a + b === 10, nx = rolls[i+2];
        const sc = spare ? (nx != null ? 10 + nx : null) : a + b;
        if(sc != null) total += sc;
        frames.push({rolls:[a, b], spare, score:sc != null ? total : null}); i += 2;
      }
    } else {
      const r = rolls.slice(i, i+3), a = r[0], b = r[1];
      const need = a===10 || (a + (b||0))===10 ? 3 : 2;
      const done = r.length >= need;
      if(done) total += r.slice(0, need).reduce((s,v)=>s+v, 0);
      frames.push({rolls:r.slice(0, need), score:done ? total : null, tenth:true}); i += need;
    }
  }
  return {frames, total};
}
// whose ball / which frame / respot? returns {frame, ball (1..3), fresh (full rack?), done}
function gameState(rolls){
  let i = 0;
  for(let f=0; f<10; f++){
    if(f < 9){
      if(i >= rolls.length) return {frame:f, ball:1, fresh:true, done:false};
      if(rolls[i]===10){ i++; continue; }
      if(i + 1 >= rolls.length) return {frame:f, ball:2, fresh:false, done:false, left:10 - rolls[i]};
      i += 2;
    } else {
      const r = rolls.slice(i);
      if(r.length===0) return {frame:9, ball:1, fresh:true, done:false};
      if(r.length===1) return r[0]===10 ? {frame:9, ball:2, fresh:true, done:false} : {frame:9, ball:2, fresh:false, done:false, left:10 - r[0]};
      if(r.length===2){
        if(r[0]===10) return r[1]===10 ? {frame:9, ball:3, fresh:true, done:false} : {frame:9, ball:3, fresh:false, done:false, left:10 - r[1]};
        if(r[0] + r[1]===10) return {frame:9, ball:3, fresh:true, done:false};
        return {frame:9, done:true};
      }
      return {frame:9, done:true};
    }
  }
  return {frame:9, done:true};
}
function rollMarks(fr){              // what to print in a frame's little boxes
  const r = fr.rolls, out = [];
  if(!fr.tenth){
    if(fr.strike) return ['', 'X'];
    if(r.length > 0) out.push(r[0]===0 ? '-' : String(r[0]));
    if(r.length > 1) out.push(fr.spare ? '/' : r[1]===0 ? '-' : String(r[1]));
    return out;
  }
  const m = v=>v===10 ? 'X' : v===0 ? '-' : String(v);
  if(r.length > 0) out.push(m(r[0]));
  if(r.length > 1) out.push(r[0]===10 ? m(r[1]) : r[0] + r[1]===10 ? '/' : m(r[1]));
  if(r.length > 2){
    if(r[0]===10 && r[1]!==10) out.push(r[1] + r[2]===10 ? '/' : m(r[2]));
    else out.push(m(r[2]));
  }
  return out;
}

const ENGINE = {setSeed, rand, LANE, BALL_R, PIN_R, PIN_H, SPOTS, newRack, newBall, newWorld, step, stepBall, standingIds, simLine, isSplit, scoreGame, gameState, rollMarks, frictionAt};
if(typeof module !== 'undefined') module.exports = ENGINE;
