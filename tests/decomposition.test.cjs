// Alternating decomposition, after Armond and Lowrance, "Turaev genus and
// alternating decompositions", Algebr. Geom. Topol. 17 (2017) 793-830.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('dist/index.html','utf8').match(/<script>\s*(\/\/ ===== Knot core[\s\S]*?)<\/script>/)[1];
vm.runInThisContext(src+'\nglobalThis.KC=KC;');
require('../dist/pd-import.js');

const altTrefoil=()=>PDImport.fromPD('[[1,4,2,5],[3,6,4,1],[5,2,6,3]]',KC);
const split=()=>{const A=altTrefoil(),B=altTrefoil();B.comps.forEach(c=>c.pts.forEach(p=>p.x+=3000));
 const comps=A.comps.concat(B.comps),crossings=KC.computeRaw(comps);crossings.forEach((x,i)=>{x.id=i+1;x.over=0;});
 return {comps,crossings};};
const fixtures={
 trefoil:altTrefoil(),
 figureEight:KC.fromCurves3D([KC.figureEightCurve()],440),
 hopf:KC.fromCurves3D(KC.braidCurves([1,1]),360),
 braid:KC.fromCurves3D(KC.braidCurves([1,2,1,-2,1,2]),440),
 torus34:KC.fromCurves3D([KC.torusCurve(3,4,2,1.15)],520),
 twoTrefoils:split(),
 longBraid:KC.fromCurves3D(KC.braidCurves([1,2,1,-2,1,2,-1,2,1,-2]),520),
 torus35:KC.fromCurves3D([KC.torusCurve(3,5,2,1.15)],560),
};

// ---- Every crossing assignment of every fixture, checked against the paper ----
let diagrams=0,nonAlternating=0,doubledCycles=0;
const graphOf=g=>{const deg=new Array(g.n).fill(0);g.edges.forEach(([u,v])=>{deg[u]++;deg[v]++;});return deg;};
const isDoubledCycle=g=>{
 const n=g.n;if(n<2||g.edges.length!==2*n)return 0;
 const nb=Array.from({length:n},()=>new Map());
 for(const [u,v] of g.edges){if(u===v)return 0;nb[u].set(v,(nb[u].get(v)||0)+1);nb[v].set(u,(nb[v].get(u)||0)+1);}
 if(n===2)return nb[0].get(1)===4?2:0;
 for(const m of nb){if(m.size!==2)return 0;for(const c of m.values())if(c!==2)return 0;}
 const seen=new Set([0]),q=[0];while(q.length)for(const w of nb[q.pop()].keys())if(!seen.has(w)){seen.add(w);q.push(w);}
 return seen.size===n?n:0;
};
for(const [name,S] of Object.entries(fixtures)){
 const c=S.crossings.length;
 assert(c>0,`${name} must have crossings`);
 const masks=c<=11?[...Array(1<<c).keys()]:Array.from({length:800},(_,i)=>(i*2654435761)%(2**c));
 for(const mask of masks){
  S.crossings.forEach((x,i)=>{x.over=(mask>>i)&1;});
  const a=KC.analyze(S.comps,S.crossings),d=KC.decompose(S.comps,S.crossings,a);
  assert(d,`${name}/${mask}: decomposition`);
  diagrams++;if(!d.alternating)nonAlternating++;

  // D is a 4-valent plane graph: V - E + F = 2 on each of its k pieces.
  assert.equal(d.faces.length,a.c+2*a.k,`${name}/${mask}: face count`);
  // The over/under role flips exactly at the nonalternating arcs, so every face
  // walk meets an even number of them and the arcs of a curve always pair up.
  for(const f of d.faces)assert.equal(f.filter(x=>d.isNA[x>>1]).length%2,0,`${name}/${mask}: odd face`);
  // One edge of G per nonalternating edge of D.
  assert.equal(d.graph.edges.length,d.nonAlt.length);
  assert.equal(d.nonAlt.length,a.alternating?0:d.nonAlt.length);
  assert.equal(d.alternating,a.alternating,`${name}/${mask}: alternating agrees with analyze`);
  // Thistlethwaite / Proposition 3.3: planar, bipartite, every degree even.
  graphOf(d.graph).forEach((deg,v)=>assert.equal(deg%2,0,`${name}/${mask}: vertex ${v} has odd degree`));
  // Each curve bounds exactly one alternating region.
  d.curves.forEach(cyc=>assert.equal(new Set(cyc.map(x=>d.regionOfX[d.dart[x].xi])).size,1));
  assert.equal(d.graph.n,d.curves.length+d.graph.solo);

  // Proposition 3.5 (twisted ribbon embedding), Corollary 3.9 (abstract
  // recursion) and the all-A/all-B count must all give the same Turaev genus.
  // decompositionGenus also asserts the sphere embedding really is spherical.
  const ribbon=KC.decompositionGenus(d);
  assert(ribbon,`${name}/${mask}: bipartite sphere embedding of G`);
  assert.equal(ribbon.genus,a.gT,`${name}/${mask}: Proposition 3.5`);
  assert.equal(KC.decompositionGenusRecursive(d.graph.n,d.graph.edges),a.gT,`${name}/${mask}: Corollary 3.9`);
  // Theorem 1.2: a doubled cycle has Turaev genus one, and is of even length.
  const cyc=isDoubledCycle(d.graph);
  if(cyc){doubledCycles++;assert.equal(a.gT,1,`${name}/${mask}: doubled cycle genus`);assert.equal(cyc%2,0,'doubled cycle length is even');}
 }
}
assert(diagrams>=2000&&nonAlternating>=1900&&doubledCycles>=40,`coverage ${diagrams}/${nonAlternating}/${doubledCycles}`);
console.log(`Decomposition structure and three independent Turaev genus computations agree on ${diagrams} diagrams (${nonAlternating} non-alternating, ${doubledCycles} doubled cycles): PASS`);

