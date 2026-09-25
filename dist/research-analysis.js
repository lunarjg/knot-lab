/* Deterministic research records; exact coefficients come from KnotInvariants. */
(function(root){
'use strict';
const seifert=typeof module!=='undefined'&&module.exports?require('./seifert.js'):root.KnotSeifert;
const graphs=typeof module!=='undefined'&&module.exports?require('./graph-blocks.js'):root.SeifertBlocks;
function polynomialText(terms) {
 const superscript=n=>String(n).replace(/[0-9-]/g,c=>({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'}[c]));
 return terms.map((term,i)=>{const v=BigInt(term.coefficient),neg=v<0n,abs=neg?-v:v,e=term.power2;
  return (i?(neg?' − ':' + '):(neg?'−':''))+(e!==0&&abs===1n?'':String(abs))+(e===0?'':e===2?'t':e%2===0?'t'+superscript(e/2):'t^('+e+'/2)');}).join('')||'0';
}
function jonesData(j) {
 const empty={jonesStatus:j?.status||'not-calculated',jonesPolynomial:null,jonesTerms:null,jonesMinExponent:null,jonesMaxExponent:null,jonesSpan:null,jonesMinCoefficient:null,jonesSecondLowCoefficient:null,jonesMaxCoefficient:null,jonesSecondHighCoefficient:null,jonesTermCount:null,isTrivialJones:null};
 if(j?.status!=='ready')return empty;
 const terms=j.terms.filter(t=>BigInt(t.coefficient)!==0n).map(t=>({power2:t.power2,coefficient:String(BigInt(t.coefficient))})).sort((a,b)=>a.power2-b.power2);
 if(!terms.length||terms.some(t=>!Number.isSafeInteger(t.power2))||new Set(terms.map(t=>t.power2)).size!==terms.length)throw Error('Invalid structured Jones polynomial.');
 return {...empty,jonesPolynomial:polynomialText(terms.slice().reverse()),jonesTerms:terms,
  jonesMinExponent:terms[0].power2/2,jonesMaxExponent:terms.at(-1).power2/2,jonesSpan:(terms.at(-1).power2-terms[0].power2)/2,
  jonesMinCoefficient:terms[0].coefficient,jonesSecondLowCoefficient:terms[1]?.coefficient??null,jonesMaxCoefficient:terms.at(-1).coefficient,jonesSecondHighCoefficient:terms.at(-2)?.coefficient??null,
  jonesTermCount:terms.length,isTrivialJones:terms.length===1&&terms[0].power2===0&&terms[0].coefficient==='1'};
}
function analyze(state,a,{name='',invariants=null}={}) {
 const s=seifert.analyze(state,a);if(s.status!=='ready')return s;
 const g=graphs.decompose(s.graph.vertices,s.graph.edges),k=g.components.length,c=a.c,mu=a.mu,chi=s.circles.length-c,genus=(2*k-mu-chi)/2;
 const diagnostics=g.diagnostics.slice();
 if(k!==a.k)diagnostics.push('Surface component count disagrees with the diagram.');
 if(!Number.isInteger(genus)||genus<0||genus!==a.gSeif)diagnostics.push('Invalid canonical Seifert genus.');
 const homogeneous=diagnostics.length?null:g.isHomogeneousDiagram;
 const record={schemaVersion:1,name,status:diagnostics.length?'diagnostic':'ready',diagnostics,
  crossingCount:c,componentCount:mu,positiveCrossingCount:a.info.filter(I=>I.sign===1).length,negativeCrossingCount:a.info.filter(I=>I.sign===-1).length,writhe:a.writhe,
  seifertCircleCount:s.circles.length,surfaceComponentCount:k,eulerCharacteristic:chi,canonicalSeifertGenus:diagnostics.length?null:genus,
  isHomogeneousDiagram:homogeneous,certifiedHomogeneousLink:homogeneous===true,certifiedKnotGenus:mu===1&&homogeneous===true?genus:null,
  blockCount:g.blockCount,positiveBlockCount:g.positiveBlockCount,negativeBlockCount:g.negativeBlockCount,mixedBlockCount:g.mixedBlockCount,blockRanks:g.blocks.map(b=>b.rank),blockSigns:g.blocks.map(b=>b.sign),
  articulationCount:g.articulationVertices.length,articulationVertices:g.articulationVertices,bipartite:g.bipartite,blocks:g.blocks,
  seifertCircles:s.circles,signedSeifertGraph:s.graph,pd:a.pd.map(row=>row.slice()),
  sA:a.sA.count,sB:a.sB.count,gT:a.gT,aAdequate:a.sA.adequate,bAdequate:a.sB.adequate,alternatingDiagram:a.alternating,
  determinant:invariants?.coloring?.determinant??null,foxColorings:invariants?.coloring?.colorings??null,linkingNumbers:invariants?.linking??null,...jonesData(invariants?.jones)};
 return {status:record.status,record,seifert:s};
}
const CSV_FIELDS=['name','status','crossingCount','componentCount','positiveCrossingCount','negativeCrossingCount','writhe','seifertCircleCount','surfaceComponentCount','eulerCharacteristic','canonicalSeifertGenus','isHomogeneousDiagram','certifiedKnotGenus','blockCount','positiveBlockCount','negativeBlockCount','mixedBlockCount','blockSigns','blockRanks','articulationCount','articulationVertices','jonesStatus','jonesPolynomial','jonesMinExponent','jonesMaxExponent','jonesSpan','jonesMinCoefficient','jonesSecondLowCoefficient','jonesMaxCoefficient','jonesSecondHighCoefficient','jonesTermCount','isTrivialJones','sA','sB','gT','aAdequate','bAdequate','determinant','foxColorings','diagnostics'];
function csv(rows) {
 const cell=v=>{let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return '"'+s.replace(/"/g,'""')+'"';};
 // A leading apostrophe neutralizes spreadsheet formulas in user-provided names.
 return [CSV_FIELDS.join(','),...rows.map(r=>CSV_FIELDS.map(k=>cell(k==='name'&&/^[\s]*[=+\-@]/.test(r[k]||'')?"'"+r[k]:r[k])).join(','))].join('\r\n')+'\r\n';
}
function json(rows){return JSON.stringify({format:'knot-lab-research',version:1,records:rows},null,2)+'\n';}
function compare(a,b,key) {
 const x=a[key],y=b[key];if(x==null)return y==null?0:1;if(y==null)return -1;
 if(key.endsWith('Coefficient'))return BigInt(x)<BigInt(y)?-1:BigInt(x)>BigInt(y)?1:0;
 return typeof x==='number'||typeof x==='boolean'?Number(x)-Number(y):String(x).localeCompare(String(y),'en');
}
const api={analyze,jonesData,polynomialText,csv,json,compare,CSV_FIELDS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KnotResearch=api;
})(typeof globalThis!=='undefined'?globalThis:self);
