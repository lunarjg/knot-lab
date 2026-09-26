// Optional browser regression: install Playwright with Chrome or set PLAYWRIGHT_MODULE.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{if(!process.env.CHECK_URL)await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});try{

 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.CHECK_URL||'http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.knotLab);
 await page.evaluate(()=>{knotLab.openTab(knotLab.deserialize({format:'knot-lab',version:1,comps:[],crossings:[],open:[[[100,200],[300,200]],[[200,100],[200,300]]],crossingMemory:[[200,200,1,0]]}),'Unfinished crossing');knotLab.view.s=1;knotLab.view.ox=knotLab.view.oy=140;});
 await page.locator('[data-tool=lasso]').click();const box=await page.locator('#cv').boundingBox();
 const gesture=async points=>{await page.mouse.move(box.x+points[0][0],box.y+points[0][1]);await page.mouse.down();for(const [x,y] of points.slice(1))await page.mouse.move(box.x+x,box.y+y,{steps:8});await page.mouse.up();};
 await gesture([[190,190],[490,190],[490,490],[190,490],[190,190]]);assert(!await page.locator('#selmenu').isVisible(),'Lasso release keeps the menu hidden');await page.mouse.click(box.x+340,box.y+340);assert(await page.locator('#selmenu').isVisible());await page.locator('#mCopy').click();
 await page.evaluate(()=>{knotLab.openTab();knotLab.view.s=1;knotLab.view.ox=knotLab.view.oy=140;});await page.keyboard.press('Meta+v');assert(!await page.locator('#selmenu').isVisible(),'Paste keeps the menu hidden');
 const center=await page.evaluate(()=>{const m=knotLab.state.memory.at(-1);if(!m)return null;return {x:m.x,y:m.y,ox:m.ox,oy:m.oy,sx:m.x*knotLab.view.s+knotLab.view.ox,sy:m.y*knotLab.view.s+knotLab.view.oy};});assert(center);assert(Math.abs(center.ox)>.99&&Math.abs(center.oy)<.01);
 await gesture([[center.sx,center.sy],[center.sx+70,center.sy+40]]);
 assert(!await page.locator('#selmenu').isVisible(),'Moving keeps the menu hidden');
 const moved=await page.evaluate(()=>knotLab.state.memory.at(-1));assert(Math.abs(moved.x-center.x-70)<.01&&Math.abs(moved.y-center.y-40)<.01);
 const c={x:center.sx+70,y:center.sy+40},h=await page.evaluate(()=>knotLab.__h());await gesture([[h.x,h.y],[c.x-(h.y-c.y),c.y+(h.x-c.x)]]);
 assert(!await page.locator('#selmenu').isVisible(),'Rotating keeps the menu hidden');
 const pixel=await page.evaluate(({x,y})=>{const cv=document.getElementById('cv'),dpr=devicePixelRatio;return [...cv.getContext('2d').getImageData(Math.round((x+5)*dpr),Math.round(y*dpr),1,1).data];},c);assert(pixel[0]>130,'The rotated horizontal understrand must have a visible gap: '+pixel);
 const rotated=await page.evaluate(()=>{const {savedAt,...data}=knotLab.serialize();return data;});await page.locator('#undo').click();await page.locator('#redo').click();assert.deepEqual(await page.evaluate(()=>{const {savedAt,...data}=knotLab.serialize();return data;}),rotated);

 // Change real controls, then reload the same browser's workspace.
 await page.locator('[data-tool=move]').click();
 const slide=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);};
 await slide('sigma',95);await page.locator('#sigma').blur();await page.keyboard.press('+');
 const radius=await page.evaluate(()=>knotLab.opts.sigma);assert(radius>95);
 await page.locator('[data-tool=lasso]').click();await page.locator('[data-shape=rect]').click();await page.locator('[data-lasso=region]').click();
 await page.locator('#navSettings').click();await page.locator('#adFill').uncheck();await slide('adSolid',37);await page.locator('#grid').uncheck();await page.locator('#autoPen').uncheck();
 const before=await page.evaluate(()=>{const {savedAt,...data}=knotLab.serialize();return data;});
 // Diagram autosave is debounced; preferences are written immediately.
 await page.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('knot-lab:workspace'));return d?.tabs.length===3&&d.tabs.find(t=>t.id===d.activeId)?.document.open.length===2;});
 await page.reload();await page.waitForFunction(()=>window.knotLab);
 assert.deepEqual(await page.evaluate(()=>{const {savedAt,...data}=knotLab.serialize();return data;}),before);
 assert.deepEqual(await page.evaluate(()=>{const o=knotLab.opts;return [o.sigma,o.adFill,o.adSolid,o.grid,o.lassoMode,o.lassoShape];}),[radius,false,.37,false,'region','rect']);
 await page.locator('[data-tool=lasso]').click();assert.equal(await page.locator('[data-shape=rect]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-lasso=region]').getAttribute('aria-pressed'),'true');
 await page.locator('#navSettings').click();assert(!await page.locator('#adFill').isChecked());assert.equal(await page.locator('#adSolid').inputValue(),'37');
 await page.locator('#navFiles').click();await page.locator('#autosave').uncheck();await page.reload();await page.waitForFunction(()=>window.knotLab);
 assert.equal(await page.evaluate(()=>knotLab.opts.sigma),radius);assert(!await page.locator('#autosave').isChecked());assert.equal(await page.evaluate(()=>knotLab.state.open.length),0);
 // Touch tap-to-open on a narrow viewport with restored rectangle preference.
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('inspector').inert);
 await page.evaluate(()=>{knotLab.openTab(knotLab.deserialize({format:'knot-lab',version:1,comps:[],crossings:[],open:[[[80,240],[240,240]],[[160,160],[160,320]]],crossingMemory:[[160,240,1,0]]}));knotLab.view.s=1;knotLab.view.ox=knotLab.view.oy=0;});
 await page.locator('[data-tool=lasso]').click();
 const touch=async points=>page.locator('#cv').evaluate((cv,points)=>{const r=cv.getBoundingClientRect();points.forEach((q,i)=>{const type=i===0?'pointerdown':i===points.length-1?'pointerup':'pointermove';cv.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:31,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+q[0],clientY:r.top+q[1]}));});},points);
 await touch([[50,130],[270,350],[270,350]]);assert(!await page.locator('#selmenu').isVisible());
 await touch([[160,240],[160,240]]);assert(await page.locator('#selmenu').isVisible());
 const menu=await page.locator('#selmenu').boundingBox();assert(menu.x>=0&&menu.x+menu.width<=390,'Selection menu fits on a phone');
 await page.locator('#mCopy').click();assert.deepEqual(errors,[]);
 console.log('Browser: click-to-open lasso menus, hidden menus after paste/move/rotation, crossing gaps, undo/redo, preferences/workspace reload, autosave independence and phone touch menu: PASS');
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>server.close());