// ---- An alternating diagram is a single vertex per piece ----
for(const [name,build] of [['trefoil',altTrefoil],['two trefoils',split]]){
 const S=build(),plan=KC.alternatingAssignment(S.comps,S.crossings);
 assert(plan.ok);S.crossings.forEach((x,i)=>{x.over=plan.over[i];});
 const a=KC.analyze(S.comps,S.crossings),d=KC.decompose(S.comps,S.crossings,a);
 assert(a.alternating&&d.alternating,name);
 assert.equal(d.graph.edges.length,0,`${name}: no edges`);
 assert.equal(d.graph.curves,0,`${name}: no curves`);
 assert.equal(d.graph.n,a.k,`${name}: one vertex per connected piece`);
 assert.equal(d.regions.length,a.k,`${name}: one alternating region per piece`);
 assert.equal(KC.decompositionGenus(d).genus,0);
 assert.equal(KC.decompositionGenusRecursive(d.graph.n,d.graph.edges),0);
}
console.log('Alternating diagrams decompose to one vertex and no edges per piece: PASS');

// ---- Corollary 3.9 on the graphs named in the paper ----
const ring=k=>{const e=[];for(let i=0;i<k;i++){e.push([i,(i+1)%k],[i,(i+1)%k]);}return e;};
assert.equal(KC.decompositionGenusRecursive(1,[]),0,'a single vertex');
assert.equal(KC.decompositionGenusRecursive(4,[]),0,'isolated vertices');
// Every doubled cycle of even length is doubled path equivalent to C_2^2, and so
// of Turaev genus one (Theorem 1.2). An odd one is not bipartite, so it is not an
// alternating decomposition graph at all and the recursion refuses it.
for(const k of [2,4,6,8,10])assert.equal(KC.decompositionGenusRecursive(k,ring(k)),1,`doubled cycle ${k}`);
for(const k of [3,5,7])assert.equal(KC.decompositionGenusRecursive(k,ring(k)),null,`doubled cycle ${k} is not bipartite`);
// Turaev genus is additive over the pieces (Theorem 1.4, class 1).
assert.equal(KC.decompositionGenusRecursive(4,[[0,1],[0,1],[0,1],[0,1],[2,3],[2,3],[2,3],[2,3]]),2,'two doubled 2-cycles');
assert.equal(KC.decompositionGenusRecursive(8,[...ring(4),...ring(4).map(([u,v])=>[u+4,v+4])]),2,'two doubled 4-cycles');
// A one-sum of two doubled cycles is Turaev genus two (Theorem 1.4, class 2).
assert.equal(KC.decompositionGenusRecursive(3,[[0,1],[0,1],[0,1],[0,1],[1,2],[1,2],[1,2],[1,2]]),2,'C_2^2 one-summed with C_2^2');
assert.equal(KC.decompositionGenusRecursive(7,[...ring(4),[3,4],[3,4],[4,5],[4,5],[5,6],[5,6],[6,3],[6,3]]),2,'C_4^2 one-summed with C_4^2');
console.log('Corollary 3.9 on C_2^2, doubled cycles, disjoint unions and one-sums: PASS');

