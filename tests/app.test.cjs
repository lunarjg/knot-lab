const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8');
function boot(saved,narrow=true,Worker){
 const arcs=[],paths=[],all=[],ids=new Map(),listeners={},rafs=[],timers=new Map(),store=new Map(saved?[[JSON.parse(saved).format==='knot-lab-workspace'?'knot-lab:workspace':'knot-lab:autosave',saved]]:[]);let tid=0;
 class El{
  constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.id=attrs.id||'';this.dataset={};Object.entries(attrs).forEach(([k,v])=>{if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;});this.checked='checked'in attrs;this.hidden='hidden'in attrs;this.value=attrs.value||'';this.style={setProperty(k,v){this[k]=v}};this.textContent='';this.children=[];this.events={};const classes=new Set((attrs.class||'').split(' '));this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,v)=>v?classes.add(c):classes.delete(c),contains:c=>classes.has(c)};}
  addEventListener(k,f){(this.events[k]??=[]).push(f)}
  setAttribute(k,v){this.attrs[k]=String(v)} removeAttribute(k){delete this.attrs[k]} getAttribute(k){return this.attrs[k]}
  querySelector(q){return this.children.find(x=>x.classList.contains(q.slice(1)))||new El()}
  getBoundingClientRect(){return {left:0,top:0,width:this.id==='inspector'?parseFloat(doc.documentElement.style['--panel-width']||'400'):(narrow?768:1400),height:900}}
  getContext(){return new Proxy({beginPath:()=>paths.push([]),moveTo:(x,y)=>paths.at(-1).push({x,y,move:true}),lineTo:(x,y)=>paths.at(-1).push({x,y,move:false}),arc:(...a)=>{assert(a.every(Number.isFinite));arcs.push(a)},measureText:t=>({width:t.length*8})},{get:(t,k)=>t[k]||((...a)=>{for(const x of a)if(typeof x==='number')assert(Number.isFinite(x),'Non-finite canvas '+k);}),set:(t,k,v)=>{t[k]=v;return true}})}
  focus(){doc.activeElement=this} blur(){if(doc.activeElement===this)doc.activeElement=doc.body} scrollIntoView(){} appendChild(x){this.children.push(x)} replaceChildren(...xs){this.children=xs} remove(){} select(){} setPointerCapture(){} releasePointerCapture(){} contains(e){return e===this} click(){if(this.onclick)this.onclick({target:this});}
 }
 for(const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]||'';const el=new El(match[1],attrs);all.push(el);if(el.id)ids.set(el.id,el);}
 const doc={body:new El('body'),documentElement:new El('html'),activeElement:null,visibilityState:'visible',getElementById:id=>ids.get(id)||null,createElement:t=>new El(t),querySelectorAll:q=>all.filter(e=>q==='[data-tool]'?e.dataset.tool:q==='.views button'?e.dataset.view:q==='#lassoModes button'?e.dataset.lasso:q==='#eraseModes button'?e.dataset.erase:false),addEventListener:(k,f)=>(listeners[k]??=[]).push(f)};
 const context={console,Worker,document:doc,navigator:{},location:{protocol:'https:'},performance,AbortController,File,Blob,URL,ResizeObserver:class{observe(){}},getComputedStyle:()=>({getPropertyValue:n=>n==='--sans'?'sans-serif':'#16263a'}),localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},requestAnimationFrame:f=>{rafs.push(f);return rafs.length},cancelAnimationFrame:()=>{},setTimeout:(f,ms)=>{timers.set(++tid,{f,ms});return tid},clearTimeout:id=>timers.delete(id),addEventListener:(k,f)=>(listeners[k]??=[]).push(f),matchMedia:q=>({matches:q.includes('max-width')&&narrow,addEventListener(){}}),confirm:()=>true,innerWidth:narrow?768:1400,devicePixelRatio:2};context.window=context;context.globalThis=context;
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/pd-import.js','utf8'),context);
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
 function flush(){let n=0;while(rafs.length&&n++<200)rafs.shift()();assert(n<200,'Animation did not stop');}
 flush();return {ctx:context,doc,ids,store,timers,arcs,paths,flush,step:()=>{const f=rafs.shift();if(f)f();},fire:(el,name,event)=>{for(const f of el.events[name]||[])f(event)},
  key:(type,props)=>{for(const f of listeners[type]||[])f({target:doc.body,preventDefault(){},stopPropagation(){},...props})}};
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

// The "+" tab lives inside the scrollable tab strip itself, immediately
// after the last tab, not as a fixed button outside it — so it always
// stays right after the last tab and scrolls together with them.
{
 const p=boot(),api=p.ctx.knotLab,strip=p.ids.get('documentTabs'),plus=p.ids.get('newTab');
 const last=()=>strip.children[strip.children.length-1];
 assert.equal(last(),plus,'The + tab must be the last child of the tab strip');
 api.openTab();api.openTab();
 assert.equal(last(),plus,'The + tab must stay last after opening more tabs');
 assert.equal(strip.children.filter(c=>c!==plus).length,3);
 plus.click();assert.equal(api.tabs.length,4);
 assert.equal(last(),plus,'The + tab must stay last after clicking it to open a tab');
}
console.log('The + tab stays as the last item in the scrollable tab strip: PASS');

