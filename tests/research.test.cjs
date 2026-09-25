const assert=require('node:assert/strict');
const KC=require('../dist/knot-core.js'),Blocks=require('../dist/graph-blocks.js'),R=require('../dist/research-analysis.js'),Inv=require('../dist/invariants.js');
require('../dist/pd-import.js');
const graph=(n,es)=>Blocks.decompose(Array.from({length:n},(_,i)=>i),es.map(([u,v,sign],i)=>({id:i+1,u,v,sign})));
let g=graph(2,[[0,1,1],[0,1,1],[0,1,1]]);assert.equal(g.blockCount,1);assert.equal(g.blocks[0].sign,'positive');assert.equal(g.blocks[0].rank,2);assert(g.isHomogeneousDiagram);
g=graph(2,[[0,1,1],[0,1,-1]]);assert.equal(g.blockCount,1);assert.equal(g.blocks[0].sign,'mixed');assert.equal(g.isHomogeneousDiagram,false);assert.deepEqual(g.blocks[0].edgeIDs,[1,2]);
g=graph(3,[[0,1,1],[1,2,-1]]);assert.equal(g.blockCount,2);assert(g.isHomogeneousDiagram);assert.deepEqual(g.articulationVertices,[1]);assert.deepEqual(g.blocks.map(b=>b.rank),[0,0]);
g=graph(4,[[0,1,1],[1,2,1],[2,3,-1],[3,0,1]]);assert.equal(g.blockCount,1);assert.equal(g.isHomogeneousDiagram,false);
assert.equal(graph(1,[[0,0,1]]).isHomogeneousDiagram,null);assert.equal(graph(3,[[0,1,1],[1,2,1],[2,0,1]]).bipartite,false);
assert.deepEqual(graph(3,[]).components,[[0],[1],[2]]);assert.equal(graph(3,[]).blockCount,0);
assert.throws(()=>Blocks.decompose([0,1],[{id:1,u:0,v:1,sign:1},{id:1,u:0,v:1,sign:-1}]),/Duplicate/);
// Independent oracle: two edges share a block iff they are joined by a chain
// of cycles. Enumerate cycles, including length-two parallel-edge cycles.
let seed=7;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let trial=0;trial<250;trial++){
 const n=2+rand(5),es=[];for(let u=0;u<n;u++)for(let v=u+1;v<n;v++)for(let k=rand(3);k>0;k--)es.push([u,v,rand(2)?1:-1]);
 const out=graph(n,es),parent=es.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
 const join=(i,j)=>parent[find(i)]=find(j),adj=Array.from({length:n},()=>[]);es.forEach(([u,v],i)=>{adj[u].push([v,i]);adj[v].push([u,i]);});
 for(let s=0;s<n;s++){
  const walk=(u,seen,path)=>{for(const [v,e] of adj[u]){if(path.includes(e))continue;if(v===s&&path.length){for(const f of path)join(f,e);}else if(v>s&&!seen.has(v)){walk(v,new Set([...seen,v]),[...path,e]);}}};walk(s,new Set([s]),[]);
 }
 const blocks=new Map();es.forEach((_,i)=>{const root=find(i);if(!blocks.has(root))blocks.set(root,[]);blocks.get(root).push(i+1);});
 const normalize=xs=>xs.map(a=>a.slice().sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);
 assert.deepEqual(normalize(out.blocks.map(b=>b.edgeIDs)),normalize([...blocks.values()]));
 const parts=skip=>{const seen=new Set([skip]);let count=0;for(let s=0;s<n;s++)if(!seen.has(s)){count++;const q=[s];seen.add(s);for(let i=0;i<q.length;i++)for(const [v] of adj[q[i]])if(!seen.has(v)){seen.add(v);q.push(v);}}return count;};
 assert.deepEqual(out.articulationVertices,Array.from({length:n},(_,i)=>i).filter(i=>parts(i)>parts(-1)));
 assert.equal(out.blocks.reduce((s,b)=>s+b.rank,0),es.length-n+out.components.length);
}
// Iterative DFS must tolerate a deep graph without a JavaScript stack overflow.
g=graph(12000,Array.from({length:11999},(_,i)=>[i,i+1,i%2?1:-1]));assert.equal(g.blockCount,11999);assert.equal(g.articulationVertices.length,11998);assert(g.isHomogeneousDiagram);
console.log('Multigraph blocks: parallel signs, bridges, cycles, isolates, diagnostics, 250 independent cycle/cut-vertex oracles and deep DFS: PASS');
const curves=c=>KC.fromCurves3D(c,440),braid=w=>curves(KC.braidCurves(w)),pd=p=>PDImport.fromPD(JSON.stringify(p),KC);
const analyze=S=>{const before=JSON.stringify(S),a=KC.analyze(S.comps,S.crossings),res=R.analyze(S,a,{name:'Fixture',invariants:Inv.calculate(a)});assert.equal(JSON.stringify(S),before);assert.equal(res.status,'ready');assert.equal(res.record.seifertCircleCount,a.sS.count);return res;};
const unknot=curves([KC.circleCurve()]),u=analyze(unknot).record;
assert.equal(u.seifertCircleCount,1);assert.equal(u.blockCount,0);assert.equal(u.canonicalSeifertGenus,0);assert.equal(u.certifiedKnotGenus,0);assert.equal(u.isTrivialJones,true);assert.equal(u.jonesSecondLowCoefficient,null);
const trefoil=braid([1,1,1]),t=analyze(trefoil).record;
assert.equal(t.crossingCount,3);assert.equal(t.seifertCircleCount,2);assert.equal(t.canonicalSeifertGenus,1);assert.equal(t.certifiedKnotGenus,1);assert.equal(t.writhe,3);assert(t.blocks.every(b=>b.sign==='positive'));assert(t.isHomogeneousDiagram);
assert.deepEqual(t.jonesTerms,[{power2:2,coefficient:'1'},{power2:6,coefficient:'1'},{power2:8,coefficient:'-1'}]);assert.equal(t.jonesSpan,3);
const fig=curves([KC.figureEightCurve()]),f=analyze(fig).record;assert.equal(f.crossingCount,4);assert.equal(f.seifertCircleCount,3);assert.equal(f.canonicalSeifertGenus,1);assert(f.isHomogeneousDiagram);assert.equal(f.positiveBlockCount,1);assert.equal(f.negativeBlockCount,1);assert.equal(f.articulationCount,1);
const five=analyze(braid(Array(5).fill(1))).record;assert.equal(five.canonicalSeifertGenus,2);assert(five.isHomogeneousDiagram);
const seven=analyze(braid(Array(7).fill(1))).record;assert.equal(seven.canonicalSeifertGenus,3);assert.equal(seven.certifiedKnotGenus,3);
const mixed=analyze(braid([1,-1])).record;assert.equal(mixed.isHomogeneousDiagram,false);assert.equal(mixed.certifiedKnotGenus,null);assert.equal(mixed.mixedBlockCount,1);
const mirror={...trefoil,crossings:trefoil.crossings.map(x=>({...x,over:1-x.over}))},m=analyze(mirror).record;
assert(m.isHomogeneousDiagram);assert.equal(m.negativeBlockCount,1);assert.deepEqual(m.seifertCircles,t.seifertCircles);assert.deepEqual(m.jonesTerms,t.jonesTerms.map(x=>({...x,power2:-x.power2})).reverse());
const knotPD=pd([[1,4,2,5],[3,6,4,1],[5,2,6,3]]),p=analyze(knotPD).record;assert.deepEqual(p.jonesTerms,m.jonesTerms,'retain the existing PD/mirror Jones normalization');
for(const S of [trefoil,fig,braid([1,2,1,-2,1,2]),curves([KC.torusCurve(3,4,2,1.15)])]){
 const plan=KC.alternatingAssignment(S.comps,S.crossings);assert(plan.ok);S.crossings.forEach((x,i)=>x.over=plan.over[i]);const a=KC.analyze(S.comps,S.crossings);assert(a.alternating);assert(R.analyze(S,a).record.isHomogeneousDiagram);
}
const unlink=curves([KC.circleCurve(),KC.circleCurve().map(p=>({...p,x:p.x+5}))]),l=analyze(unlink).record;
assert.equal(l.componentCount,2);assert.equal(l.surfaceComponentCount,2);assert.equal(l.canonicalSeifertGenus,0);assert.equal(l.certifiedKnotGenus,null);assert.equal(l.isTrivialJones,false);assert.equal(l.jonesMinExponent,-.5);
const hopf=analyze(braid([1,1])).record;assert.equal(hopf.surfaceComponentCount,1);assert.equal(hopf.canonicalSeifertGenus,0);assert.equal(hopf.certifiedKnotGenus,null);
assert.equal(R.analyze({...unknot,open:[{pts:[{x:0,y:0},{x:1,y:1}]}]},KC.analyze(unknot.comps,unknot.crossings)).status,'open');
assert.equal(R.analyze({comps:[],crossings:[]},KC.analyze([],[])).status,'empty');
// Compare the complete circle partition with the established half-edge state,
// not only the circle count, across deterministic signed braid fixtures.
for(let trial=0;trial<80;trial++){
 const word=Array.from({length:2+rand(11)},()=>((rand(3)+1)*(rand(2)?1:-1))),S=braid(word),a=KC.analyze(S.comps,S.crossings),r=R.analyze(S,a);
 assert.equal(r.status,'ready');const roots=new Map();
 for(const circle of r.seifert.circles)for(const arc of circle.arcs){const root=a.sS.uf.find(2*arc);assert.equal(a.sS.uf.find(2*arc+1),root);if(roots.has(root))assert.equal(roots.get(root),circle.id);else roots.set(root,circle.id);}
 assert.equal(new Set(roots.values()).size,roots.size);assert.equal(roots.size,r.record.seifertCircleCount-a.free);
 const plan=KC.alternatingAssignment(S.comps,S.crossings);assert(plan.ok);S.crossings.forEach((x,i)=>x.over=plan.over[i]);assert(R.analyze(S,KC.analyze(S.comps,S.crossings)).record.isHomogeneousDiagram);
}
console.log('Finalized diagrams: unknot, positive trefoil, figure-eight, 5_1, genus-3 T(2,7), alternating diagrams, mirrors, PD, Hopf, split unlink, 80 signed-braid partitions/alternating certificates and open-arc exclusion: PASS');
const data=R.jonesData({status:'ready',terms:[{power2:8,coefficient:'9007199254740993123'},{power2:-4,coefficient:'-2'},{power2:0,coefficient:'3'}]});
assert.equal(data.jonesMinExponent,-2);assert.equal(data.jonesMaxExponent,4);assert.equal(data.jonesSpan,6);assert.equal(data.jonesMaxCoefficient,'9007199254740993123');assert.equal(data.jonesSecondLowCoefficient,'3');assert.equal(data.jonesSecondHighCoefficient,'3');assert.equal(data.isTrivialJones,false);
assert.equal(R.jonesData({status:'limited'}).isTrivialJones,null);assert.equal(R.jonesData(null).jonesSpan,null);
assert.equal(R.jonesData({status:'ready',terms:[{power2:2,coefficient:'1'}]}).isTrivialJones,false);
assert(R.compare({jonesMinCoefficient:'9007199254740993123'},{jonesMinCoefficient:'9007199254740993122'},'jonesMinCoefficient')>0);
assert.equal(R.json([t,f]),R.json([t,f]));assert.equal(JSON.parse(R.json([t])).records[0].jonesMinCoefficient,'1');
assert(R.csv([{...t,name:'=HYPERLINK("x")'}]).includes("'=HYPERLINK"));assert(R.csv([{...t,name:'a,"b"\nc'}]).includes('"a,""b""\nc"'));
console.log('Jones occupied extremes, exact integers, half-exponents, null limits, deterministic JSON/CSV and safe names: PASS');