// ---- Proposition 3.11: lengthening a doubled path leaves the genus alone ----
// Splitting a pair of parallel edges over a new degree-four vertex is a doubled
// path extension, so it must not move the Turaev genus. A single extension turns
// an even cycle odd and so leaves the bipartite world the recursion is defined
// on, exactly as the paper warns; two of them on the same path come back to it.
{
 let extended=0;
 const parallel=(edges,from)=>{const seen=new Map();
  for(let i=from||0;i<edges.length;i++){const k=Math.min(...edges[i])+','+Math.max(...edges[i]);
   if(seen.has(k))return [seen.get(k),i];seen.set(k,i);}
  return null;};
 const extendAt=(n,edges,i,j)=>{const [u,v]=edges[i],w=n;
  return [n+1,[...edges.filter((_,t)=>t!==i&&t!==j),[u,w],[u,w],[w,v],[w,v]]];};
 const lengthen=(n,edges)=>{                       // two extensions of one path
  const first=parallel(edges);if(!first)return null;
  const [n1,e1]=extendAt(n,edges,first[0],first[1]);
  return extendAt(n1,e1,e1.length-4,e1.length-3);
 };
 const seeds=[[2,[[0,1],[0,1],[0,1],[0,1]]],[3,[[0,1],[0,1],[0,1],[0,1],[1,2],[1,2],[1,2],[1,2]]],[4,ring(4)],[6,ring(6)]];
 for(const [,S] of Object.entries(fixtures)){
  for(const mask of [1,3,5,9,21,42]){
   S.crossings.forEach((x,i)=>{x.over=(mask>>i)&1;});
   const d=KC.decompose(S.comps,S.crossings,KC.analyze(S.comps,S.crossings));
   if(d&&d.graph.edges.length)seeds.push([d.graph.n,d.graph.edges]);
  }
 }
 for(const [n0,e0] of seeds){
  const base=KC.decompositionGenusRecursive(n0,e0);
  assert(base!==null,'seed is an alternating decomposition graph');
  // One extension alone leaves the bipartite world, so the recursion refuses it.
  const single=parallel(e0);
  if(single){const [n1,e1]=extendAt(n0,e0,single[0],single[1]);assert.equal(KC.decompositionGenusRecursive(n1,e1),null,'one extension is not bipartite');}
  let cur=[n0,e0];
  for(let step=0;step<3;step++){
   const next=lengthen(cur[0],cur[1]);
   if(!next)break;
   cur=next;extended++;
   assert.equal(KC.decompositionGenusRecursive(cur[0],cur[1]),base,'doubled path extension changed the genus');
  }
 }
 assert(extended>=100,`extensions ${extended}`);
 console.log(`Proposition 3.11: ${extended} doubled path extensions all keep the Turaev genus: PASS`);
}

