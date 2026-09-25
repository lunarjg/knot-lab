/* Read-only oriented Seifert circles from KC.analyze's existing Sf pairings.
   Cromwell (1989); Manchón, arXiv:1102.0890. No independent sign convention. */
(function(root){
'use strict';
function analyze(state,a) {
 const {comps,crossings}=state;
 if(state.open?.length)return {status:'open',message:'Close all open arcs before research analysis.'};
 if(!comps.length)return {status:'empty',message:'Draw or import a closed diagram.'};
 if(a.c!==crossings.length||a.mu!==comps.length||a.arcCount!==2*a.c)throw Error('Research requires the finalized diagram analysis.');
 const n=a.arcCount,succ=new Int32Array(n).fill(-1),token=Array(n),arcs=[];
 let base=0;
 a.occ.forEach((list,c)=>{
  list.forEach((e,j)=>{const next=list[(j+1)%list.length];arcs.push({index:base+j,component:c,s0:e.s,s1:next.s+(j+1===list.length?comps[c].len:0)});});base+=list.length;
 });
 a.info.forEach((I,xi)=>I.Sf.forEach(pair=>{
  const inn=pair.find(v=>v%2===1),out=pair.find(v=>v%2===0);
  if(inn===undefined||out===undefined||succ[inn>>1]!==-1)throw Error('Seifert smoothing must pair one incoming and one outgoing half-edge.');
  succ[inn>>1]=out>>1;
  const k=I.O.inn===inn?crossings[xi].over:1-crossings[xi].over;
  token[inn>>1]=[crossings[xi].id,k];
 }));
 if(new Set(succ).size!==n||[...succ].some(s=>s<0||s>=n))throw Error('Seifert smoothing is not a permutation of directed arcs.');
 const used=new Uint8Array(n),circles=[];
 for(let start=0;start<n;start++)if(!used[start]){
  const members=[];let p=start;do{if(used[p])throw Error('Seifert trace does not close.');used[p]=1;members.push(p);p=succ[p];}while(p!==start);
  const seed=members.map(i=>token[i]).sort((x,y)=>x[0]-y[0]||x[1]-y[1])[0];
  circles.push({id:'S'+seed[0]+'.'+(seed[1]+1),arcs:members,freeComponent:null,seed});
 }
 circles.sort((x,y)=>x.seed[0]-y.seed[0]||x.seed[1]-y.seed[1]);circles.forEach(c=>delete c.seed);
 a.occ.forEach((list,c)=>{if(!list.length)circles.push({id:'S-free-'+(c+1),arcs:[],freeComponent:c});});
 const circleOfArc=Array(n);circles.forEach(circle=>circle.arcs.forEach(i=>circleOfArc[i]=circle.id));
 const edges=a.info.map((I,i)=>({id:crossings[i].id,crossingID:crossings[i].id,crossingIndex:i,u:circleOfArc[I.Sf[0][0]>>1],v:circleOfArc[I.Sf[1][0]>>1],sign:I.sign}));
 if(circles.length!==a.sS.count)throw Error('Seifert circle count disagrees with the existing smoothing state.');
 const vertices=circles.map(c=>({id:c.id}));
 return {status:'ready',circles,arcs,circleOfArc,graph:{vertices,edges}};
}
const api={analyze};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KnotSeifert=api;
})(typeof globalThis!=='undefined'?globalThis:self);
