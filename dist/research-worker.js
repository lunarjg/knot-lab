'use strict';
importScripts('./knot-core.js','./pd-import.js','./seifert.js','./graph-blocks.js','./research-analysis.js','./research-dataset.js','./invariants.js');
self.onmessage=({data})=>{
 const id=data.id;
 try{
  const rows=ResearchDataset.parse(data.text);self.postMessage({id,type:'start',total:rows.length});
  for(let i=0;i<rows.length;i++){
   const row=rows[i];let record;
   try{
    // The same importer as the editor constructs and verifies geometry and
    // reconstructs crossings BEFORE any research calculation is performed.
    const state=row.unknot?KC.fromCurves3D([KC.circleCurve()],160):PDImport.fromPD(row.pd,KC);
    const a=KC.analyze(state.comps,state.crossings),invariants=data.jones===false?null:KnotInvariants.calculate(a);
    const result=KnotResearch.analyze(state,a,{name:row.name,invariants});
    if(!result.record)throw Error(result.message||'Could not analyze diagram.');record=result.record;
   }catch(error){record={schemaVersion:1,name:row.name,status:'error',diagnostics:[error.message||'Could not analyze this row.'],jonesStatus:'not-calculated',isHomogeneousDiagram:null,isTrivialJones:null};}
   self.postMessage({id,type:'row',index:i,completed:i+1,total:rows.length,record});
  }
  self.postMessage({id,type:'done',total:rows.length});
 }catch(error){self.postMessage({id,type:'error',error:error.message||'Could not read dataset.'});}
};