// ---- Overlay geometry ----
{
 const S=altTrefoil();S.crossings[0].over=1-S.crossings[0].over;
 const a=KC.analyze(S.comps,S.crossings),d=KC.decompose(S.comps,S.crossings,a);
 assert.equal(d.graph.n,2);assert.equal(d.graph.edges.length,4);assert.equal(a.gT,1);
 assert.equal(isDoubledCycle(d.graph),2,'one flipped crossing gives C_2^2');
 const off=9,P=KC.decompositionPaths(S.comps,d,{clearance:off});
 assert.equal(P.curves.length,2);assert.equal(P.marks.length,2*d.nonAlt.length);assert.equal(P.gEdges.length,d.nonAlt.length);
 // A curve crosses the strand at each marked point, so it leaves one side and
 // comes back on the other: the closing chord is exactly twice the offset.
 P.curves.forEach((pts,i)=>{
  assert(pts.length>3,`curve ${i} has points`);
  const gap=Math.hypot(pts[0].x-pts[pts.length-1].x,pts[0].y-pts[pts.length-1].y);
  assert(Math.abs(gap-2*off)<1.5,`curve ${i} closes across the strand: ${gap}`);
 });
 // The edges of G run between the two marked points of their arc.
 P.gEdges.forEach(e=>{
  const near=p=>P.marks.some(m=>Math.hypot(m.x-p.x,m.y-p.y)<1e-6);
  assert(near(e.pts[0])&&near(e.pts[e.pts.length-1]),'edge ends on its marked points');
  assert.equal(e.over,!!d.dart[2*e.arc].over);
 });
 // Signs alternate around each vertex, so a vertex carries as many + as - edges.
 const plus=new Array(d.graph.n).fill(0),minus=new Array(d.graph.n).fill(0);
 d.graph.signed.forEach(e=>{const t=e.over?plus:minus;t[e.u]++;t[e.v]++;});
 for(let v=0;v<d.graph.n;v++)assert.equal(plus[v],minus[v],`vertex ${v} balances + and - edges`);
}
console.log('Overlay geometry: closed curves crossing at the marked points, and edges of G between them: PASS');

// ---- The relaxation gives the thread back ----
// Relaxing the curves takes a few hundred milliseconds, which is long enough to
// be felt at the end of a gesture, so it is written to be run in slices: the app
// takes a few rounds per frame and gives the thread back in between. Draining
// the same generator in one go must give exactly the same curves, and no single
// slice may carry the whole run -- that is what a blocking version looked like.
{
 const S=fixtures.torus34;
 S.crossings.forEach((x,i)=>{x.over=(i%3===0)?1:0;});
 const d=KC.decompose(S.comps,S.crossings,KC.analyze(S.comps,S.crossings));
 assert(d&&!d.alternating,'the fixture has a nonalternating decomposition to draw');
 let steps=0,out;
 const it=KC.decompositionSteps(S.comps,d);
 for(let r=it.next();;r=it.next()){if(r.done){out=r.value;break;}steps++;assert(steps<1e4,'the stepper does not end');}
 assert(steps>=20,`the run was handed back only ${steps} times`);
 const whole=KC.decompositionPaths(S.comps,d);
 assert.equal(out.curves.length,whole.curves.length);
 out.curves.forEach((pts,i)=>{
  assert.equal(pts.length,whole.curves[i].length,`curve ${i} came out a different length in slices`);
  pts.forEach((P,j)=>{const Q=whole.curves[i][j];
   assert(Math.abs(P.x-Q.x)<1e-9&&Math.abs(P.y-Q.y)<1e-9,`curve ${i} point ${j} differs between a sliced and a drained run`);});
 });
 console.log(`Relaxation runs in ${steps} slices and lands exactly where draining it in one go does: PASS`);
}

