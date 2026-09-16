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
const lens=h=>state(lensCoords(h).map(poly));
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
 const r=KC.attemptStep(s,cm=>{cm[0].pts[2].y=2/zoom;cm[1].pts[2].y=-2/zoom;},{faceLimits:{bigon:{area:400/zoom**2,thickness:8/zoom,separation:16/zoom}}});
 assert.equal(r.reason,'bigon');
}
const scaledCurl=()=>state([poly([[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[x*20,y*20]))]);
const kinkState=scaledCurl(),kinkBefore=JSON.stringify(kinkState);
assert(KC.smallFaces(kinkState.comps,kinkState.crossings).some(f=>f.type==='kink'&&Math.abs(f.area-400)<1e-7));
const flattenKink=cm=>cm[0].pts.forEach(p=>p.y*=.1);
assert.equal(KC.attemptStep(kinkState,flattenKink,{faceLimits}).reason,'kink');assert.equal(JSON.stringify(kinkState),kinkBefore);
const kinkDisabled=scaledCurl();assert(KC.attemptStep(kinkDisabled,flattenKink,{faceLimits:{bigon:faceLimits.bigon}}).ok);
const born=state([flat]),bornBefore=JSON.stringify(born);
assert.equal(KC.attemptStep(born,cm=>{cm[0].pts=curled.pts.map(p=>({...p}));},{faceLimits}).reason,'kink');assert.equal(JSON.stringify(born),bornBefore,'Rejected kink birth must preserve IDs');
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
