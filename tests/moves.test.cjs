const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('dist/index.html','utf8').match(/<script>\s*(\/\/ ===== Knot core[\s\S]*?)<\/script>/)[1];vm.runInThisContext(src+'\nglobalThis.KC=KC;');
const poly=a=>{const cm={pts:a.map(([x,y],i)=>({x,y,u:i/a.length}))};KC.updateGeom(cm);return cm};
function fixture(t){return [[[-100,-100],[100,100],[300,-300]],[[-100,100],[100,-100],[-300,-300]],[[-100,t],[100,t],[100,300],[-100,300]]].map(poly)}
function state(cm,cyclic=false){const crossings=KC.computeRaw(cm);crossings.forEach((x,i)=>{x.id=i+1;const [a,b]=x.occ.map(o=>o.c);x.over=a<b?0:1;if(cyclic&&Math.min(a,b)===0&&Math.max(a,b)===2)x.over=1-x.over;});return {comps:cm,crossings,nextId:crossings.length+1}}
const totals={r1:0,r2:0,r3:0};const S=state(fixture(-1));
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

// Drag spacing is transactional and checks the swept path, not just endpoints.
const moveBottom = y => cm => { cm[2].pts[0].y=y;cm[2].pts[1].y=y; };
const spaced=state(fixture(-30)),spacedBefore=JSON.stringify(spaced);
const crowded=KC.attemptStep(spaced,moveBottom(-5),{minCrossingDistance:20});
assert.equal(crowded.ok,false);assert.equal(crowded.reason,'spacing');
assert.equal(JSON.stringify(spaced),spacedBefore,'Rejected drag must preserve geometry, crossings and next ID');
const jump=state(fixture(-30)),jumpBefore=JSON.stringify(jump);
const crossed=KC.attemptStep(jump,moveBottom(30),{minCrossingDistance:20});
assert.equal(crossed.ok,false);assert.equal(crossed.reason,'spacing');assert.equal(JSON.stringify(jump),jumpBefore);
const dense=state(fixture(-5));
assert(KC.attemptStep(dense,moveBottom(-10),{minCrossingDistance:20}).ok,'Dense diagrams must be able to spread out');
const unchanged=state(fixture(-5));
assert(KC.attemptStep(unchanged,()=>{},{minCrossingDistance:20}).ok,'Existing density must not block no-op steps');
const unrestricted=state(fixture(-30));
const allowed=KC.attemptStep(unrestricted,moveBottom(30),{minCrossingDistance:0});
assert(allowed.ok);assert.equal(allowed.ev.r3,1,'Turning spacing off must preserve R3 classification');
const birthState=state([kink(.5),bar()]),birthBefore=JSON.stringify(birthState);
const closeBirth=KC.attemptStep(birthState,cm=>{cm[0].pts[2].y=-1},{minCrossingDistance:20});
assert.equal(closeBirth.reason,'spacing');assert.equal(JSON.stringify(birthState),birthBefore,'Rejected new crossings must not consume IDs');
console.log('Crossing spacing, swept collision, rollback, dense-diagram recovery and unrestricted R3: PASS');

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