// ---- Coarse before fine ----
// Shortening a curve is a heat flow, so a dent takes about as many rounds to
// fill as the square of its width in points. At the drawn spacing the wide
// dents in a big diagram are never reached: 400 rounds still left grooves in a
// 63-crossing one. So the curve is pulled taut on a coarse copy of itself
// first and the spacing is halved back down as it goes -- the same curve, in a
// fraction of the rounds.
{
 const S=fixtures.torus35;
 S.crossings.forEach((x,i)=>{x.over=(i%3===0)?1:0;});
 const d=KC.decompose(S.comps,S.crossings,KC.analyze(S.comps,S.crossings));
 assert(d&&!d.alternating,'the fixture has a nonalternating decomposition to draw');
 const run=opt=>{let n=0,r;const it=KC.decompositionSteps(S.comps,d,opt);
  for(r=it.next();!r.done;r=it.next()){n++;assert(n<1e4,'the stepper does not end');}
  const len=r.value.curves.reduce((t,p)=>{let u=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];u+=Math.hypot(a.x-b.x,a.y-b.y);}return t+u;},0);
  return {n,len};};
 const ladder=run(undefined),flat=run({coarse:1});
 assert(ladder.n*2<flat.n,`the ladder took ${ladder.n} rounds against ${flat.n} at the drawn spacing throughout`);
 assert(Math.abs(ladder.len-flat.len)<0.03*flat.len,
  `the ladder settled on a different curve: ${Math.round(ladder.len)} against ${Math.round(flat.len)}`);
 console.log(`Pulling the curves taut coarse-first reaches the same length in ${ladder.n} rounds rather than ${flat.n}: PASS`);
}

