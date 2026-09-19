const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('dist/index.html','utf8').match(/<script>\s*(\/\/ ===== Knot core[\s\S]*?)<\/script>/)[1];vm.runInThisContext(src+'\nglobalThis.KC=KC;');
const poly=a=>{const cm={pts:a.map(([x,y],i)=>({x,y,u:i/a.length}))};KC.updateGeom(cm);return cm};
function fixture(t){return [[[-100,-100],[100,100],[300,-300]],[[-100,100],[100,-100],[-300,-300]],[[-100,t],[100,t],[100,300],[-100,300]]].map(poly)}
function state(cm,cyclic=false){const crossings=KC.computeRaw(cm);crossings.forEach((x,i)=>{x.id=i+1;const [a,b]=x.occ.map(o=>o.c);x.over=a<b?0:1;if(cyclic&&Math.min(a,b)===0&&Math.max(a,b)===2)x.over=1-x.over;});return {comps:cm,crossings,nextId:crossings.length+1}}
const totals={r1:0,r2:0,r3:0};const S=state(fixture(-1));

// Alternate every closed component together, minimizing flips for the fixed
// projection (including disconnected pieces and the wrap around each component).
require('../dist/pd-import.js');
const altTrefoil=()=>PDImport.fromPD('[[1,4,2,5],[3,6,4,1],[5,2,6,3]]',KC);
const splitA=altTrefoil(),splitB=altTrefoil();splitB.comps.forEach(c=>c.pts.forEach(p=>p.x+=3000));
const split=state(splitA.comps.concat(splitB.comps));
const altFixtures=[altTrefoil(),split,KC.fromCurves3D(KC.braidCurves([1,1]),360),KC.fromCurves3D(KC.braidCurves([1,2,1,-2,1,2]),440),KC.fromCurves3D([KC.figureEightCurve()],440),KC.fromCurves3D([KC.torusCurve(3,4,2,1.15)],520),KC.fromCurves3D([KC.circleCurve()],360)];
for(const s of altFixtures)for(const pattern of [0,1,2]) {
 s.crossings.forEach((x,i)=>{x.over=pattern===0?0:pattern===1?i%2:(i%3===0?1:0);if(pattern===2){x.occ.reverse();x.over=1-x.over;}});
 const original=JSON.stringify(s),r=KC.alternatingAssignment(s.comps,s.crossings);assert(r.ok);assert.equal(JSON.stringify(s),original,'Planning must not mutate input');
 const xs=KC.cloneCrossings(s.crossings);xs.forEach((x,i)=>x.over=r.over[i]);assert(KC.analyze(s.comps,xs).alternating);
 assert.equal(r.flips,xs.filter((x,i)=>x.over!==s.crossings[i].over).length);
 assert.equal(KC.alternatingAssignment(s.comps,xs).flips,0,'Repeated conversion must be a no-op');
 if(xs.length<=8){
  let minimum=Infinity;
  for(let mask=0;mask<2**xs.length;mask++){
   xs.forEach((x,i)=>x.over=(mask>>i)&1);
   if(KC.analyze(s.comps,xs).alternating)minimum=Math.min(minimum,xs.filter((x,i)=>x.over!==s.crossings[i].over).length);
  }
  assert.equal(r.flips,minimum,'Compare with all crossing assignments on small fixtures');
 }
}
const inconsistent=[{over:0,occ:[{c:0,s:0},{c:1,s:0}]}];
assert.equal(KC.alternatingAssignment([{},{}],inconsistent).ok,false,'Reject inconsistent cyclic crossing constraints');
assert.equal(inconsistent[0].over,0);
console.log('Alternating assignment: knots, links, split diagrams, cyclic order, minimum flips and no-op/error handling: PASS');

