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

for(const t of [0,1]){const r=KC.attemptStep(S,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=t}),{});assert(r.ok);for(const k in totals)totals[k]+=r.ev[k]}
assert.deepEqual(totals,{r1:0,r2:0,r3:1});
const rback=KC.attemptStep(S,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=-1}),{});assert(rback.ok);assert.equal(rback.ev.r3,1);assert.equal(rback.ev.r2,0);
const forbidden=state(fixture(-1),true),before=JSON.stringify(forbidden.comps);const bad=KC.attemptStep(forbidden,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=1}),{});assert(!bad.ok);assert.equal(bad.reason,'R3');assert.equal(JSON.stringify(forbidden.comps),before);
// Previously even a no-op deleted these two crossings and incremented R2.
const kink=y=>poly([[-20,10],[-1,1],[0,y],[1,1],[20,10],[20,20],[-20,20]]);
const bar=()=>poly([[-30,0],[30,0],[30,-20],[-30,-20]]);
const noop=state([kink(-1),bar()]);const n=KC.attemptStep(noop,()=>{},{});assert(n.ok);assert.equal(noop.crossings.length,2);assert.deepEqual(n.ev,{r1:0,r2:0,r3:0});
let id=100;const a=[kink(-1),bar()],b=[kink(.5),bar()],x=state(a).crossings;
const death=KC.reconcile(x,a,b,KC.computeRaw(b),{nextId:()=>id++});assert(death.ok);assert.deepEqual(death.ev,{r1:0,r2:1,r3:0});
const birth=KC.reconcile([],b,a,KC.computeRaw(a),{nextId:()=>id++});assert(birth.ok);assert.deepEqual(birth.ev,{r1:0,r2:1,r3:0});
x[0].over=1-x[0].over;assert.equal(KC.reconcile(x,a,b,KC.computeRaw(b),{}).reason,'R2');
console.log('R3 forward/reverse, exact triple-point frame, cyclic-height rejection, no-op resampling, R2 birth/death and invalid R2: PASS');
const curled=poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]]),flat=poly([[-20,0],[20,0],[20,20],[-20,20]]);
const curlX=state([curled]).crossings;assert.equal(curlX.length,1);
const r1death=KC.reconcile(curlX,[curled],[flat],[],{});assert(r1death.ok);assert.deepEqual(r1death.ev,{r1:1,r2:0,r3:0});
const r1birth=KC.reconcile([],[flat],[curled],KC.computeRaw([curled]),{nextId:()=>id++});assert(r1birth.ok);assert.deepEqual(r1birth.ev,{r1:1,r2:0,r3:0});
console.log('R1 birth and death remain correctly classified: PASS');

// Without a size floor, a valid R1 self-crossing may start below any
// previous size threshold and later shrink and grow freely.
const curled2=poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]]),flat2=poly([[-20,0],[20,0],[20,20],[-20,20]]);
for(const under of [false,true]) {
 const born=state(KC.cloneComps([flat2]));
 const r=KC.attemptStep(born,cm=>{cm[0].pts=curled2.pts.map(p=>({...p}));},{under,weight:o=>o.u<.3?1:0});
 assert(r.ok,'A valid R1 self-crossing must be allowed to start');assert.equal(r.ev.r1,1);assert.equal(born.crossings.length,1);assert.equal(born.nextId,2);
 assert.equal(KC.loosenR1(born,{component:0,u:2/8,radius:60,maxLoopLength:120,eligibleIds:new Set()}),null,'Do not immediately erase a newly created self-crossing');
 const grow=KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=2;}),{});assert(grow.ok);assert.equal(grow.ev.r1,0);
 const shrink=KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=.5;}),{});assert(shrink.ok);assert.equal(shrink.ev.r1,0);
}
console.log('Crossings shrink and grow freely with no bigon/kink size floor: PASS');