// ---- The drawn curves are the decomposition curves ----
// Everything the overlay claims is checked on one pass over the same diagrams,
// since relaxing the curves is the expensive part and they only need drawing
// once. For every curve:
//   * it is simple, and disjoint from the other curves -- so each one encircles
//     its own tangle and never strays into a neighbouring one;
//   * it meets D exactly at its own marked points, which is the same statement
//     read off the diagram rather than off the curve;
//   * it separates the crossings of the region it bounds from the middle pieces
//     of the edges of G that meet it, which is what fixes the side it is drawn
//     on; and
//   * the region's shading covers those crossings and none of those edges.
{
 const meet=(a,b,c,d)=>{const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
  if(den>-1e-12&&den<1e-12)return false;
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
  return t>1e-9&&t<1-1e-9&&u>1e-9&&u<1-1e-9;};
 const hits=(A,B,skipNear)=>{let k=0;
  for(let i=0;i+1<A.length;i++)for(let j=0;j+1<B.length;j++){
   if(skipNear&&Math.abs(i-j)<2)continue;
   if(meet(A[i],A[i+1],B[j],B[j+1]))k++;}
  return k;};
 const wind=(pts,q)=>{let t=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];
   const ax=a.x-q.x,ay=a.y-q.y,bx=b.x-q.x,by=b.y-q.y;t+=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);}
  return Math.round(t/(2*Math.PI));};
 // A curve under tension is a string, so a dent left in one is a dent something
 // is holding: a strand it has to come round, or one of its own marked points,
 // which it has to pass through. A dent with neither in it is one the
 // relaxation settled for, and those are what used to leave grooves in a
 // region. Every concave stretch of every drawn curve is checked for one.
 const holds=(span,strandPts,marks)=>{
  const poly=span.concat([span[0]]);
  const covers=(px,py)=>{let w=false;
   for(let a=0,b=poly.length-1;a<poly.length;b=a++){const A=poly[a],B=poly[b];
    if((A.y>py)!==(B.y>py)&&px<(B.x-A.x)*(py-A.y)/(B.y-A.y)+A.x)w=!w;}
   return w;};
  for(const q of strandPts)if(covers(q.x,q.y))return true;
  return span.slice(1,-1).some(q=>marks.some(m=>Math.hypot(m.x-q.x,m.y-q.y)<9.5));
 };
 const dents=(p,strandPts,marks)=>{
  // The concave stretches are the runs between consecutive vertices of the
  // convex hull, so the hull is taken and the curve walked between them.
  const n=p.length,out=[];
  const ps=p.map((q,i)=>({x:q.x,y:q.y,i})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo=[],up=[];
  for(const q of ps){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  for(let k=ps.length-1;k>=0;k--){const q=ps[k];
   while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  lo.pop();up.pop();
  const idx=lo.concat(up).map(q=>q.i).sort((a,b)=>a-b);
  for(let k=0;k<idx.length;k++){
   const i=idx[k],j=idx[(k+1)%idx.length],span=[];
   for(let t=i;;t=(t+1)%n){span.push(p[t]);if(t===j||span.length>n)break;}
   if(span.length<4)continue;
   const A=p[i],B=p[j],ex=B.x-A.x,ey=B.y-A.y,L=Math.hypot(ex,ey);
   if(L<20)continue;
   let depth=0;
   for(const q of span){const u=((q.x-A.x)*ex+(q.y-A.y)*ey)/(L*L);
    depth=Math.max(depth,Math.hypot(A.x+u*ex-q.x,A.y+u*ey-q.y));}
   if(depth>=12&&!holds(span,strandPts,marks))out.push(depth);
  }
  return out;
 };
 let drawn=0,shaded=0,points=0,withInfinity=0,turnSum=0,turnWorst=0,loose=0,looseWorst=0;
 for(const [name,S] of Object.entries(fixtures)){
  const c=S.crossings.length;
  for(const mask of (c<=4?[...Array(1<<c).keys()]:[1,3,7,13,29,55,91,170,341,682].filter(m=>m<(1<<c)))){
   S.crossings.forEach((x,i)=>{x.over=(mask>>i)&1;});
   const d=KC.decompose(S.comps,S.crossings,KC.analyze(S.comps,S.crossings));
   if(!d||d.alternating)continue;
   const P=KC.decompositionPaths(S.comps,d);
   const strands=S.comps.map(cm=>cm.pts.concat([cm.pts[0]]));
   const strandPts=[].concat(...S.comps.map(cm=>cm.pts));
   const closed=P.curves.map(p=>p.concat([p[0]]));
   closed.forEach((g,i)=>{
    drawn++;
    // How far the tangent swings in all, in half-turns. A convex curve spends
    // exactly two and every wiggle costs more, so this is what says whether the
    // curve came out smooth -- and it is the thing the relaxation used to be
    // worst at, since every point was placed against whichever strand happened
    // to be nearest it and the placement jumped where that changed.
    {
     const p=P.curves[i],m=p.length;let turn=0;
     for(let k=0;k<m;k++){const A=p[(k-1+m)%m],B=p[k],C=p[(k+1)%m];
      const t1=Math.atan2(B.y-A.y,B.x-A.x),t2=Math.atan2(C.y-B.y,C.x-B.x);
      let dt=t2-t1;while(dt>Math.PI)dt-=2*Math.PI;while(dt<-Math.PI)dt+=2*Math.PI;
      turn+=Math.abs(dt);}
     turn/=Math.PI;turnSum+=turn;if(turn>turnWorst)turnWorst=turn;
     for(const depth of dents(p,strandPts,P.marks)){
      loose++;if(depth>looseWorst)looseWorst=depth;
      assert(depth<30,`${name}/${mask}: curve ${i} has a ${depth.toFixed(0)}px dent in it with nothing holding it`);
     }
    }
    assert.equal(hits(g,g,true),0,`${name}/${mask}: curve ${i} crosses itself`);
    assert.equal(strands.reduce((t,st)=>t+hits(g,st,false),0),d.curves[i].length,
     `${name}/${mask}: curve ${i} does not meet D exactly at its marked points`);
    const pts=P.curves[i];
    const inside=d.regions[d.curveRegion[i]].map(xi=>wind(pts,S.crossings[xi]));
    const outside=d.curves[i].map(x=>{const e=P.gEdges[d.nonAlt.indexOf(x>>1)];return wind(pts,e.pts[e.pts.length>>1]);});
    assert.equal(new Set(inside).size,1,`${name}/${mask}/${i}: the region is split by its own curve`);
    assert.equal(new Set(outside).size,1,`${name}/${mask}/${i}: the edges of G are split by the curve`);
    assert.notEqual(inside[0],outside[0],`${name}/${mask}/${i}: the curve does not separate its region from its edges`);
   });
   for(let i=0;i<closed.length;i++)for(let j=i+1;j<closed.length;j++)
    assert.equal(hits(closed[i],closed[j],false),0,`${name}/${mask}: curves ${i} and ${j} cross`);
   assert.equal(P.regions.length,d.regions.length,`${name}/${mask}: one fill per region`);
   for(const R of P.regions){
    shaded++;if(R.outer)withInfinity++;
    // What the canvas fills: the region's own curves, and for the one holding
    // the point at infinity every curve nothing else contains, since the curves
    // belong to the regions whose tangles they encircle and a split diagram can
    // leave that one with none of its own.
    const bounds=R.outer?R.curves.concat(P.outermost.filter(ci=>!R.curves.includes(ci))):R.curves;
    const filled=q=>(bounds.reduce((t,ci)=>t+Math.abs(wind(P.curves[ci],q)),0)%2===1)!==R.outer;
    for(const xi of d.regions[R.region]){points++;assert(filled(S.crossings[xi]),`${name}/${mask}: a crossing of the region is not shaded`);}
    for(const ci of R.curves)for(const x of d.curves[ci]){
     const e=P.gEdges[d.nonAlt.indexOf(x>>1)];
     points++;assert(!filled(e.pts[e.pts.length>>1]),`${name}/${mask}: an edge of G is inside the shading`);
    }
    // The shading is opaque, so two regions overlapping would be one painting
    // the other out. A region must hold its own crossings and nobody else's.
    for(const O of P.regions){
     if(O===R)continue;
     for(const xi of d.regions[O.region]){
      points++;
      assert(!filled(S.crossings[xi]),`${name}/${mask}: region ${R.region} is shaded over region ${O.region}`);
     }
    }
   }
  }
 }
 assert(drawn>=90&&shaded>=90&&points>=900,`coverage ${drawn}/${shaded}/${points}`);
 const turnMean=turnSum/drawn;
 assert(turnMean<6,`the curves came out wiggly: ${turnMean.toFixed(2)}pi of turning each on average`);
 assert(turnWorst<30,`one curve came out wiggly: ${turnWorst.toFixed(2)}pi of turning`);
 assert(loose<40,`${loose} dents were left with nothing holding them`);
 assert(withInfinity>=4,`the region holding the point at infinity never came up (${withInfinity})`);
 console.log(`${drawn} drawn curves are simple, disjoint, meet D only at their marked points, turn through ${turnMean.toFixed(1)}pi each on the way round, are dented only where something holds them (${loose} shallow exceptions, the deepest ${looseWorst.toFixed(0)}px), and shade ${shaded} regions correctly over ${points} points (${withInfinity} holding the point at infinity): PASS`);
}

// ---- Degenerate input is refused, not guessed at ----
assert.equal(KC.decompositionGenusRecursive(3,[[0,1],[1,2],[2,0]]),null,'a triangle is not an alternating decomposition graph');
{
 const S=KC.fromCurves3D([KC.circleCurve()],360),a=KC.analyze(S.comps,S.crossings);
 const d=KC.decompose(S.comps,S.crossings,a);
 assert(d&&d.alternating&&d.graph.n===0&&d.nArc===0,'a crossingless circle has nothing to decompose');
 assert.equal(KC.decompositionGenus(d).genus,0);
}
console.log('Graphs that are not alternating decomposition graphs, and crossingless diagrams: PASS');
