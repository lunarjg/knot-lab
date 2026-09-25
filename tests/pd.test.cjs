const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8');
const core=fs.readFileSync('dist/knot-core.js','utf8');
vm.runInThisContext(core+'\nglobalThis.KC=KC;');
require('../dist/pd-import.js');
const cases=[
 ['R1',()=>({comps:null}),[[1,2,2,1]]],
 ['trefoil',()=>KC.fromCurves3D([KC.torusCurve(2,3,2,1)],420)],
 ['figure8',()=>KC.fromCurves3D([KC.figureEightCurve()],440)],
 ['hopf',()=>KC.fromCurves3D(KC.braidCurves([1,1]),360)],
 ['torus34',()=>KC.fromCurves3D([KC.torusCurve(3,4,2,1.15)],520)],
 ['mixed braid',()=>KC.fromCurves3D(KC.braidCurves([1,1,1,2,-1,2]),460)]
];
for(const [name,make,pd0] of cases){const obj=make(),a=pd0?null:KC.analyze(obj.comps,obj.crossings);const pd=pd0||a.pd;
 try{const start=performance.now(),res=PDImport.fromPD(JSON.stringify(pd),KC),b=KC.analyze(res.comps,res.crossings);console.log(name+': PASS');
 if(a)for(const key of ['c','mu','writhe','gT','gSeif'])assert.equal(b[key],a[key],name+' '+key);if(a){assert.equal(b.sA.count,a.sA.count);assert.equal(b.sB.count,a.sB.count);}
 }catch(e){console.error(name,e.stack);process.exitCode=1;}
}
const trefoil=[[1,4,2,5],[3,6,4,1],[5,2,6,3]];
const split=trefoil.concat(trefoil.map(row=>row.map(n=>n+6)));
const splitObj=PDImport.fromPD(JSON.stringify(split),KC);assert.equal(KC.analyze(splitObj.comps,splitObj.crossings).mu,2);
for(const code of ['PD[X[1,4,2,5],X[3,6,4,1],X[5,2,6,3]]','[(1,4,2,5),(3,6,4,1),(5,2,6,3)]'])assert.equal(PDImport.fromPD(code,KC).crossings.length,3);
for(const code of ['','[]','[[1,2,3,4]]','[[1,2,3]]','[[0,1,1,0]]','[[1.1,2,2,1.1]]','alert(1)','[[1,2,1,2]]','[[9007199254740992,1,1,9007199254740992]]'])assert.throws(()=>PDImport.fromPD(code,KC),code);
let count=0;
for(const word of [[1,-2,1,-2],[1,2,1,-2,1,2,1,-2],[1,1,2,2,3,3],[1,2,-3,1,-2,3,1,2,3],[1,1,1,1,1,1,1,1,1],[1,2,1,2,1,2,1,2,1,2,1,2]]){
 const obj=KC.fromCurves3D(KC.braidCurves(word),480),a=KC.analyze(obj.comps,obj.crossings),out=PDImport.fromPD(JSON.stringify(a.pd),KC),b=KC.analyze(out.comps,out.crossings);
 for(const key of ['c','mu','writhe','gT','gSeif'])assert.equal(b[key],a[key]);assert.equal(b.sA.count,a.sA.count);assert.equal(b.sB.count,a.sB.count);count++;
}
console.log('Split links, alternate syntaxes, nine invalid inputs, and '+count+' additional braid diagrams passed');

