/* Local dataset adapters. No evaluation, network access or PD-only analysis. */
(function(root){
'use strict';
const MAX_BYTES=5*1024*1024,MAX_ROWS=10000;
function delimited(text,delimiter) {
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else field+=c;}
  else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){
   row.push(field);field='';if(c!==delimiter){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
  }else field+=c;
 }
 if(quoted)throw Error('Unclosed quote in dataset.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function parse(text) {
 if(typeof text!=='string'||text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Use a local dataset no larger than 5 MB.');
 const source=text.replace(/^\uFEFF/,'').trim();if(!source)throw Error('Paste PD codes or choose a local dataset.');
 let parsed;try{parsed=JSON.parse(source);}catch{}
 let rows;
 if(parsed!==undefined){
  if(Array.isArray(parsed)){
   if(parsed.length&&parsed.every(row=>Array.isArray(row)&&row.length===4&&row.every(Number.isSafeInteger)))rows=[{pd:parsed}];
   else rows=parsed;
  }else if(parsed&&Array.isArray(parsed.records))rows=parsed.records;
  else if(parsed&&Array.isArray(parsed.diagrams))rows=parsed.diagrams;
  else rows=[parsed];
 }else{
  const first=source.split(/\r?\n/)[0],normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const delimiter=first.includes('\t')?'\t':',';
  const header=delimited(first,delimiter)[0]||[],pdColumn=header.findIndex(h=>['pd','pdnotation','pdcode'].includes(normalize(h)));
  if(pdColumn>=0){
   const table=delimited(source,delimiter),nameColumn=header.findIndex(h=>['name','diagram','id','knot','knotname'].includes(normalize(h)));
   rows=table.slice(1).map(row=>({name:nameColumn>=0?row[nameColumn]:'',pd:row[pdColumn]}));
  }else{
   // Balanced PD expressions may span lines. Text before each expression is
   // its optional name; there is no regular-expression evaluation of input.
   rows=[];let depth=0,start=-1,prefix='';
   for(let i=0;i<source.length;i++){
    const c=source[i];if(c==='['||c==='('){if(depth++===0)start=i;}
    else if(c===']'||c===')'){
     if(--depth<0)throw Error('Unbalanced PD brackets.');
     if(depth===0){rows.push({name:prefix.replace(/\bPD\s*$/i,'').replace(/[:=]\s*$/,'').trim(),pd:source.slice(start,i+1)});prefix='';start=-1;}
    }else if(depth===0)prefix+=c;
   }
   if(depth)throw Error('Unbalanced PD brackets.');
   if(prefix.trim())throw Error('Use PD expressions, JSON records, or CSV/TSV with name and pd columns. DT generator files need conversion to PD first.');
  }
 }
 if(!rows.length||rows.length>MAX_ROWS)throw Error('Use between 1 and 10,000 diagram records.');
 return rows.map((entry,i)=>{
  const r=Array.isArray(entry)?{pd:entry}:typeof entry==='string'?{pd:entry}:entry||{};
  return {name:String(r.name||'Diagram '+(i+1)).slice(0,200),pd:Array.isArray(r.pd)?JSON.stringify(r.pd):typeof r.pd==='string'?r.pd:'',unknot:r.unknot===true};
 });
}
const api={parse,MAX_BYTES,MAX_ROWS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ResearchDataset=api;
})(typeof globalThis!=='undefined'?globalThis:self);
