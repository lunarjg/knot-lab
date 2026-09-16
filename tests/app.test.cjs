const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8');
function boot(saved,narrow=true,Worker){
 const arcs=[],all=[],ids=new Map(),listeners={},rafs=[],timers=new Map(),store=new Map(saved?[[JSON.parse(saved).format==='knot-lab-workspace'?'knot-lab:workspace':'knot-lab:autosave',saved]]:[]);let tid=0;
 class El{
  constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.id=attrs.id||'';this.dataset={};Object.entries(attrs).forEach(([k,v])=>{if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;});this.checked='checked'in attrs;this.hidden='hidden'in attrs;this.value=attrs.value||'';this.style={setProperty(k,v){this[k]=v}};this.textContent='';this.children=[];this.events={};const classes=new Set((attrs.class||'').split(' '));this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,v)=>v?classes.add(c):classes.delete(c),contains:c=>classes.has(c)};}
  addEventListener(k,f){(this.events[k]??=[]).push(f)}
  setAttribute(k,v){this.attrs[k]=String(v)} removeAttribute(k){delete this.attrs[k]} getAttribute(k){return this.attrs[k]}
  querySelector(q){return this.children.find(x=>x.classList.contains(q.slice(1)))||new El()}
  getBoundingClientRect(){return {left:0,top:0,width:this.id==='inspector'?parseFloat(doc.documentElement.style['--panel-width']||'400'):(narrow?768:1400),height:900}}
  getContext(){return new Proxy({arc:(...a)=>{assert(a.every(Number.isFinite));arcs.push(a)},measureText:t=>({width:t.length*8})},{get:(t,k)=>t[k]||((...a)=>{for(const x of a)if(typeof x==='number')assert(Number.isFinite(x),'Non-finite canvas '+k);}),set:(t,k,v)=>{t[k]=v;return true}})}
  focus(){doc.activeElement=this} scrollIntoView(){} appendChild(x){this.children.push(x)} replaceChildren(...xs){this.children=xs} remove(){} select(){} setPointerCapture(){} releasePointerCapture(){} contains(e){return e===this} click(){if(this.onclick)this.onclick({target:this});}
 }
 for(const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]||'';const el=new El(match[1],attrs);all.push(el);if(el.id)ids.set(el.id,el);}
 const doc={body:new El('body'),documentElement:new El('html'),activeElement:null,visibilityState:'visible',getElementById:id=>ids.get(id)||null,createElement:t=>new El(t),querySelectorAll:q=>all.filter(e=>q==='[data-tool]'?e.dataset.tool:q==='.views button'?e.dataset.view:q==='#lassoModes button'?e.dataset.lasso:q==='#eraseModes button'?e.dataset.erase:false),addEventListener:(k,f)=>(listeners[k]??=[]).push(f)};
 const context={console,Worker,document:doc,navigator:{},location:{protocol:'https:'},performance,AbortController,File,Blob,URL,ResizeObserver:class{observe(){}},getComputedStyle:()=>({getPropertyValue:n=>n==='--sans'?'sans-serif':'#16263a'}),localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},requestAnimationFrame:f=>{rafs.push(f);return rafs.length},cancelAnimationFrame:()=>{},setTimeout:(f,ms)=>{timers.set(++tid,{f,ms});return tid},clearTimeout:id=>timers.delete(id),addEventListener:(k,f)=>(listeners[k]??=[]).push(f),matchMedia:q=>({matches:q.includes('max-width')&&narrow,addEventListener(){}}),confirm:()=>true,innerWidth:narrow?768:1400,devicePixelRatio:2};context.window=context;context.globalThis=context;
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/pd-import.js','utf8'),context);
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
 function flush(){let n=0;while(rafs.length&&n++<200)rafs.shift()();assert(n<200,'Animation did not stop');}
 flush();return {ctx:context,doc,ids,store,timers,arcs,flush,step:()=>{const f=rafs.shift();if(f)f();},fire:(el,name,event)=>{for(const f of el.events[name]||[])f(event)}};
}
const t=boot(),lab=t.ctx.knotLab,pd='[[1,4,2,5],[3,6,4,1],[5,2,6,3]]';
assert.equal(lab.analysis.c,0);assert(t.ids.get('inspector').inert);
t.ids.get('pdOpen').click();assert(!t.ids.get('inspector').inert);assert.equal(t.doc.activeElement,t.ids.get('pdInput'));
t.ids.get('pdInput').value=pd;t.ids.get('pdImport').click();assert.equal(lab.analysis.c,3);assert(t.ids.get('pdError').hidden);assert(t.ids.get('inspector').inert);
const stateJSON=()=>{const {savedAt,...s}=lab.serialize();return JSON.stringify(s);};const before=stateJSON();
t.ids.get('pdInput').value='[[1,2,1,2]]';t.ids.get('pdImport').click();assert(!t.ids.get('pdError').hidden);assert.equal(stateJSON(),before);
const saved=JSON.stringify(lab.serialize()),restored=lab.deserialize(JSON.parse(saved));assert.equal(restored.crossings.length,3);
t.ids.get('undo').click();assert.equal(lab.analysis.c,0);t.ids.get('redo').click();assert.equal(lab.analysis.c,3);
for(const name of ['mirrorBtn','clearBtn']){t.ids.get(name).click();t.ids.get('undo').click();assert.equal(lab.analysis.c,3);}
for(const button of t.doc.querySelectorAll('.views button'))button.click();
for(const {f,ms} of t.timers.values())if(ms===700)f();assert(t.store.has('knot-lab:workspace'));
const reload=boot(t.store.get('knot-lab:workspace'),false);assert.equal(reload.ctx.knotLab.analysis.c,3);assert.equal(reload.ctx.knotLab.analysis.writhe,lab.analysis.writhe);
assert(!reload.ids.get('inspector').inert);
// Imported geometry must still support the original crossing switch tool.
const flip=t.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='flip');flip.click();
const cr=lab.state.crossings[0],old=cr.over,e={pointerType:'mouse',pointerId:1,clientX:cr.x*lab.view.s+lab.view.ox,clientY:cr.y*lab.view.s+lab.view.oy,button:0,preventDefault(){}};
t.fire(t.ids.get('cv'),'pointerdown',e);t.fire(t.ids.get('cv'),'pointerup',e);assert.equal(cr.over,1-old);t.ids.get('undo').click();
console.log('App initialization, PD UI, error isolation, undo/redo, mirror/clear, all state views, autosave/reload, panel and crossing flip: PASS');

