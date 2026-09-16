/* Exact combinatorial invariants. No geometry mutation or network access.
   References: Kauffman, arXiv:2204.12104; Kolay, arXiv:1910.08044. */
(function(root){
'use strict';
const JONES_LIMIT=18,MATRIX_LIMIT=200;
function uf(n){const p=Int32Array.from({length:n},(_,i)=>i);return {find(x){while(p[x]!==x){p[x]=p[p[x]];x=p[x];}return x;},join(a,b){a=this.find(a);b=this.find(b);if(a!==b)p[a]=b;}};}
function determinant(matrix){
 const n=matrix.length;if(!n)return 1n;
 const a=matrix.map(r=>r.map(BigInt));let prev=1n,sign=1n;
 for(let k=0;k<n-1;k++){
  let pivot=k;while(pivot<n&&a[pivot][k]===0n)pivot++;
  if(pivot===n)return 0n;
  if(pivot!==k){[a[k],a[pivot]]=[a[pivot],a[k]];sign=-sign;}
  const v=a[k][k];
  for(let i=k+1;i<n;i++){for(let j=k+1;j<n;j++)a[i][j]=(a[i][j]*v-a[i][k]*a[k][j])/prev;a[i][k]=0n;}
  prev=v;
 }
 return sign*a[n-1][n-1];
}
function rank3(matrix,cols){
 const a=matrix.map(row=>row.map(x=>(x%3+3)%3));let rank=0;
 for(let c=0;c<cols&&rank<a.length;c++){
  let p=rank;while(p<a.length&&!a[p][c])p++;if(p===a.length)continue;
  [a[p],a[rank]]=[a[rank],a[p]];
  if(a[rank][c]===2)for(let j=c;j<cols;j++)a[rank][j]=a[rank][j]*2%3;
  for(let i=rank+1;i<a.length;i++){const f=a[i][c];if(f)for(let j=c;j<cols;j++)a[i][j]=(a[i][j]-f*a[rank][j]+6)%3;}
  rank++;
 }
 return rank;
}
function coloring(a){
 if(a.info.length>MATRIX_LIMIT)return {status:'limited',limit:MATRIX_LIMIT};
 const arcs=uf(a.arcCount);a.info.forEach(I=>arcs.join(I.O.inn>>1,I.O.out>>1));
 const index=new Map();for(let i=0;i<a.arcCount;i++){const r=arcs.find(i);if(!index.has(r))index.set(r,index.size);}
 const n=index.size+a.free;
 const matrix=a.info.map(I=>{const row=Array(n).fill(0);for(const [node,v] of [[I.O.out,2],[I.N.inn,-1],[I.N.out,-1]])row[index.get(arcs.find(node>>1))]+=v;return row;});
 const dim=n-rank3(matrix,n),count=3n**BigInt(dim);
 let det=null;
 if(a.mu===1){
  if(!a.info.length)det=1n;
  else {if(matrix.length!==n)throw new Error('Invalid knot coloring matrix');det=determinant(matrix.slice(0,-1).map(r=>r.slice(0,-1)));if(det<0n)det=-det;}
 }
 return {status:'ready',determinant:det===null?null:String(det),colorings:String(count),nonconstant:String(count-3n),tricolorable:count>3n};
}
function jones(a){
 const c=a.info.length;if(c>JONES_LIMIT)return {status:'limited',limit:JONES_LIMIT};
 const hist=new Map(),n=a.arcCount;
 for(let mask=0;mask<2**c;mask++){
  const u=uf(n);let b=0;
  a.info.forEach((I,i)=>{const bit=(mask>>>i)&1;b+=bit;for(const [x,y] of I[bit?'B':'A'])u.join(x>>1,y>>1);});
  const roots=new Set();for(let i=0;i<n;i++)roots.add(u.find(i));
  const loops=roots.size+a.free,m=loops-1,key=b+','+m;
  hist.set(key,(hist.get(key)||0)+1);
 }
 const poly=new Map();
 for(const [key,count] of hist){
  const [b,m]=key.split(',').map(Number);if(m<0)throw new Error('No closed link to evaluate');
  let choose=1n;
  for(let k=0;k<=m;k++){
   const exp=c-2*b+2*m-4*k-3*a.writhe;
   const coefficient=BigInt(count)*choose*((m+a.writhe)%2? -1n:1n);
   poly.set(exp,(poly.get(exp)||0n)+coefficient);
   if(k<m)choose=choose*BigInt(m-k)/BigInt(k+1);
  }
 }
 const terms=[...poly].filter(([,v])=>v!==0n).map(([e,v])=>{if(e%2)throw new Error('Invalid Jones exponent');return {power2:-e/2,coefficient:String(v)};}).sort((a,b)=>b.power2-a.power2);
 return {status:'ready',terms};
}
function calculate(a){
 if(!a.mu)return {status:'empty'};
 const pairs=[];
 for(let i=0;i<a.mu;i++)for(let j=i+1;j<a.mu;j++){
  let sum=0;for(const I of a.info)if((I.O.c===i&&I.N.c===j)||(I.O.c===j&&I.N.c===i))sum+=I.sign;
  if(sum%2)throw new Error('A component pair has an odd crossing-sign sum; separate overlapping crossings and retry.');
  pairs.push({a:i+1,b:j+1,value:sum/2});
 }
 return {status:'ready',components:a.mu,linking:pairs,coloring:coloring(a),jones:jones(a)};
}
const api={calculate,determinant,JONES_LIMIT,MATRIX_LIMIT};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KnotInvariants=api;
})(typeof self!=='undefined'?self:globalThis);
