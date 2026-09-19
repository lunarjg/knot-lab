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

// Only monogons and bigons are protected: a nearby R3 triangle remains free.
const moveBottom = y => cm => { cm[2].pts[0].y=y;cm[2].pts[1].y=y; };
const faceLimits={bigon:{area:400,thickness:8,separation:16},kink:{area:180,thickness:6}};
const triangle=state(fixture(-30));
assert.equal(KC.smallFaces(triangle.comps,triangle.crossings).length,0);
assert(KC.attemptStep(triangle,moveBottom(-5),{faceLimits}).ok,'Close crossings outside bigons/kinks must remain free');
const triple=state(fixture(-1));let r3Count=0;
for(const y of [0,1]) {const r=KC.attemptStep(triple,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=y}),{faceLimits});assert(r.ok);r3Count+=r.ev.r3;}
assert.equal(r3Count,1);
const trianglePass=state(fixture(-1));
const triangleMove=KC.attemptStep(trianglePass,moveBottom(1),{faceLimits});
assert(triangleMove.ok);assert.equal(triangleMove.ev.r3,1);

// The crossings of this lens stay 80 units apart while its curved area collapses.
const lensCoords=h=>[
 [[-80,-40],[-40,0],[0,h],[40,0],[80,-40],[80,-100],[-80,-100]],
 [[-80,40],[-40,0],[0,-h],[40,0],[80,40],[80,100],[-80,100]]
];
const lens=(h,alternating=true)=>{const s=state(lensCoords(h).map(poly));if(alternating)s.crossings[0].over=1-s.crossings[0].over;return s;};
const flattenLens=h=>cm=>{cm[0].pts[2].y=h;cm[1].pts[2].y=-h;};
const lensState=lens(20);assert.equal(lensState.crossings.length,2);
assert(KC.smallFaces(lensState.comps,lensState.crossings).some(f=>f.type==='bigon'&&Math.abs(f.area-1600)<1e-7));
const lensBefore=JSON.stringify(lensState);
const collapsed=KC.attemptStep(lensState,flattenLens(2),{faceLimits});
assert.equal(collapsed.reason,'bigon');assert.equal(JSON.stringify(lensState),lensBefore,'Rejected bigon squeeze must roll back');
const almostFlat=lens(20);assert.equal(KC.attemptStep(almostFlat,flattenLens(1e-10),{faceLimits}).reason,'bigon');
const wide=lens(20);assert(KC.attemptStep(wide,flattenLens(12),{faceLimits}).ok);
const disabled=lens(20);assert(KC.attemptStep(disabled,flattenLens(2),{faceLimits:{kink:faceLimits.kink}}).ok,'Bigon toggle must act independently');
const narrow=lens(1);assert(KC.attemptStep(narrow,flattenLens(2),{faceLimits}).ok,'Small imported bigons must be able to expand');
const shrinking=lens(1),shrinkingBefore=JSON.stringify(shrinking);
assert.equal(KC.attemptStep(shrinking,flattenLens(.5),{faceLimits}).reason,'bigon');assert.equal(JSON.stringify(shrinking),shrinkingBefore);
// Sufficient area alone must not admit a long, thin bigon.
const thin=lens(20);const thinResult=KC.attemptStep(thin,flattenLens(6),{faceLimits});
assert.equal(thinResult.reason,'bigon','Area 480 passes the area floor but must fail thickness');
// Applying scale-aware world limits yields the same decision at every zoom.
for(const zoom of [.25,1,4]) {
 const coords=lensCoords(20).map(p=>p.map(([x,y])=>[x/zoom,y/zoom]));const s=state(coords.map(poly));
 s.crossings[0].over=1-s.crossings[0].over;
 const r=KC.attemptStep(s,cm=>{cm[0].pts[2].y=2/zoom;cm[1].pts[2].y=-2/zoom;},{faceLimits:{bigon:{area:400/zoom**2,thickness:8/zoom,separation:16/zoom}}});
 assert.equal(r.reason,'bigon');
}
// The identical geometry must shrink without any size floor for either R2 height order.
for(const mirror of [false,true])for(const h of [2,6,1e-10]) {
 const s=lens(20,false);if(mirror)s.crossings.forEach(x=>x.over=1-x.over);
 assert(KC.smallFaces(s.comps,s.crossings).every(f=>!f.alternating));
 const r=KC.attemptStep(s,flattenLens(h),{faceLimits});assert(r.ok);assert.equal(r.ev.r2,0);
 assert(KC.smallFaces(s.comps,s.crossings).some(f=>f.type==='bigon'&&f.area<500));
}
// A tiny R2 bigon can shrink, disappear, and reappear with protection enabled.
const closeR2=lens(20,false);
assert(KC.attemptStep(closeR2,cm=>cm.forEach(c=>c.pts.forEach(p=>{p.x*=.1;p.y*=.1;})),{faceLimits}).ok);
assert(KC.smallFaces(closeR2.comps,closeR2.crossings).some(f=>f.type==='bigon'&&f.separation<16));
for(const mirror of [false,true]) {
 const s=state([kink(-1),bar()]);if(mirror)s.crossings.forEach(x=>x.over=1-x.over);
 const shrink=KC.attemptStep(s,cm=>{cm[0].pts=kink(-.2).pts;},{faceLimits});assert(shrink.ok);
 const gone=KC.attemptStep(s,cm=>{cm[0].pts=kink(.5).pts;},{faceLimits});assert(gone.ok);assert.equal(gone.ev.r2,1);assert.equal(s.crossings.length,0);
 const back=KC.attemptStep(s,cm=>{cm[0].pts=kink(-.2).pts;},{faceLimits});assert(back.ok);assert.equal(back.ev.r2,1);assert.equal(s.crossings.length,2);
}
const invalidR2=state([kink(-1),bar()]);invalidR2.crossings[0].over=1-invalidR2.crossings[0].over;
const invalidBefore=JSON.stringify(invalidR2);
assert.equal(KC.attemptStep(invalidR2,cm=>{cm[0].pts=kink(.5).pts;},{faceLimits}).reason,'R2');
assert.equal(JSON.stringify(invalidR2),invalidBefore);
// Both boundary strands may belong to one component; component identity is not height.
for(const alternating of [false,true]) {
 const s=state([poly([[-80,-40],[-40,0],[0,20],[40,0],[80,-40],[120,-40],[120,40],[80,40],[40,0],[0,-20],[-40,0],[-80,40],[-120,40],[-120,-40]])]);
 assert.equal(s.crossings.length,2);
 for(const x of s.crossings)x.over=x.occ.findIndex(o=>o.u<5/14);
 if(alternating)s.crossings[0].over=1-s.crossings[0].over;
 const faces=KC.smallFaces(s.comps,s.crossings).filter(f=>f.type==='bigon');assert.equal(faces.length,1);assert.equal(faces[0].alternating,alternating);
 const r=KC.attemptStep(s,cm=>cm[0].pts.forEach(p=>{if(p.x===0)p.y*=.1;}),{faceLimits});assert.equal(r.ok,!alternating);
}
// Over/under classification is independent of occurrence order and polyline seams.
for(const reverse of [false,true])for(const shift of [0,2,5])for(const alternating of [false,true]) {
 const coords=lensCoords(20).map(ps=>{ps=reverse?[...ps].reverse():ps;return ps.slice(shift).concat(ps.slice(0,shift));});
 const s=state(coords.map(poly));if(alternating)s.crossings[0].over=1-s.crossings[0].over;
 for(const x of s.crossings){x.occ.reverse();x.over=1-x.over;}
 const faces=KC.smallFaces(s.comps,s.crossings).filter(f=>f.type==='bigon');assert(faces.length);assert(faces.every(f=>f.alternating===alternating));
 const r=KC.attemptStep(s,cm=>cm.forEach(c=>c.pts.forEach(p=>{if(p.x===0)p.y*=.1;})),{faceLimits});
 assert.equal(r.ok,!alternating);if(alternating)assert.equal(r.reason,'bigon');
}
const scaledCurl=()=>state([poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[x*20,y*20]))]);
const kinkState=scaledCurl(),kinkBefore=JSON.stringify(kinkState);
assert(KC.smallFaces(kinkState.comps,kinkState.crossings).some(f=>f.type==='kink'&&Math.abs(f.area-400)<1e-7));
const flattenKink=cm=>cm[0].pts.forEach(p=>p.y*=.1);
assert.equal(KC.attemptStep(kinkState,flattenKink,{faceLimits}).reason,'kink');assert.equal(JSON.stringify(kinkState),kinkBefore);
const kinkDisabled=scaledCurl();assert(KC.attemptStep(kinkDisabled,flattenKink,{faceLimits:{bigon:faceLimits.bigon}}).ok);
for(const under of [false,true]) {
 const born=state(KC.cloneComps([flat]));
 const r=KC.attemptStep(born,cm=>{cm[0].pts=curled.pts.map(p=>({...p}));},{faceLimits,under,weight:o=>o.u<.3?1:0});
 assert(r.ok,'A valid R1 self-crossing must be allowed to start below the size floor');assert.equal(r.ev.r1,1);assert.equal(born.crossings.length,1);assert.equal(born.nextId,2);
 assert(KC.smallFaces(born.comps,born.crossings).some(f=>f.type==='kink'&&f.area<180));
 assert.equal(KC.loosenR1(born,{component:0,u:2/8,radius:60,maxLoopLength:120,eligibleIds:new Set()}),null,'Do not immediately erase a newly created self-crossing');
 const grow=KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=2;}),{faceLimits});assert(grow.ok);assert.equal(grow.ev.r1,0);
 const protectedBefore=JSON.stringify(born);
 assert.equal(KC.attemptStep(born,cm=>cm[0].pts.forEach(p=>{p.y*=.5;}),{faceLimits}).reason,'kink');assert.equal(JSON.stringify(born),protectedBefore);
}
// Face detection must not depend on orientation or the cyclic polyline seam.
for(const reverse of [false,true])for(let shift=0;shift<8;shift++) {
 let pts=[[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]];
 if(reverse)pts.reverse();pts=pts.slice(shift).concat(pts.slice(0,shift));
 const s=state([poly(pts)]),faces=KC.smallFaces(s.comps,s.crossings);
 assert.equal(faces.length,1);assert.equal(faces[0].type,'kink');assert(Math.abs(faces[0].area-1)<1e-8);
}
console.log('Bigon/kink area, thinness, independent toggles, curved boundaries, zoom, rollback and unrestricted R3: PASS');

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
// A coarse step can overshoot a narrow valid region; take its valid prefix.
{
 const s=state([kink(-.1),bar()]);s.crossings[0].over=1-s.crossings[0].over;
 const mutate=(cm,scale)=>KC.moveWeighted(cm[0],KC.indexOfU(cm[0],2/7),0,2.5*scale,40);
 assert(!KC.attemptStep(s,c=>mutate(c,1),{}).ok);
 assert(KC.adaptiveStep(s,mutate,{}).ok);assert.equal(s.crossings.length,2);
}
// Arc-length integration should not amplify forces when vertices are subdivided.
{
 const cm=KC.fromCurves3D([KC.figureEightCurve()],440).comps, dense=KC.cloneComps(cm);
 dense.forEach(c=>{c.pts=c.pts.flatMap((a,i,pts)=>{const b=pts[(i+1)%pts.length];return [a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,u:(a.u+((b.u-a.u+1)%1)/2)%1}]});KC.updateGeom(c)});
 KC.relaxMutator(cm,40,1);KC.relaxMutator(dense,40,1);
 cm.forEach((c,k)=>c.pts.forEach((p,i)=>assert(Math.hypot(p.x-dense[k].pts[2*i].x,p.y-dense[k].pts[2*i].y)<.025)));
}
const maximumTurn=comps=>Math.max(...comps.flatMap(c=>c.pts.map((p,i,a)=>{
 const prev=a[(i+a.length-1)%a.length],next=a[(i+1)%a.length],ux=p.x-prev.x,uy=p.y-prev.y,vx=next.x-p.x,vy=next.y-p.y;
 return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy));
})));
const Inv=require('../dist/invariants.js');
for(const s of [altTrefoil(),KC.fromCurves3D([KC.torusCurve(2,3,2,1)],440),KC.fromCurves3D([KC.figureEightCurve()],440)]) {
 const before=Inv.calculate(KC.analyze(s.comps,s.crossings));
 for(let i=0;i<300;i++){const r=KC.relaxStep(s);if(!r.ok)break;}
 assert(maximumTurn(s.comps)<.16,'Repeated relaxation must not introduce sharp corners');
 assert.deepEqual(Inv.calculate(KC.analyze(s.comps,s.crossings)),before,'Relaxation must preserve knot invariants');
}
console.log('Crowded crossing escape, grid-boundary translations, adaptive steps, sampling-independent relaxation, smoothness and invariants: PASS');

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

