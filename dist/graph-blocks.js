/* Edge-based, iterative Tarjan decomposition of an undirected signed multigraph.
   Bridges are dyad blocks; isolated vertices have no edge block. */
(function(root){
'use strict';
function decompose(vertices, edges) {
 const ids=vertices.map(v=>typeof v==='object'?v.id:v), index=new Map(ids.map((id,i)=>[id,i]));
 if(index.size!==ids.length)throw Error('Duplicate graph vertex ID.');
 const n=ids.length,adj=Array.from({length:n},()=>[]),edgeIDs=new Set(),diagnostics=[];
 const ends=edges.map((e,i)=>{
  if(edgeIDs.has(e.id))throw Error('Duplicate crossing edge ID.');edgeIDs.add(e.id);
  const u=index.get(e.u),v=index.get(e.v);
  if(u===undefined||v===undefined||![1,-1].includes(e.sign))throw Error('Invalid signed graph edge.');
  if(u===v)diagnostics.push('Self-loop at crossing '+e.id+'; check oriented smoothing.');
  adj[u].push(i);adj[v].push(i);return [u,v];
 });
 const disc=new Int32Array(n),low=new Int32Array(n),parent=new Int32Array(n).fill(-1),parentEdge=new Int32Array(n).fill(-1);
 const children=new Int32Array(n),cut=new Set(),edgeStack=[],raw=[],components=[];let clock=0;
 // Skip only the parent EDGE, not all edges back to the parent vertex.
 // This is what keeps opposite-signed parallel edges in the same block.
 for(let start=0;start<n;start++)if(!disc[start]){
  const members=[],stack=[{u:start,next:0}];disc[start]=low[start]=++clock;
  while(stack.length){
   const frame=stack[stack.length-1],u=frame.u;
   if(frame.next===0)members.push(u);
   if(frame.next<adj[u].length){
    const ei=adj[u][frame.next++];if(ei===parentEdge[u])continue;
    const [a,b]=ends[ei],v=a===u?b:a;if(u===v)continue;
    if(!disc[v]){
     parent[v]=u;parentEdge[v]=ei;children[u]++;edgeStack.push(ei);
     disc[v]=low[v]=++clock;stack.push({u:v,next:0});
    }else if(disc[v]<disc[u]){low[u]=Math.min(low[u],disc[v]);edgeStack.push(ei);}
   }else{
    stack.pop();const p=parent[u];
    if(p>=0){
     low[p]=Math.min(low[p],low[u]);
     if(low[u]>=disc[p]){
      if(parent[p]>=0||children[p]>1)cut.add(p);
      const block=[];let ei;do{ei=edgeStack.pop();block.push(ei);}while(ei!==parentEdge[u]);raw.push(block);
     }
    }
   }
  }
  components.push(members.sort((a,b)=>a-b).map(i=>ids[i]));
 }
 const blocks=raw.map(list=>list.sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]).map((list,i)=>{
  const vs=[...new Set(list.flatMap(e=>ends[e]))].sort((a,b)=>a-b),signs=list.map(e=>edges[e].sign);
  const sign=signs.every(s=>s===1)?'positive':signs.every(s=>s===-1)?'negative':'mixed';
  return {id:'B'+(i+1),vertexIDs:vs.map(v=>ids[v]),edgeIDs:list.map(e=>edges[e].id),edgeSigns:signs,sign,vertexCount:vs.length,edgeCount:list.length,rank:list.length-vs.length+1};
 });
 const color=new Int8Array(n).fill(-1);let bipartite=true;
 for(let r=0;r<n;r++)if(color[r]<0){const q=[r];color[r]=0;for(let at=0;at<q.length;at++){const u=q[at];for(const ei of adj[u]){const [a,b]=ends[ei],v=a===u?b:a;if(color[v]<0){color[v]=1-color[u];q.push(v);}else if(color[v]===color[u])bipartite=false;}}}
 if(!bipartite)diagnostics.push('Seifert graph is not bipartite; check diagram reconstruction and smoothing.');
 const positiveBlockCount=blocks.filter(b=>b.sign==='positive').length,negativeBlockCount=blocks.filter(b=>b.sign==='negative').length,mixedBlockCount=blocks.filter(b=>b.sign==='mixed').length;
 return {blocks,articulationVertices:[...cut].sort((a,b)=>a-b).map(i=>ids[i]),components,bipartite,diagnostics,
  isHomogeneousDiagram:diagnostics.length?null:mixedBlockCount===0,blockCount:blocks.length,positiveBlockCount,negativeBlockCount,mixedBlockCount};
}
const api={decompose};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SeifertBlocks=api;
})(typeof globalThis!=='undefined'?globalThis:self);
