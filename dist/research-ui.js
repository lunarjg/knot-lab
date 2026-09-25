/* Research inspector and batch controller. Diagram edits remain owned by the editor. */
(function(root){
'use strict';
const COLORS=['#176c82','#c0491b','#7053a0','#25804b','#a12c63','#856207','#345fbd','#9b483e'];
const columns=[['name','Name'],['crossingCount','c'],['componentCount','μ'],['canonicalSeifertGenus','Genus'],['isHomogeneousDiagram','Homogeneous'],['blockCount','Blocks'],['positiveBlockCount','+ blocks'],['negativeBlockCount','− blocks'],['mixedBlockCount','Mixed'],['jonesSpan','Jones span'],['jonesMinCoefficient','Min coeff.'],['jonesMaxCoefficient','Max coeff.'],['isTrivialJones','V = 1'],['status','Status']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display=v=>v===null||v===undefined?'—':typeof v==='boolean'?v?'Yes':'No':Array.isArray(v)?v.join(', '):String(v);
function mount(host) {
 const $=id=>document.getElementById(id),R=root.KnotResearch;
 let result=null,sourceRef=null,sourceTab=null,openCount=-1,selected=null,batchWorker=null,batchID=0,rows=[],total=0,filters=[],sortKey='name',sortDir=1,page=0,queued=false;
 let renderResult=null,renderMaps=null,selectionResult=null,selectionRef=null,selectionCache=null,graphResult=null,graphSelection=null;
 const emptySelection={circles:new Set(),crossings:new Set()};
 const visible=()=>$('pageResearch').hidden===false&&!$('inspector').inert;
 const current=()=>{const s=host.source();return !s.busy&&s.analysis===sourceRef&&s.tabId===sourceTab&&!s.state.open.length?result:null;};
 function download(text,type,name){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const dl=(id,entries)=>{$(id).innerHTML=entries.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(display(v))+'</dd>').join('');};
 function ensure(){
  const s=host.source();
  if(s.analysis!==sourceRef||s.tabId!==sourceTab||openCount!==s.state.open.length){result=null;selected=null;sourceRef=s.analysis;sourceTab=s.tabId;openCount=s.state.open.length;}
  if(s.busy)return {status:'editing',message:'Editing… Research updates when the gesture finishes.'};
  if(!s.analysis)return {status:'empty',message:'Draw or import a closed diagram.'};
  if(!result){try{result=R.analyze(s.state,s.analysis,{name:s.name,invariants:s.invariants});}catch(error){result={status:'diagnostic',message:error.message};}}
  if(result.record){Object.assign(result.record,{name:s.name,determinant:s.invariants?.coloring?.determinant??null,foxColorings:s.invariants?.coloring?.colorings??null,linkingNumbers:s.invariants?.linking??null},R.jonesData(s.invariants?.jones));}
  return result;
 }
 function refresh(){
  if(!visible()){const s=host.source();if(s.analysis!==sourceRef||s.tabId!==sourceTab||s.state.open.length){result=null;selected=null;}return;}
  const r=ensure(),record=r.record,ok=r.status==='ready';
  $('researchStatus').textContent=ok?(record.isHomogeneousDiagram?'This diagram is homogeneous.':'This diagram is not homogeneous.'):(r.message||record?.diagnostics.join(' ')||'Research analysis unavailable.');
  $('researchStatus').className=ok&&record.isHomogeneousDiagram?'research-positive':'';
  $('researchMeaning').textContent=ok?(record.isHomogeneousDiagram?'Therefore the represented knot/link is certified homogeneous.':'This does NOT prove that the represented knot/link is non-homogeneous; another diagram of the same knot/link may be homogeneous.') : '';
  $('researchGraphSection').hidden=!ok;
  $('researchJSON').disabled=$('researchCSV').disabled=!ok;
  $('researchCalculate').disabled=!ok||host.source().calculating;
  $('researchCancelJones').hidden=!host.source().calculating;
  $('researchGenusNote').textContent=ok?(record.surfaceComponentCount>1?'Sum of genera over '+record.surfaceComponentCount+' disconnected canonical Seifert surfaces.':record.certifiedKnotGenus!==null?'Certified knot genus: '+record.certifiedKnotGenus:'Canonical Seifert genus is a property of this diagram; it is not a knot-genus certificate.') : '';
  dl('researchStats',ok?[
   ['Crossings c',record.crossingCount],['Components μ',record.componentCount],['Positive / negative',record.positiveCrossingCount+' / '+record.negativeCrossingCount],['Writhe',record.writhe],['Seifert circles s',record.seifertCircleCount],['Canonical Seifert genus of this diagram',record.canonicalSeifertGenus],['Blocks (+ / − / mixed)',record.blockCount+' ('+record.positiveBlockCount+' / '+record.negativeBlockCount+' / '+record.mixedBlockCount+')'],['Articulations',record.articulationCount],['Block ranks',record.blockRanks],['sA / sB / gT(D)',record.sA+' / '+record.sB+' / '+record.gT],['A / B adequate',display(record.aAdequate)+' / '+display(record.bAdequate)],['Determinant',record.determinant],['Fox 3-colorings',record.foxColorings]
  ]:[]);
  const ready=ok&&record.jonesStatus==='ready';
  $('researchJonesStatus').textContent=ok?(record.jonesStatus==='limited'?'Jones not calculated: more than 18 crossings. Other available invariants are retained.':host.source().invariantStatus):'Close a diagram to calculate.';
  $('researchJones').textContent=ready?record.jonesPolynomial:'—';
  dl('researchJonesStats',ready?[
   ['Exponent range',record.jonesMinExponent+' … '+record.jonesMaxExponent],['Span',record.jonesSpan],['Lowest / next occupied coefficients',record.jonesMinCoefficient+' / '+display(record.jonesSecondLowCoefficient)],['Highest / next occupied coefficients',record.jonesMaxCoefficient+' / '+display(record.jonesSecondHighCoefficient)],['Nonzero terms',record.jonesTermCount],['Exactly V(t) = 1',record.isTrivialJones]
  ]:[]);
  $('researchPreview').checked=host.source().viewMode==='S';
  if(ok)drawGraph();
 }
 function select(kind,id){
  const r=ensure();if(r.status!=='ready')return false;
  selected={kind,id};if(kind==='circle')host.view('S');else if(host.source().viewMode==='AD')host.view('diagram');
  drawGraph();host.render();return true;
 }
 // Build lookup tables once per finalized analysis, not once per rendered arc.
 function maps(r){
  if(renderResult!==r){renderResult=r;renderMaps={colors:new Map(),free:new Map(),blocks:new Map(r.record.blocks.map(b=>[b.id,b]))};r.seifert.circles.forEach((c,i)=>{renderMaps.colors.set(c.id,COLORS[i%COLORS.length]);if(c.freeComponent!==null)renderMaps.free.set(c.freeComponent,c.id);});}
  return renderMaps;
 }
 function selectionSets(r=current()){
  if(r?.status!=='ready'||!selected)return emptySelection;
  if(selectionResult===r&&selectionRef===selected)return selectionCache;
  const circles=new Set(),crossings=new Set();
  if(selected.kind==='circle')circles.add(selected.id);
  if(selected.kind==='edge')crossings.add(Number(selected.id));
  if(selected.kind==='block'){const b=maps(r).blocks.get(selected.id);if(b){b.vertexIDs.forEach(i=>circles.add(i));b.edgeIDs.forEach(i=>crossings.add(i));}}
  selectionResult=r;selectionRef=selected;return selectionCache={circles,crossings};
 }
 function drawGraph(){
  const r=current();if(r?.status!=='ready'||(graphResult===r&&graphSelection===selected))return;
  graphResult=r;graphSelection=selected;
  const {vertices,edges}=r.record.signedSeifertGraph,n=vertices.length;
  const parallel=new Map();edges.forEach(e=>{const key=[e.u,e.v].sort().join('/');if(!parallel.has(key))parallel.set(key,[]);parallel.get(key).push(e);});
  const widest=Math.max(1,...[...parallel.values()].map(es=>es.length)),w=Math.max(300,Math.min(850,n*42),widest*42+90),h=Math.max(235,Math.min(850,n*42));
  const pos=new Map(vertices.map((v,i)=>[v.id,{x:n===1?w/2:w/2+(w/2-60)*Math.cos(-Math.PI/2+2*Math.PI*i/n),y:n===1?h/2:h/2+(h/2-50)*Math.sin(-Math.PI/2+2*Math.PI*i/n)}]));
  const blocks=new Map();r.record.blocks.forEach((b,i)=>b.edgeIDs.forEach(e=>blocks.set(e,i)));
  const sets=selectionSets(r),activeEdges=sets.crossings,cut=new Set(r.record.articulationVertices);let svg='';
  // Parallel fans can bend beyond the initial layout, especially vertically.
  // Bound their actual quadratic extrema and labels rather than clipping them.
  const bounds={x0:0,y0:0,x1:w,y1:h},include=(x,y,px=8,py=px)=>{bounds.x0=Math.min(bounds.x0,x-px);bounds.y0=Math.min(bounds.y0,y-py);bounds.x1=Math.max(bounds.x1,x+px);bounds.y1=Math.max(bounds.y1,y+py);};

  for(const group of parallel.values())group.forEach((e,i)=>{
   const [u,v]=[e.u,e.v].sort(),a=pos.get(u),b=pos.get(v),dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,offset=(i-(group.length-1)/2)*76;
   const cx=(a.x+b.x)/2-dy/L*offset,cy=(a.y+b.y)/2+dx/L*offset,mx=(a.x+2*cx+b.x)/4,my=(a.y+2*cy+b.y)/4;
   const d=`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`,chosen=activeEdges.has(e.id),color=COLORS[(blocks.get(e.id)||0)%COLORS.length],label='X'+e.id+' '+(e.sign>0?'+':'−');
   include(a.x,a.y);include(b.x,b.y);include(mx,my-8,Math.max(22,label.length*3.5),12);
   for(const [p,q,c] of [[a.x,b.x,cx],[a.y,b.y,cy]]){const t=(p-c)/(p-2*c+q);if(t>0&&t<1){const u=1-t;include(u*u*a.x+2*u*t*cx+t*t*b.x,u*u*a.y+2*u*t*cy+t*t*b.y);}}
   svg+='<g role="button" tabindex="0" data-kind="edge" data-id="'+esc(e.id)+'" aria-label="'+esc(label+', '+r.record.blocks[blocks.get(e.id)]?.id)+'" aria-pressed="'+chosen+'"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+(chosen?5:2)+'"/><path d="'+d+'" fill="none" stroke="transparent" stroke-width="14"/><text x="'+mx+'" y="'+(my-5)+'" class="research-edge-label">'+label+'</text></g>';
  });
  vertices.forEach((v,i)=>{const p=pos.get(v.id),chosen=sets.circles.has(v.id);include(p.x,p.y,Math.max(25,v.id.length*3),25);svg+='<g role="button" tabindex="0" data-kind="circle" data-id="'+esc(v.id)+'" aria-label="Seifert circle '+esc(v.id)+(cut.has(v.id)?', articulation':'')+'" aria-pressed="'+chosen+'">'+(cut.has(v.id)?'<circle cx="'+p.x+'" cy="'+p.y+'" r="22" class="research-articulation"/>':'')+'<circle cx="'+p.x+'" cy="'+p.y+'" r="17" fill="'+COLORS[i%COLORS.length]+'" stroke="'+(chosen?'var(--ink)':'var(--paper)')+'" stroke-width="'+(chosen?5:2)+'"/><text x="'+p.x+'" y="'+(p.y+4)+'" class="research-vertex-label">'+esc(v.id)+'</text></g>';});
  const focus=document.activeElement?.closest?.('[data-kind]'),focusKind=focus?.dataset.kind,focusID=focus?.dataset.id;
  const x0=Math.floor(bounds.x0),y0=Math.floor(bounds.y0),width=Math.ceil(bounds.x1)-x0,height=Math.ceil(bounds.y1)-y0;
  $('researchGraph').innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+x0+' '+y0+' '+width+' '+height+'" style="min-width:'+width+'px" aria-label="Signed Seifert multigraph">'+svg+'</svg>';
  $('researchCircles').innerHTML=vertices.map((v,i)=>'<button data-kind="circle" data-id="'+esc(v.id)+'" style="border-color:'+COLORS[i%COLORS.length]+'">'+esc(v.id)+'</button>').join('');
  $('researchEdges').innerHTML=edges.map(e=>'<button data-kind="edge" data-id="'+esc(e.id)+'">X'+esc(e.id)+' '+(e.sign>0?'+':'−')+'</button>').join('');
  $('researchBlocks').innerHTML=r.record.blocks.length?r.record.blocks.map((b,i)=>'<button data-kind="block" data-id="'+b.id+'" aria-pressed="'+(selected?.kind==='block'&&selected.id===b.id)+'" style="border-left-color:'+COLORS[i%COLORS.length]+'"><strong>'+b.id+' · '+b.sign+'</strong><span>'+b.vertexCount+' vertices · '+b.edgeCount+' edges · rank '+b.rank+'</span><small>'+b.vertexIDs.map(esc).join(', ')+' · '+b.edgeIDs.map((e,j)=>'X'+esc(e)+(b.edgeSigns[j]>0?'+':'−')).join(', ')+'</small></button>').join(''):'<p class="small">No edge blocks. Isolated Seifert circles are retained.</p>';
  $('researchSelection').textContent=selected?(selected.kind==='edge'?'Crossing X'+selected.id:selected.kind==='circle'?'Circle '+selected.id:'Block '+selected.id)+' selected.':'Select an edge, circle or block.';
  if(focusKind&&focusID)$('pageResearch').querySelector('[data-kind="'+focusKind+'"][data-id="'+focusID+'"]')?.focus({preventScroll:true});
 }
 function pick(w,tol){
  if(!visible()||!$('researchPick').checked)return false;
  const r=ensure();if(r.status!=='ready')return true;
  const nearest=host.source().state.crossings.map(x=>({id:x.id,d:Math.hypot(x.x-w.x,x.y-w.y)})).filter(x=>x.d<tol).sort((a,b)=>a.d-b.d)[0];
  if(nearest)select('edge',nearest.id);return true;
 }
 function paint(ctx,view,KC,tracePiece){
  const r=current();if(r?.status!=='ready'||!visible())return;
  const s=host.source().state,sets=selectionSets(r);ctx.save();
  for(const [i,circle] of r.seifert.circles.entries()){
   if(sets.circles.has(circle.id)&&host.source().viewMode!=='S'){
    ctx.strokeStyle=COLORS[i%COLORS.length];ctx.lineWidth=9/view.s;ctx.globalAlpha=.4;ctx.beginPath();
    if(circle.freeComponent!==null){const cm=s.comps[circle.freeComponent];tracePiece(cm,0,cm.len);}
    for(const ai of circle.arcs){const a=r.seifert.arcs[ai];tracePiece(s.comps[a.component],a.s0,a.s1);}ctx.stroke();
   }
   if(host.source().viewMode==='S'){
    const a=circle.arcs.length?r.seifert.arcs[circle.arcs[0]]:null,cm=s.comps[a?a.component:circle.freeComponent],p=KC.pointAtS(cm,a?(a.s0+a.s1)/2:cm.len/2);
    ctx.globalAlpha=1;ctx.font='600 '+(12/view.s)+'px sans-serif';ctx.fillStyle=COLORS[i%COLORS.length];ctx.fillText(circle.id,p.x+9/view.s,p.y-9/view.s);
   }
  }
  ctx.globalAlpha=1;ctx.strokeStyle='#bd3c35';ctx.lineWidth=3/view.s;
  for(const x of s.crossings)if(sets.crossings.has(x.id)){ctx.beginPath();ctx.arc(x.x,x.y,15/view.s,0,2*Math.PI);ctx.stroke();}
  ctx.restore();
 }
 function circleColor(arc,freeComponent){if(!visible())return null;const r=current();if(r?.status!=='ready')return null;const m=maps(r),id=freeComponent===undefined?r.seifert.circleOfArc[arc]:m.free.get(freeComponent);return m.colors.get(id)||null;}
 function circleHighlighted(arc,freeComponent){if(!visible()||!selected)return false;const r=current();if(r?.status!=='ready')return false;const id=freeComponent===undefined?r.seifert.circleOfArc[arc]:maps(r).free.get(freeComponent);return selectionSets(r).circles.has(id);}
 const choose=e=>{const el=e.target.closest('[data-kind]');if(el)select(el.dataset.kind,el.dataset.id);};
 for(const id of ['researchGraph','researchCircles','researchEdges','researchBlocks']){$(id).onclick=choose;$(id).onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-kind]')){e.preventDefault();choose(e);}};}
 $('researchPreview').onchange=()=>{host.view($('researchPreview').checked?'S':'diagram');refresh();};
 $('researchClearSelection').onclick=()=>{selected=null;drawGraph();host.render();};
 $('researchCalculate').onclick=()=>host.calculate();$('researchCancelJones').onclick=()=>host.cancel();
 for(const type of ['JSON','CSV'])$('research'+type).onclick=()=>{const r=ensure();if(r.status==='ready')download(type==='JSON'?R.json([r.record]):R.csv([r.record]),type==='JSON'?'application/json':'text/csv;charset=utf-8','knot-research.'+type.toLowerCase());};
 // Batch data never enters the current editor state. Terminating its dedicated
 // worker cancels even a synchronous PD reconstruction or Jones expansion.
 function stopBatch(){batchID++;if(batchWorker)batchWorker.terminate();batchWorker=null;$('researchBatchCancel').hidden=true;$('researchBatchRun').disabled=false;}
 function filtered(){return rows.filter(r=>filters.every(f=>r[f.key]!==null&&r[f.key]!==undefined&&(f.op==='eq'?R.compare(r,{[f.key]:f.value},f.key)===0:f.op==='gte'?R.compare(r,{[f.key]:f.value},f.key)>=0:R.compare(r,{[f.key]:f.value},f.key)<=0))).map((r,i)=>({r,i})).sort((a,b)=>sortDir*R.compare(a.r,b.r,sortKey)||a.i-b.i).map(x=>x.r);}
 function renderBatch(){
  queued=false;const filteredRows=filtered(),pages=Math.max(1,Math.ceil(filteredRows.length/50));page=Math.min(page,pages-1);
  $('researchBatchTable').innerHTML='<table><thead><tr>'+columns.map(([k,label])=>'<th scope="col"'+(k===sortKey?' aria-sort="'+(sortDir===1?'ascending':'descending')+'"':'')+'><button data-sort="'+k+'">'+esc(label)+(k===sortKey?(sortDir===1?' ↑':' ↓'):'')+'</button></th>').join('')+'</tr></thead><tbody>'+filteredRows.slice(page*50,(page+1)*50).map(r=>'<tr>'+columns.map(([k])=>'<td>'+(k==='status'&&r.diagnostics?.length?'<details class="research-row-error"><summary>'+esc(display(r[k]))+'</summary>'+esc(r.diagnostics.join(' '))+'</details>':esc(display(r[k])))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  $('researchPage').textContent=filteredRows.length+' of '+rows.length+' completed rows · Page '+(page+1)+' / '+pages;
  $('researchPrev').disabled=page===0;$('researchNext').disabled=page+1>=pages;
  $('researchBatchJSON').disabled=$('researchBatchCSV').disabled=!filteredRows.length;
  $('researchFilters').textContent=filters.map(f=>(columns.find(c=>c[0]===f.key)?.[1]||f.key)+' '+({eq:'=',gte:'≥',lte:'≤'}[f.op])+' '+f.value).join(' · ');
 }
 const scheduleBatch=()=>{if(!queued){queued=true;requestAnimationFrame(renderBatch);}};
 $('researchBatchRun').onclick=()=>{
  stopBatch();rows=[];total=0;page=0;renderBatch();const id=batchID;
  try{
   batchWorker=new Worker('./research-worker.js');$('researchBatchRun').disabled=true;$('researchBatchCancel').hidden=false;$('researchBatchProgress').value=0;$('researchBatchProgress').max=1;
   $('researchBatchStatus').textContent='Reading local dataset…';
   batchWorker.onmessage=({data})=>{
    if(data.id!==batchID)return;
    if(data.type==='start'){total=data.total;$('researchBatchProgress').max=total;$('researchBatchStatus').textContent='0 / '+total+' completed';}
    if(data.type==='row'){rows.push(data.record);$('researchBatchProgress').value=data.completed;$('researchBatchStatus').textContent=data.completed+' / '+data.total+' completed';scheduleBatch();}
    if(data.type==='done'){stopBatch();$('researchBatchStatus').textContent='Finished '+rows.length+' rows · '+rows.filter(r=>r.status==='error').length+' errors';renderBatch();}
    if(data.type==='error'){stopBatch();$('researchBatchStatus').textContent=data.error;renderBatch();}
   };
   batchWorker.onerror=()=>{if(id!==batchID)return;stopBatch();$('researchBatchStatus').textContent='Batch worker failed. Completed rows are retained; reload and retry.';renderBatch();};
   batchWorker.postMessage({id,text:$('researchBatchInput').value,jones:$('researchBatchJones').checked});
  }catch{stopBatch();$('researchBatchStatus').textContent='Batch analysis requires browser worker support.';}
 };
 $('researchBatchCancel').onclick=()=>{stopBatch();$('researchBatchStatus').textContent='Canceled · '+rows.length+' / '+total+' rows completed and retained';renderBatch();};
 $('researchBatchFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){$('researchBatchStatus').textContent='Choose a dataset no larger than 5 MB.';return;}try{$('researchBatchInput').value=await file.text();$('researchBatchStatus').textContent='Loaded '+file.name+' locally. Ready to run.';}catch{$('researchBatchStatus').textContent='Could not read that file.';}};
 $('researchFilterField').innerHTML=columns.filter(([k])=>!['name','status'].includes(k)).map(([k,label])=>'<option value="'+k+'">'+label+'</option>').join('');
 $('researchAddFilter').onclick=()=>{
  const key=$('researchFilterField').value,op=$('researchFilterOp').value,text=$('researchFilterValue').value.trim();let value;
  if(['isHomogeneousDiagram','isTrivialJones'].includes(key)){if(!/^(true|false|yes|no)$/i.test(text)){$('researchFilters').textContent='Enter true or false.';return;}value=/^(true|yes)$/i.test(text);}
  else if(key.endsWith('Coefficient')){if(!/^-?\d+$/.test(text)){$('researchFilters').textContent='Enter an integer coefficient.';return;}value=String(BigInt(text));}
  else {value=Number(text);if(!text||!Number.isFinite(value)){$('researchFilters').textContent='Enter a number.';return;}}
  filters.push({key,op,value});page=0;renderBatch();
 };
 $('researchGenus3').onclick=()=>{filters=[{key:'canonicalSeifertGenus',op:'eq',value:3},{key:'isHomogeneousDiagram',op:'eq',value:true},{key:'componentCount',op:'eq',value:1}];page=0;renderBatch();};
 $('researchClearFilters').onclick=()=>{filters=[];page=0;renderBatch();};
 $('researchBatchTable').onclick=e=>{const b=e.target.closest('[data-sort]');if(b){sortDir=sortKey===b.dataset.sort?-sortDir:1;sortKey=b.dataset.sort;page=0;renderBatch();}};
 $('researchPrev').onclick=()=>{page--;renderBatch();};$('researchNext').onclick=()=>{page++;renderBatch();};
 for(const type of ['JSON','CSV'])$('researchBatch'+type).onclick=()=>download(type==='JSON'?R.json(filtered()):R.csv(filtered()),type==='JSON'?'application/json':'text/csv;charset=utf-8','knot-research-batch.'+type.toLowerCase());
 renderBatch();
 return {refresh,select,pick,paint,circleColor,circleHighlighted,get picking(){return visible()&&$('researchPick').checked;},get record(){return ensure().record||null;},get selection(){return selected;},get batchRows(){return rows.slice();},get filteredRows(){return filtered();}};
}
root.KnotResearchUI={mount};
})(typeof globalThis!=='undefined'?globalThis:self);
