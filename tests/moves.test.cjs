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
const maximumTurn=comps=>Math.max(...comps.flatMap(c=>c.pts.map((p,i,a)=>{
 const prev=a[(i+a.length-1)%a.length],next=a[(i+1)%a.length],ux=p.x-prev.x,uy=p.y-prev.y,vx=next.x-p.x,vy=next.y-p.y;
 return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy));
})));
const Inv=require('../dist/invariants.js');
for(const s of [altTrefoil(),KC.fromCurves3D([KC.torusCurve(2,3,2,1)],440),KC.fromCurves3D([KC.figureEightCurve()],440)]) {
 const before=Inv.calculate(KC.analyze(s.comps,s.crossings));
 for(let i=0;i<300;i++){const r=KC.relaxStep(s);if(!r.ok)break;}
 assert(maximumTurn(s.comps)<.5,'Repeated relaxation must not introduce sharp corners');
 assert.deepEqual(Inv.calculate(KC.analyze(s.comps,s.crossings)),before,'Relaxation must preserve knot invariants');
}
console.log('Crowded crossing escape, grid-boundary translations, adaptive steps, relaxation smoothness and invariants: PASS');

// Auto-relax must forward its clearance argument into the same default
// floor used while dragging, so a configuration that would squeeze
// crossings closer than the floor is refused rather than applied.
{
 const smallLens=h=>poly([[-40,0],[-h,-h/4],[0,-h],[h,-h/4],[40,0],[40,40],[-40,40]]);
 const mkAlternating=()=>{const s=state([smallLens(20),bar()]);s.crossings[0].over=1-s.crossings[0].over;return s;};
 assert(KC.relaxStep(mkAlternating()).ok,'Auto-relax without a clearance argument is unrestricted');
 const r=KC.relaxStep(mkAlternating(),1000);
 assert(!r.ok&&r.reason==='clearance','Auto-relax must refuse a step that would violate its clearance floor');
}
console.log('Auto-relax respects the default crossing clearance floor: PASS');

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