// Tap the active title to rename in place. Selecting another tab remains one
// tap; renaming changes neither the diagram nor its undo/redo history.
{
 const p=boot(),api=p.ctx.knotLab;api.importPD(pd);const id=api.activeTabId;
 const diagram=JSON.stringify(api.serialize().comps),original=api.tabs[0].title;
 const item=()=>p.ids.get('documentTabs').children.find(i=>i.children[0].getAttribute('aria-selected')==='true'||i.children[0].tagName==='INPUT');
 const key=(field,name,composing=false)=>p.fire(field,'keydown',{key:name,isComposing:composing,preventDefault(){},stopPropagation(){}});
 item().children[0].click();let field=item().children[0];assert.equal(field.tagName,'INPUT');assert.equal(field.value,original);
 field.value='  My trefoil  ';key(field,'Enter',true);assert.equal(api.tabs[0].title,original,'IME Enter must not prematurely commit');key(field,'Enter');
 assert.equal(api.tabs[0].title,'My trefoil');assert.equal(p.ids.get('fileName').value,'My trefoil');assert.equal(JSON.stringify(api.serialize().comps),diagram);
 item().children[0].click();field=item().children[0];field.value='Canceled';key(field,'Escape');assert.equal(api.tabs[0].title,'My trefoil');
 item().children[0].click();field=item().children[0];field.value='   ';p.fire(field,'blur',{});assert.equal(api.tabs[0].title,'My trefoil');
 p.fire(item().children[0],'keydown',{key:'F2',preventDefault(){},stopPropagation(){}});field=item().children[0];field.value='Renamed <knot>';p.fire(field,'blur',{});assert.equal(api.tabs[0].title,'Renamed <knot>');
 assert.equal(item().children[1].getAttribute('aria-label'),'Close tab Renamed <knot>');
 const second=api.openTab();p.ids.get('documentTabs').children[0].children[0].click();assert.equal(api.activeTabId,id);assert.equal(item().children[0].tagName,'BUTTON');
 item().children[0].click();field=item().children[0];field.value='Saved on switch';api.activateTab(second);assert.equal(api.tabs[0].title,'Saved on switch');
 api.activateTab(id);assert.equal(p.ids.get('fileName').value,'Saved on switch');
 for(const {f,ms} of p.timers.values())if(ms===700)f();const restored=boot(p.store.get('knot-lab:workspace'));assert.equal(restored.ctx.knotLab.tabs[0].title,'Saved on switch');
 p.ids.get('undo').click();assert.equal(api.analysis.c,0);assert.equal(api.tabs[0].title,'Saved on switch');p.ids.get('redo').click();assert.equal(api.analysis.c,3);
}
console.log('Tab title rename: tap/F2, Enter/blur, cancel, IME, switching, autosave and independent diagram history: PASS');

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
 // A crossing flip stays in its own document and undo restores it.
 const flip=p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='flip');flip.click();
 const cr=api.state.crossings[0],ev={pointerType:'mouse',pointerId:4,clientX:cr.x*api.view.s+api.view.ox,clientY:cr.y*api.view.s+api.view.oy,button:0,preventDefault(){}};
 const wPlain=api.analysis.writhe;
 p.fire(p.ids.get('cv'),'pointerdown',ev);p.fire(p.ids.get('cv'),'pointerup',ev);
 const wFlipped=api.analysis.writhe;assert.notEqual(wFlipped,wPlain);
 p.ids.get('undo').click();assert.equal(api.analysis.writhe,wPlain);p.ids.get('redo').click();assert.equal(api.analysis.writhe,wFlipped);
 api.activateTab(original);assert.equal(api.analysis.writhe,w);api.activateTab(second);assert.equal(api.analysis.writhe,wFlipped);
 // Workspace reload retains every tab, the selected tab and geometry.
 for(const {f,ms} of p.timers.values())if(ms===700)f();
 const r=boot(p.store.get('knot-lab:workspace'));assert.equal(r.ctx.knotLab.tabs.length,2);assert.equal(r.ctx.knotLab.activeTabId,second);assert.equal(r.ctx.knotLab.analysis.writhe,wFlipped);
 r.ctx.knotLab.activateTab(original);assert.equal(r.ctx.knotLab.analysis.writhe,w);
 r.ctx.knotLab.closeTab(second);assert.equal(r.ctx.knotLab.tabs.length,1);
 r.ctx.knotLab.closeTab(original);assert.equal(r.ctx.knotLab.tabs.length,1);assert.equal(r.ctx.knotLab.analysis.c,0);
 const migrated=boot(originalDoc);assert.equal(migrated.ctx.knotLab.analysis.c,3);assert.equal(migrated.ctx.knotLab.tabs.length,1);
 console.log('New-file tabs, invalid-file isolation, independent geometry and history, workspace reload, closing and legacy migration: PASS');
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
 assert.equal(p.ids.get('documentTabs').children.filter(c=>c!==p.ids.get('newTab')).length,3);
 assert.equal(p.ids.get('documentTabs').children[2].children[0].getAttribute('aria-selected'),'true');
 api.activateTab(original);assert.equal(api.analysis.writhe,originalW);
 p.ids.get('newTab').click();assert.equal(api.tabs.length,4);assert.equal(api.analysis.c,0);
 api.activateTab(original);assert.equal(api.analysis.c,3);
 console.log('File picker batch opens, failed-file isolation, visible selected tabs and New tab: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

// Curling a strand over its own immediate neighbourhood is the slack the
// in-drag smoothing exists to absorb, so it only forms a new self-crossing
// with "Smooth corners" off; crossing a strand somewhere else is unaffected
// (covered below). Move counts, undo and redo follow the curl either way.
{
 const curl=(cornerFix)=>{
  const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv'),d=api.serialize();
  d.comps=[[[-20,0],[-2,0],[-1,3],[1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[400+5*x,200+5*y])];
  api.openTab(api.deserialize(d),'new self-crossing');api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();assert.equal(api.analysis.c,0);
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
  p.ids.get('cornerFix').onchange({target:{checked:cornerFix}});
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
  p.ids.get('sigma').oninput({target:{value:'10'}});
  const ev=(x,y,type)=>({pointerType:'mouse',pointerId:12,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
  p.fire(canvas,'pointerdown',ev(395,215,'pointerdown'));p.fire(canvas,'pointermove',ev(465,185,'pointermove'));
  for(let i=0;i<20;i++){p.step();if(api.analysis.c>=1)break;}
  p.fire(canvas,'pointerup',ev(465,185,'pointerup'));p.flush();
  return p;
 };
 assert.equal(curl(true).ctx.knotLab.analysis.c,0,'With Smooth corners on, the grip takes up that slack instead of curling');
 const p=curl(false),api=p.ctx.knotLab;
 const finalC=api.analysis.c;
 assert(finalC>=1,'A self-crossing must form');
 p.ids.get('undo').click();assert.equal(api.analysis.c,0);
 p.ids.get('redo').click();assert.equal(api.analysis.c,finalC);
}
console.log('New R1 self-crossing with Smooth corners off, undo and redo: PASS');

// Crossing a different strand, or a part of the same strand far enough away
// along its length, is untouched by the in-drag smoothing: its reach is
// measured along the strand, so only the slack beside the grip is absorbed.
for(const cornerFix of [true,false]) {
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv'),d=api.serialize();
 const ring=(cx,cy)=>{const o=[];for(let i=0;i<60;i++){const t=2*Math.PI*i/60;o.push([cx+90*Math.cos(t),cy+90*Math.sin(t)]);}return o;};
 d.comps=[ring(200,300),ring(600,300)];
 api.openTab(api.deserialize(d),'two rings');api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();
 assert.equal(api.analysis.c,0);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
 p.ids.get('cornerFix').onchange({target:{checked:cornerFix}});
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 const ev=(x,y,type)=>({pointerType:'mouse',pointerId:18,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 p.fire(canvas,'pointerdown',ev(290,300,'pointerdown'));p.fire(canvas,'pointermove',ev(640,300,'pointermove'));
 for(let i=0;i<40;i++){p.step();if(api.analysis.c>=2)break;}
 p.fire(canvas,'pointerup',ev(640,300,'pointerup'));p.flush();
 assert(api.analysis.c>=2,`Dragging one strand across another must still make crossings (cornerFix=${cornerFix})`);
}
console.log('Dragging one strand across another still makes crossings either way: PASS');

// Holding Shift while dragging reverses underneath for that gesture only,
// live for as long as it is held, without changing the base setting.
{
 const birth=(withShift)=>{
  const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv'),d=api.serialize();
  d.comps=[[[-20,0],[-2,0],[-1,3],[1,3],[2,0],[20,0],[20,20],[-20,20]].map(([x,y])=>[400+5*x,200+5*y])];
  api.openTab(api.deserialize(d),'shift drag');api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
  p.ids.get('cornerFix').onchange({target:{checked:false}});   // let the curl form
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
  p.ids.get('sigma').oninput({target:{value:'10'}});
  const ev=(x,y,type)=>({pointerType:'mouse',pointerId:12,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
  p.fire(canvas,'pointerdown',ev(395,215,'pointerdown'));
  if(withShift)p.key('keydown',{key:'Shift'});
  p.fire(canvas,'pointermove',ev(465,185,'pointermove'));
  for(let i=0;i<20;i++){p.step();if(api.analysis.c>=1)break;}
  if(withShift)p.key('keyup',{key:'Shift'});
  p.fire(canvas,'pointerup',ev(465,185,'pointerup'));p.flush();
  assert(api.analysis.c>=1);
  // The first-born crossing reflects the approach direction/weight Shift flips.
  return api.state.crossings.reduce((a,b)=>a.id<b.id?a:b).over;
 };
 assert.notEqual(birth(false),birth(true),'Shift held during the drag must flip which strand ends up on top');
 // The base setting itself must be unchanged after the gesture.
 const p=boot(),api=p.ctx.knotLab;assert.equal(p.ids.get('under').checked,false);
}
console.log('Shift held during a drag reverses underneath for that gesture only: PASS');

// The move tool's own options bar carries drag radius, underneath and its own
// Auto-relax button, so they are reachable without opening settings. Drag
// radius defaults to 80.
{
 const p=boot(),api=p.ctx.knotLab;
 assert.equal(p.ids.get('sigma').value,'80');
 assert.equal(api.opts.sigma,80);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
 assert(p.ids.get('optMove').hidden);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 assert(!p.ids.get('optMove').hidden);assert(!p.ids.get('toolopts').hidden);
 assert.equal(p.ids.get('optDraw').hidden,true);assert.equal(p.ids.get('optErase').hidden,true);assert.equal(p.ids.get('optLasso').hidden,true);
 p.ids.get('sigma').oninput({target:{value:'80'}});assert.equal(p.ids.get('sigmaV').textContent,'80');
 assert(p.ids.has('relaxMove'),'The move options bar carries its own Auto-relax button');
}
console.log('The move tool options bar shows drag radius, underneath and Auto-relax: PASS');

// Auto-relax is reachable from the move options bar and from the A shortcut,
// and both track the same run: either one stops it again, and both labels
// follow along.
{
 const p=boot(),api=p.ctx.knotLab;api.importPD(pd);
 const geometry=()=>JSON.stringify(api.serialize().comps);
 const labels=()=>[p.ids.get('smoothBtn').textContent,p.ids.get('relaxMove').textContent];
 const before=geometry();
 p.ids.get('relaxMove').onclick();p.step();
 assert.notEqual(geometry(),before,'The options bar button must start relaxing');
 assert.deepEqual(labels(),['Stop relaxing','Stop relaxing'],'Both buttons show the running state');
 p.key('keydown',{key:'a'});p.flush();
 assert.deepEqual(labels(),['Auto-relax','Auto-relax'],'A stops a run started from the options bar');
 const stopped=geometry();
 p.key('keydown',{key:'a'});p.step();
 assert.notEqual(geometry(),stopped,'A starts a run as well');
 assert.deepEqual(labels(),['Stop relaxing','Stop relaxing']);
 p.ids.get('smoothBtn').onclick();p.flush();
 assert.deepEqual(labels(),['Auto-relax','Auto-relax']);
 // A typed into a text field must stay text, not a shortcut.
 const quiet=geometry();
 p.key('keydown',{key:'a',target:p.ids.get('pdInput')});p.step();
 assert.equal(geometry(),quiet,'A inside a text field must not start relaxing');
}
console.log('Auto-relax from the move options bar and the A shortcut: PASS');

// A drag tidies up the kinks it leaves behind when it ends, in the same undo
// step, without changing the diagram's topology.
{
 const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
 api.importPD(pd);api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();
 const maxTurn=()=>Math.max(...api.state.comps.flatMap(c=>c.pts.map((q,i,a)=>{
  const prev=a[(i+a.length-1)%a.length],next=a[(i+1)%a.length];
  const ux=q.x-prev.x,uy=q.y-prev.y,vx=next.x-q.x,vy=next.y-q.y;
  return Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy));
 })));
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 p.ids.get('sigma').oninput({target:{value:'10'}});
 const hit=api.state.comps[0].pts[10],crossingsBefore=api.analysis.c;
 const ev=(x,y,type)=>({pointerType:'mouse',pointerId:31,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
 p.fire(canvas,'pointerdown',ev(hit.x,hit.y,'pointerdown'));
 p.fire(canvas,'pointermove',ev(hit.x+70,hit.y+50,'pointermove'));
 for(let i=0;i<12;i++)p.step();
 const kinkedWhileHeld=maxTurn();
 p.fire(canvas,'pointerup',ev(hit.x+70,hit.y+50,'pointerup'));p.flush();
 assert(maxTurn()<=kinkedWhileHeld,'Releasing the strand must not leave it sharper than it was mid-drag');
 assert.equal(api.analysis.c,crossingsBefore,'Tidying up must not add or remove a crossing');
 const settled=JSON.stringify(api.serialize().comps);
 p.ids.get('undo').click();
 assert.equal(api.analysis.c,crossingsBefore);
 assert.notEqual(JSON.stringify(api.serialize().comps),settled,'One undo takes back the drag and its tidy-up together');
 p.ids.get('redo').click();
 assert.equal(JSON.stringify(api.serialize().comps),settled);
}
console.log('A finished drag smooths its own sharp corners inside the drag undo step: PASS');

// Working an already-stretched strand takes up its slack: the smoothing pass
// that runs around the grip while dragging draws the strand back in instead
// of only ever paying out more of it. "Smooth corners" turns it off.
{
 const whip=(cornerFix)=>{
  const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
  api.importPD(pd);api.view.s=1;api.view.ox=0;api.view.oy=0;p.flush();
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
  p.ids.get('cornerFix').onchange({target:{checked:cornerFix}});
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
  const total=()=>api.state.comps.reduce((a,c)=>a+c.len,0);
  const ev=(x,y,type)=>({pointerType:'mouse',pointerId:44,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
  const hit=api.state.comps[0].pts[10];
  p.fire(canvas,'pointerdown',ev(hit.x,hit.y,'pointerdown'));
  // stretch a finger out, then whip it around so the strand folds up
  for(const [dx,dy] of [[260,40],[120,220],[-140,90],[60,-180]]) {
   p.fire(canvas,'pointermove',ev(hit.x+dx,hit.y+dy,'pointermove'));
   for(let i=0;i<12;i++)p.step();
  }
  p.fire(canvas,'pointerup',ev(hit.x+60,hit.y-180,'pointerup'));p.flush();
  return total();
 };
 const loose=whip(false), takenUp=whip(true);
 assert(takenUp<loose,`Dragging with Smooth corners on must take up slack (${takenUp.toFixed(0)} vs ${loose.toFixed(0)})`);
}
console.log('Dragging an already-stretched strand takes up its slack, and Smooth corners switches that off: PASS');

// Momentary crossing-switch: holding C acts like the Flip tool without
// discarding whichever tool was active, and releasing C restores it.
{
 const p=boot();
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
 p.key('keydown',{key:'c'});
 assert.equal(p.doc.querySelectorAll('[data-tool]').find(e=>e.getAttribute('aria-pressed')==='true').dataset.tool,'flip');
 p.key('keydown',{key:'c',repeat:true});
 assert.equal(p.doc.querySelectorAll('[data-tool]').find(e=>e.getAttribute('aria-pressed')==='true').dataset.tool,'flip');
 p.key('keyup',{key:'c'});
 assert.equal(p.doc.querySelectorAll('[data-tool]').find(e=>e.getAttribute('aria-pressed')==='true').dataset.tool,'draw');
}
console.log('Holding C is a momentary crossing-switch that restores the previous tool on release: PASS');

// The canvas itself isn't focusable, so focus left on a text field (PD
// code, braid word, a rename, ...) would otherwise keep swallowing every
// single-letter shortcut even after the user moved on to the diagram.
// A pointerdown on the canvas must reclaim focus so shortcuts work again.
{
 const p=boot(),canvas=p.ids.get('cv'),pressedTool=()=>p.doc.querySelectorAll('[data-tool]').find(e=>e.getAttribute('aria-pressed')==='true').dataset.tool;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
 p.ids.get('pdInput').focus();
 assert.equal(p.doc.activeElement, p.ids.get('pdInput'));
 p.key('keydown',{key:'c',target:p.ids.get('pdInput')});
 assert.equal(pressedTool(),'draw','A shortcut must stay suppressed while a text field looks focused');
 p.key('keyup',{key:'c'});
 const ev={pointerType:'mouse',pointerId:1,clientX:100,clientY:100,button:0,buttons:1,preventDefault(){}};
 p.fire(canvas,'pointerdown',ev);p.fire(canvas,'pointerup',{...ev,buttons:0});
 assert.equal(p.doc.activeElement, p.doc.body,'A canvas interaction must reclaim focus from a stale text field');
 p.key('keydown',{key:'c'});
 assert.equal(pressedTool(),'flip','The shortcut must work again once focus has moved off the text field');
 p.key('keyup',{key:'c'});
}
console.log('A canvas interaction reclaims focus so shortcuts are not silently swallowed by a stale text field: PASS');

function arcSession(pointerType='mouse',fix=true,saved) {
 const p=boot(saved),api=p.ctx.knotLab,canvas=p.ids.get('cv');
 api.view.s=1;api.view.ox=0;api.view.oy=0;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();
 p.ids.get('autoClose').onchange({target:{checked:false}});p.ids.get('cornerFix').onchange({target:{checked:fix}});
 p.ids.get('palm').onchange({target:{checked:false}});p.ids.get('penDoubleTap').onchange({target:{checked:false}});
 p.draw=ps=>{
  const ev=([x,y],type)=>({pointerType,pointerId:80,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
  p.fire(canvas,'pointerdown',ev(ps[0],'pointerdown'));for(const q of ps.slice(1))p.fire(canvas,'pointermove',ev(q,'pointermove'));
  p.paths.length=0;p.fire(canvas,'pointerup',ev(ps.at(-1),'pointerup'));p.flush();
 };
 return p;
}
const openArcs=paths=>paths.map(ps=>({pts:ps.map(([x,y])=>({x,y}))}));
// Join two open arcs across a third: the connector is below it in either
// direction, with mouse/pen/touch, and is visibly broken at the crossing.
for(const pointer of ['mouse','pen','touch'])for(const reverse of [false,true]) {
 const p=arcSession(pointer),api=p.ctx.knotLab;
 api.state.open=openArcs([[[200,50],[200,100]],[[200,300],[200,350]],[[100,200],[300,200]]]);
 const points=[[200,100],[200,150],[200,200],[200,250],[200,300]];p.draw(reverse?points.reverse():points);
 assert.equal(api.state.open.length,2);assert.equal(api.analysis.c,0,'Open arcs stay excluded from invariants');
 const m=api.state.memory.find(m=>Math.hypot(m.x-200,m.y-200)<1);assert(m&&Math.abs(m.ox)>.99&&Math.abs(m.oy)<.01,'Existing horizontal arc must be over');
 assert(p.paths.some(path=>path.some(q=>q.move&&Math.abs(q.x-200)<.01&&Math.abs(Math.abs(q.y-200)-8)<.1)),'The connector must resume after its undercrossing gap');
 const saved=JSON.stringify(api.serialize()),loaded=api.deserialize(JSON.parse(saved));assert.equal(loaded.memory.length,api.state.memory.length);
 p.ids.get('undo').click();assert.equal(api.state.open.length,3);assert.equal(api.state.memory.length,0);
 p.ids.get('redo').click();assert.equal(api.state.open.length,2);assert.equal(api.state.memory.length,1);
 api.openTab();api.activateTab(api.tabs[0].id);assert.equal(api.state.memory.length,1);
 for(const {f,ms} of p.timers.values())if(ms===700)f();const restored=boot(p.store.get('knot-lab:workspace'));assert.equal(restored.ctx.knotLab.state.memory.length,1);
}
// Closing either component first must give the same final heights, including
// persistence between drawing steps and both smoothing settings.
for(const attachAtStart of [false,true]) {
 const p=arcSession(),api=p.ctx.knotLab;
 api.state.open=openArcs([[[200,50],[200,100]],[[100,200],[300,200]]]);
 const path=[[200,100],[200,150],[200,200],[200,250],[200,300]];p.draw(attachAtStart?path:path.reverse());
 const m=api.state.memory.find(m=>Math.hypot(m.x-200,m.y-200)<1);assert(m&&Math.abs(m.ox)>.99,'One-ended connections also go underneath');
}
for(const fix of [false,true])for(const horizontalFirst of [false,true]) {
 let p=arcSession('mouse',fix),api=p.ctx.knotLab;
 api.state.open=openArcs([[[100,100],[100,50],[300,50],[300,100]],[[50,200],[350,200]]]);
 const closeHorizontal=[[350,200],[400,200],[400,450],[0,450],[0,200],[50,200]];
 const closeVertical=[[300,100],[300,200],[300,300],[200,300],[100,300],[100,200],[100,100]];
 if(horizontalFirst)p.draw(closeHorizontal);
 p.draw(closeVertical);
 if(!horizontalFirst){p=arcSession('mouse',fix,JSON.stringify(api.serialize()));api=p.ctx.knotLab;p.draw(closeHorizontal);}
 assert.equal(api.state.comps.length,2);assert.equal(api.state.open.length,0);assert.equal(api.state.crossings.length,2);
 for(const X of api.state.crossings){const o=X.occ[X.over];assert(Math.abs(o.dx)>.99&&Math.abs(o.dy)<.01,'Existing horizontal arc stays over after closure');}
 const prior=JSON.stringify(api.serialize().crossings);p.ids.get('undo').click();p.ids.get('redo').click();assert.equal(JSON.stringify(api.serialize().crossings),prior);
}
// The new connecting part also passes under an older part of the same arc.
{
 const p=arcSession('mouse',false),api=p.ctx.knotLab;
 api.state.open=openArcs([[[100,100],[300,100],[300,300]]]);
 p.draw([[300,300],[100,300],[100,50],[200,50],[200,200],[100,200],[100,100]]);
 const X=api.state.crossings.find(X=>Math.hypot(X.x-200,X.y-100)<3);assert(X);assert(Math.abs(X.occ[X.over].dx)>.99);
}
console.log('Arc connectors pass under existing open/closed/self arcs, visual gaps, both closure orders, JSON/autosave, tabs and undo/redo: PASS');

// Squeezing a bigon down to a tiny gap must not be blocked mid-drag. On
// release, "Separate overlapping crossings" eases the two crossings the drag
// pushed together back apart; with the setting off they stay exactly where
// the drag left them. Either way both crossings survive and undo restores.
{
 const squeeze=separate=>{
  const p=boot(),api=p.ctx.knotLab,canvas=p.ids.get('cv');
  const d=api.serialize();d.comps=[
  [[-80,-40],[-40,0],[0,20],[40,0],[80,-40],[80,-100],[-80,-100]],
  [[-80,40],[-40,0],[0,-20],[40,0],[80,40],[80,100],[-80,100]]
  ].map(ps=>ps.map(([x,y])=>[x+200,y+200]));
  api.openTab(api.deserialize(d),'bigon');api.view.s=1;api.view.ox=0;api.view.oy=0;
  p.ids.get('separate').onchange({target:{checked:separate}});
  p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
  const ev=(y,type)=>({pointerType:'mouse',pointerId:20,clientX:200,clientY:y,button:0,buttons:type==='pointerup'?0:1,type,preventDefault(){}});
  p.fire(canvas,'pointerdown',ev(220,'pointerdown'));p.fire(canvas,'pointermove',ev(182,'pointermove'));
  for(let i=0;i<8;i++)p.step();
  const held=api.state.crossings.map(X=>({x:X.x,y:X.y}));
  assert.equal(held.length,2,'The squeeze itself must not be blocked or collapse the bigon');
  const squeezed=Math.hypot(held[0].x-held[1].x,held[0].y-held[1].y);
  p.fire(canvas,'pointerup',ev(182,'pointerup'));p.flush();
  assert.equal(api.state.crossings.length,2,'A tiny genuine bigon must keep both crossings, not collapse');
  const [a,b]=api.state.crossings;
  return {p,api,squeezed,released:Math.hypot(a.x-b.x,a.y-b.y)};
 };
 const off=squeeze(false);
 assert(off.squeezed<16,'The drag must be able to squeeze the bigon tight in the first place');
 assert(off.released<16,'With separation off, nothing may nudge the crossings back apart on release');
 const on=squeeze(true);
 assert(on.released>off.released,'Separation must push the squeezed crossings apart');
 assert(on.released>=20,'Separation must clear the drawn undercrossing breaks');
 // The nudge rides the drag's own undo step, and cannot change the topology.
 on.p.ids.get('undo').click();
 assert.equal(on.api.state.crossings.length,2);
 const [ua,ub]=on.api.state.crossings;
 assert(Math.hypot(ua.x-ub.x,ua.y-ub.y)>on.released,'Undo must restore the pre-drag geometry, not the separated one');
 off.p.ids.get('undo').click();
 assert.equal(off.api.state.crossings.length,2);
}
console.log('A drag that squeezes a bigon is not blocked, and release-time crossing separation can be switched off: PASS');

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
 // Converting changes only crossing heights, with one undo step and stale
 // invariant work canceled. Open arcs and Reidemeister counts are untouched.
 const alt=p.ids.get('makeAlternating');assert(alt.disabled,'An alternating diagram needs no conversion');
 api.state.open=openArcs([[[600,600],[650,650]]]);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='flip').click();
 const crossing=api.state.crossings[0],ev={pointerType:'mouse',pointerId:70,clientX:crossing.x*api.view.s+api.view.ox,clientY:crossing.y*api.view.s+api.view.oy,button:0,preventDefault(){}};
 p.fire(p.ids.get('cv'),'pointerdown',ev);p.fire(p.ids.get('cv'),'pointerup',ev);
 assert(!api.analysis.alternating);assert(!alt.disabled);
 const before=api.serialize(),originalId=api.activeTabId,nextId=api.state.nextId;
 button.click();const calculating=workers.at(-1);alt.click();
 assert(calculating.terminated);calculating.complete();assert(p.ids.get('invariantResults').hidden);
 assert(api.analysis.alternating);assert(alt.disabled);assert.equal(api.state.nextId,nextId);
 const after=api.serialize();
 // Exactly one crossing changes height, and nothing about the geometry moves.
 assert.equal(after.crossings.length,before.crossings.length);
 const changedHeights=after.crossings.filter((X,i)=>JSON.stringify(X)!==JSON.stringify(before.crossings[i])).length;
 assert.equal(changedHeights,1,'Making this diagram alternating needs exactly one flip');
 for(const key of ['comps','open','crossingMemory'])assert.equal(JSON.stringify(after[key]),JSON.stringify(before[key]));
 p.ids.get('undo').click();assert(!api.analysis.alternating);assert.equal(JSON.stringify(api.serialize().crossings),JSON.stringify(before.crossings));
 p.ids.get('redo').click();assert(api.analysis.alternating);
 alt.click();p.ids.get('undo').click();assert(!api.analysis.alternating,'Already-alternating conversion must not add an undo entry');p.ids.get('redo').click();
 api.activateTab(api.tabs.find(t=>t.id!==originalId).id);assert(alt.disabled);api.activateTab(originalId);assert(api.analysis.alternating);
 for(const {f,ms} of p.timers.values())if(ms===700)f();const restored=boot(p.store.get('knot-lab:workspace'));assert(restored.ctx.knotLab.analysis.alternating);assert.equal(JSON.stringify(restored.ctx.knotLab.serialize().crossings),JSON.stringify(after.crossings));
 console.log('Make alternating: button state, minimal flips, fixed geometry, open arcs, undo/redo, tabs, autosave and canceled stale invariants: PASS');
 console.log('Invariant UI: exact results, mirror, tab switch, stale messages, cancel and retry after worker error: PASS');
}

// Inspector page navigation must reveal the PD target even from another page.
{
 const p=boot();
 p.ids.get('navSettings').click();
 assert(!p.ids.get('pageSettings').hidden);assert(p.ids.get('pageDiagram').hidden);assert(p.ids.get('pageFiles').hidden);
 p.ids.get('pdOpen').click();assert(!p.ids.get('pageFiles').hidden);assert(p.ids.get('pageSettings').hidden);
 assert.equal(p.ids.get('navFiles').getAttribute('aria-pressed'),'true');assert.equal(p.doc.activeElement,p.ids.get('pdInput'));
 assert(!p.ids.has('saveBtn2'));assert(!p.ids.has('openBtn2'));
}
// A pending native share must not replace a newer document name or clear newer edits.
(async()=>{
 const p=boot(),api=p.ctx.knotLab;api.importPD(pd);
 let finish;p.ctx.navigator.canShare=()=>true;p.ctx.navigator.share=()=>new Promise(resolve=>finish=resolve);
 const saving=p.ids.get('saveBtn').onclick();
 const item=p.ids.get('documentTabs').children[0];item.children[0].click();const field=item.children[0];
 field.value='Renamed during export';p.fire(field,'blur',{});p.ids.get('mirrorBtn').click();
 const id=api.activeTabId;api.openTab();finish();await saving;
 const tab=api.tabs.find(t=>t.id===id);assert.equal(tab.title,'Renamed during export');assert(tab.dirty);
 api.activateTab(id);assert.equal(p.ids.get('fileName').value,'Renamed during export');
 console.log('Inspector navigation, duplicate actions removed and async export rename/edit race: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

// Hit the actual strand between vertices at high zoom, not just vertex disks.
{
 const p=boot(),api=p.ctx.knotLab,d=api.serialize();
 d.comps=[[[0,0],[100,0],[100,100],[0,100]]];api.openTab(api.deserialize(d),'segment hit');
 api.view.s=6;api.view.ox=0;api.view.oy=0;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 const ev=y=>({pointerType:'mouse',pointerId:53,clientX:300,clientY:y,button:0,preventDefault(){}});
 p.fire(p.ids.get('cv'),'pointerdown',ev(0));p.fire(p.ids.get('cv'),'pointermove',ev(-30));
 for(let i=0;i<4;i++)p.step();
 p.fire(p.ids.get('cv'),'pointerup',ev(-30));p.flush();
 assert.equal(api.view.oy,0,'Dragging a segment must not pan the canvas');assert(api.state.comps[0].pts.some(q=>q.y<-.1));
 p.ids.get('undo').click();assert(api.state.comps[0].pts.every(q=>q.y>=0));
}
// Queued relaxation frames cannot modify an undo, a new run or another tab.
{
 const p=boot(),api=p.ctx.knotLab;api.importPD(pd);
 const geometry=()=>JSON.stringify(api.serialize().comps),before=geometry();
 p.ids.get('smoothBtn').click();p.step();assert.notEqual(geometry(),before);
 p.ids.get('undo').click();p.flush();assert.equal(geometry(),before);
 p.ids.get('redo').click();const partial=geometry();p.flush();assert.equal(geometry(),partial);
 p.ids.get('smoothBtn').click();p.ids.get('smoothBtn').click();p.flush();assert.equal(geometry(),partial);
 p.ids.get('smoothBtn').click();p.ids.get('undo').click();p.ids.get('smoothBtn').click();p.flush();
 assert.equal(p.ids.get('smoothBtn').textContent,'Auto-relax');
 p.ids.get('smoothBtn').click();p.ids.get('newTab').click();p.flush();assert.equal(api.analysis.c,0);
}
console.log('Segment dragging at high zoom and relaxation cancel/undo/redo/restart/tab isolation: PASS');

// The near-coincident pair previously lost one crossing and blocked every drag.
for(const pointerType of ['mouse','pen','touch']) {
 const p=boot(),api=p.ctx.knotLab,d=api.serialize();
 d.comps=[[[380,210],[399,201],[400,199.999],[401,201],[420,210],[420,220],[380,220]],[[370,200],[430,200],[430,180],[370,180]]];
 api.openTab(api.deserialize(d),'crowded crossings');assert.equal(api.analysis.c,2);
 // Make the pair non-R2 by setting opposite overstrands.
 api.state.crossings[0].over=0;api.state.crossings[1].over=1;
 api.view.s=1;api.view.ox=0;api.view.oy=0;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='move').click();
 const ev=y=>({pointerType,pointerId:54,clientX:400,clientY:y,button:0,width:1,height:1,preventDefault(){}});
 p.fire(p.ids.get('cv'),'pointerdown',ev(199.999));p.fire(p.ids.get('cv'),'pointermove',ev(185));
 for(let i=0;i<5;i++)p.step();p.fire(p.ids.get('cv'),'pointerup',ev(185));p.flush();
 assert.equal(api.analysis.c,2);assert(api.state.comps[0].pts.some(q=>q.y<195));
 p.ids.get('undo').click();assert.equal(api.analysis.c,2);assert(api.state.comps[0].pts.every(q=>q.y>=199.999));
 p.ids.get('redo').click();assert.equal(api.analysis.c,2);assert(api.state.comps[0].pts.some(q=>q.y<195));
}
console.log('Crowded crossing escape through mouse/pen/touch, undo and redo: PASS');

// Strand eraser removes a crossing-bounded arc, never its entire component.
for(const pointerType of ['mouse','pen','touch'])for(const wrap of [false,true]) {
 const p=boot(),api=p.ctx.knotLab,K=vm.runInContext('KC',p.ctx);api.importPD(pd);
 api.view.s=1;api.view.ox=0;api.view.oy=0;
 p.ids.get('penDoubleTap').onchange({target:{checked:false}});p.ids.get('palm').onchange({target:{checked:false}});
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='erase').click();
 assert.equal(p.doc.querySelectorAll('#eraseModes button').find(e=>e.dataset.erase==='strand').getAttribute('aria-pressed'),'true');
 const c=api.state.comps[0],L=c.len,cuts=api.state.crossings.flatMap(X=>X.occ.map(o=>o.s)).sort((a,b)=>a-b);
 const i=wrap?cuts.length-1:0,start=cuts[i],end=wrap?cuts[0]+L:cuts[i+1],hit=K.pointAtS(c,(start+end)/2);
 const original=JSON.stringify(api.serialize().comps),oldCrossings=api.state.crossings.map(X=>({x:X.x,y:X.y,over:X.occ[X.over]}));
 const ev=()=>({pointerType,pointerId:81,clientX:hit.x,clientY:hit.y,button:0,width:1,height:1,preventDefault(){}});
 p.fire(p.ids.get('cv'),'pointerdown',ev());
 const afterDown=JSON.stringify(api.serialize().open);
 for(let j=0;j<4;j++)p.fire(p.ids.get('cv'),'pointermove',ev());
 p.fire(p.ids.get('cv'),'pointerup',ev());p.flush();
 assert.equal(JSON.stringify(api.serialize().open),afterDown,'Repeated samples cannot cascade into neighboring strands');
 assert.equal(api.state.comps.length,0);assert.equal(api.state.open.length,1);
 const points=api.state.open[0].pts,remaining=points.slice(1).reduce((sum,q,j)=>sum+Math.hypot(q.x-points[j].x,q.y-points[j].y),0);
 assert(Math.abs(remaining-(L-(end-start)))<4.01);assert(remaining>L*.4);
 assert(oldCrossings.every(X=>api.state.memory.some(m=>Math.hypot(m.x-X.x,m.y-X.y)<1e-6&&Math.abs(m.ox*X.over.dy-m.oy*X.over.dx)<1e-6)),'Remember crossing heights for reconnection');
 const restored=api.deserialize(api.serialize());assert.equal(restored.open.length,1);
 p.ids.get('undo').click();assert.equal(JSON.stringify(api.serialize().comps),original);assert.equal(api.analysis.c,3);
 p.ids.get('redo').click();assert.equal(api.state.open.length,1);
}
// Open arcs are cut only at their own crossing boundaries; other curves survive.
{
 const p=boot(),api=p.ctx.knotLab;api.view.s=1;api.view.ox=0;api.view.oy=0;
 api.state.open=[{pts:[{x:100,y:200},{x:500,y:200}]},{pts:[{x:200,y:100},{x:200,y:300}]},{pts:[{x:400,y:100},{x:400,y:300}]}];
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='erase').click();
 const ev=x=>({pointerType:'mouse',pointerId:82,clientX:x,clientY:200,button:0,preventDefault(){}});
 p.fire(p.ids.get('cv'),'pointerdown',ev(300));p.fire(p.ids.get('cv'),'pointerup',ev(300));
 assert.equal(api.state.open.length,4);assert(api.state.open.some(s=>s.pts[0].x===200&&s.pts[0].y===100));
 const horizontal=api.state.open.filter(s=>s.pts.every(q=>q.y===200));assert.equal(horizontal.length,2);
 assert(horizontal[0].pts.at(-1).x<200);assert(horizontal[1].pts[0].x>400);
 p.ids.get('undo').click();assert.equal(api.state.open.length,3);
 // At a crossing, choose the visually upper (later drawn) vertical strand only.
 p.fire(p.ids.get('cv'),'pointerdown',ev(200));p.fire(p.ids.get('cv'),'pointerup',ev(200));
 assert(api.state.open.some(s=>s.pts[0].x===100&&s.pts.at(-1).x===500));
 assert(api.state.open.some(s=>s.pts[0].x===400&&s.pts.at(-1).y===300));
 p.ids.get('undo').click();
 // Drag across two separate strands in one gesture; one undo restores both.
 const v=(x,y)=>({...ev(x),clientY:y});
 p.fire(p.ids.get('cv'),'pointerdown',v(200,150));p.fire(p.ids.get('cv'),'pointermove',v(400,150));p.fire(p.ids.get('cv'),'pointerup',v(400,150));
 assert(api.state.open.filter(s=>s.pts[0].x===200||s.pts[0].x===400).every(s=>s.pts[0].y>200));
 p.ids.get('undo').click();assert.equal(api.state.open.length,3);
}
console.log('Strand eraser: mouse/pen/touch, cyclic arcs, stable gesture boundaries, open crossings, upper-strand hit, multi-delete, memory, JSON and undo/redo: PASS');
// Reconnect a strand-erased knot and retain a surviving crossing's height.
{
 const p=arcSession('mouse',false),api=p.ctx.knotLab,K=vm.runInContext('KC',p.ctx);api.importPD(pd);api.view.s=1;api.view.ox=0;api.view.oy=0;
 const cm=K.cloneComps(api.state.comps)[0],xs=api.state.crossings.map(X=>({x:X.x,y:X.y,over:{...X.occ[X.over]}}));
 const cut=api.state.crossings.flatMap(X=>X.occ.map(o=>o.s)).sort((a,b)=>a-b),a=cut[0],b=cut[1],hit=K.pointAtS(cm,(a+b)/2);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='erase').click();
 const ev={pointerType:'mouse',pointerId:83,clientX:hit.x,clientY:hit.y,button:0,preventDefault(){}};
 p.fire(p.ids.get('cv'),'pointerdown',ev);p.fire(p.ids.get('cv'),'pointerup',ev);
 const rem=api.state.open[0].pts,path=[[rem.at(-1).x,rem.at(-1).y]];
 for(let s=a;s<b;s+=4){const q=K.pointAtS(cm,s);path.push([q.x,q.y]);}path.push([rem[0].x,rem[0].y]);
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='draw').click();p.draw(path);
 assert.equal(api.state.open.length,0);assert.equal(api.state.comps.length,1);assert.equal(api.analysis.c,3);
 const boundary=[K.pointAtS(cm,a),K.pointAtS(cm,b)];
 const survivor=xs.find(X=>boundary.every(q=>Math.hypot(q.x-X.x,q.y-X.y)>10));assert(survivor);
 const now=api.state.crossings.find(X=>Math.hypot(X.x-survivor.x,X.y-survivor.y)<1);assert(now);
 const over=now.occ[now.over];assert(Math.abs(over.dx*survivor.over.dy-over.dy*survivor.over.dx)<.01);
 p.ids.get('undo').click();assert.equal(api.state.open.length,1);
}
// Crossing-free loops still constitute a single strand; other components survive.
{
 const p=boot(),api=p.ctx.knotLab,d=api.serialize();d.comps=[[[100,100],[200,100],[200,200],[100,200]],[[400,100],[500,100],[500,200],[400,200]]];
 api.openTab(api.deserialize(d));api.view.s=1;api.view.ox=0;api.view.oy=0;
 p.doc.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='erase').click();
 const ev={pointerType:'mouse',pointerId:84,clientX:150,clientY:100,button:0,preventDefault(){}};
 p.fire(p.ids.get('cv'),'pointerdown',ev);p.fire(p.ids.get('cv'),'pointerup',ev);
 assert.equal(api.state.comps.length,1);assert(api.state.comps[0].pts.every(q=>q.x>=400));
 p.ids.get('undo').click();assert.equal(api.state.comps.length,2);
}
console.log('Strand erase/rejoin preserves surviving crossing heights; isolated loops and other components: PASS');
