// Compare identical validated local movements against another core revision.
// BASELINE_CORE is a saved knot-core.js; KNOT_FIXTURE is optional native JSON.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
if(!process.env.BASELINE_CORE)throw Error('Set BASELINE_CORE to the baseline knot-core.js path');
const data=process.env.KNOT_FIXTURE?JSON.parse(fs.readFileSync(process.env.KNOT_FIXTURE,'utf8')):null;
function run(file){
 const K=new Function(fs.readFileSync(file,'utf8')+'\nreturn KC;')();
 let S;
 if(data){
  assert(!data.open?.length,'Use a closed diagram for the core benchmark');
  const comps=data.comps.map(pts=>{const cm={pts:pts.map(([x,y],i)=>({x,y,u:i/pts.length}))};K.updateGeom(cm);return cm;});
  const crossings=K.computeRaw(comps);
  crossings.forEach((x,i)=>{
   x.id=i+1;const saved=data.crossings.reduce((best,m)=>!best||Math.hypot(m[0]-x.x,m[1]-x.y)<Math.hypot(best[0]-x.x,best[1]-x.y)?m:best,null);
   assert(saved&&Math.hypot(saved[0]-x.x,saved[1]-x.y)<.01,'Saved crossing must match the projection');
   const costs=x.occ.map(o=>Math.abs(o.dx*saved[3]-o.dy*saved[2]));x.over=costs[0]<=costs[1]?0:1;
  });
  S={comps,crossings,nextId:crossings.length+1};
 }else S=K.fromCurves3D([K.torusCurve(9,11,2,1.15)],1100);
 const before=K.analyze(S.comps,S.crossings),times=[],events=[];let u=S.comps[0].pts[Math.min(100,S.comps[0].pts.length-1)].u;
 for(let step=0;step<360;step++){
  const t=performance.now();
  const result=K.attemptStep(S,comps=>{
   const cm=comps[0],i=K.indexOfU(cm,u);K.moveWeighted(cm,i,step<180?.35:-.35,.1,60);
   const s=cm.cum[i];K.smoothCorners(cm.pts,true,{angle:.5,iters:1,strength:.5,mask:j=>K.sDist(cm,cm.cum[j],s)<180?1:0});
  },{under:false,weight:o=>{if(o.c!==0)return 0;const cm=S.comps[0],d=K.sDist(cm,o.s,K.arcPosOfU(cm,u));return Math.exp(-d*d/(2*60*60));}});
  times.push(performance.now()-t);events.push(result);u=S.comps[0].pts[K.indexOfU(S.comps[0],u)].u;
 }
 times.sort((a,b)=>a-b);
 return {state:S,events,analysis:{c:before.c,sA:before.sA.count,sB:before.sB.count,gT:before.gT},timing:{median:times[180],p95:times[342],total:times.reduce((a,b)=>a+b,0)}};
}
const baseline=run(process.env.BASELINE_CORE),optimized=run(path.join(__dirname,'../dist/knot-core.js'));
assert.deepEqual(optimized.state,baseline.state,'Same inputs must produce exactly the same final geometry, crossings and IDs');
assert.deepEqual(optimized.events,baseline.events,'Every accepted/blocked step and R-event must match');
console.log(JSON.stringify({initial:baseline.analysis,baseline:baseline.timing,optimized:optimized.timing,identicalSteps:360},null,2));