// Assisted R1 removes only a nearby empty monogon, never a threaded/enclosing loop.
const curlPoints=[[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]];
const curlState=extra=>state([poly(curlPoints),...extra]);
const loosen={component:0,u:2/8,radius:60,maxLoopLength:120};
for(const over of [0,1]) {
 const s=curlState([]);s.crossings[0].over=over;
 const r=KC.loosenR1(s,loosen);assert(r,'Empty curl should loosen');
 assert.equal(s.crossings.length,0);assert.deepEqual(r.ev,{r1:1,r2:0,r3:0});assert.equal(s.comps.length,1);
 assert.equal(KC.loosenR1(s,loosen),null,'Must not count the same R1 twice');
}
const tinyBox=(x,y)=>poly([[x-.08,y-.08],[x+.08,y-.08],[x+.08,y+.08],[x-.08,y+.08]]);
for(const extra of [[tinyBox(0,2.65)],[tinyBox(0,1.8)]]) {
 const s=curlState(extra),before=JSON.stringify(s);assert.equal(s.crossings.length,1);
 assert.equal(KC.loosenR1(s,loosen),null,'A component inside the loop or neck must be protected');assert.equal(JSON.stringify(s),before);
}
const openThread=curlState([]);openThread.open=[{pts:[{x:-5,y:2.6},{x:5,y:2.6}]}];
const threadBefore=JSON.stringify(openThread);assert.equal(KC.loosenR1(openThread,loosen),null);assert.equal(JSON.stringify(openThread),threadBefore);
const remote=curlState([]),remoteBefore=JSON.stringify(remote);
assert.equal(KC.loosenR1(remote,{...loosen,u:6/8,radius:2}),null);assert.equal(JSON.stringify(remote),remoteBefore);
const busy=curlState([poly(curlPoints.map(([x,y])=>[x+60,y]))]);
assert.equal(busy.crossings.length,2);busy.crossings[1].over=1;
const survivors=JSON.stringify(busy.crossings.filter(x=>x.occ[0].c===1));
assert(KC.loosenR1(busy,loosen));assert.equal(JSON.stringify(busy.crossings.filter(x=>x.occ[0].c===1)),survivors,'Unrelated crossings must remain untouched');
console.log('Assisted R1: both signs, one count, enclosed components, neck obstruction, open strands and distant curls: PASS');
const twoCurls=[[-20,0],[-2,0],[1,3],[-1,3],[2,0],[40,0],[58,0],[61,3],[59,3],[62,0],[80,0],[80,20],[-20,20]];
for(let rotation=0;rotation<twoCurls.length;rotation++) {
 const points=twoCurls.slice(rotation).concat(twoCurls.slice(0,rotation)),s=state([poly(points)]);
 assert.equal(s.crossings.length,2);const other=s.crossings.find(x=>x.x>40);other.over=1;
 const originalOver=other.occ[other.over].u;
 const u=points.findIndex(p=>p[0]===1&&p[1]===3)/points.length;
 assert(KC.loosenR1(s,{component:0,u,radius:10,maxLoopLength:120}));
 assert.equal(s.crossings.length,1);assert.equal(s.crossings[0].id,other.id);
 assert(KC.circD(s.crossings[0].occ[s.crossings[0].over].u,originalOver)<1e-6);
}
console.log('Local R1 preserves other crossings on the same component across cyclic seams: PASS');

// Subpixel crossings on grid boundaries must survive resampling and movement.
for(const h of [.001,1e-7])for(const offset of [0,24,-24,.37]) {
 const cm=[kink(-h),bar()];cm.forEach(c=>{c.pts.forEach(p=>{p.x+=offset;p.y+=offset});KC.updateGeom(c)});
 const s=state(cm);assert.equal(s.crossings.length,2);s.crossings[0].over=1-s.crossings[0].over;
 const ids=s.crossings.map(x=>[x.id,x.over]);
 assert(KC.attemptStep(s,()=>{},{}).ok);
 const r=KC.attemptStep(s,c=>KC.moveWeighted(c[0],KC.indexOfU(c[0],2/7),0,-2.5,40),{});
 assert(r.ok,'A crowded non-R2 bigon must be able to open');assert.equal(s.crossings.length,2);
 assert.deepEqual(s.crossings.map(x=>[x.id,x.over]).sort(),ids.sort());assert.deepEqual(r.ev,{r1:0,r2:0,r3:0});
}
for(const scale of [1,.1,.01,.001])for(let j=0;j<40;j++) {
 const cm=[kink(-.01),bar()];cm.forEach(c=>{c.pts.forEach(p=>{p.x=p.x*scale+j*.37;p.y=p.y*scale+j*.37});KC.updateGeom(c)});
 const s=state(cm);assert.equal(s.crossings.length,2);
 const r=KC.attemptStep(s,c=>c.forEach(c=>c.pts.forEach(p=>{p.x+=1.4;p.y+=.37})),{});
 assert(r.ok);assert.equal(s.crossings.length,2);assert.deepEqual(r.ev,{r1:0,r2:0,r3:0});
}
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
console.log('Crowded crossing escape, grid-boundary translations, relaxation smoothness and invariants: PASS');

// Repeated relaxation must not grow the point count without bound: periodic
// compaction (compactStep) rebuilds each component back to even spacing.
{
 const s=KC.fromCurves3D([KC.figureEightCurve()],440);
 const countOf=()=>s.comps.reduce((a,c)=>a+c.pts.length,0);
 const initial=countOf();
 for(let round=0;round<5;round++){
  for(let i=0;i<150;i++){
   const r=KC.relaxStep(s);if(!r.ok)break;
   if((i+1)%30===0)KC.compactStep(s);
  }
  KC.compactStep(s);
 }
 assert(countOf()<initial*1.5,'Point count must stay bounded across repeated relax runs, not grow every round');
}
console.log('Repeated auto-relax does not grow the point count without bound: PASS');