// Resize and hide gestures use the same handlers for finger, Pencil and mouse.
for (const pointerType of ['touch','pen','mouse']) {
 const p=boot(),h=p.ids.get('panelResize'),toggle=p.ids.get('panelToggle');
 toggle.click();assert(!p.ids.get('inspector').inert);
 const ev=(x)=>({button:0,pointerId:22,pointerType,clientX:x,preventDefault(){},stopPropagation(){}});
 p.fire(h,'pointerdown',ev(400));p.fire(h,'pointermove',ev(300));p.fire(h,'pointerup',ev(300));
 assert.equal(h.getAttribute('aria-valuenow'),'500');assert.equal(p.store.get('knot-lab:panel-width'),'500');
 p.fire(h,'pointerdown',ev(300));p.fire(h,'pointermove',ev(760));
 assert(p.doc.body.classList.contains('panel-will-hide'));
 p.fire(h,'pointerup',ev(760));assert(p.ids.get('inspector').inert);assert.equal(toggle.getAttribute('aria-expanded'),'false');
 toggle.click();assert.equal(h.getAttribute('aria-valuenow'),'500');assert(!p.ids.get('inspector').inert);
 p.fire(h,'pointerdown',ev(300));p.fire(h,'pointermove',ev(400));p.fire(h,'pointercancel',ev(400));assert.equal(h.getAttribute('aria-valuenow'),'500');
 assert(!p.doc.body.classList.contains('panel-resizing'));assert.equal(p.ids.get('inspector').style.transform,'');
 p.fire(h,'keydown',{key:'Home',preventDefault(){},stopPropagation(){}});assert.equal(h.getAttribute('aria-valuenow'),'280');
 p.fire(h,'keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});assert(p.ids.get('inspector').inert);
}
console.log('Touch, pen and mouse resize, drag-to-hide, edge-arrow reopen, width retention, cancellation and keyboard controls: PASS');

(async()=>{
 const p=boot(),api=p.ctx.knotLab,original=api.activeTabId;
 api.importPD(pd);
 const originalDoc=JSON.stringify(api.serialize()),w=api.analysis.writhe;
 // File loading creates a new tab without overwriting the first document.
 assert(await api.openFile(new File([originalDoc],'trefoil.json',{type:'application/json'})));
 const second=api.activeTabId;assert.notEqual(second,original);assert.equal(api.tabs.length,2);assert.equal(api.tabs[1].title,'trefoil');
 p.ids.get('mirrorBtn').click();assert.equal(api.analysis.writhe,-w);
 api.activateTab(original);assert.equal(api.analysis.writhe,w);
 p.ids.get('undo').click();assert.equal(api.analysis.c,0);p.ids.get('redo').click();assert.equal(api.analysis.c,3);
 api.activateTab(second);assert.equal(api.analysis.writhe,-w);
 p.ids.get('undo').click();assert.equal(api.analysis.writhe,w);
 const before=api.tabs.length;assert.equal(await api.openFile(new File(['not json'],'bad.json')),false);assert.equal(api.tabs.length,before);assert.equal(api.activeTabId,second);
 // Counter changes stay in their own document and undo restores them.
 const flip=p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='flip');flip.click();
 const cr=api.state.crossings[0],ev={pointerType:'mouse',pointerId:4,clientX:cr.x*api.view.s+api.view.ox,clientY:cr.y*api.view.s+api.view.oy,button:0,preventDefault(){}};
 p.fire(p.ids.get('cv'),'pointerdown',ev);p.fire(p.ids.get('cv'),'pointerup',ev);assert.equal(api.serialize().stats.flips,1);
 p.ids.get('undo').click();assert.equal(api.serialize().stats.flips,0);p.ids.get('redo').click();assert.equal(api.serialize().stats.flips,1);
 api.activateTab(original);assert.equal(api.serialize().stats.flips,0);api.activateTab(second);assert.equal(api.serialize().stats.flips,1);
 // Workspace reload retains every tab, the selected tab, geometry and counters.
 for(const {f,ms} of p.timers.values())if(ms===700)f();
 const r=boot(p.store.get('knot-lab:workspace'));assert.equal(r.ctx.knotLab.tabs.length,2);assert.equal(r.ctx.knotLab.activeTabId,second);assert.equal(r.ctx.knotLab.serialize().stats.flips,1);
 r.ctx.knotLab.activateTab(original);assert.equal(r.ctx.knotLab.analysis.writhe,w);assert.equal(r.ctx.knotLab.serialize().stats.flips,0);
 r.ctx.knotLab.closeTab(second);assert.equal(r.ctx.knotLab.tabs.length,1);
 r.ctx.knotLab.closeTab(original);assert.equal(r.ctx.knotLab.tabs.length,1);assert.equal(r.ctx.knotLab.analysis.c,0);
 const migrated=boot(originalDoc);assert.equal(migrated.ctx.knotLab.analysis.c,3);assert.equal(migrated.ctx.knotLab.tabs.length,1);
 console.log('New-file tabs, invalid-file isolation, independent geometry/history/counters, workspace reload, closing and legacy migration: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

// The precise eraser outline follows every pressed sample, even before hover,
// over empty space, and when the final pointer-up position has no move event.
for (const pointerType of ['mouse','pen','touch']) {
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='erase').click();
 p.doc.querySelectorAll('#eraseModes button').find(e=>e.dataset.erase==='precise').click();
 p.ids.get('penDoubleTap').onchange({target:{checked:false}});
 p.ids.get('palm').onchange({target:{checked:false}});
 api.view.s=1;api.view.ox=0;api.view.oy=0;
 api.state.open=[{pts:Array.from({length:41},(_,i)=>({x:100+i*5,y:100}))}];
 const ev=(x,y,type)=>({pointerType,pointerId:80,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 const fire=(type,e)=>{p.arcs.length=0;p.fire(canvas,type,e);const last=p.arcs.at(-1);assert(last,'Eraser outline must be rendered');assert.equal(last[0],e.clientX);assert.equal(last[1],e.clientY);};
 fire('pointerdown',ev(120,100,'pointerdown'));
 assert(api.state.open.every(st=>st.pts.every(q=>Math.abs(q.x-120)>=12)));
 const moving=ev(180,100,'pointermove');moving.getCoalescedEvents=()=>[ev(150,100,'pointermove'),ev(165,100,'pointermove')];
 fire('pointermove',moving);
 assert(api.state.open.every(st=>st.pts.every(q=>q.x<=108||q.x>=192)),'Pressed movement must erase the entire path');
 fire('pointermove',ev(180,160,'pointermove'));
 fire('pointerup',ev(210,160,'pointerup'));
 p.ids.get('undo').click();assert.equal(api.state.open.length,1);assert.equal(api.state.open[0].pts.length,41,'One stroke is one undo');
 p.ids.get('redo').click();assert(api.state.open[0].pts.length<41);
 fire('pointerdown',ev(250,100,'pointerdown'));fire('pointerup',ev(250,100,'pointerup'));
 assert(api.state.open.every(st=>st.pts.every(q=>Math.abs(q.x-250)>=12)),'Repeated clicks erase at the new cursor position');
}
console.log('Precise eraser cursor, click/drag/coalesced/up samples, empty-space movement and undo for mouse/pen/touch: PASS');

(async()=>{
 const p=boot(),api=p.ctx.knotLab,original=api.activeTabId;
 api.importPD(pd);const originalJSON=JSON.stringify(api.serialize()),originalW=api.analysis.writhe;
 const fileA=new File([originalJSON],'first.json'),fileB=new File([originalJSON],'second.json');
 await p.ids.get('fileInput').onchange({target:{files:[fileA,new File(['broken'],'invalid.json'),fileB]}});
 assert.equal(api.tabs.length,3);assert.deepEqual(Array.from(api.tabs,t=>t.title).slice(1),['first','second']);
 assert.equal(p.ids.get('documentTabs').children.length,3);
 assert.equal(p.ids.get('documentTabs').children[2].children[0].getAttribute('aria-selected'),'true');
 api.activateTab(original);assert.equal(api.analysis.writhe,originalW);
 p.ids.get('newTab').click();assert.equal(api.tabs.length,4);assert.equal(api.analysis.c,0);
 api.activateTab(original);assert.equal(api.analysis.c,3);
 console.log('File picker batch opens, failed-file isolation, visible selected tabs and New tab: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

// A real drag loosens one local curl; click-only, the off switch, undo and
// redo preserve the expected geometry and R1 count in the active document.
for(const enabled of [true,false]) {
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
 const d=api.serialize();d.comps=[[[-20,0],[-2,0],[1,3],[-1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[200+5*x,200+5*y])];
 api.openTab(api.deserialize(d),'curl');assert.equal(api.analysis.c,1);
 api.view.s=1;api.view.ox=0;api.view.oy=0;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 p.ids.get('loosenR1').onchange({target:{checked:enabled}});
 const ev=(x,y,type)=>({pointerType:'mouse',pointerId:12,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 p.fire(canvas,'pointerdown',ev(205,215,'pointerdown'));p.fire(canvas,'pointerup',ev(205,215,'pointerup'));p.flush();
 assert.equal(api.analysis.c,1,'Merely clicking must preserve the curl');
 p.fire(canvas,'pointerdown',ev(205,215,'pointerdown'));p.fire(canvas,'pointermove',ev(206,215,'pointermove'));p.step();
 p.fire(canvas,'pointerup',ev(206,215,'pointerup'));p.flush();
 assert.equal(api.analysis.c,enabled?0:1);assert.equal(api.serialize().stats.r1,enabled?1:0);
 p.ids.get('undo').click();assert.equal(api.analysis.c,1);assert.equal(api.serialize().stats.r1,0);
 p.ids.get('redo').click();assert.equal(api.analysis.c,enabled?0:1);assert.equal(api.serialize().stats.r1,enabled?1:0);
}
console.log('R1 drag assistance, click-only preservation, off switch and single-gesture undo/redo: PASS');

// A user can create a self-crossing while kink protection and R1 assistance
// are both enabled. Assistance must not erase a loop born during this drag.
{
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv'),d=api.serialize();
 d.comps=[[[-20,0],[-2,0],[-1,3],[1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[400+5*x,200+5*y])];
 api.openTab(api.deserialize(d),'new self-crossing');api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();assert.equal(api.analysis.c,0);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 p.ids.get('sigma').oninput({target:{value:'10'}});
 assert(p.ids.get('protectKinks').checked&&p.ids.get('loosenR1').checked);
 const ev=(x,y,type)=>({pointerType:'mouse',pointerId:12,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 p.fire(canvas,'pointerdown',ev(395,215,'pointerdown'));p.fire(canvas,'pointermove',ev(465,185,'pointermove'));
 for(let i=0;i<20;i++){p.step();if(api.analysis.c===1)break;}
 p.fire(canvas,'pointerup',ev(465,185,'pointerup'));p.flush();
 assert.equal(api.analysis.c,1);assert.equal(api.serialize().stats.r1,1);
 p.ids.get('undo').click();assert.equal(api.analysis.c,0);assert.equal(api.serialize().stats.r1,0);
 p.ids.get('redo').click();assert.equal(api.analysis.c,1);assert.equal(api.serialize().stats.r1,1);
}
console.log('New R1 self-crossing with protection and assistance enabled, move count, undo and redo: PASS');

// Exercise the two independent controls through the actual drag event path.
for(const alternating of [true,false])for(const protect of [true,false]) {
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
 const d=api.serialize();d.comps=[
 [[-80,-40],[-40,0],[0,20],[40,0],[80,-40],[80,-100],[-80,-100]],
 [[-80,40],[-40,0],[0,-20],[40,0],[80,40],[80,100],[-80,100]]
 ].map(ps=>ps.map(([x,y])=>[x+200,y+200]));
 api.openTab(api.deserialize(d),'bigon');api.view.s=1;api.view.ox=0;api.view.oy=0;
 if(alternating){const x=api.state.crossings[0];x.over=1-x.over;}
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 p.ids.get('protectBigons').onchange({target:{checked:protect}});
 p.ids.get('bigonArea').oninput({target:{value:'600'}});assert.equal(p.ids.get('bigonAreaV').textContent,'600 px²');
 p.ids.get('kinkArea').oninput({target:{value:'240'}});assert.equal(p.ids.get('kinkAreaV').textContent,'240 px²');
 const ev=(y,type)=>({pointerType:'mouse',pointerId:20,clientX:200,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 p.fire(canvas,'pointerdown',ev(220,'pointerdown'));p.fire(canvas,'pointermove',ev(182,'pointermove'));
 for(let i=0;i<4;i++)p.step();p.fire(canvas,'pointerup',ev(182,'pointerup'));p.flush();
 const faces=vm.runInContext('KC.smallFaces(knotLab.state.comps,knotLab.state.crossings)',p.ctx).filter(f=>f.type==='bigon');
 assert(faces.length);
 if(protect&&alternating){assert(faces.every(f=>f.area>=600-1e-6&&f.thickness>=8-1e-6&&f.separation>=16-1e-6));assert(p.ids.get('toast').textContent.includes('bigon'));}
 else assert(faces.some(f=>f.area<600),'R2-compatible bigons and disabled protection must allow a smaller bigon');
 p.ids.get('undo').click();assert.equal(api.analysis.c,2);
}
console.log('Bigon drag constraint, separate area controls, off switch and undo through pointer events: PASS');

// Worker lifecycle: cancellation and stale results cannot leak across changes/tabs.
{
 const workers=[];class FakeWorker{
  constructor(url){assert.equal(url,'./invariants-worker.js');this.terminated=false;workers.push(this);}
  postMessage(data){this.data=data;}terminate(){this.terminated=true;}
  complete(){const result=require('../dist/invariants.js').calculate(this.data.analysis);this.onmessage({data:{id:this.data.id,result}});}
 }
 const p=boot(undefined,true,FakeWorker),api=p.ctx.knotLab,button=p.ids.get('calculateInvariants');
 assert(button.disabled);api.importPD(pd);assert(!button.disabled);button.click();
 assert(button.disabled);assert(!p.ids.get('cancelInvariants').hidden);workers.at(-1).complete();
 assert.equal(p.ids.get('knotDeterminant').textContent,'3');assert.equal(p.ids.get('coloringCount').textContent,'9');
 assert.equal(p.ids.get('tricolorable').textContent,'Yes');assert.equal(p.ids.get('jonesPolynomial').textContent,'t⁻¹ + t⁻³ − t⁻⁴');
 assert(!p.ids.get('invariantResults').hidden);
 p.ids.get('mirrorBtn').click();assert(p.ids.get('invariantResults').hidden);button.click();const stale=workers.at(-1);
 api.openTab();assert(stale.terminated);stale.complete();assert(p.ids.get('invariantResults').hidden);assert(button.disabled);
 api.activateTab(api.tabs[0].id);button.click();const canceled=workers.at(-1);p.ids.get('cancelInvariants').click();assert(canceled.terminated);canceled.complete();assert(p.ids.get('invariantResults').hidden);
 button.click();workers.at(-1).complete();assert.equal(p.ids.get('jonesPolynomial').textContent,'−t⁴ + t³ + t');
 button.click();const errored=workers.at(-1);errored.onerror();assert(!button.disabled);assert(p.ids.get('invariantStatus').textContent.includes('Could not calculate'));
 console.log('Invariant UI: exact results, mirror, tab switch, stale messages, cancel and retry after worker error: PASS');
}