// Auto-relax keeps its clearance floor live (unlike a human-directed drag,
// it is an undirected force simulation, and letting it run unconstrained
// measurably makes the curve MORE angular near a converging cluster before
// eventually hitting a real topology block anyway). Without a clearance
// argument it is unrestricted, same as a plain attemptStep.
{
 const smallLens=h=>poly([[-40,0],[-h,-h/4],[0,-h],[h,-h/4],[40,0],[40,40],[-40,40]]);
 const mkAlternating=()=>{const s=state([smallLens(20),bar()]);s.crossings[0].over=1-s.crossings[0].over;return s;};
 assert(KC.relaxStep(mkAlternating()).ok,'Auto-relax without a clearance argument is unrestricted');
}
console.log('Auto-relax without a clearance argument is unrestricted: PASS');

// separateCrowdedCrossings generalizes the old bigon-only release nudge to
// any pair of crossings a gesture left crowded — including a non-bigon
// triangle (three or more arcs converging), not just a two-crossing bigon.
{
 const distsOf=X=>{const m=new Map();for(let i=0;i<X.length;i++)for(let j=i+1;j<X.length;j++){
  const a=X[i],b=X[j];m.set([a.id,b.id].sort((x,y)=>x-y).join(':'),Math.hypot(a.x-b.x,a.y-b.y));
 }return m;};
 const squeeze=cm=>{cm[2].pts[0].y=-10;cm[2].pts[1].y=-10;};

 const triangle=state(fixture(-30));
 assert.equal(KC.smallFaces(triangle.comps,triangle.crossings).length,0,'Not a bigon: a genuine set of unrelated crossings');
 const distsAtStart=distsOf(triangle.crossings);
 // Squeeze two of them together well past the clearance floor — allowed
 // now that there is no live clearance check, mirroring what a drag or
 // relax run could do to them.
 assert(KC.attemptStep(triangle,squeeze,{}).ok);
 let anyCrowded=false;
 for(let i=0;i<triangle.crossings.length;i++)for(let j=i+1;j<triangle.crossings.length;j++){
  const a=triangle.crossings[i],b=triangle.crossings[j];
  if(Math.hypot(a.x-b.x,a.y-b.y)<32)anyCrowded=true;
 }
 assert(anyCrowded,'Setup must have actually crowded at least one pair of crossings');
 const sep=KC.separateCrowdedCrossings(triangle,{clearance:32,before:distsAtStart});
 assert(sep,'A crowded non-bigon triangle must be spread apart, not left as-is');
 for(let i=0;i<triangle.crossings.length;i++)for(let j=i+1;j<triangle.crossings.length;j++){
  const a=triangle.crossings[i],b=triangle.crossings[j];
  assert(Math.hypot(a.x-b.x,a.y-b.y)>=32-1e-6,'Every pair must be spread back out to the clearance floor');
 }

 // A pair already this close before the gesture started (e.g. an imported
 // diagram) must be left alone, matching the old bigon-only leniency: only
 // pairs the gesture itself tightened get nudged apart.
 const already=state(fixture(-30));
 assert(KC.attemptStep(already,squeeze,{}).ok);
 const distsAlreadyTight=distsOf(already.crossings);
 const tightBefore=JSON.stringify(already.crossings);
 assert.equal(KC.separateCrowdedCrossings(already,{clearance:32,before:distsAlreadyTight}),null,
  'A pair no closer than it was at the start of this snapshot must be left untouched');
 assert.equal(JSON.stringify(already.crossings),tightBefore);
}
console.log('separateCrowdedCrossings generalizes release-time separation beyond bigons: PASS');

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

