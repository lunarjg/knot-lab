// Optional browser smoke test: install Playwright with Chrome or set PLAYWRIGHT_MODULE.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../dist'),out=path.resolve(process.env.RESEARCH_SCREENSHOTS||path.join(require('os').tmpdir(),'knot-research-screenshots'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.knotLab);
 await page.evaluate(()=>knotLab.openTab(KC.fromCurves3D(KC.braidCurves([1,1,1]),440),'Positive trefoil'));
 await page.locator('#navResearch').click();assert.equal(await page.locator('#researchStatus').textContent(),'This diagram is homogeneous.');
 const original=await page.evaluate(()=>JSON.stringify([knotLab.state.comps,knotLab.state.crossings,knotLab.state.open]));
 await page.screenshot({path:path.join(out,'research-statistics.png')});
 await page.locator('#researchGraph svg').evaluate(el=>window.researchGraphBeforeCalculation=el);
 await page.locator('#researchCalculate').click();await page.waitForFunction(()=>knotLab.research.record?.jonesStatus==='ready');
 assert.equal(await page.evaluate(()=>knotLab.research.record.jonesPolynomial),'−t⁴ + t³ + t');
 assert(await page.locator('#researchGraph svg').evaluate(el=>el===window.researchGraphBeforeCalculation),'invariant-only refresh must reuse the graph DOM');
 await page.locator('#researchGraph [data-kind=edge] text').first().click();assert.equal(await page.evaluate(()=>knotLab.research.selection.kind),'edge');
 await page.locator('#researchGraph [data-kind=circle]').first().click();assert.equal(await page.locator('#researchPreview').isChecked(),true);
 await page.locator('#panelScroll').evaluate(el=>{el.scrollTop+=document.getElementById('researchGraph').getBoundingClientRect().top-320;});await page.screenshot({path:path.join(out,'research-seifert-graph.png')});
 await page.locator('#researchBlocks button').first().click();assert.equal(await page.evaluate(()=>knotLab.research.selection.kind),'block');
 assert.deepEqual(JSON.parse(await page.evaluate(()=>JSON.stringify([knotLab.state.comps,knotLab.state.crossings,knotLab.state.open]))),JSON.parse(original));
 // Real download, not a rendered-string reconstruction.
 const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#researchJSON').click()]);const record=JSON.parse(fs.readFileSync(await dl.path(),'utf8')).records[0];assert.equal(record.certifiedKnotGenus,1);assert.equal(record.jonesMinCoefficient,'1');
 await page.locator('#researchPick').check();await page.locator('[data-view=diagram]').click();
 for(const pointerType of ['mouse','touch','pen']){
  await page.evaluate(type=>{document.getElementById('palm').checked=false;document.getElementById('palm').onchange({target:{checked:false}});const cv=document.getElementById('cv'),r=cv.getBoundingClientRect(),x=knotLab.state.crossings[0],v=knotLab.view,e={bubbles:true,pointerType:type,pointerId:19,button:0,clientX:r.left+x.x*v.s+v.ox,clientY:r.top+x.y*v.s+v.oy};for(const name of ['pointerdown','pointerup'])cv.dispatchEvent(new PointerEvent(name,{...e,buttons:name==='pointerdown'?1:0}));},pointerType);
  assert.equal(await page.evaluate(()=>knotLab.research.selection.kind),'edge');assert.deepEqual(JSON.parse(await page.evaluate(()=>JSON.stringify([knotLab.state.comps,knotLab.state.crossings,knotLab.state.open]))),JSON.parse(original));
 }
 await page.locator('#researchPick').uncheck();
 // Panning is a view change: research data and circle colours remain available.
 await page.locator('[data-tool=move]').click();
 const panCheck=await page.evaluate(()=>{const cv=document.getElementById('cv'),r=cv.getBoundingClientRect(),before=knotLab.research.circleColor(0),e={bubbles:true,pointerType:'mouse',pointerId:21,button:0,clientX:r.left+5,clientY:r.top+50};cv.dispatchEvent(new PointerEvent('pointerdown',{...e,buttons:1}));const during=knotLab.research.circleColor(0),ready=knotLab.research.record?.status;cv.dispatchEvent(new PointerEvent('pointermove',{...e,clientX:e.clientX+4,buttons:1}));cv.dispatchEvent(new PointerEvent('pointerup',{...e,clientX:e.clientX+4,buttons:0}));return {before,during,ready};});
 assert.equal(panCheck.ready,'ready','panning must not suspend research analysis');assert.equal(panCheck.during,panCheck.before,'panning must keep circle colours');
 // Actual editor gestures with each pointer type, followed by undo.
 for(const pointerType of ['mouse','touch','pen']){
  await page.locator('[data-tool=move]').click();
  const changed=await page.evaluate(async type=>{const cv=document.getElementById('cv'),r=cv.getBoundingClientRect(),c=knotLab.state.comps[0],p=KC.pointAtS(c,c.len*.13),v=knotLab.view,before=JSON.stringify(c.pts),e={bubbles:true,pointerType:type,pointerId:31,button:0,clientX:r.left+p.x*v.s+v.ox,clientY:r.top+p.y*v.s+v.oy};cv.dispatchEvent(new PointerEvent('pointerdown',{...e,buttons:1}));cv.dispatchEvent(new PointerEvent('pointermove',{...e,clientX:e.clientX+12,buttons:1}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));cv.dispatchEvent(new PointerEvent('pointerup',{...e,clientX:e.clientX+12,buttons:0}));return JSON.stringify(knotLab.state.comps[0].pts)!==before;},pointerType);
  assert(changed,pointerType+' must move the strand');await page.locator('#undo').click();assert.deepEqual(JSON.parse(await page.evaluate(()=>JSON.stringify([knotLab.state.comps,knotLab.state.crossings,knotLab.state.open]))),JSON.parse(original));assert.equal(await page.locator('#researchStatus').textContent(),'This diagram is homogeneous.');
 }
 await page.locator('#researchBatchDetails summary').click();const codes=await page.evaluate(()=>JSON.stringify([{name:'trefoil',pd:KC.analyze(KC.fromCurves3D(KC.braidCurves([1,1,1]),440).comps,KC.fromCurves3D(KC.braidCurves([1,1,1]),440).crossings).pd},{name:'genus 3',pd:KC.analyze(KC.fromCurves3D(KC.braidCurves(Array(7).fill(1)),440).comps,KC.fromCurves3D(KC.braidCurves(Array(7).fill(1)),440).crossings).pd},{name:'bad',pd:[[1,2,1,2]]},{name:'unknot',unknot:true}]));
 await page.locator('#researchBatchInput').fill(codes);await page.locator('#researchBatchRun').click();await page.waitForFunction(()=>document.getElementById('researchBatchStatus').textContent.startsWith('Finished'),null,{timeout:90000});assert.equal(await page.evaluate(()=>knotLab.research.batchRows.length),4);
 await page.locator('.research-row-error summary').click();assert((await page.locator('.research-row-error').textContent()).length>10,'Row errors are expandable with touch or keyboard');
 await page.locator('#researchGenus3').click();assert.equal(await page.evaluate(()=>knotLab.research.filteredRows.length),1);await page.locator('#researchBatchTable').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'research-batch.png')});
 const [csv]=await Promise.all([page.waitForEvent('download'),page.locator('#researchBatchCSV').click()]);assert(fs.readFileSync(await csv.path(),'utf8').includes('genus 3'));
 await page.locator('#researchBatchInput').fill(JSON.stringify(Array.from({length:1000},(_,i)=>({name:'row '+i,pd:JSON.parse(codes)[0].pd}))));await page.locator('#researchBatchRun').click();await page.locator('#researchBatchCancel').click();assert((await page.locator('#researchBatchStatus').textContent()).startsWith('Canceled'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>JSON.stringify([knotLab.state.comps,knotLab.state.crossings,knotLab.state.open]))),JSON.parse(original));
 // A many-edge fan must fit its SVG even when it bends vertically.
 await page.evaluate(()=>knotLab.openTab(KC.fromCurves3D(KC.braidCurves([...Array(12).fill(1),...Array(12).fill(2)]),800),'Parallel fans'));
 assert.equal(await page.evaluate(()=>knotLab.research.record.crossingCount),24);
 const clipped=await page.locator('#researchGraph svg').evaluate(svg=>{const v=svg.viewBox.baseVal;return [...svg.querySelectorAll('path,text,circle')].filter(el=>{const b=el.getBBox();return b.x<v.x-1||b.y<v.y-1||b.x+b.width>v.x+v.width+1||b.y+b.height>v.y+v.height+1;}).length;});assert.equal(clipped,0,'all parallel edges, circles and labels must fit inside the graph viewBox');
 await page.evaluate(()=>knotLab.research.select('block','B1'));
 const reads=await page.evaluate(()=>{const circles=knotLab.research.record.seifertCircles;let reads=0;for(const c of circles){const id=c.id;Object.defineProperty(c,'id',{get(){reads++;return id;},enumerable:true,configurable:true});}knotLab.research.circleColor(0);reads=0;for(let i=0;i<1000;i++){knotLab.research.circleColor(i%48);knotLab.research.circleHighlighted(i%48);}return reads;});assert(reads<100,'render lookups must not repeatedly scan all circles');console.log('Circle-ID reads for 1,000 cached colour/highlight pairs: '+reads);
 await page.evaluate(()=>{knotLab.openTab(KC.fromCurves3D(KC.braidCurves([1,-1]),440),'Mixed block');});assert.equal(await page.locator('#researchStatus').textContent(),'This diagram is not homogeneous.');assert((await page.locator('#researchMeaning').textContent()).includes('does NOT prove'));assert.equal(await page.evaluate(()=>knotLab.research.record.certifiedKnotGenus),null);
 await page.setViewportSize({width:390,height:844});await page.locator('#panelToggle').click();await page.locator('#navResearch').click();await page.locator('#panelScroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,'research-phone.png')});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'phone page must not overflow horizontally');
 if(errors.length)throw Error(errors.join('\n'));console.log('Research browser: graph/circle/block selection, exact Jones, real JSON/CSV downloads, read-only mouse/pen/touch selection, editable gestures and undo, batch/errors/filter/cancel, topology preservation, non-homogeneous language, panning, parallel-fan bounds, cached graph/colour rendering and phone layout: PASS');
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);if(e.actual&&e.expected){const diff=(a,b,p='')=>{if(JSON.stringify(a)===JSON.stringify(b))return null;if(typeof a!=='object'||typeof b!=='object'||a===null||b===null)return {p,a,b};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const r=diff(a[k],b[k],p+'.'+k);if(r)return r;}return null;};console.error(diff(e.actual,e.expected));}process.exitCode=1}).finally(()=>server.close());
