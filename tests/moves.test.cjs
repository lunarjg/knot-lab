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