// Auto-relax carries no size or distance floor at all: only real topology
// (reconcile) gates a step, same as a plain attemptStep.
{
 const smallLens=h=>poly([[-40,0],[-h,-h/4],[0,-h],[h,-h/4],[40,0],[40,40],[-40,40]]);
 const mkAlternating=()=>{const s=state([smallLens(20),bar()]);s.crossings[0].over=1-s.crossings[0].over;return s;};
 assert(KC.relaxStep(mkAlternating()).ok,'Auto-relax is unrestricted by anything but topology');
}
console.log('Auto-relax is unrestricted by anything but topology: PASS');

// A curve vertex landing exactly on another strand without crossing to the
// other side (a tangential touch) must not register a false crossing; a
// genuine transversal dip through the same point still must.
{
 const A=poly([[-200,0],[-50,0],[0,0],[50,0],[200,0],[200,50],[-200,50]]);
 const touch=poly([[-200,-200],[-50,-200],[-5,-200],[0,0],[5,-200],[50,-200],[200,-200],[200,-250],[-200,-250]]);
 assert.equal(KC.computeRaw([A,touch]).length,0,'A tangential touch must not create a crossing');
 const dip=poly([[-200,-200],[-50,-200],[-5,-200],[0,0.5],[5,-200],[50,-200],[200,-200],[200,-250],[-200,-250]]);
 assert.equal(KC.computeRaw([A,dip]).length,2,'A genuine dip through the same point must still cross');
}
console.log('Tangential vertex touches are not counted as crossings; genuine dips still are: PASS');

// Performance: dragging skips backup-cloning and resampling for components
// the mutator declares it won't touch (opt.touchedComps) — a pure
// bookkeeping shortcut that must produce byte-for-byte the same outcome as
// the unoptimized path, for both a step that succeeds and one that a
// smaller component's topology blocks.
{
 const build=()=>{
  const t=altTrefoil();
  // Pre-resampled to SEG spacing, matching how every real component (drawn,
  // imported or template) already looks by the time a drag can touch it —
  // an untouched component is only ever skipped, never left needing a fix
  // resampleComp would otherwise have applied to it regardless.
  const squareCorners=[[2000,2000],[2020,2000],[2020,2020],[2000,2020]].map(([x,y])=>({x,y}));
  const other=poly(KC.resampleClosed(squareCorners,KC.SEG).map(p=>[p.x,p.y]));
  const comps=[...t.comps,other];
  const raw=KC.computeRaw(comps);raw.forEach((x,i)=>{x.id=i+1;x.over=i%2;});
  return {comps,crossings:raw,nextId:raw.length+1};
 };
 const mkOpt=(c,touched)=>({
  weight:o=>0,
  nextId:(()=>{let n=1000;return ()=>n++;})(),
  ...(touched?{touchedComps:[c]}:{})
 });
 const dragMutator=(c,u,dx,dy,sig)=>comps=>{const cm=comps[c],gi=KC.indexOfU(cm,u);KC.moveWeighted(cm,gi,dx,dy,sig,u);};

 // A move with room to succeed.
 {
  const withHint=build(), without=build();
  const r1=KC.attemptStep(withHint,dragMutator(0,0.1,1.2,0.6,40),mkOpt(0,true));
  const r2=KC.attemptStep(without,dragMutator(0,0.1,1.2,0.6,40),mkOpt(0,false));
  assert.equal(r1.ok,r2.ok);assert.deepEqual(r1.ev,r2.ev);
  assert.deepEqual(withHint.comps,without.comps,'touchedComps must not change the resulting geometry');
  assert.deepEqual(withHint.crossings,without.crossings,'touchedComps must not change the resulting crossings');
 }
 // A move an invalid R2 height order blocks outright.
 {
  const withHint=build(), without=build();
  withHint.crossings[0].over=1-withHint.crossings[0].over;
  without.crossings[0].over=1-without.crossings[0].over;
  const mutate=(c,u,sig)=>comps=>{const cm=comps[c],gi=KC.indexOfU(cm,u);KC.moveWeighted(cm,gi,0,2.2,sig,u);};
  const r1=KC.attemptStep(withHint,mutate(0,0.02,10),mkOpt(0,true));
  const r2=KC.attemptStep(without,mutate(0,0.02,10),mkOpt(0,false));
  assert.equal(r1.ok,r2.ok);
  assert.deepEqual(withHint.comps,without.comps,'touchedComps must not change a blocked outcome');
  assert.deepEqual(withHint.crossings,without.crossings,'touchedComps must not change a blocked outcome');
 }
}
console.log('touchedComps drag shortcuts match the unoptimized path exactly: PASS');