const Dataset=require('../dist/research-dataset.js'),fs=require('node:fs'),vm=require('node:vm');
const code='[[1,4,2,5],[3,6,4,1],[5,2,6,3]]';
assert.equal(Dataset.parse(code).length,1);
assert.equal(Dataset.parse('Trefoil: PD[X[1,4,2,5],\nX[3,6,4,1],X[5,2,6,3]]\nCurl: [[1,2,2,1]]')[0].name,'Trefoil');
assert.equal(Dataset.parse(JSON.stringify([{name:'a',pd:JSON.parse(code)},{name:'b',pd:code}])).length,2);
assert.equal(Dataset.parse('name,pd\n"trefoil, \"\"one\"\"",'+JSON.stringify(code))[0].name,'trefoil, "one"');
assert.equal(Dataset.parse('name\tpd_notation\n3_1\t'+code)[0].pd,code);
assert.equal(Dataset.parse('{"diagrams":[{"name":"unknot","unknot":true}]}')[0].unknot,true);
assert.throws(()=>Dataset.parse('[1,2'),/brackets/);assert.throws(()=>Dataset.parse('4 6 2'),/PD/);assert.throws(()=>Dataset.parse('x'.repeat(Dataset.MAX_BYTES+1)),/5 MB/);
assert.throws(()=>Dataset.parse(JSON.stringify(Array(10001).fill(code))),/10,000/);
assert.equal(Dataset.parse(JSON.stringify([{name:'missing PD'}]))[0].pd,'','individual malformed records are retained for error reporting');
assert.throws(()=>Dataset.parse(JSON.stringify([{name:'한'.repeat(Math.floor(Dataset.MAX_BYTES/3)+1),unknot:true}])),/5 MB/,'pasted input uses the same UTF-8 byte limit as file uploads');
const messages=[],ctx={TextEncoder,postMessage:m=>messages.push(m)};ctx.self=ctx;ctx.globalThis=ctx;ctx.importScripts=(...names)=>names.forEach(n=>vm.runInContext(fs.readFileSync('dist/'+n.replace('./',''),'utf8'),ctx));vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/research-worker.js','utf8'),ctx);
const dataset=JSON.stringify([{name:'trefoil',pd:code},{name:'bad',pd:'[[1,2,1,2]]'},{name:'unknot',unknot:true}]);
ctx.self.onmessage({data:{id:12,text:dataset,jones:true}});
assert.equal(messages[0].type,'start');assert.equal(messages.at(-1).type,'done');assert(messages.every(m=>m.id===12));
const batch=messages.filter(m=>m.type==='row').map(m=>m.record);assert.equal(batch.length,3);assert.equal(batch[0].canonicalSeifertGenus,1);assert.equal(batch[0].isHomogeneousDiagram,true);assert.equal(batch[1].status,'error');assert.equal(batch[2].isTrivialJones,true);
assert.deepEqual(JSON.parse(JSON.stringify(batch[0].signedSeifertGraph)),p.signedSeifertGraph,'batch and editor use the same finalized reconstruction');assert.deepEqual(JSON.parse(JSON.stringify(batch[0].jonesTerms)),p.jonesTerms);
messages.length=0;ctx.self.onmessage({data:{id:13,text:code,jones:false}});assert.equal(messages.find(m=>m.type==='row').record.isTrivialJones,null);
messages.length=0;ctx.self.onmessage({data:{id:14,text:'not PD'}});assert.equal(messages.at(-1).type,'error');
console.log('Local PD/JSON/CSV/TSV adapters, limits, real batch worker, per-row errors, progress, optional Jones and finalized-state parity: PASS');