// A default clearance floor (independent of the optional bigon/kink size
// protection) prevents three or more crossings from collapsing together
// when no single Reidemeister move actually resolves them, while leaving
// genuine R2-birth bigons and R3's exact triple-point frame unrestricted.
{
 const moveBottom=y=>cm=>{cm[2].pts[0].y=y;cm[2].pts[1].y=y;};
 // Bringing an unrelated (non-bigon, non-R3-recognized) triangle of
 // crossings together must be blocked once it passes the clearance floor.
 const triangle=state(fixture(-30));
 assert.equal(KC.smallFaces(triangle.comps,triangle.crossings).length,0);
 const squeezed=KC.attemptStep(triangle,moveBottom(-5),{crossingClearance:16});
 assert(!squeezed.ok && squeezed.reason==='clearance','Non-resolvable crossing clusters must not overlap');

 // The user can always drag back away from a blocked position.
 const recovered=KC.attemptStep(triangle,()=>{},{crossingClearance:16});
 assert(recovered.ok);
 const away=KC.attemptStep(triangle,moveBottom(-30),{crossingClearance:16});
 assert(away.ok,'Dragging away from a blocked configuration must succeed');

 // A genuine R2-birth bigon (same strand over both new crossings) is exempt
 // and may shrink freely, matching the existing non-alternating bigon rule.
 const lens=h=>poly([[-40,0],[-h,-h/4],[0,-h],[h,-h/4],[40,0],[40,40],[-40,40]]);
 const bar=()=>poly([[-30,0],[30,0],[30,-20],[-30,-20]]);
 const lensState=state([lens(20),bar()]);
 const closeR2=state([lens(20),bar()]);
 assert(KC.attemptStep(closeR2,cm=>cm.forEach(c=>c.pts.forEach(p=>{p.x*=.1;p.y*=.1;})),{crossingClearance:16}).ok,
   'A genuine R2-birth bigon must remain free to shrink toward release');

 // The exact triple-point frame inside a valid R3 slide must not be blocked
 // merely because its crossings briefly coincide there.
 const triple=state(fixture(-1));
 const frame0=KC.attemptStep(triple,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=0;}),{crossingClearance:16});
 assert(frame0.ok,'A valid R3 exact triple-point frame must not be blocked by clearance');
 const frame1=KC.attemptStep(triple,cm=>cm[2].pts.forEach(p=>{if(p.y<2)p.y=1;}),{crossingClearance:16});
 assert(frame1.ok && frame1.ev.r3===1);
}
console.log('Default crossing clearance blocks non-resolvable clusters, allows recovery, R2-birth bigons and R3: PASS');

