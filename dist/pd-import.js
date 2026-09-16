/* PD rotation-system importer. No evaluation of input; client-only construction. */
(function(root){
'use strict';
const fail = msg => { throw new Error(msg); };
function parse(text) {
  if(typeof text !== 'string' || text.length > 40000) fail('PD 코드는 40,000자 이하로 입력하세요.');
  let s=text.trim().replace(/^PD\s*(?=\[)/i,'').replace(/\bX\s*(?=\[)/g,'').replace(/\(/g,'[').replace(/\)/g,']');
  if(!s) fail('PD 코드를 입력하세요.');
  if(!/^[\s\d,\[\]]+$/.test(s)) fail('숫자 목록 또는 PD[X[…], …] 형식으로 입력하세요.');
  let pd; try {pd=JSON.parse(s);} catch {fail('괄호와 쉼표를 확인하세요. 각 교차는 숫자 4개입니다.');}
  if(!Array.isArray(pd)||!pd.length) fail('교차가 하나 이상인 PD 코드를 입력하세요. 교차 없는 원은 펜으로 그릴 수 있습니다.');
  if(pd.length>80) fail('한 번에 교차 80개까지 불러올 수 있습니다.');
  const labels=new Map();
  pd.forEach((row,v)=>{
    if(!Array.isArray(row)||row.length!==4||!row.every(n=>Number.isSafeInteger(n)&&n>0)) fail(`${v+1}번째 교차는 양의 정수 4개여야 합니다.`);
    row.forEach((n,p)=>{if(!labels.has(n))labels.set(n,[]);labels.get(n).push(4*v+p);});
  });
  for(const [n,ds] of labels) if(ds.length!==2) fail(`현 번호 ${n}이 ${ds.length}번 나옵니다. 각 번호는 정확히 2번 나와야 합니다.`);
  return pd;
}
const opposite=d=> (d&~3)+((d+2)%4);
const next=d=> (d&~3)+((d+1)%4);
function topology(pd){
  const labels=new Map(), twin=new Int32Array(pd.length*4);
  pd.forEach((r,v)=>r.forEach((n,p)=>{const d=4*v+p;if(labels.has(n)){const e=labels.get(n);twin[d]=e;twin[e]=d;}else labels.set(n,d);}));
  const groups=[],seen=new Set();
  for(let v=0;v<pd.length;v++)if(!seen.has(v)){
    const vs=[],todo=[v];seen.add(v);
    while(todo.length){const a=todo.pop();vs.push(a);for(let p=0;p<4;p++){const b=twin[4*a+p]>>2;if(!seen.has(b)){seen.add(b);todo.push(b);}}}
    const faces=[],used=new Set();
    for(const a of vs)for(let p=0;p<4;p++) {const start=4*a+p;if(used.has(start))continue;const f=[];let d=start;do{used.add(d);f.push(d);d=next(twin[d]);}while(d!==start);faces.push(f);}
    if(vs.length-vs.length*2+faces.length!==2)fail('이 PD 코드의 교차 순서는 평면 도식을 만들지 못합니다. 각 교차의 반시계 방향 순서를 확인하세요.');
    groups.push({vs,faces});
  }
  // Every crossing's first port is the incoming underpass. Propagate orientation.
  const incoming=new Int8Array(twin.length).fill(-1);
  const set=(d,val)=>{if(incoming[d]>=0&&incoming[d]!==val)fail('현의 방향이 일치하지 않습니다. 각 교차의 첫 번호는 들어오는 아래 현이어야 합니다.');incoming[d]=val;};
  for(let d=0;d<twin.length;d+=4) {
    let e=d;do{set(e,1);set(opposite(e),0);e=twin[opposite(e)];}while(e!==d);
  }
  // Components that are over at every crossing have no prescribed orientation.
  for(let d=0;d<twin.length;d++)if(incoming[d]<0){let e=d;do{set(e,1);set(opposite(e),0);e=twin[opposite(e)];}while(e!==d);}
  return {twin,groups,incoming};
}
function embedding(group,twin){
  const adj=[],xy=[];const node=()=>{adj.push(new Set());xy.push({x:0,y:0});return adj.length-1;};
  const edge=(a,b)=>{adj[a].add(b);adj[b].add(a);};
  const port=new Map(),center=new Map(),mid=new Map();
  for(const v of group.vs){center.set(v,node());for(let p=0;p<4;p++)port.set(4*v+p,node());for(let p=0;p<4;p++){edge(center.get(v),port.get(4*v+p));edge(port.get(4*v+p),port.get(4*v+(p+1)%4));}}
  for(const v of group.vs)for(let p=0;p<4;p++){const d=4*v+p;if(mid.has(d))continue;const m=node(),t=twin[d];mid.set(d,m);mid.set(t,m);edge(port.get(d),m);edge(m,port.get(t));}
  const faces=group.faces.map(f=>f.flatMap(d=>[port.get(d),mid.get(d),port.get(twin[d])]));
  let outer=0;faces.forEach((f,i)=>{if(f.length>faces[outer].length)outer=i;});
  for(let i=0;i<faces.length;i++)if(i!==outer){const c=node();for(const p of faces[i])edge(c,p);}
  const boundary=faces[outer];
  if(new Set(boundary).size!==boundary.length)fail('이 도식의 외곽을 구성하지 못했습니다. PD 코드의 연결을 확인하세요.');
  const fixed=new Set(boundary);
  // The face walk follows next(twin(d)); counterclockwise screen boundary preserves the PD port order.
  boundary.forEach((v,i)=>{const t=2*Math.PI*i/boundary.length;xy[v]={x:Math.cos(t),y:-Math.sin(t)};});
  const inside=adj.map((_,i)=>i).filter(i=>!fixed.has(i));
  const index=new Map(inside.map((v,i)=>[v,i]));
  const neighbors=inside.map(v=>[...adj[v]]);
  const multiply=p=>inside.map((v,i)=>{let r=adj[v].size*p[i];for(const n of neighbors[i])if(index.has(n))r-=p[index.get(n)];return r;});
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  for(const axis of ['x','y']){
    const b=inside.map((v,i)=>neighbors[i].reduce((s,n)=>s+(fixed.has(n)?xy[n][axis]:0),0));
    const x=b.map(()=>0);let r=b.slice(),p=r.slice(),rr=dot(r,r);
    for(let step=0;step<inside.length*3+20&&rr>1e-24;step++){
      const ap=multiply(p),den=dot(p,ap);if(den<=0)break;
      const alpha=rr/den;x.forEach((_,i)=>{x[i]+=alpha*p[i];r[i]-=alpha*ap[i];});
      const nr=dot(r,r),beta=nr/rr;p=r.map((v,i)=>v+beta*p[i]);rr=nr;
    }
    inside.forEach((v,i)=>xy[v][axis]=x[i]);
  }
  const inner=new Map();
  for(const v of group.vs){
    const c=xy[center.get(v)],ps=[0,1,2,3].map(p=>xy[port.get(v*4+p)]);
    // A disk strictly inside the crossing's four triangular wedges.
    let radius=Infinity;
    for(let p=0;p<4;p++){const a=ps[p],b=ps[(p+1)%4];const dist=Math.abs((b.x-a.x)*(a.y-c.y)-(b.y-a.y)*(a.x-c.x))/Math.hypot(b.x-a.x,b.y-a.y);radius=Math.min(radius,dist,Math.hypot(a.x-c.x,a.y-c.y));}
    if(radius<1e-9)fail('도식의 일부가 너무 촘촘해 복원하지 못했습니다. 더 단순한 PD 코드로 나누어 입력하세요.');
    radius*=0.45;
    ps.forEach((p,i)=>{const l=Math.hypot(p.x-c.x,p.y-c.y);inner.set(v*4+i,{x:c.x+(p.x-c.x)*radius/l,y:c.y+(p.y-c.y)*radius/l});});
  }
  return {xy,port,mid,inner};
}
function fromPD(text,KC){
  const pd=parse(text),{twin,groups,incoming}=topology(pd);
  const comps=[],segmentTags=[],visited=new Set();
  for(let gi=0;gi<groups.length;gi++){
    const group=groups[gi],em=embedding(group,twin);
    const transform=p=>({x:p.x*420+gi*960,y:p.y*420});
    for(const v of group.vs)for(let p=0;p<4;p++){
      const start=4*v+p;if(visited.has(start)||!incoming[start])continue;
      const path=[],tags=[];let d=start;
      const add=(point,tag=null)=>{path.push(transform(point));tags.push(tag);};
      do{
        const o=opposite(d),t=twin[o];visited.add(d);visited.add(o);
        add(em.xy[em.port.get(d)]);
        add(em.inner.get(d),{cross:d>>2,over:!!(d%2),port:d%4});
        add(em.inner.get(o));
        add(em.xy[em.port.get(o)]);
        add(em.xy[em.mid.get(o)]);
        d=t;
      }while(d!==start);
      // Subdivide without smoothing away the rotation system or tiny crossings.
      const pts=[],st=[];
      path.forEach((a,i)=>{const b=path[(i+1)%path.length],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5));for(let k=0;k<n;k++){pts.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});st.push(tags[i]);}});
      pts.forEach((q,i)=>q.u=i/pts.length);const cm={pts};KC.updateGeom(cm);comps.push(cm);segmentTags.push(st);
    }
  }
  const crossings=KC.computeRaw(comps),seen=new Set();
  if(crossings.length!==pd.length)fail('도식 복원 중 교차 수가 일치하지 않았습니다. 현재 작업은 유지됩니다.');
  for(const [i,x] of crossings.entries()){
    const ts=x.occ.map(o=>segmentTags[o.c][o.seg]);
    if(ts.some(t=>!t)||ts[0].cross!==ts[1].cross||ts[0].over===ts[1].over||seen.has(ts[0].cross))fail('교차 연결을 검증하지 못했습니다. 현재 작업은 유지됩니다.');
    seen.add(ts[0].cross);x.id=i+1;x.over=ts[0].over?0:1;
  }
  return {comps,crossings,nextId:crossings.length+1,open:[],memory:[]};
}
root.PDImport={parse,topology,fromPD};
})(typeof globalThis!=='undefined'?globalThis:window);
