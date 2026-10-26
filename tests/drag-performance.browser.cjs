// Optional, local-only Chrome benchmark. See docs/drag-performance.md.
// CHECK_ROOT points at another checkout's dist directory; KNOT_FIXTURE supplies a native JSON.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(process.env.CHECK_ROOT||path.join(__dirname,'../dist'));
const fixture=process.env.KNOT_FIXTURE?JSON.parse(fs.readFileSync(process.env.KNOT_FIXTURE,'utf8')):null;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');
 // Read-only access to the actual grip, scoped to this test server. Production
 // code exposes no scheduler or profiling hooks. Use the same hook on baseline.
 let body=fs.readFileSync(p);
 if(p.endsWith('index.html'))body=body.toString().replace(/function tick\(([^)]*)\) \{([\s\S]*?)\n  \}/,(_,params,code)=>`function tick(${params}) { const start=performance.now(), before=window.__steps.length; try {${code} } finally {if(window.__steps.length>before)window.__frames.push(performance.now()-start);}\n  }`).replace('window.knotLab = {',`window.__readDrag = () => {
   if (!drag) return null;
   const cm = S.comps[drag.c], p = cm.pts[KC.indexOfU(cm, drag.u)];
   return {x:p.x,y:p.y,mx:drag.mx,my:drag.my,blocked:drag.lastBlocked,distance:Math.hypot(p.x-drag.mx,p.y-drag.my)};
 }; window.knotLab = {`).replace('if (drag.changed) { separateCrowdedCrossings', 'window.__releaseGrip = window.__readDrag(); if (drag.changed) { separateCrowdedCrossings');
 res.end(body);
});
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__frames=[];window.__steps=[];window.__rafIntervals=[];window.__run=0;
  });
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.knotLab);
  const metadata=await page.evaluate(fixture=>{
   const state=fixture?knotLab.deserialize(fixture):KC.fromCurves3D([KC.torusCurve(9,11,2,1.15)],1100);
   knotLab.openTab(state,'Drag performance');window.__fixture=knotLab.serialize();
   const original=KC.attemptStep;KC.attemptStep=(...args)=>{const start=performance.now(),r=original(...args);window.__steps.push({ms:performance.now()-start,ok:r.ok,continuous:!!args[2]?.continuous,reason:r.reason});return r;};
   window.__reset=()=>{
    knotLab.openTab(knotLab.deserialize(window.__fixture),'Drag sample');
    document.querySelector('[data-tool="move"]').click();knotLab.opts.separate=false;
    const p=knotLab.state.comps[0].pts[Math.min(100,knotLab.state.comps[0].pts.length-1)],cv=document.getElementById('cv'),r=cv.getBoundingClientRect();
    // Capture scalar coordinates: point objects move in place during the drag.
    const ox=p.x,oy=p.y;window.__event=(type,dx=0,dy=0)=>cv.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'mouse',pointerId:1,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+(ox+dx)*knotLab.view.s+knotLab.view.ox,clientY:r.top+(oy+dy)*knotLab.view.s+knotLab.view.oy}));
    window.__frames=[];window.__steps=[];window.__rafIntervals=[];window.__releaseGrip=null;window.__event('pointerdown');
    const run=++window.__run;let last;const watch=t=>{if(run!==window.__run||!window.__readDrag())return;if(last!==undefined)window.__rafIntervals.push(t-last);last=t;requestAnimationFrame(watch);};requestAnimationFrame(watch);
   };
   window.__stats=()=>{const stats=a=>{a.sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)]??0,p95:a[Math.floor(a.length*.95)]??0,max:a.at(-1)??0};};return {tasks:stats([...window.__frames]),rafIntervals:stats([...window.__rafIntervals]),steps:stats(window.__steps.map(x=>x.ms)),accepted:window.__steps.filter(x=>x.ok).length,rejected:window.__steps.filter(x=>!x.ok).length,certified:window.__steps.filter(x=>x.ok&&x.continuous).length,subdivisions:window.__steps.filter(x=>x.reason==='subdivide').length};};
   return {crossings:knotLab.analysis.c,points:knotLab.state.comps.reduce((n,c)=>n+c.pts.length,0),components:knotLab.state.comps.length};
  },fixture);
  // Let layout and initialization settle before timing input.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const fixed=await page.evaluate(async()=>{
   window.__reset();const start=performance.now();window.__event('pointermove',180,0);
   await new Promise((resolve,reject)=>{const poll=()=>{const d=window.__readDrag();if(d.distance<.8||d.blocked)return resolve();if(performance.now()-start>10000)return reject(Error('Drag did not settle'));requestAnimationFrame(poll);};requestAnimationFrame(poll);});
   const elapsed=performance.now()-start,grip=window.__readDrag(),stats=window.__stats(),geometry=knotLab.serialize().comps;
   window.__event('pointerup',180,0);return {elapsed,grip,stats,geometry};
  });
  fixed.geometrySHA256=digest(fixed.geometry);delete fixed.geometry;
  const paths=[];
  for(const [distance,duration]of [[180,600],[360,240]])paths.push(await page.evaluate(async({distance,duration})=>{
   window.__reset();const start=performance.now();
   await new Promise(resolve=>{const frame=()=>{const t=Math.min(1,(performance.now()-start)/duration);window.__event('pointermove',distance*t,0);if(t===1)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
   const elapsed=performance.now()-start,grip=window.__readDrag(),stats=window.__stats();
   window.__event('pointerup',distance,0);
   return {distance,duration,elapsed,releaseGap:grip.distance,releaseInputGap:window.__releaseGrip?.distance,blocked:grip.blocked,stats,analysis:{c:knotLab.analysis.c,sA:knotLab.analysis.sA.count,sB:knotLab.analysis.sB.count,gT:knotLab.analysis.gT},geometry:knotLab.serialize().comps};
  },{distance,duration}));
  for(const p of paths){p.geometrySHA256=digest(p.geometry);delete p.geometry;}
  assert.deepEqual(errors,[]);const result={metadata,fixed,paths};
  if(process.env.PERF_OUTPUT)fs.writeFileSync(process.env.PERF_OUTPUT,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>server.close());