// relaxStep is exactly Codex's original adaptiveStep-based relax (verified
// against commit 82c9671) with one addition: a crossing-clearance floor
// passed through the same opt the interactive drag already used. Like the
// original, one relaxStep call mutates every component in a single atomic
// attemptStep — there is no per-component split — so once a region's
// remaining slack above the clearance floor drops below what even the
// smallest (1/64) retry scale would move it, that step correctly reports
// ok:false and leaves the whole diagram exactly as it was, including any
// unrelated component. That coupling is inherent to relaxStep's structure,
// not something this test works around; what it does check is that a
// permanently stuck region never dips the geometry below the clearance
// floor and never corrupts it, and that separateCrowdedCrossings can still
// run safely afterward.
{
 const maxTurn=cm=>{let mx=0;const p=cm.pts,n=p.length;for(let i=0;i<n;i++){
   const a=p[(i-1+n)%n],b=p[i],c=p[(i+1)%n],ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y,lu=Math.hypot(ux,uy),lv=Math.hypot(vx,vy);
   if(!lu||!lv)continue;
   mx=Math.max(mx,Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(lu*lv)))));
 }return mx;};
 // Component A: a minimal 3-crossing diagram squeezed small enough that it
 // hits the clearance floor almost immediately and stays stuck there.
 const crowded=altTrefoil();
 crowded.comps.forEach(c=>{c.pts.forEach(p=>{p.x*=.12;p.y*=.12;});c.pts=KC.resampleClosed(c.pts,KC.SEG);KC.updateGeom(c);});
 // Component B: a separate, distant, heavily kinked loop with room to smooth.
 const N=120,wob=[];
 for(let i=0;i<N;i++){const t=2*Math.PI*i/N,wig=25*Math.sin(23*t)+10*Math.sin(41*t+1);wob.push({x:3000+(300+wig)*Math.cos(t),y:3000+(300+wig)*Math.sin(t)});}
 const kinked={pts:KC.resampleClosed(wob,KC.SEG)};KC.updateGeom(kinked);
 const comps=[...crowded.comps,kinked];
 const raw=KC.computeRaw(comps);raw.forEach((x,i)=>{x.id=i+1;x.over=i%2;});
 const S={comps,crossings:raw,nextId:raw.length+1};
 const distsAtStart=(()=>{const m=new Map();for(let i=0;i<S.crossings.length;i++)for(let j=i+1;j<S.crossings.length;j++){const a=S.crossings[i],b=S.crossings[j];m.set([a.id,b.id].sort((x,y)=>x-y).join(':'),Math.hypot(a.x-b.x,a.y-b.y));}return m;})();
 let rejected=0,firstReject=-1;
 for(let i=0;i<300;i++){const r=KC.relaxStep(S,32);if(!r.ok){rejected++;if(firstReject<0)firstReject=i;}}
 assert(firstReject>=0&&firstReject<40,'The crowded component must reach the clearance floor quickly for this to be a meaningful test');
 assert(rejected>200,'A permanently stuck region must keep reporting the clearance rejection rather than silently drifting past the floor');
 for(let i=0;i<S.crossings.length;i++)for(let j=i+1;j<S.crossings.length;j++) {
   const a=S.crossings[i],b=S.crossings[j];
   assert(Math.hypot(a.x-b.x,a.y-b.y)+1e-6>=32,'No crossing pair may end up closer than the clearance floor, even after many stuck attempts');
 }
 assert(S.comps.every(cm=>cm.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),'A permanently stuck run must never corrupt the geometry');
 // A final separateCrowdedCrossings pass, matching what relaxFrames now
 // does once a run ends, must not error or blow up the geometry.
 KC.separateCrowdedCrossings(S,{clearance:32,before:distsAtStart});
 assert(S.comps.every(cm=>cm.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),'The final separation pass must not corrupt the geometry');
}
console.log('A permanently clearance-stuck region reports rejection and never breaches the floor, without corrupting the diagram: PASS');