// Landing a step exactly on the triple point and a later step moving away
// from it are each their own reconcile call, so a slide sampled in two
// steps that happens to land exactly there counts r3 once per step (2
// total), not once for the whole slide; a single step spanning the same
// move (rback below) counts it once, as does jumping straight past it.
for(const t of [0,1]){const r=KC.attemptStep(S,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=t}),{});assert(r.ok);for(const k in totals)totals[k]+=r.ev[k]}
assert.deepEqual(totals,{r1:0,r2:0,r3:2});
const rback=KC.attemptStep(S,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=-1}),{});assert(rback.ok);assert.equal(rback.ev.r3,1);assert.equal(rback.ev.r2,0);
const forbidden=state(fixture(-1),true),before=JSON.stringify(forbidden.comps);const bad=KC.attemptStep(forbidden,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=1}),{});assert(!bad.ok);assert.equal(bad.reason,'R3');assert.equal(JSON.stringify(forbidden.comps),before);
// Previously even a no-op deleted these two crossings and incremented R2.
const kink=y=>poly([[-20,10],[-1,1],[0,y],[1,1],[20,10],[20,20],[-20,20]]);
const bar=()=>poly([[-30,0],[30,0],[30,-20],[-30,-20]]);
// At normal screen scale (unlike the subpixel scales exercised below), a
// no-op resample must not touch which crossings exist.
const scaleUp=cm=>poly(cm.pts.map(p=>[p.x*80,p.y*80]));
const noop=state([scaleUp(kink(-1)),scaleUp(bar())]);const n=KC.attemptStep(noop,()=>{},{});assert(n.ok);assert.equal(noop.crossings.length,2);assert.deepEqual(n.ev,{r1:0,r2:0,r3:0});
let id=100;const a=[kink(-1),bar()],b=[kink(.5),bar()],x=state(a).crossings;
const death=KC.reconcile(x,a,b,KC.computeRaw(b),{nextId:()=>id++});assert(death.ok);assert.deepEqual(death.ev,{r1:0,r2:1,r3:0});
const birth=KC.reconcile([],b,a,KC.computeRaw(a),{nextId:()=>id++});assert(birth.ok);assert.deepEqual(birth.ev,{r1:0,r2:1,r3:0});
x[0].over=1-x[0].over;assert.equal(KC.reconcile(x,a,b,KC.computeRaw(b),{}).reason,'R2');
console.log('R3 forward/reverse, cyclic-height rejection, no-op resampling, R2 birth/death and invalid R2: PASS');
const curled=poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]]),flat=poly([[-20,0],[20,0],[20,20],[-20,20]]);
const curlX=state([curled]).crossings;assert.equal(curlX.length,1);
const r1death=KC.reconcile(curlX,[curled],[flat],[],{});assert(r1death.ok);assert.deepEqual(r1death.ev,{r1:1,r2:0,r3:0});
const r1birth=KC.reconcile([],[flat],[curled],KC.computeRaw([curled]),{nextId:()=>id++});assert(r1birth.ok);assert.deepEqual(r1birth.ev,{r1:1,r2:0,r3:0});
console.log('R1 birth and death remain correctly classified: PASS');

// Without a size floor, a valid R1 self-crossing may start below any
// previous size threshold and later shrink and grow freely.
const curled2=poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[x*5,y*5])),flat2=poly([[-20,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[x*5,y*5]));
for(const under of [false,true]) {
 const born=state(KC.cloneComps([flat2]));
 const r=KC.attemptStep(born,cm=>{cm[0].pts=curled2.pts.map(p=>({...p}));},{under,weight:o=>o.u<.3?1:0});
 assert(r.ok,'A valid R1 self-crossing must be allowed to start');assert.equal(r.ev.r1,1);assert.equal(born.crossings.length,1);assert.equal(born.nextId,2);
 const grow=KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=2;}),{});assert(grow.ok);assert.equal(grow.ev.r1,0);
 const shrink=KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=.5;}),{});assert(shrink.ok);assert.equal(shrink.ev.r1,0);
}
console.log('Crossings shrink and grow freely with no bigon/kink size floor: PASS');


const maximumTurn=comps=>Math.max(...comps.flatMap(c=>c.pts.map((p,i,a)=>{
 const prev=a[(i+a.length-1)%a.length],next=a[(i+1)%a.length],ux=p.x-prev.x,uy=p.y-prev.y,vx=next.x-p.x,vy=next.y-p.y;
 return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy));
})));
const Inv=require('../dist/invariants.js');
for(const s of [altTrefoil(),KC.fromCurves3D([KC.torusCurve(2,3,2,1)],440),KC.fromCurves3D([KC.figureEightCurve()],440)]) {
 const before=Inv.calculate(KC.analyze(s.comps,s.crossings));
 for(let i=0;i<300;i++){const r=KC.relaxStep(s);if(!r.ok)break;}
 assert(maximumTurn(s.comps)<.4,'Repeated relaxation must not introduce sharp corners');
 assert.deepEqual(Inv.calculate(KC.analyze(s.comps,s.crossings)),before,'Relaxation must preserve knot invariants');
}
console.log('Crowded crossing escape, relaxation smoothness and invariants: PASS');

// Repeated relaxation must not grow the point count without bound:
// resampleComp's own 16-point cap trims nearby points back down each step.
{
 const s=KC.fromCurves3D([KC.figureEightCurve()],440);
 const countOf=()=>s.comps.reduce((a,c)=>a+c.pts.length,0);
 const initial=countOf();
 for(let round=0;round<5;round++){
  for(let i=0;i<150;i++){const r=KC.relaxStep(s);if(!r.ok)break;}
 }
 assert(countOf()<initial*1.5,'Point count must stay bounded across repeated relax runs, not grow every round');
}
console.log('Repeated auto-relax does not grow the point count without bound: PASS');

// Auto-relax carries no size or distance floor at all: only real topology
// (reconcile) gates a step, same as a plain attemptStep.
assert(KC.relaxStep(altTrefoil()).ok,'Auto-relax is unrestricted by anything but topology');
console.log('Auto-relax is unrestricted by anything but topology: PASS');


