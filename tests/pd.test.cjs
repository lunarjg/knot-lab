const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8');
const core=html.match(/<script>\s*(\/\/ ===== Knot core[\s\S]*?)<\/script>/)[1];
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