// Performance: dragging skips backup-cloning, resampling and "before" face
// recomputation for components the mutator declares it won't touch
// (opt.touchedComps), and adaptiveStep computes the "before" face structure
// once per retry ladder instead of once per scale attempt. Both are pure
// bookkeeping shortcuts and must produce byte-for-byte the same outcome as
// the unoptimized path, for both a step that succeeds and one a smaller
// component elsewhere blocks.
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
 const mkOpt=(c,u,sig,touched)=>({
  faceLimits:{bigon:{area:400,thickness:8,separation:16},kink:{area:180,thickness:6}},
  crossingClearance:32,
  weight:o=>0,
  nextId:(()=>{let n=1000;return ()=>n++;})(),
  ...(touched?{touchedComps:[c]}:{})
 });
 const dragMutator=(c,u,dx,dy,sig)=>comps=>{const cm=comps[c],gi=KC.indexOfU(cm,u);KC.moveWeighted(cm,gi,dx,dy,sig,u);};

 // A move with room to succeed.
 {
  const withHint=build(), without=build();
  const r1=KC.attemptStep(withHint,dragMutator(0,0.1,1.2,0.6,40),mkOpt(0,0.1,40,true));
  const r2=KC.attemptStep(without,dragMutator(0,0.1,1.2,0.6,40),mkOpt(0,0.1,40,false));
  assert.equal(r1.ok,r2.ok);assert.deepEqual(r1.ev,r2.ev);
  assert.deepEqual(withHint.comps,without.comps,'touchedComps must not change the resulting geometry');
  assert.deepEqual(withHint.crossings,without.crossings,'touchedComps must not change the resulting crossings');
 }
 // A move squeezed enough to hit the clearance floor and be rejected,
 // exercising adaptiveStep's full retry ladder (and its beforeFaces reuse).
 {
  const withHint=build(), without=build();
  const mutate=(c,u,sig)=>(comps,scale)=>{const cm=comps[c],gi=KC.indexOfU(cm,u);KC.moveWeighted(cm,gi,0,2.2*scale,sig,u);};
  const r1=KC.adaptiveStep(withHint,mutate(0,0.02,10),mkOpt(0,0.02,10,true));
  const r2=KC.adaptiveStep(without,mutate(0,0.02,10),mkOpt(0,0.02,10,false));
  assert.equal(r1.ok,r2.ok);
  assert.deepEqual(withHint.comps,without.comps,'touchedComps must not change a blocked outcome');
  assert.deepEqual(withHint.crossings,without.crossings,'touchedComps must not change a blocked outcome');
 }
}
console.log('touchedComps/beforeFaces drag shortcuts match the unoptimized path exactly: PASS');