// The exported PD code must really encode the diagram on the canvas. Nothing
// below reuses analyze()'s structures: the Kauffman bracket is computed from
// the PD integers alone, so it fails if the writer emits the wrong labels, the
// wrong counterclockwise order, or the wrong crossing signs.
{
 const INV=require('../dist/invariants.js');
 // Slot 0 is the incoming understrand and slot 2 the outgoing one; every label
 // occurs exactly twice, once entering a crossing and once leaving one, so
 // those known slots propagate to the over positions. The overstrand enters on
 // one of slots 1/3 and leaves by the other, which seeds a strand that passes
 // over twice in a row.
 const orient=pd=>{
  const pos=new Map();
  pd.forEach((row,i)=>row.forEach((L,k)=>{if(!pos.has(L))pos.set(L,[]);pos.get(L).push([i,k]);}));
  for(const [L,ps] of pos) assert.equal(ps.length,2,'PD label '+L+' must appear exactly twice');
  const dir=pd.map(()=>[ 'in',null,'out',null ]);
  for(let pass=0;pass<4*pd.length+4;pass++){
   let changed=false;
   for(const [,[p,q]] of pos){
    const a=dir[p[0]][p[1]],b=dir[q[0]][q[1]];
    if(a&&!b){dir[q[0]][q[1]]=a==='in'?'out':'in';changed=true;}
    else if(b&&!a){dir[p[0]][p[1]]=b==='in'?'out':'in';changed=true;}
   }
   for(let i=0;i<pd.length;i++){
    if(dir[i][1]&&!dir[i][3]){dir[i][3]=dir[i][1]==='in'?'out':'in';changed=true;}
    else if(dir[i][3]&&!dir[i][1]){dir[i][1]=dir[i][3]==='in'?'out':'in';changed=true;}
   }
   if(!changed)break;
  }
  return dir;
 };
 const writheOf=pd=>{const d=orient(pd);
  return pd.reduce((w,_,i)=>{assert(d[i][1]&&d[i][3],'PD orientation undetermined');return w+((d[i][1]==='in'?1:3)===3?1:-1);},0);};
 const jonesFromPD=pd=>{
  const labels=[...new Set(pd.flat())].sort((a,b)=>a-b),idx=new Map(labels.map((L,i)=>[L,i])),n=labels.length,c=pd.length;
  const br=new Map();
  for(let mask=0;mask<2**c;mask++){
   const par=Int32Array.from({length:n},(_,i)=>i);
   const find=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
   let b=0;
   pd.forEach((row,i)=>{const bit=(mask>>>i)&1;b+=bit;
    for(const [u,v] of (bit?[[0,3],[1,2]]:[[0,1],[2,3]])){const x=find(idx.get(row[u])),y=find(idx.get(row[v]));if(x!==y)par[x]=y;}});
   const seen=new Set();for(let i=0;i<n;i++)seen.add(find(i));
   const m=seen.size-1;
   for(let k=0;k<=m;k++){
    let ch=1n;for(let j=0;j<k;j++)ch=ch*BigInt(m-j)/BigInt(j+1);
    const e=(c-2*b)+2*(m-k)-2*k;
    br.set(e,(br.get(e)||0n)+ch*((m%2)?-1n:1n));
   }
  }
  const w=writheOf(pd),out=new Map();
  for(const [e,v] of br){const ee=e-3*w;out.set(ee,(out.get(ee)||0n)+((w%2)?-v:v));}
  return [...out].filter(([,v])=>v!==0n).map(([e,v])=>{assert.equal(e%2,0,'Invalid A exponent from PD');return {power2:-e/2,coefficient:String(v)};})
   .sort((a,b)=>b.power2-a.power2).map(t=>t.coefficient+'@'+t.power2).join(' ');
 };
 const show=terms=>terms.map(t=>t.coefficient+'@'+t.power2).join(' ');
 const geoms=[
  ['trefoil',()=>KC.fromCurves3D([KC.torusCurve(2,3,2,1)],420),'-1@8 1@6 1@2'],
  ['figure-8',()=>KC.fromCurves3D([KC.figureEightCurve()],440),'1@4 -1@2 1@0 -1@-2 1@-4'],
  ['torus(3,4) = 8_19',()=>KC.fromCurves3D([KC.torusCurve(3,4,2,1.15)],520),'-1@16 1@10 1@6'],
  ['Hopf link',()=>KC.fromCurves3D(KC.braidCurves([1,1]),360),'-1@5 -1@1'],
  ['braid 1,1,1,1,1',()=>KC.fromCurves3D(KC.braidCurves([1,1,1,1,1]),440),null],
  ['braid 1,-2,1,-2',()=>KC.fromCurves3D(KC.braidCurves([1,-2,1,-2]),440),null],
  ['braid 1,1,2,2',()=>KC.fromCurves3D(KC.braidCurves([1,1,2,2]),440),null],
  ['braid 1,2,-1,2',()=>KC.fromCurves3D(KC.braidCurves([1,2,-1,2]),440),null]
 ];
 for(const [name,make,known] of geoms){
  const g=make(),a=KC.analyze(g.comps,g.crossings),geo=show(INV.calculate(a).jones.terms);
  // the literature value, where the knot is one we can name
  if(known)assert.equal(geo,known,name+': geometry Jones must match the published polynomial');
  // the PD read back through the independent importer
  const o=PDImport.fromPD(JSON.stringify(a.pd),KC);
  assert.equal(show(INV.calculate(KC.analyze(o.comps,o.crossings)).jones.terms),geo,name+': PD round-trip changed the knot');
  // and the PD integers on their own
  assert.equal(jonesFromPD(a.pd),geo,name+': independent bracket over the exported PD disagrees with the drawn diagram');
 }
}
console.log('Exported PD codes really encode the drawn diagram: independent Kauffman bracket and round-trip both agree: PASS');
