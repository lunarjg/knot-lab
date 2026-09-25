// ===== Knot core: geometry, crossing tracking, Reidemeister validity, state analysis =====
const KC = (function () {
  const SEG = 7; // target segment length (world units)
  // How far apart the two halves of an R2 pair may be and still be matched.
  // The structural work is done by the empty-bigon test in pairCost; this is
  // only a sanity cap, so it is generous. It has to clear a bigon that a
  // single rigid step collapses all at once (a paste or a nudge of a whole
  // component), not just the tiny one an incremental drag leaves: the old
  // values of 70/60 rejected a legitimate separation costing ~153.
  const R2_REACH = 32 * SEG;

  function circD(a, b) { let d = Math.abs(a - b) % 1; return d > 0.5 ? 1 - d : d; }
  function circSigned(a, b) { let d = (b - a) % 1; if (d > 0.5) d -= 1; else if (d <= -0.5) d += 1; return d; }
  const mod = (a, m) => ((a % m) + m) % m;

  function updateGeom(comp) {
    const p = comp.pts, n = p.length;
    const cum = new Float64Array(n + 1), uw = new Float64Array(n + 1);
    uw[0] = p[0].u;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y);
      let d = circSigned(a.u, b.u); if (d <= 0) d = 1e-9;
      uw[i + 1] = uw[i] + d;
    }
    comp.cum = cum; comp.uw = uw; comp.len = cum[n];
  }

  function arcPosOfU(comp, u) {
    const uw = comp.uw, n = comp.pts.length, period = uw[n] - uw[0];
    let v = uw[0] + mod(u - uw[0], 1) * (period / 1);
    if (v >= uw[n]) v = uw[n] - 1e-12;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (uw[m] <= v) lo = m; else hi = m; }
    const f = (v - uw[lo]) / ((uw[lo + 1] - uw[lo]) || 1);
    return comp.cum[lo] + f * (comp.cum[lo + 1] - comp.cum[lo]);
  }
  function sDist(comp, a, b) { const L = comp.len; const d = mod(a - b, L); return Math.min(d, L - d); }
  function pointAtS(comp, s) {
    const L = comp.len, cum = comp.cum, n = comp.pts.length, p = comp.pts;
    s = mod(s, L);
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = p[lo], b = p[(lo + 1) % n], sl = (cum[lo + 1] - cum[lo]) || 1, f = (s - cum[lo]) / sl;
    return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), dx: (b.x - a.x) / sl, dy: (b.y - a.y) / sl, seg: lo };
  }

  function cloneComps(comps) {
    return comps.map(c => { const k = { pts: c.pts.map(q => ({ x: q.x, y: q.y, u: q.u })) }; updateGeom(k); return k; });
  }
  function cloneCrossings(X) {
    return X.map(c => ({ id: c.id, over: c.over, x: c.x, y: c.y, occ: c.occ.map(o => ({ ...o })) }));
  }

  function resampleComp(comp, simplify = false) {
    const p = comp.pts, n = p.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      out.push(a);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > 1.6 * SEG) {
        const k = Math.ceil(d / SEG) - 1, du = circSigned(a.u, b.u);
        for (let j = 1; j <= k; j++) {
          const f = j / (k + 1);
          out.push({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), u: mod(a.u + f * du, 1) });
        }
      }
    }
    if (out.length > 16) {
      // Standalone resampling only drops straight, redundant points. A caller
      // checking the resulting projection may also simplify gentle bends.
      // Sharp corners and reversals survive even when their edges are tiny.
      const redundant = (a, b, c) => {
        const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
        const cross = Math.abs(ux * vy - uy * vx), dot = ux * vx + uy * vy;
        return dot >= 0 && (simplify ? Math.atan2(cross, dot) < 0.45 :
          cross <= 1e-12 * Math.max(1, Math.hypot(ux, uy) * Math.hypot(vx, vy)));
      };
      const kept = [out[0]];
      for (let i = 1; i < out.length; i++) {
        const q = kept[kept.length - 1];
        if (Math.hypot(out[i].x - q.x, out[i].y - q.y) < 0.45 * SEG && redundant(q, out[i], out[(i + 1) % out.length])) continue;
        kept.push(out[i]);
      }
      while (kept.length > 16) {
        const l = kept[kept.length - 1], f = kept[0];
        if (Math.hypot(l.x - f.x, l.y - f.y) < 0.45 * SEG && redundant(kept[kept.length - 2], l, f)) kept.pop(); else break;
      }
      comp.pts = kept;
    } else comp.pts = out;
    updateGeom(comp);
  }

  function mkOcc(comps, c, i, t) {
    const cm = comps[c], p = cm.pts, n = p.length, a = p[i], b = p[(i + 1) % n];
    const sl = (cm.cum[i + 1] - cm.cum[i]) || 1;
    return { c, seg: i, t, u: mod(a.u + t * circSigned(a.u, b.u), 1), s: cm.cum[i] + t * sl, dx: (b.x - a.x) / sl, dy: (b.y - a.y) / sl };
  }

  // All transverse self/mutual intersections of the closed polylines
  function computeRaw(comps) {
    const CELL = 24, grid = new Map();
    comps.forEach((cm, c) => {
      const p = cm.pts, n = p.length;
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        const x0 = Math.floor(Math.min(a.x, b.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x) / CELL);
        const y0 = Math.floor(Math.min(a.y, b.y) / CELL), y1 = Math.floor(Math.max(a.y, b.y) / CELL);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
          const key = (cx + 32768) * 65536 + (cy + 32768);
          let l = grid.get(key); if (!l) { l = []; grid.set(key, l); }
          l.push(c, i);
        }
      }
    });
    const res = [];
    for (const [key, l] of grid) {
      const cx = Math.floor(key / 65536) - 32768, cy = (key % 65536) - 32768;
      for (let A = 0; A < l.length; A += 2) {
        const c1 = l[A], i = l[A + 1], P = comps[c1].pts, n1 = P.length;
        const a1 = P[i], a2 = P[(i + 1) % n1];
        for (let B = A + 2; B < l.length; B += 2) {
          const c2 = l[B], j = l[B + 1];
          if (c1 === c2) { if (j === i || (j + 1) % n1 === i || (i + 1) % n1 === j) continue; }
          const Q = comps[c2].pts, n2 = Q.length, b1 = Q[j], b2 = Q[(j + 1) % n2];
          // Test the pair in the first cell shared by its bounding boxes.
          // Ownership must use the same bounds as insertion, not a rounded
          // intersection coordinate that can drift across a cell boundary.
          if (cx !== Math.max(Math.floor(Math.min(a1.x, a2.x) / CELL), Math.floor(Math.min(b1.x, b2.x) / CELL)) ||
              cy !== Math.max(Math.floor(Math.min(a1.y, a2.y) / CELL), Math.floor(Math.min(b1.y, b2.y) / CELL))) continue;
          const rx = a2.x - a1.x, ry = a2.y - a1.y, sx = b2.x - b1.x, sy = b2.y - b1.y;
          const den = rx * sy - ry * sx;
          if (Math.abs(den) < 1e-12) continue;
          const qx = b1.x - a1.x, qy = b1.y - a1.y;
          const t = (qx * sy - qy * sx) / den, w = (qx * ry - qy * rx) / den;
          if (t < 0 || t >= 1 || w < 0 || w >= 1) continue;
          const x = a1.x + t * rx, y = a1.y + t * ry;
          res.push({ x, y, id: 0, over: 0, occ: [mkOcc(comps, c1, i, t), mkOcc(comps, c2, j, w)] });
        }
      }
    }
    return res;
  }

  function loopArc(X, comps) {
    const a = X.occ[0], b = X.occ[1];
    if (a.c !== b.c) return null;
    const cm = comps[a.c], fwd = mod(b.s - a.s, cm.len);
    return fwd <= cm.len - fwd ? { c: a.c, start: a.s, len: fwd } : { c: a.c, start: b.s, len: cm.len - fwd };
  }
  function isSmallLoop(X, all, comps, maxLen) {
    const la = loopArc(X, comps);
    if (!la || la.len > maxLen) return false;
    const L = comps[la.c].len;
    for (const Y of all) {
      if (Y === X) continue;
      for (const o of Y.occ) {
        if (o.c !== la.c) continue;
        const rel = mod(o.s - la.start, L);
        if (rel > 1e-6 && rel < la.len - 1e-6) return false;
      }
    }
    return true;
  }

  // Match old crossings to newly computed ones, classify births/deaths, verify R2/R3 validity
  function reconcile(oldX, oldComps, comps, raw, opt) {
    opt = opt || {};
    const ev = { r1: 0, r2: 0, r3: 0 };
    const ns = new Map();
    for (const O of oldX) for (const o of O.occ) ns.set(o, arcPosOfU(comps[o.c], o.u));
    const mO = new Map(), mN = new Map();
    const pass = (T) => {
      const cand = [];
      for (const O of oldX) {
        if (mO.has(O)) continue;
        for (const N of raw) {
          if (mN.has(N)) continue;
          for (let perm = 0; perm < 2; perm++) {
            const a = O.occ[0], b = O.occ[1], na = N.occ[perm], nb = N.occ[1 - perm];
            if (a.c !== na.c || b.c !== nb.c) continue;
            const cost = sDist(comps[a.c], ns.get(a), na.s) + sDist(comps[b.c], ns.get(b), nb.s) + 0.5 * Math.hypot(O.x - N.x, O.y - N.y);
            if (cost < T) cand.push([cost, O, N, perm]);
          }
        }
      }
      cand.sort((x, y) => x[0] - y[0]);
      for (const [, O, N, perm] of cand) {
        if (mO.has(O) || mN.has(N)) continue;
        mO.set(O, N); mN.set(N, O); N.id = O.id; N.over = perm ? 1 - O.over : O.over;
      }
    };
    pass(45); pass(500);

    const births = raw.filter(N => !mN.has(N)), deaths = oldX.filter(O => !mO.has(O));

    // Integrating a whole curve -- a pasted component, a dropped selection, a
    // freshly drawn loop -- is not a Reidemeister move. It adds a complete
    // strand at once, so its crossings are born in numbers that cannot pair up
    // as R1 or R2, and rejecting them (which is right for a drag) would throw
    // away the entire match. The caller then has to renumber every crossing,
    // including the ones that never moved, and re-decide their heights: pasting
    // beside an existing diagram silently rewrote that diagram's crossings.
    //
    // In this mode the matching pass still does its job -- every crossing it
    // recognises keeps its id and its over/under -- and whatever is left over
    // is simply handed back as fresh, for the caller to assign.
    if (opt.integrate) {
      const nid = opt.nextId || (() => Math.floor(Math.random() * 1e9));
      births.forEach(N => { N.id = nid(); });
      return { ok: true, crossings: raw, ev };
    }
    // An R2 pair has to be adjacent along both strands -- nothing else that
    // appeared or vanished in this same step may sit between them. Two
    // crossings that merely happen to land near each other are not an R2, and
    // pairing them as one is how a strand gets to slide through another strand
    // while the step still looks like a legal move.
    //
    // Only births are in the way of a birth pair (and only deaths of a death
    // pair), not every crossing. A crossing that was already there and did not
    // change is just another strand passing through the new bigon, which is a
    // perfectly ordinary thing for a drag to produce: it enters and leaves
    // across the bigon's own boundary, so it necessarily lands on one of these
    // arcs. Counting it made `reconcile` refuse clean R2s in any crowded part
    // of a diagram -- on a seven-component diagram it turned 56 legitimate
    // steps into "a strand cannot pass through another strand".
    const arcEmpty = (cm, s0, s1, all, A, B, c) => {
      const L = cm.len, fwd = mod(s1 - s0, L), bwd = mod(s0 - s1, L);
      const span = Math.min(fwd, bwd), start = fwd <= bwd ? s0 : s1;
      for (const X of all) {
        if (X === A || X === B) continue;
        for (const o of X.occ) {
          if (o.c !== c) continue;
          const t = mod(o.s - start, L);
          if (t > 1e-9 && t < span - 1e-9) return false;
        }
      }
      return true;
    };
    const pairCost = (A, B, perm, cm, all) => {
      const a = A.occ[0], b = A.occ[1], na = B.occ[perm], nb = B.occ[1 - perm];
      if (a.c !== na.c || b.c !== nb.c) return Infinity;
      if (all && !(arcEmpty(cm[a.c], a.s, na.s, all, A, B, a.c) && arcEmpty(cm[b.c], b.s, nb.s, all, A, B, b.c))) return Infinity;
      return sDist(cm[a.c], a.s, na.s) + sDist(cm[b.c], b.s, nb.s) + 0.5 * Math.hypot(A.x - B.x, A.y - B.y);
    };

    // --- deaths: a crossing can only disappear through a move that is allowed
    // to remove it -- an R2 bigon collapse (both crossings agreeing on which
    // strand is on top) or an R1 kink. A death that matches neither is not a
    // Reidemeister move at all: it is a strand that slid through another one,
    // which changes the knot. Those are rejected, and the step is rolled back.
    const doneD = new Set();
    for (const d of deaths) {
      if (doneD.has(d)) continue;
      let best = null;
      for (const e of deaths) {
        if (e === d || doneD.has(e)) continue;
        for (let perm = 0; perm < 2; perm++) {
          const c = pairCost(d, e, perm, oldComps, deaths);
          if (c < R2_REACH && (!best || c < best[0])) best = [c, e, perm];
        }
      }
      if (best) {
        const [, e, perm] = best;
        doneD.add(d); doneD.add(e);
        if ((perm ? 1 - e.over : e.over) !== d.over) return { ok: false, reason: 'R2' };
        ev.r2++; continue;
      }
      if (isSmallLoop(d, oldX, oldComps, 16 * SEG)) { doneD.add(d); ev.r1++; continue; }
      return { ok: false, reason: 'pass' };
    }

    // --- births: the dragged strand goes on top (or below in "under" mode)
    const W = opt.weight || (() => 0);
    const nextId = opt.nextId || (() => Math.floor(Math.random() * 1e9));
    const decide = (N) => {
      const w0 = W(N.occ[0]), w1 = W(N.occ[1]);
      if (Math.abs(w0 - w1) < 1e-3) return 0;
      const hi = w0 > w1 ? 0 : 1;
      return opt.under ? 1 - hi : hi;
    };
    const doneB = new Set();
    for (const b of births) {
      if (doneB.has(b)) continue;
      let best = null;
      for (const e of births) {
        if (e === b || doneB.has(e)) continue;
        for (let perm = 0; perm < 2; perm++) {
          const c = pairCost(b, e, perm, comps, births);
          if (c < R2_REACH && (!best || c < best[0])) best = [c, e, perm];
        }
      }
      b.id = nextId(); b.over = decide(b); doneB.add(b);
      if (best) {
        const [, e, perm] = best;
        e.id = nextId(); e.over = perm ? 1 - b.over : b.over; doneB.add(e); ev.r2++;
      } else if (isSmallLoop(b, raw, comps, 16 * SEG)) ev.r1++;
      // A birth that is neither half of an R2 bigon nor an R1 kink means the
      // strand arrived on the far side of another one: not a legal move.
      else return { ok: false, reason: 'pass' };
    }

    // --- R3: crossings swapping order along a strand pass through a triple point; heights must not be cyclic
    const keyOf = (X, k) => X.id + (k === X.over ? 'o' : 'u');
    const seqOld = comps.map(() => []), seqNew = comps.map(() => []);
    for (const [O, N] of mO) {
      O.occ.forEach((o, k) => seqOld[o.c].push({ s: o.s, key: keyOf(O, k), X: O, k }));
      N.occ.forEach((o, k) => seqNew[o.c].push({ s: o.s, key: keyOf(N, k), X: N, k }));
    }
    const matchedNew = raw.filter(N => mN.has(N));
    const seen = new Set();
    for (let c = 0; c < comps.length; c++) {
      const A = seqOld[c].sort((p, q) => p.s - q.s), B = seqNew[c].sort((p, q) => p.s - q.s), m = A.length;
      if (m < 3 || B.length !== m) continue;
      const pos = new Map(); B.forEach((e, i) => pos.set(e.key, i));
      const off = pos.get(A[0].key);
      let same = off !== undefined;
      if (same) for (let i = 0; i < m; i++) if (B[(off + i) % m].key !== A[i].key) { same = false; break; }
      if (same) continue;
      for (let i = 0; i < m; i++) {
        const x = A[i], y = A[(i + 1) % m], px = pos.get(x.key), py = pos.get(y.key);
        if (px === undefined || py === undefined || py !== (px - 1 + m) % m) continue;
        const nx = B[px], ny = B[py], X = nx.X, Y = ny.X;
        if (X === Y || Math.hypot(X.x - Y.x, X.y - Y.y) > 60) continue;
        const P = X.occ[1 - nx.k], Q = Y.occ[1 - ny.k];
        let bz = null;
        for (const Z of matchedNew) {
          if (Z === X || Z === Y || Math.hypot(Z.x - X.x, Z.y - X.y) > 80) continue;
          for (let j = 0; j < 2; j++) {
            const zp = Z.occ[j], zq = Z.occ[1 - j];
            if (zp.c !== P.c || zq.c !== Q.c) continue;
            const cost = sDist(comps[P.c], zp.s, P.s) + sDist(comps[Q.c], zq.s, Q.s);
            if (cost < 160 && (!bz || cost < bz[0])) bz = [cost, Z, j];
          }
        }
        if (!bz) continue;
        const [, Z, j] = bz;
        const a = nx.k === X.over, b = ny.k === Y.over, cc = Z.over === j;
        if ((a && cc && !b) || (!a && !cc && b)) return { ok: false, reason: 'R3' };
        const key = [X.id, Y.id, Z.id].sort((p, q) => p - q).join(',');
        if (!seen.has(key)) { seen.add(key); ev.r3++; }
      }
    }
    return { ok: true, crossings: raw, ev };
  }

  function attemptStep(S, mutator, opt) {
    const backup = cloneComps(S.comps);
    mutator(S.comps);
    S.comps.forEach(updateGeom);
    // Decimation is a numerical maintenance step, not a Reidemeister move.
    // Keep its pre-resample projection if shortening a run touches a crossing.
    // This lets smooth strands shed crowded samples without erasing a tiny
    // bigon, inventing crossings, or changing an unrelated component.
    const moved = cloneComps(S.comps), projected = computeRaw(S.comps);
    S.comps.forEach((cm, c) => {
      const old = backup[c].pts;
      if (cm.pts.length !== old.length || cm.pts.some((p, i) => p.x !== old[i].x || p.y !== old[i].y || p.u !== old[i].u)) resampleComp(cm, true);
    });
    let raw = computeRaw(S.comps);
    const sameProjection = sampled => {
      const remaining = new Set(sampled);
      const same = (a, b) => a.c === b.c && a.dx * b.dx + a.dy * b.dy > 1 - 1e-8;
      return projected.length === sampled.length && projected.every(X => {
        for (const Y of remaining) {
          if (Math.hypot(X.x - Y.x, X.y - Y.y) > 1e-7) continue;
          if ((same(X.occ[0], Y.occ[0]) && same(X.occ[1], Y.occ[1])) ||
              (same(X.occ[0], Y.occ[1]) && same(X.occ[1], Y.occ[0]))) { remaining.delete(Y); return true; }
        }
        return false;
      });
    };
    if (!sameProjection(raw)) {
      S.comps = cloneComps(moved);
      S.comps.forEach((cm, c) => {
        if (cm.pts.length !== backup[c].pts.length || cm.pts.some((p, i) => p.x !== backup[c].pts[i].x || p.y !== backup[c].pts[i].y)) resampleComp(cm);
      });
      raw = computeRaw(S.comps);
      // Even subdivision can expose floating-point endpoint degeneracies.
      // Prefer the actual requested geometry if that happens.
      if (!sameProjection(raw)) { S.comps = moved; raw = projected; }
    }
    const r = reconcile(S.crossings, backup, S.comps, raw, { ...opt, nextId: () => S.nextId++ });
    if (!r.ok) { S.comps = backup; return r; }
    S.crossings = r.crossings;
    return r;
  }
  // Auto-relax's step: the same attemptStep every other move goes through,
  // so only real topology (reconcile) gates it. A blocked frame simply
  // stops the run.
  function relaxStep(S) {
    return attemptStep(S, comps => relaxMutator(comps, 40, 1.0), {});
  }

  function moveWeighted(comp, gi, ux, uy, sigma) {
    const p = comp.pts, n = p.length, cum = comp.cum, L = comp.len, lim = 3 * sigma, half = Math.floor(n / 2);
    const g2 = 2 * sigma * sigma;
    p[gi].x += ux; p[gi].y += uy;
    for (let k = 1; k < half; k++) {
      const i = (gi + k) % n, d = mod(cum[i] - cum[gi], L);
      if (d > lim) break;
      const w = Math.exp(-d * d / g2); p[i].x += w * ux; p[i].y += w * uy;
    }
    for (let k = 1; k < half; k++) {
      const i = mod(gi - k, n), d = mod(cum[gi] - cum[i], L);
      if (d > lim) break;
      const w = Math.exp(-d * d / g2); p[i].x += w * ux; p[i].y += w * uy;
    }
  }
  function indexOfU(comp, u) {
    let best = 0, bd = 2;
    comp.pts.forEach((q, i) => { const d = circD(q.u, u); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const pairKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  // The angle the two strands make at a crossing, measured between lines
  // rather than directions: pi/2 is a square crossing, 0 is flat.
  function crossingAngle(X) {
    const [p, q] = X.occ;
    const n1 = Math.hypot(p.dx, p.dy) || 1, n2 = Math.hypot(q.dx, q.dy) || 1;
    return Math.acos(Math.min(1, Math.abs((p.dx * q.dx + p.dy * q.dy) / (n1 * n2))));
  }
  const crossingAngles = crossings => new Map(crossings.map(X => [X.id, crossingAngle(X)]));
  // Pairwise crossing distances, for separateCrossings' "was it already like
  // that?" comparison. Keyed by crossing id, so it survives a gesture that
  // renumbers nothing but moves everything.
  function crossingDistances(crossings) {
    const m = new Map();
    for (let i = 0; i < crossings.length; i++) for (let j = i + 1; j < crossings.length; j++) {
      const a = crossings[i], b = crossings[j];
      m.set(pairKey(a.id, b.id), Math.hypot(a.x - b.x, a.y - b.y));
    }
    return m;
  }
  // Weak-magnet separation, run once a gesture finishes: two crossings the
  // gesture pushed into each other are eased back apart until they clear
  // `gap`, so an overlapped pair reads as two crossings instead of one blot.
  //
  // Only pairs the gesture actually tightened are touched -- newly formed, or
  // measurably closer than they were at `before` -- so a diagram that was
  // already drawn tight (an import, or a deliberately crowded region) is left
  // exactly as it is rather than rearranged behind the user's back.
  //
  // Every nudge goes through attemptStep and is rolled back unless it leaves
  // the topology untouched, so separating can never add, remove or reorder a
  // crossing. A pair with nowhere to go is recorded as stuck and skipped,
  // rather than stopping the pass for the pairs that can still move.
  function separateCrossings(S, opt) {
    const gap = opt.gap, before = opt.before;
    if (!(gap > 0) || !before) return 0;
    const stuck = new Set();
    const touched = opt.touched;
    let moved = 0;
    for (let guard = 0; guard < 24; guard++) {
      const X = S.crossings;
      let worst = null;
      for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) {
        const a = X[i], b = X[j], key = pairKey(a.id, b.id);
        if (stuck.has(key)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= gap) continue;
        const prior = before.get(key);
        if (prior !== undefined && prior <= d + 1e-6) continue;
        if (!worst || d < worst.d) worst = { a, b, d, key };
      }
      if (!worst) break;
      const { a, b, d, key } = worst;
      // Exactly coincident crossings have no separation axis of their own;
      // push them apart along one of the strands running through them.
      let ux, uy;
      if (d > 1e-6) { ux = (b.x - a.x) / d; uy = (b.y - a.y) / d; }
      else { const o = a.occ[0], t = Math.hypot(o.dx, o.dy) || 1; ux = o.dx / t; uy = o.dy / t; }
      // Overshoot the gap a little: the corner smoothing that follows a drag
      // pulls the fresh bend back in by a few percent, and this is what keeps
      // the settled result at the gap rather than just under it.
      const push = (gap - d) / 2 + gap * 0.15, sigma = Math.max(10, gap * 0.6);
      const backup = { comps: cloneComps(S.comps), crossings: cloneCrossings(S.crossings), nextId: S.nextId };
      const before2 = S.crossings.length;
      const r = attemptStep(S, comps => {
        // A stationary component may still be a sparse imported polygon.
        // Densify only the strands this nudge touches before locating its grip;
        // otherwise a crossing can snap to a distant corner of that polygon.
        const involved = new Set([...a.occ, ...b.occ].map(o => o.c));
        involved.forEach(c => resampleComp(comps[c]));
        [[a, -1], [b, 1]].forEach(([Xc, sign]) => Xc.occ.forEach(o => {
          const cm = comps[o.c];
          moveWeighted(cm, indexOfU(cm, o.u), sign * ux * push, sign * uy * push, sigma);
        }));
      }, {});
      if (!r.ok || r.ev.r1 || r.ev.r2 || r.ev.r3 || S.crossings.length !== before2) {
        S.comps = backup.comps; S.crossings = backup.crossings; S.nextId = backup.nextId;
        stuck.add(key); continue;
      }
      const na = S.crossings.find(Xc => Xc.id === a.id), nb = S.crossings.find(Xc => Xc.id === b.id);
      if (!na || !nb || Math.hypot(na.x - nb.x, na.y - nb.y) <= d + 1e-6) stuck.add(key);
      else { moved++; if (touched) { touched.add(a.id); touched.add(b.id); } }
    }
    return moved;
  }

  // Pushing two crossings apart stretches the arcs between them, which leaves
  // both strands running nearly parallel through each crossing -- separated,
  // but flat enough that you cannot read which strand is which. This turns the
  // two strands apart again about the crossing they share.
  //
  // The displacement along a strand is u(s) = A * s * exp(-s^2 / 2 sigma^2)
  // times the normal. u(0) = 0, so the crossing itself does not move, while
  // du/ds at the crossing is A -- the tangent there turns by A radians and the
  // effect dies away within a couple of sigma. The largest displacement is only
  // about 0.6 * A * sigma, so this opens the angle without redrawing the curve.
  function openCrossings(S, ids, opt) {
    const minAngle = opt.minAngle, sigma = opt.sigma || 18;
    if (!(minAngle > 0) || !ids || !ids.size) return 0;
    let opened = 0;
    for (const id of ids) {
      const X = S.crossings.find(c => c.id === id);
      if (!X) continue;
      const [p, q] = X.occ;
      const n1 = Math.hypot(p.dx, p.dy) || 1, n2 = Math.hypot(q.dx, q.dy) || 1;
      const t1x = p.dx / n1, t1y = p.dy / n1, t2x = q.dx / n2, t2y = q.dy / n2;
      // signed angle from strand 1 to strand 2
      const th = Math.atan2(t1x * t2y - t1y * t2x, t1x * t2x + t1y * t2y);
      const abs = Math.abs(th);
      if (crossingAngle(X) >= minAngle) continue;
      // turn them apart until the lines meet at minAngle, from whichever side
      // they are already on, so a crossing never flips through square
      const target = abs <= Math.PI / 2 ? minAngle : Math.PI - minAngle;
      const half = (target - abs) * Math.sign(th || 1) / 2;
      const backup = { comps: cloneComps(S.comps), crossings: cloneCrossings(S.crossings), nextId: S.nextId };
      const n = S.crossings.length;
      const turn = (comps, o, A) => {
        const cm = comps[o.c], L = cm.len, g2 = 2 * sigma * sigma;
        const m = Math.hypot(o.dx, o.dy) || 1, nx = -o.dy / m, ny = o.dx / m;
        cm.pts.forEach((pt, i) => {
          let ds = mod(cm.cum[i] - o.s, L); if (ds > L / 2) ds -= L;
          const w = A * ds * Math.exp(-ds * ds / g2);
          pt.x += w * nx; pt.y += w * ny;
        });
      };
      const r = attemptStep(S, comps => { turn(comps, p, -half); turn(comps, q, half); }, {});
      if (!r.ok || r.ev.r1 || r.ev.r2 || r.ev.r3 || S.crossings.length !== n) {
        S.comps = backup.comps; S.crossings = backup.crossings; S.nextId = backup.nextId;
        continue;
      }
      opened++;
    }
    return opened;
  }

  // Energy-style relaxation: short-range repulsion between distant parts of
  // the curve + smoothing toward the immediate-neighbor midpoint.
  function relaxMutator(comps, R, strength) {
    const CELL = R, grid = new Map();
    comps.forEach((cm, c) => cm.pts.forEach((q, i) => {
      const cx = Math.floor(q.x / CELL), cy = Math.floor(q.y / CELL), key = (cx + 32768) * 65536 + (cy + 32768);
      let l = grid.get(key); if (!l) { l = []; grid.set(key, l); } l.push(c, i);
    }));
    const disp = comps.map(cm => cm.pts.map(() => ({ x: 0, y: 0 })));
    comps.forEach((cm, c) => {
      const p = cm.pts, n = p.length;
      for (let i = 0; i < n; i++) {
        const q = p[i], cx = Math.floor(q.x / CELL), cy = Math.floor(q.y / CELL);
        let fx = 0, fy = 0;
        for (let ax = cx - 1; ax <= cx + 1; ax++) for (let ay = cy - 1; ay <= cy + 1; ay++) {
          const l = grid.get((ax + 32768) * 65536 + (ay + 32768)); if (!l) continue;
          for (let k = 0; k < l.length; k += 2) {
            const c2 = l[k], j = l[k + 1];
            if (c2 === c && sDist(cm, cm.cum[i], cm.cum[j]) < 2.5 * R) continue;
            const o = comps[c2].pts[j], dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy);
            if (d >= R || d < 1e-6) continue;
            const w = (R - d) / R; fx += w * w * dx / d; fy += w * w * dy / d;
          }
        }
        const a = p[(i - 1 + n) % n], b = p[(i + 1) % n];
        disp[c][i].x = strength * fx + 0.3 * ((a.x + b.x) / 2 - q.x);
        disp[c][i].y = strength * fy + 0.3 * ((a.y + b.y) / 2 - q.y);
      }
    });
    comps.forEach((cm, c) => { cm.pts = cm.pts.map((q, i) => { let { x, y } = disp[c][i]; const m = Math.hypot(x, y); if (m > 1.2) { x *= 1.2 / m; y *= 1.2 / m; } return { x: q.x + x, y: q.y + y, u: q.u }; }); });
  }


  // Round off sharp corners: vertices turning more than `angle` (and their neighbours) are pulled toward
  // the midpoint of their neighbours. Returns the number of passes that moved something.
  function smoothCorners(pts, closed, opt) {
    opt = opt || {};
    const n = pts.length, thr = opt.angle || 0.45, iters = opt.iters || 10, str = opt.strength || 0.5, mask = opt.mask;
    if (n < 5) return 0;
    let passes = 0;
    for (let it = 0; it < iters; it++) {
      const mark = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) continue;
        const a = pts[(i - 1 + n) % n], b = pts[i], q = pts[(i + 1) % n];
        const ux = b.x - a.x, uy = b.y - a.y, vx = q.x - b.x, vy = q.y - b.y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        if (!lu || !lv) continue;
        const cs = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)));
        if (Math.acos(cs) <= thr) continue;
        for (let k = -2; k <= 2; k++) {
          let j = i + k;
          if (closed) j = (j + n) % n; else if (j <= 0 || j >= n - 1) continue;
          mark[j] = 1;
        }
      }
      const nx = new Float64Array(n), ny = new Float64Array(n);
      let any = false;
      for (let i = 0; i < n; i++) {
        if (!mark[i]) continue;
        const w = str * (mask ? mask(i) : 1);
        if (w <= 0) { mark[i] = 0; continue; }
        const a = pts[(i - 1 + n) % n], b = pts[i], q = pts[(i + 1) % n];
        nx[i] = b.x + w * ((a.x + q.x) / 2 - b.x); ny[i] = b.y + w * ((a.y + q.y) / 2 - b.y); any = true;
      }
      if (!any) break;
      for (let i = 0; i < n; i++) if (mark[i]) { pts[i].x = nx[i]; pts[i].y = ny[i]; }
      passes++;
    }
    return passes;
  }

  // ----- building diagrams -----
  function resampleClosed(raw, spacing) {
    const n = raw.length, cum = [0];
    for (let i = 0; i < n; i++) { const a = raw[i], b = raw[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b.x - a.x, b.y - a.y)); }
    const L = cum[n], m = Math.max(16, Math.round(L / spacing)), out = [];
    let j = 0;
    for (let k = 0; k < m; k++) {
      const s = k * L / m;
      while (j < n - 1 && cum[j + 1] < s) j++;
      const a = raw[j], b = raw[(j + 1) % n], f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
      out.push({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), z: (a.z || 0) + f * ((b.z || 0) - (a.z || 0)), u: k / m });
    }
    return out;
  }

  function zAt(comp, o) { const p = comp.pts, a = p[o.seg], b = p[(o.seg + 1) % p.length]; return a.z + o.t * (b.z - a.z); }

  function fromCurves3D(curves, size) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    curves.forEach(cv => cv.forEach(q => { minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x); miny = Math.min(miny, q.y); maxy = Math.max(maxy, q.y); }));
    const sc = size / Math.max(maxx - minx, maxy - miny), cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const comps = curves.map(cv => {
      const sp = cv.map(q => ({ x: (q.x - cx) * sc, y: (q.y - cy) * sc, z: q.z || 0 }));
      const c = { pts: resampleClosed(sp, SEG) }; updateGeom(c); return c;
    });
    const raw = computeRaw(comps);
    let id = 1;
    raw.forEach(X => { X.id = id++; X.over = zAt(comps[X.occ[0].c], X.occ[0]) >= zAt(comps[X.occ[1].c], X.occ[1]) ? 0 : 1; });
    comps.forEach(c => c.pts.forEach(q => delete q.z));
    return { comps, crossings: raw, nextId: id };
  }

  function torusCurve(p, q, R, r) {
    const N = 1600, out = [];
    for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N, rr = R + r * Math.cos(q * t); out.push({ x: rr * Math.cos(p * t), y: rr * Math.sin(p * t), z: r * Math.sin(q * t) }); }
    return out;
  }
  function figureEightCurve() {
    const N = 1600, out = [];
    for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N, rr = 2 + Math.cos(2 * t); out.push({ x: rr * Math.cos(3 * t), y: rr * Math.sin(3 * t), z: Math.sin(4 * t) }); }
    return out;
  }
  function circleCurve() {
    const N = 400, out = [];
    for (let i = 0; i < N; i++) { const t = 2 * Math.PI * i / N; out.push({ x: Math.cos(t), y: Math.sin(t), z: 0 }); }
    return out;
  }

  function braidCurves(word) {
    const n = Math.max(...word.map(Math.abs)) + 1, G = 70, H = 70, rows = word.length, curves = [];
    const visited = new Array(n).fill(false);
    const push = (arr, x, y, z) => arr.push({ x, y, z });
    const line = (arr, x0, y0, x1, y1) => { const k = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8)); for (let i = 0; i < k; i++) push(arr, x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k, 0); };
    const arc = (arr, cx, cy, r, th0, th1) => { const k = 14; for (let i = 0; i < k; i++) { const th = th0 + (th1 - th0) * i / k; push(arr, cx + r * Math.cos(th), cy + r * Math.sin(th), 0); } };
    for (let s0 = 0; s0 < n; s0++) {
      if (visited[s0]) continue;
      const pts = []; let p = s0;
      do {
        visited[p] = true;
        let pos = p;
        for (let r = 0; r < rows; r++) {
          const g = word[r], i = Math.abs(g), eps = Math.sign(g);
          let target = pos, moving = 0;
          if (pos === i - 1) { target = i; moving = 1; } else if (pos === i) { target = i - 1; moving = -1; }
          const S = 24;
          for (let k = 0; k < S; k++) {
            const tau = k / S, x = (pos + (target - pos) * (1 - Math.cos(Math.PI * tau)) / 2) * G, y = (r + tau) * H;
            const z = moving ? (moving < 0 ? 1 : -1) * eps * Math.sin(Math.PI * tau) : 0;
            push(pts, x, y, z);
          }
          pos = target;
        }
        const k = pos, rho = 0.4 * (n - k) * G, xk = k * G, xR = (n - 1) * G + 2 * rho, Hb = rows * H;
        arc(pts, xk + rho, Hb, rho, Math.PI, Math.PI / 2);
        line(pts, xk + rho, Hb + rho, xR - rho, Hb + rho);
        arc(pts, xR - rho, Hb, rho, Math.PI / 2, 0);
        line(pts, xR, Hb, xR, 0);
        arc(pts, xR - rho, 0, rho, 0, -Math.PI / 2);
        line(pts, xR - rho, -rho, xk + rho, -rho);
        arc(pts, xk + rho, 0, rho, -Math.PI / 2, -Math.PI);
        p = pos;
      } while (p !== s0);
      curves.push(pts);
    }
    return curves;
  }

  // ----- analysis: states, Turaev genus, PD -----
  function UF(n) { const p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i; const f = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }; return { find: f, union: (a, b) => { a = f(a); b = f(b); if (a !== b) p[a] = b; } }; }

  function analyze(comps, X) {
    const occ = comps.map(() => []);
    X.forEach((cr, xi) => cr.occ.forEach((o, k) => occ[o.c].push({ s: o.s, xi, k })));
    occ.forEach(l => l.sort((a, b) => a.s - b.s));
    const arcBase = []; let A = 0;
    occ.forEach((l, c) => { arcBase[c] = A; A += l.length; });
    const half = X.map(() => [null, null]);
    occ.forEach((l, c) => {
      const m = l.length;
      l.forEach((e, j) => { half[e.xi][e.k] = { out: 2 * (arcBase[c] + j), inn: 2 * (arcBase[c] + (j - 1 + m) % m) + 1, c, j }; });
    });
    const info = X.map((cr, xi) => {
      const o = cr.occ[cr.over], nn = cr.occ[1 - cr.over];
      const crossScreen = nn.dx * o.dy - nn.dy * o.dx;
      const sMath = crossScreen > 0 ? -1 : 1;
      const O = half[xi][cr.over], N = half[xi][1 - cr.over];
      const p1 = [[N.out, O.out], [N.inn, O.inn]], p2 = [[N.out, O.inn], [N.inn, O.out]];
      return { sign: crossScreen > 0 ? 1 : -1, O, N, A: sMath > 0 ? p1 : p2, B: sMath > 0 ? p2 : p1, Sf: [[O.inn, N.out], [N.inn, O.out]] };
    });
    const free = occ.filter(l => l.length === 0).length;
    const state = (key) => {
      const uf = UF(Math.max(1, 2 * A));
      for (let a = 0; a < A; a++) uf.union(2 * a, 2 * a + 1);
      info.forEach(I => I[key].forEach(([u, v]) => uf.union(u, v)));
      const roots = new Set(); for (let i = 0; i < 2 * A; i++) roots.add(uf.find(i));
      const adequate = info.every(I => uf.find(I.N.out) !== uf.find(I.N.inn));
      return { uf, count: roots.size + free, adequate };
    };
    const sA = state('A'), sB = state('B'), sS = state('Sf');
    // split pieces of the diagram
    const cu = UF(Math.max(1, comps.length));
    X.forEach(cr => cu.union(cr.occ[0].c, cr.occ[1].c));
    const pieces = new Set(); comps.forEach((_, c) => pieces.add(cu.find(c)));
    const k = comps.length ? pieces.size : 0, c = X.length, mu = comps.length;
    const writhe = info.reduce((t, I) => t + I.sign, 0);
    let alternating = true;
    occ.forEach(l => { for (let j = 0; j < l.length; j++) { const a = l[j], b = l[(j + 1) % l.length]; if ((X[a.xi].over === a.k) === (X[b.xi].over === b.k)) alternating = false; } });
    // PD (KnotTheory convention: X[in-under, ..., out-under, ...] counterclockwise)
    const lab = node => ((node - (node & 1)) / 2) + 1;
    const pd = info.map(I => {
      const Nin = lab(I.N.inn), Nout = lab(I.N.out), Oin = lab(I.O.inn), Oout = lab(I.O.out);
      return I.sign > 0 ? [Nin, Oout, Nout, Oin] : [Nin, Oin, Nout, Oout];
    });
    const gT = comps.length ? (2 * k + c - sA.count - sB.count) / 2 : 0;
    const gSeif = comps.length ? (2 * k - sS.count + c - mu) / 2 : 0;
    return {
      c, mu, k, writhe, sA, sB, sS, gT, gSeif, occ, info, arcCount: A, alternating, pd,
      positive: c > 0 && info.every(I => I.sign > 0), negative: c > 0 && info.every(I => I.sign < 0), free
    };
  }


  // ----- alternating decomposition -----
  // Armond and Lowrance, "Turaev genus and alternating decompositions",
  // Algebr. Geom. Topol. 17 (2017) 793-830.
  //
  // Read D as a 4-valent plane graph. An edge of it is NONALTERNATING when the
  // strand is the overstrand at both ends, or the understrand at both. Mark every
  // nonalternating edge with two points and, inside each face, join the marked
  // points that are adjacent along the boundary without lying on the same edge
  // (Figure 1 of the paper). Those arcs close up into disjoint simple closed
  // curves -- the alternating decomposition. The alternating decomposition graph
  // G has one vertex per curve and one edge per nonalternating edge of D.
  //
  // Everything here runs on darts. Arc g is the piece of a component between two
  // consecutive crossings; dart 2g leaves the earlier crossing running forwards
  // and dart 2g+1 leaves the later one running backwards, so d^1 is the same arc
  // seen from its other end.
  function decompose(comps, X, a) {
    a = a || analyze(comps, X);
    const occ = a.occ, base = [];
    let nArc = 0;
    occ.forEach((l, c) => { base[c] = nArc; nArc += l.length; });
    const nD = 2 * nArc, dart = new Array(nD).fill(null);
    occ.forEach((l, c) => {
      const m = l.length, L = comps[c].len;
      l.forEach((e, j) => {
        const g = base[c] + j, o = X[e.xi].occ[e.k];
        const span = m > 1 ? mod(l[(j + 1) % m].s - e.s, L) : L;
        dart[2 * g] = { xi: e.xi, k: e.k, c, arc: g, over: X[e.xi].over === e.k, ang: Math.atan2(o.dy, o.dx), s0: e.s, s1: e.s + span };
      });
      l.forEach((e, j) => {
        const back = base[c] + (j - 1 + m) % m, f = dart[2 * back], o = X[e.xi].occ[e.k];
        dart[2 * back + 1] = { xi: e.xi, k: e.k, c, arc: back, over: X[e.xi].over === e.k, ang: Math.atan2(-o.dy, -o.dx), s0: f.s1, s1: f.s0 };
      });
    });
    const at = X.map(() => []);
    for (let d = 0; d < nD; d++) if (dart[d]) at[dart[d].xi].push(d);
    if (at.some(l => l.length !== 4)) return null;
    at.forEach(l => l.sort((p, q) => dart[p].ang - dart[q].ang));
    const rot = new Int32Array(nD);
    at.forEach(l => l.forEach((d, i) => { rot[d] = l[(i + 1) % 4]; }));
    const nextInFace = d => rot[d ^ 1];

    const faceOf = new Int32Array(nD).fill(-1), faces = [];
    for (let d = 0; d < nD; d++) {
      if (faceOf[d] >= 0) continue;
      const walk = []; let e = d;
      do { faceOf[e] = faces.length; walk.push(e); e = nextInFace(e); } while (e !== d);
      faces.push(walk);
    }

    const isNA = new Uint8Array(nArc), nonAlt = [];
    for (let g = 0; g < nArc; g++) if (dart[2 * g].over === dart[2 * g + 1].over) { isNA[g] = 1; nonAlt.push(g); }
    // Along a face walk the over/under role flips exactly at the nonalternating
    // arcs, so every face meets an even number of them and the arcs below always
    // pair up. sigma walks a decomposition curve from marked point to marked
    // point: leave the arc backwards, run along the face past the alternating
    // arcs, and stop at the first nonalternating one.
    const nextNA = d => { let e = nextInFace(d); while (!isNA[e >> 1]) e = nextInFace(e); return e; };
    const sigma = new Int32Array(nD).fill(-1);
    for (const g of nonAlt) for (const d of [2 * g, 2 * g + 1]) sigma[d] = nextNA(d ^ 1);
    const curveOf = new Int32Array(nD).fill(-1), curves = [];
    for (const g of nonAlt) for (const d of [2 * g, 2 * g + 1]) {
      if (curveOf[d] >= 0) continue;
      const cyc = []; let e = d;
      do { curveOf[e] = curves.length; cyc.push(e); e = sigma[e]; } while (e !== d);
      curves.push(cyc);
    }

    // An alternating region is a piece of the sphere cut along the curves that
    // still holds crossings: exactly a maximal run of alternating arcs.
    const ru = UF(Math.max(1, X.length));
    for (let g = 0; g < nArc; g++) if (!isNA[g]) ru.union(dart[2 * g].xi, dart[2 * g + 1].xi);
    const regionIx = new Map(), regions = [], regionOfX = [];
    X.forEach((_, i) => {
      const r = ru.find(i);
      if (!regionIx.has(r)) { regionIx.set(r, regions.length); regions.push([]); }
      regionOfX[i] = regionIx.get(r); regions[regionOfX[i]].push(i);
    });
    // A crossing-free component is a whole alternating piece too.
    occ.forEach(l => { if (!l.length) regions.push([]); });
    const curveRegion = curves.map(cyc => regionOfX[dart[cyc[0]].xi]);
    // A region no curve bounds is a whole alternating sphere piece, and the paper
    // gives it the single vertex that stands for an alternating diagram.
    const bounded = new Set(curveRegion);
    const solo = regions.map((_, r) => r).filter(r => !bounded.has(r));
    const signed = nonAlt.map(g => ({ u: curveOf[2 * g], v: curveOf[2 * g + 1], arc: g, over: !!dart[2 * g].over }));
    return {
      dart, rot, nextInFace, faces, faceOf, isNA, nonAlt, sigma, curves, curveOf,
      regions, regionOfX, curveRegion, solo, nArc, alternating: !nonAlt.length,
      graph: { n: curves.length + solo.length, edges: signed.map(e => [e.u, e.v]), signed, curves: curves.length, solo: solo.length }
    };
  }

  // Proposition 3.5: the Turaev surface of D is the TWISTED embedding of G -- the
  // sphere embedding carrying a half twist in every edge band. G is bipartite and
  // every edge joins the two sides, so half-twisting every band is the same as
  // reflecting the vertex disks on one side, that is, reversing their rotation.
  // The sphere embedding itself is read straight off the decomposition: the
  // marked points sit along a curve in the order sigma visits them.
  function decompositionGenus(dec) {
    if (!dec) return null;
    const { curves, curveOf, sigma, nonAlt, graph } = dec;
    const darts = [];
    for (const g of nonAlt) darts.push(2 * g, 2 * g + 1);
    const back = new Int32Array(sigma.length).fill(-1);
    for (const d of darts) back[sigma[d]] = d;
    const boundary = (flip) => {
      const seen = new Set(); let f = 0;
      for (const d of darts) {
        if (seen.has(d)) continue;
        f++; let e = d;
        do { seen.add(e); e = (flip[curveOf[e]] ? back[e] : sigma[e]) ^ 1; } while (e !== d);
      }
      return f;
    };
    const colour = new Int8Array(curves.length).fill(-1), adj = curves.map(() => []);
    graph.edges.forEach(([u, v]) => { adj[u].push(v); adj[v].push(u); });
    let k = graph.solo;
    for (let v = 0; v < curves.length; v++) {
      if (colour[v] >= 0) continue;
      k++; colour[v] = 0;
      const q = [v];
      while (q.length) { const w = q.pop(); for (const z of adj[w]) { if (colour[z] < 0) { colour[z] = 1 - colour[w]; q.push(z); } else if (colour[z] === colour[w]) return null; } }
    }
    // Isolated vertices are spheres of their own: one vertex, no edge, one face.
    const e = graph.edges.length, V = curves.length + graph.solo;
    const flat = boundary(new Uint8Array(curves.length)) + graph.solo, twisted = boundary(colour) + graph.solo;
    if (V - e + flat !== 2 * k) return null;
    const genus = (2 * k - (V - e + twisted)) / 2;
    return Number.isInteger(genus) && genus >= 0 ? { genus, components: k, sphereFaces: flat, twistedFaces: twisted } : null;
  }

  // Corollary 3.9: the same Turaev genus read straight off the abstract graph,
  // with no embedding and no diagram. Lemma 3.6 guarantees that one of the two
  // rules always applies, so the recursion terminates. The rules only mean
  // anything for an alternating decomposition graph, so a graph that is not one
  // is refused rather than answered: planarity is assumed of the caller, but the
  // other two conditions of Proposition 3.3 are checked here.
  function decompositionGenusRecursive(n, edgeList) {
    const degree = new Array(n).fill(0), near = Array.from({ length: n }, () => []);
    for (const [u, v] of edgeList) {
      if (!(u >= 0 && u < n && v >= 0 && v < n) || u === v) return null;
      degree[u]++; degree[v]++; near[u].push(v); near[v].push(u);
    }
    if (degree.some(d => d % 2)) return null;
    const side = new Int8Array(n).fill(-1);
    for (let v = 0; v < n; v++) {
      if (side[v] >= 0) continue;
      side[v] = 0;
      const q = [v];
      while (q.length) { const w = q.pop(); for (const z of near[w]) { if (side[z] < 0) { side[z] = 1 - side[w]; q.push(z); } else if (side[z] === side[w]) return null; } }
    }
    const count = (N, E) => { const u = UF(Math.max(1, N)); E.forEach(e => u.union(e[0], e[1])); const r = new Set(); for (let i = 0; i < N; i++) r.add(u.find(i)); return r.size; };
    const merge = (N, E, group) => {
      const id = new Array(N).fill(-1); let next = 0;
      for (let i = 0; i < N; i++) if (!group.has(i)) id[i] = next++;
      const gid = next++;
      group.forEach(i => { id[i] = gid; });
      return [next, E.map(e => [id[e[0]], id[e[1]]]).filter(e => e[0] !== e[1])];
    };
    let guard = 0;
    const go = (N, E) => {
      if (++guard > 5000) return null;
      if (!E.length) return 0;
      const k = count(N, E), seen = new Map();
      for (let i = 0; i < E.length; i++) {
        const key = Math.min(E[i][0], E[i][1]) + ',' + Math.max(E[i][0], E[i][1]);
        if (seen.has(key)) {
          const j = seen.get(key), rest = E.filter((_, t) => t !== i && t !== j);
          if (count(N, rest) === k) { const g = go(N, rest); return g === null ? null : g + 1; }
          return go(...merge(N, rest, new Set(E[i])));
        }
        seen.set(key, i);
      }
      const deg = new Array(N).fill(0), inc = Array.from({ length: N }, () => []);
      E.forEach((e, i) => { deg[e[0]]++; deg[e[1]]++; inc[e[0]].push(i); inc[e[1]].push(i); });
      for (let v = 0; v < N; v++) if (deg[v] === 2) {
        const [i, j] = inc[v], rest = E.filter((_, t) => t !== i && t !== j);
        return go(...merge(N, rest, new Set([v, ...E[i], ...E[j]])));
      }
      return null;
    };
    return go(n, edgeList.map(e => [e[0], e[1]]));
  }

  // Start with a boundary following the faces of the diagram, and shorten it
  // subject to strand and boundary clearances. This is also the fallback for a
  // tangle that cannot fit in a round disk in the current drawing. A final pass
  // tries circles, then ellipses, around the alternating core: marked points
  // may move along their nonalternating edges instead of holding long grooves
  // in the boundary halfway along a winding connector.
  // The relaxation is the one part of this file that takes long enough to be
  // felt, so it is written as a generator that gives the thread back between
  // rounds. Anything that just wants the answer drains it; the app drives it a
  // few rounds at a time so a gesture never waits on it.
  function decompositionPaths(comps, dec, opt) {
    const steps = decompositionSteps(comps, dec, opt);
    let step; while (!(step = steps.next()).done);
    return step.value;
  }
  // Propose local fold closures; the caller checks diagram intersections and
  // neighbouring boundaries before accepting this geometry.
  function repairDecompositionDents(pts, clear = 7) {
    if (pts.length < 4) return null;
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const sorted = pts.map((p, i) => ({ ...p, i })).sort((a, b) => a.x - b.x || a.y - b.y), lo = [], hi = [];
    for (const p of sorted) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of sorted.slice().reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const hull = lo.slice(0, -1).concat(hi.slice(0, -1)).map(p => p.i).sort((a, b) => a - b);
    const removed = new Set();
    for (let k = 0; k < hull.length; k++) {
      const a = hull[k], b = hull[(k + 1) % hull.length], chord = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
      if (chord < 1e-8) continue;
      let length = 0, depth = 0;
      const pocket = [];
      for (let j = a; j !== b; j = (j + 1) % pts.length) {
        const next = pts[(j + 1) % pts.length];
        length += Math.hypot(next.x - pts[j].x, next.y - pts[j].y);
        depth = Math.max(depth, Math.abs(cross(pts[a], pts[b], pts[j])) / chord);
        if (j !== a) pocket.push(j);
      }
      // Deep folds take a long detour around a narrow opening. Leave broad
      // bends and the rest of the existing silhouette exactly as they are.
      if (length > 1.6 * chord && depth > 3 * clear) pocket.forEach(j => removed.add(j));
    }
    if (!removed.size) return null;
    const kept = pts.map((p, i) => ({ ...p, i })).filter(p => !removed.has(p.i)), out = [];
    kept.forEach((p, i) => {
      const a = kept[mod(i - 1, kept.length)], b = kept[(i + 1) % kept.length];
      if (mod(p.i - a.i, pts.length) === 1 && mod(b.i - p.i, pts.length) === 1) { out.push({ x: p.x, y: p.y }); return; }
      const da = Math.hypot(a.x - p.x, a.y - p.y), db = Math.hypot(b.x - p.x, b.y - p.y);
      const trim = Math.min(clear, da / 3, db / 3);
      if (trim < 1e-9) { out.push({ x: p.x, y: p.y }); return; }
      const u = { x: p.x + (a.x - p.x) * trim / da, y: p.y + (a.y - p.y) * trim / da };
      const v = { x: p.x + (b.x - p.x) * trim / db, y: p.y + (b.y - p.y) * trim / db };
      for (let k = 0; k <= 4; k++) {
        const t = k / 4, s = 1 - t;
        out.push({ x: s * s * u.x + 2 * s * t * p.x + t * t * v.x, y: s * s * u.y + 2 * s * t * p.y + t * t * v.y });
      }
    });
    return out;
  }

  function* decompositionSteps(comps, dec, opt) {
    if (!dec) return null;
    opt = opt || {};
    // Optional deterministic work counters, independent of task slicing.
    const work = opt.work;
    if (work) { work.rounds = 0; work.pointUpdates = 0; work.distanceChecks = 0; }
    const clear = opt.clearance == null ? 7 : opt.clearance;   // never closer to a strand than this
    const pad = opt.pad == null ? 20 : opt.pad;               // and as far off as this, where there is room
    const apart = opt.apart == null ? 10 : opt.apart;          // off the other curves
    const fine = opt.spacing || 9;                             // point spacing, as drawn
    const coarse = opt.coarse == null ? 4 : opt.coarse;        // and how far above it the first rounds run
    const rounds = opt.rounds == null ? 150 : opt.rounds;
    const stride = opt.stride == null ? 5 : opt.stride;      // no point is pulled further in a round
    const gain = opt.gain == null ? 2 : opt.gain;             // how hard a dip is pushed out once taut
    const creep = opt.creep == null ? 2 : opt.creep;          // how far a marked point may slide in a round
    const band = opt.band == null ? 0.09 : opt.band;          // and how far in all, as a fraction of its edge
    const tidy = opt.tidy == null ? 0.8 : opt.tidy;           // how far the drawn line may cut a corner
    const shape = opt.shape == null ? 25 : opt.shape;         // rounds spent convexifying once it is taut
    const tail = opt.tail == null ? 12 : opt.tail;            // and settling the corners the last pull leaves
    const stretch = opt.stretch == null ? 120 : opt.stretch;   // how many points ahead a chord may reach when pulling taut
    const blunt = opt.blunt == null ? 5 : opt.blunt;          // over how many points either side a dent is filled
    const passes = opt.smooth == null ? 12 : opt.smooth;      // passes of plain smoothing once the shape is settled
    const stray = opt.stray == null ? clear : opt.stray;      // and how far that may take a point off what it settled on
    const reach = opt.reach == null ? 7 : opt.reach;          // nor moved further, once every rule has spoken
    const { dart, sigma, nonAlt, curves, nextInFace, faces } = dec;

    let h = fine, gait = 1;                                    // the spacing in force, and the step it allows

    // A grid of line segments, asked only for what lies near a point. The curve
    // grid is rebuilt as the curves move, so it is a plain array of buckets over
    // a fixed frame rather than anything that allocates per round.
    const CELL = Math.max(16, 2 * Math.max(clear, apart, fine), pad + 4);
    const frame = { x0: 0, y0: 0, nx: 1, ny: 1 };
    const grid = () => ({ cell: Array.from({ length: frame.nx * frame.ny }, () => []), at: [] });
    const cellsOf = it => {
      const lo = Math.max(0, Math.floor((Math.min(it[0], it[2]) - frame.x0) / CELL));
      const hi = Math.min(frame.nx - 1, Math.floor((Math.max(it[0], it[2]) - frame.x0) / CELL));
      const bo = Math.max(0, Math.floor((Math.min(it[1], it[3]) - frame.y0) / CELL));
      const bi = Math.min(frame.ny - 1, Math.floor((Math.max(it[1], it[3]) - frame.y0) / CELL));
      const out = [];
      for (let cx = lo; cx <= hi; cx++) for (let cy = bo; cy <= bi; cy++) out.push(cy * frame.nx + cx);
      return out;
    };
    const fill = (g, items) => {
      for (const c of g.cell) c.length = 0;
      g.at = [];
      for (let i = 0; i < items.length; i++) {
        const cells = cellsOf(items[i]);
        g.at.push(cells);
        for (const k of cells) g.cell[k].push(i);
      }
      return g;
    };
    // A curve moves while it is being swept against, so its index is kept exact
    // point by point rather than rebuilt once a round. A stale index is what let
    // a curve walk through a part of itself that had already moved on.
    const relist = (g, items, i) => {
      for (const k of g.at[i]) { const l = g.cell[k], at = l.indexOf(i); if (at >= 0) l.splice(at, 1); }
      const cells = cellsOf(items[i]);
      g.at[i] = cells;
      for (const k of cells) g.cell[k].push(i);
    };
    const box = (g, x0, y0, x1, y1, out) => {
      out.length = 0;
      const lo = Math.max(0, Math.floor((Math.min(x0, x1) - frame.x0) / CELL) - 1);
      const hi = Math.min(frame.nx - 1, Math.floor((Math.max(x0, x1) - frame.x0) / CELL) + 1);
      const bo = Math.max(0, Math.floor((Math.min(y0, y1) - frame.y0) / CELL) - 1);
      const bi = Math.min(frame.ny - 1, Math.floor((Math.max(y0, y1) - frame.y0) / CELL) + 1);
      for (let x = lo; x <= hi; x++) for (let y = bo; y <= bi; y++) {
        const l = g.cell[y * frame.nx + x];
        for (let i = 0; i < l.length; i++) out.push(l[i]);
      }
      return out;
    };
    const near = (g, px, py, out) => box(g, px, py, px, py, out);
    // A segment sits in every cell it spans, so a range query can hand the same
    // one back several times. That is harmless when taking a nearest distance and
    // wrong when counting crossings, so counting goes through a stamp.
    let visit = 0;
    const once = new Int32Array(4).fill(-1);
    const stamps = { strand: once };
    const fresh = (name, size) => {
      if (stamps[name].length < size) stamps[name] = new Int32Array(size).fill(-1);
      return stamps[name];
    };
    // The nearest point on a segment, asked for millions of times a run: it
    // leaves the foot of the perpendicular in `cqx`/`cqy` and returns only the
    // distance, because handing back a little object for each answer cost more
    // in collection than the arithmetic did.
    let cqx = 0, cqy = 0;
    const closest = (it, px, py) => {
      if (work) work.distanceChecks++;
      const ex = it[2] - it[0], ey = it[3] - it[1], L2 = ex * ex + ey * ey;
      let u = L2 ? ((px - it[0]) * ex + (py - it[1]) * ey) / L2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      cqx = it[0] + u * ex; cqy = it[1] + u * ey;
      const dx = px - cqx, dy = py - cqy;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const strand = [];
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    comps.forEach(cm => {
      const q = cm.pts, n = q.length;
      for (let i = 0; i < n; i++) {
        strand.push([q[i].x, q[i].y, q[(i + 1) % n].x, q[(i + 1) % n].y]);
        bx0 = Math.min(bx0, q[i].x); bx1 = Math.max(bx1, q[i].x);
        by0 = Math.min(by0, q[i].y); by1 = Math.max(by1, q[i].y);
      }
    });
    if (!strand.length) { bx0 = by0 = 0; bx1 = by1 = 1; }
    const PAD = 4 * CELL;
    frame.x0 = bx0 - PAD; frame.y0 = by0 - PAD;
    frame.nx = Math.max(1, Math.ceil((bx1 - bx0 + 2 * PAD) / CELL));
    frame.ny = Math.max(1, Math.ceil((by1 - by0 + 2 * PAD) / CELL));
    const strandAt = fill(grid(), strand);

    const sample = (d, from, to) => {
      const D = dart[d], cm = comps[D.c], f = D.s1 > D.s0 ? 1 : -1;
      const n = Math.max(1, Math.ceil(Math.abs(to - from) / h)), out = [];
      for (let i = 0; i <= n; i++) { const P = pointAtS(cm, from + (to - from) * i / n); out.push({ x: P.x, y: P.y, tx: f * P.dx, ty: f * P.dy }); }
      return out;
    };
    // Which side of a face walk the face lies on is one global bit. Under "face
    // on the left" every walk turns through +2*pi except the one outer walk per
    // piece, so the total turning over all walks is +2*pi*c(D).
    let turn = 0;
    for (const walk of faces) {
      const pts = [];
      for (const d of walk) pts.push(...sample(d, dart[d].s0, dart[d].s1));
      for (let i = 0; i < pts.length; i++) {
        const u = pts[i], v = pts[(i + 1) % pts.length];
        turn += Math.atan2(u.tx * v.ty - u.ty * v.tx, u.tx * v.tx + u.ty * v.ty);
      }
    }
    const side = turn >= 0 ? 1 : -1;

    // The two marked points may sit anywhere on their edge, so they are placed
    // symmetrically about its middle: the piece between them is the edge of G,
    // and the rest of the edge belongs to the alternating region at either end.
    // The two marked points may sit anywhere on their edge, so where they sit is
    // not fixed: each is held as a fraction of the way along from its own end and
    // is free to slide, subject to keeping clear of the crossings and leaving a
    // bar between them. Pinning them made every region pinch to a neck at each
    // nonalternating edge, whatever the rest of the relaxation did.
    const span = d => Math.abs(dart[d].s1 - dart[d].s0);
    const frac = new Float64Array(dart.length);
    const barOf = L => opt.bar != null ? Math.min(opt.bar, L) : Math.min(0.72 * L, Math.max(26, Math.min(120, 0.45 * L)));
    const home = new Float64Array(dart.length);
    for (const g of nonAlt) { const L = span(2 * g); home[2 * g] = home[2 * g + 1] = frac[2 * g] = frac[2 * g + 1] = (1 - barOf(L) / L) / 2; }
    const markAt = d => { const D = dart[d]; return D.s0 + (D.s1 > D.s0 ? 1 : -1) * frac[d] * span(d); };
    // A marked point may not crowd the crossing at its end of the edge, and the
    // two on one edge may not close up on each other.
    const settle = () => {
      for (const g of nonAlt) {
        const L = span(2 * g);
        const edge = Math.min(0.3, Math.max(9, 0.1 * L) / L), bar = Math.min(0.4, Math.max(16, 0.2 * L) / L);
        // The slide is meant to take the pinch out of a region, not to choose
        // where the edge of G goes: left free, shortening walks both points onto
        // the crossings, which is shorter and says less. So each stays within a
        // band of where it started.
        const hold = (d) => {
          const f = Math.max(home[d] - band, Math.min(home[d] + band, frac[d]));
          return Math.max(edge, f);
        };
        let a = hold(2 * g), b = hold(2 * g + 1);
        const over = a + b - (1 - bar);
        if (over > 0) { a = Math.max(edge, a - over / 2); b = Math.max(edge, b - over / 2); }
        frac[2 * g] = a; frac[2 * g + 1] = b;
      }
    };

    // Offsetting a polyline folds it into a little loop at every corner that
    // turns the wrong way; cutting each loop out keeps the starting curve simple.
    const meet = (a, b, c, d) => {
      const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
      const den = rx * sy - ry * sx;
      if (den > -1e-12 && den < 1e-12) return null;
      const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
      const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
      if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
      return { x: a.x + t * rx, y: a.y + t * ry };
    };
    const dropLoops = pts => {
      const out = [];
      let i = 0;
      while (i < pts.length - 1) {
        out.push(pts[i]);
        let cut = -1, at = null;
        for (let j = pts.length - 2; j > i + 1; j--) {
          const q = meet(pts[i], pts[i + 1], pts[j], pts[j + 1]);
          if (q) { cut = j; at = q; break; }
        }
        if (cut < 0) { i++; continue; }
        out.push(at); i = cut + 1;
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const respace = pts => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const total = cum[cum.length - 1], n = Math.max(1, Math.round(total / h)), out = [];
      let j = 0;
      for (let k = 0; k <= n; k++) {
        const at = total * k / n;
        while (j < cum.length - 2 && cum[j + 1] < at) j++;
        const f = (at - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
        out.push({ x: pts[j].x + f * (pts[j + 1].x - pts[j].x), y: pts[j].y + f * (pts[j + 1].y - pts[j].y) });
      }
      return out;
    };

    // The starting curve: hug the face boundary a clearance away. It is already
    // the right curve, just far longer than it needs to be.
    const arcStart = x => {
      const back = x ^ 1, end = sigma[x], pts = [];
      const take = arr => arr.forEach(P => pts.push({ x: P.x - side * P.ty * clear, y: P.y + side * P.tx * clear }));
      take(sample(back, markAt(x), dart[back].s1));
      for (let e = nextInFace(back); e !== end; e = nextInFace(e)) take(sample(e, dart[e].s0, dart[e].s1));
      take(sample(end, dart[end].s0, markAt(end)));
      return respace(dropLoops(pts));
    };
    // Each curve is kept as its list of arcs, one per marked point it passes
    // through. An arc's two ends are pinned to that marked point and never move;
    // every other point is free, and its neighbours are always inside the same
    // arc, so shortening never has to reason across a pin.
    const curveArcs = curves.map(cyc => cyc.map(x => arcStart(x)));
    const flatten = () => {
      const flat = [], pin = [], where = [];
      curveArcs.forEach((arcs, c) => {
        const pts = [], mark = [], at = [];
        arcs.forEach((arc, a) => arc.forEach((P, i) => { pts.push(P); mark.push(i === 0 || i === arc.length - 1); at.push(a * 1e5 + i); }));
        flat.push(pts); pin.push(mark); where.push(at);
      });
      return { flat, pin, where };
    };

    // Cut out any small loop inside an arc, leaving its two pinned ends alone.
    const mend = arc => {
      for (let sweep = 0; sweep < 2; sweep++) {
        let cut = false;
        for (let i = 0; i + 3 < arc.length; i++) {
          for (let d = 2; d <= 8 && i + d + 1 < arc.length; d++) {
            const at = meet(arc[i], arc[i + 1], arc[i + d], arc[i + d + 1]);
            if (!at) continue;
            arc.splice(i + 1, d, at); cut = true; break;
          }
        }
        if (!cut) break;
      }
      return arc;
    };

    // A curve is still legal when it is simple and misses every other curve. Both
    // halves matter: convexifying pushes curves outwards, and the one thing that
    // must never happen is two of them crossing, since that is a region taking in
    // a piece of a tangle that is not its own.
    const check = grid();
    const legal = () => {
      const segs = [], tag = [], ok = curveArcs.map(() => true);
      curveArcs.forEach((arcs, c) => {
        const pts = [].concat(...arcs), n = pts.length;
        for (let i = 0; i < n; i++) { segs.push([pts[i].x, pts[i].y, pts[(i + 1) % n].x, pts[(i + 1) % n].y]); tag.push(c * 1e6 + i); }
      });
      fill(check, segs);
      const look = [];
      const size = curveArcs.map(arcs => arcs.reduce((t, arc) => t + arc.length, 0));
      for (let k = 0; k < segs.length; k++) {
        const c = Math.floor(tag[k] / 1e6), i = tag[k] % 1e6, n = size[c];
        for (const j of box(check, segs[k][0], segs[k][1], segs[k][2], segs[k][3], look)) {
          if (j <= k) continue;
          const oc = Math.floor(tag[j] / 1e6), oi = tag[j] % 1e6;
          if (oc === c && Math.min(Math.abs(oi - i), n - Math.abs(oi - i)) <= 1) continue;
          const a = segs[k], b = segs[j];
          if (meet({ x: a[0], y: a[1] }, { x: a[2], y: a[3] }, { x: b[0], y: b[1] }, { x: b[2], y: b[3] })) { ok[c] = false; ok[oc] = false; }
        }
      }
      // And it must meet the diagram exactly at its own marked points, one per
      // arc. Sweeping a point's path cannot see the segments it drags, so a curve
      // can slip past a strand without any point crossing one; counting settles
      // it, and a curve that has slipped is put back.
      const crossings = curveArcs.map(() => 0), seen = fresh('strand', strand.length);
      for (let k = 0; k < segs.length; k++) {
        const c = Math.floor(tag[k] / 1e6), a = segs[k], here = ++visit;
        for (const j of box(strandAt, a[0], a[1], a[2], a[3], look)) {
          if (seen[j] === here) continue;
          seen[j] = here;
          const b = strand[j];
          if (meet({ x: a[0], y: a[1] }, { x: a[2], y: a[3] }, { x: b[0], y: b[1] }, { x: b[2], y: b[3] })) crossings[c]++;
        }
      }
      curveArcs.forEach((arcs, c) => { if (crossings[c] !== arcs.length) ok[c] = false; });
      return ok;
    };

    // Shorten every curve at once, so two sharing a face meet in the middle
    // instead of one taking the room before the other has moved.
    // Where a curve meets a marked point it crosses the edge on a short chord: the
    // end of one arc a clearance out on one side, the start of the next the same
    // distance out on the other.
    const wide = new Float64Array(dart.length).fill(clear), wideBack = new Float64Array(dart.length).fill(clear);
    const chordAt = x => {
      const P = pointAtS(comps[dart[x].c], markAt(x)), f = dart[x].s1 > dart[x].s0 ? 1 : -1;
      const tx = f * P.dx, ty = f * P.dy, nx = -side * ty, ny = side * tx;
      const a = wide[x], b = wideBack[x];
      return { tx, ty, into: { x: P.x + nx * a, y: P.y + ny * a }, outOf: { x: P.x - nx * b, y: P.y - ny * b } };
    };
    // A marked point moves under the same rule as everything else: the segments
    // it carries must go on crossing the diagram exactly as often as they did,
    // and the chord itself must still cross its own edge once. A proposal that
    // fails is dropped and the mark stays where it was.
    const setChords = () => curves.forEach((cyc, c) => {
      const arcs = curveArcs[c], m = cyc.length;
      cyc.forEach((x, j) => {
        const before = arcs[(j - 1 + m) % m], after = arcs[j];
        const wasIn = before[before.length - 1], wasOut = after[0];
        const u = before[before.length - 2] || wasOut, v = after[1] || wasIn;
        const keepFrac = frac[x], keepWide = wide[x], keepBack = wideBack[x];
        const at = chordAt(x);
        const fine = cuts(u.x, u.y, at.into.x, at.into.y) === cuts(u.x, u.y, wasIn.x, wasIn.y)
          && cuts(v.x, v.y, at.outOf.x, at.outOf.y) === cuts(v.x, v.y, wasOut.x, wasOut.y)
          && cuts(at.into.x, at.into.y, at.outOf.x, at.outOf.y) === 1;
        if (!fine) { frac[x] = keepFrac; wide[x] = keepWide; wideBack[x] = keepBack; return; }
        before[before.length - 1] = at.into;
        after[0] = at.outOf;
      });
    });
    // Slide each marked point along its own edge towards whichever way shortens
    // the two arcs meeting there. It is the same length that the rest of the
    // relaxation is minimising, with one more degree of freedom.
    const slide = () => {
      curves.forEach((cyc, c) => {
        const arcs = curveArcs[c], m = cyc.length;
        cyc.forEach((x, j) => {
          const before = arcs[(j - 1 + m) % m], after = arcs[j];
          if (before.length < 2 || after.length < 2) return;
          const at = chordAt(x), u = before[before.length - 2], v = after[1];
          const du = Math.hypot(u.x - at.into.x, u.y - at.into.y) || 1;
          const dv = Math.hypot(v.x - at.outOf.x, v.y - at.outOf.y) || 1;
          const pull = ((u.x - at.into.x) / du + (v.x - at.outOf.x) / dv) * at.tx
                     + ((u.y - at.into.y) / du + (v.y - at.outOf.y) / dv) * at.ty;
          frac[x] += Math.max(-creep, Math.min(creep, creep * pull)) / span(x);
        });
      });
      settle();
      setChords();
    };

    const bag = [], sack = [], pouch = [], curveAt = grid();
    // How many times a segment crosses the diagram. A move may not change this
    // for either of the two segments the point carries.
    const cuts = (x0, y0, x1, y1) => {
      const seen = fresh('strand', strand.length), here = ++visit;
      let k = 0;
      for (const j of box(strandAt, x0, y0, x1, y1, sack)) {
        if (seen[j] === here) continue;
        seen[j] = here;
        const b = strand[j];
        if (meet({ x: x0, y: y0 }, { x: x1, y: y1 }, { x: b[0], y: b[1] }, { x: b[2], y: b[3] })) k++;
      }
      return k;
    };
    // A curve under tension is a string: where it is not held against something
    // it runs straight, and a dent left in it is a dent nothing is holding. The
    // relaxation walks each point downhill a step at a time and settles into
    // whatever local minimum it is nearest, which does leave such dents behind.
    // So the arcs are also pulled taut outright: the chord between two points of
    // an arc replaces everything between them whenever that chord is one the
    // curve is allowed to take. It is the same rule the relaxation obeys, asked
    // globally instead of a step at a time, and it is what takes out a groove
    // the flow would have needed hundreds of rounds to reach.
    const chordFree = (A, B, c, curveSeg, owner) => {
      // Nothing crossed, and no closer to anything than the relaxation may come.
      if (cuts(A.x, A.y, B.x, B.y) !== 0) return false;
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      const steps = Math.max(2, Math.ceil(L / (0.5 * fine)));
      for (let step = 0; step <= steps; step++) {
        const px = A.x + dx * step / steps, py = A.y + dy * step / steps;
        for (const k of near(strandAt, px, py, bag)) if (closest(strand[k], px, py) < clear) return false;
        for (const k of near(curveAt, px, py, pouch)) {
          if (Math.floor(owner[k] / 1e6) === c) continue;
          if (closest(curveSeg[k], px, py) < apart) return false;
        }
      }
      return true;
    };
    // A chord can miss every strand and still close over one: a strand that loops
    // inside the pocket it cuts off crosses neither the chord nor the arc. Taking
    // the shortcut would swallow it whole, and a count of crossings would never
    // notice, so the pocket is asked directly whether anything is in it.
    const swallows = (arc, i, j) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = i; k <= j; k++) {
        const Q = arc[k];
        if (Q.x < x0) x0 = Q.x; if (Q.x > x1) x1 = Q.x;
        if (Q.y < y0) y0 = Q.y; if (Q.y > y1) y1 = Q.y;
      }
      const held = (px, py) => {
        let w = false;
        for (let a = i, b = j; a <= j; b = a++) {
          const A = arc[a], B = arc[b];
          if ((A.y > py) !== (B.y > py) && px < (B.x - A.x) * (py - A.y) / (B.y - A.y) + A.x) w = !w;
        }
        return w;
      };
      const seen = fresh('strand', strand.length), here = ++visit;
      for (const k of box(strandAt, x0, y0, x1, y1, sack)) {
        if (seen[k] === here) continue;
        seen[k] = here;
        if (held(strand[k][0], strand[k][1])) return true;
      }
      return false;
    };
    // A chord is probed by sampling along it, so a long one costs more to test
    // than a short one, and letting the reach run to the end of the arc makes the
    // pull quadratic in its length -- on a curve with a long open run that is
    // unbounded work for no gain. Capped, it is linear: a dent wider than the
    // reach is one the relaxation itself fills, since wide is exactly what it is
    // good at.
    function* pullTaut(curveSeg, owner) {
      for (let c = 0; c < curveArcs.length; c++) {
        const arcs = curveArcs[c];
        for (let a = 0; a < arcs.length; a++) {
          yield 'pull';
          const arc = arcs[a];
          if (arc.length < 4) continue;
          const out = [arc[0]];
          let i = 0;
          while (i < arc.length - 1) {
            const stop = Math.min(arc.length, i + 1 + stretch);
            let best = i + 1;
            for (let j = i + 2; j < stop; j++) { if (!chordFree(arc[i], arc[j], c, curveSeg, owner)) break; best = j; }
            while (best > i + 1 && swallows(arc, i, best)) best--;
            out.push(arc[best]); i = best;
          }
          arcs[a] = respace(out);
        }
      }
    }

    let shaping = false, pulled = false;
    const safe = curveArcs.map(arcs => arcs.map(arc => arc.map(P => ({ x: P.x, y: P.y }))));
    const stuck = curveArcs.map(() => false), trips = curveArcs.map(() => 0);
    const keep = curves.map(cyc => cyc.map(x => [frac[x], wide[x], wideBack[x]]));
    let limit = rounds, quiet = 0, was = Infinity;
    // The ladder: the spacing in force, and the round this level gives way at.
    // A third of the budget each is a cap rather than a share, since a level
    // that has stopped moving hands what is left to the next one straight away,
    // and everything it does not spend goes to the spacing that is drawn.
    let level = Math.max(1, coarse), levelEnd = Math.ceil(rounds / 3);
    for (let round = 0; round < limit; round++) {
      if (work) work.rounds++;
      if (round) yield round;
      // Shortening a curve is a heat flow, so a dent takes about as many rounds
      // to fill as the square of its width in points. At nine pixels a point the
      // wide dents in a big diagram are never reached inside any budget worth
      // paying for: 400 rounds still left grooves in a 63-crossing diagram. So
      // the curve is pulled taut on a coarse copy of itself first -- four times
      // the spacing, a quarter of the points, and the same shape sixteen times
      // sooner -- and the spacing is halved back down to the drawn one as it
      // goes. Every rule still holds at every level, since they are all written
      // in pixels rather than in points, and the last rounds are at the spacing
      // that is actually drawn.
      if (level * fine !== h) {
        h = level * fine; gait = level;
        curveArcs.forEach(arcs => arcs.forEach((arc, a) => { arcs[a] = respace(arc); }));
      }
      // Points crowd towards a pin as the curve shortens, and once one lands on
      // top of a pin the curve folds over its own marked point. Spreading each
      // arc out again every so often is what stops that happening.
      if (round && round % 10 === 0) curveArcs.forEach(arcs => arcs.forEach((arc, a) => { arcs[a] = respace(arc); }));
      const { flat, pin, where } = flatten();
      const curveSeg = [], owner = [], base = [];
      flat.forEach((pts, c) => {
        base[c] = curveSeg.length;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          curveSeg.push([pts[i].x, pts[i].y, pts[j].x, pts[j].y]); owner.push(c * 1e6 + i);
        }
      });
      fill(curveAt, curveSeg);
      let shift = 0;
      for (let c = 0; c < flat.length; c++) {
        // A round is a pass over every point of every curve, which on a big
        // diagram is long enough to drop a frame on its own, so the thread comes
        // back between curves as well as between rounds. Nothing outside reads
        // the curves while it is away: a gesture meanwhile replaces the analysis,
        // and the run is dropped rather than resumed.
        if (c) yield 'curve';
        const pts = flat[c], n = pts.length;
        if (work) work.pointUpdates += n;
        // Filling a dent outwards is done against a window rather than against
        // the two neighbours: a three-point mean fills over a couple of points,
        // which at nine pixels apart still leaves a corner. Over eleven it reads
        // as a curve. The sums are taken once for the round, so every point is
        // filtered against the same curve.
        let sumX = null, sumY = null;
        if (shaping && n > 2 * blunt + 2) {
          sumX = new Float64Array(n + 1); sumY = new Float64Array(n + 1);
          for (let i = 0; i < n; i++) { sumX[i + 1] = sumX[i] + pts[i].x; sumY[i + 1] = sumY[i] + pts[i].y; }
        }
        const sumOver = (S, i) => {
          const lo = i - blunt, hi = i + blunt;
          if (lo < 0) return S[n] - S[n + lo] + S[hi + 1];
          if (hi >= n) return S[n] - S[lo] + S[hi - n + 1];
          return S[hi + 1] - S[lo];
        };
        for (let i = 0; i < n; i++) {
          if (pin[c][i]) continue;
          const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
          const ox = pts[i].x, oy = pts[i].y;
          let px = ox, py = oy;
          let dx = (a.x + b.x) / 2 - px, dy = (a.y + b.y) / 2 - py;
          if (sumX) { dx = sumOver(sumX, i) / (2 * blunt + 1) - px; dy = sumOver(sumY, i) / (2 * blunt + 1) - py; }
          if (shaping) {
            const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty);
            if (tl > 1e-9) {
              const nx = side * -ty / tl, ny = side * tx / tl, inward = dx * nx + dy * ny;
              // Nothing already bulging is pulled back in, and a point with
              // nothing to fill stays where it is: sliding it along the curve
              // instead only bunches points up and leaves the curve ragged.
              if (inward < 0) { dx = 0; dy = 0; }
              // Once taut, what is left to fill is shallow, so the outward half is
              // taken at a gain; the step clamp and the sweep still bound it.
              else { dx += nx * inward * (gain - 1); dy += ny * inward * (gain - 1); }
            }
          }
          const len = Math.hypot(dx, dy), cap = stride * gait;
          if (len > cap) { dx = dx * cap / len; dy = dy * cap / len; }
          px += dx; py += dy;
          for (let pass = 0; pass < 2; pass++) {
            let hit = false, want = 0, worst = 0, hx = 0, hy = 0;
            for (const k of near(curveAt, px, py, bag)) {
              // Only the two segments that contain this point are exempt. A wider
              // exemption lets a point drift onto a pinned one two places along
              // and fold the curve over its own marked point. A curve needs only
              // a hair of room from itself to stay unfolded; the gap that has to
              // read on screen is the one between different curves.
              const tag = owner[k], oc = Math.floor(tag / 1e6), oi = tag % 1e6;
              const mine = oc === c;
              if (mine && (oi === i || oi === (i - 1 + n) % n)) continue;
              const keep = mine ? 0.8 * h : apart;
              const d = closest(curveSeg[k], px, py);
              if (keep - d > worst) { worst = keep - d; hit = true; hx = cqx; hy = cqy; want = keep; }
            }
            if (!hit) break;
            const ux = px - hx, uy = py - hy, L = Math.hypot(ux, uy);
            if (L < 1e-9) break;
            px = hx + ux / L * want; py = hy + uy / L * want;
          }
          // A region should be a comfortable neighbourhood of its tangle, not a
          // sleeve on it. Shortening will always pull the curve back onto the
          // strand it came from, so the thickness is set rather than pushed for:
          // the curve is placed halfway across whatever corridor it is in, up to
          // `pad`. Where the corridor is narrow that is the middle of it, and
          // where it opens out the curve stops at `pad` instead of drifting off.
          {
            let near1 = Infinity, ux = 0, uy = 0, near2 = Infinity;
            for (const k of near(strandAt, px, py, bag)) {
              const d = closest(strand[k], px, py);
              if (d < near1) { near1 = d; ux = px - cqx; uy = py - cqy; }
            }
            const L = Math.hypot(ux, uy);
            if (L > 1e-9 && near1 < pad) {
              ux /= L; uy /= L;
              for (const k of near(strandAt, px, py, bag)) {
                const d = closest(strand[k], px, py);
                const vx = px - cqx, vy = py - cqy;
                if (vx * ux + vy * uy < 0 && d < near2) near2 = d;
              }
              const across = near1 + (near2 === Infinity ? 2 * pad : near2);
              const want = Math.min(pad, across / 2);
              if (want > near1) { px += ux * (want - near1); py += uy * (want - near1); }
            }
          }
          // Strand clearance goes last, so it is the rule that always holds: a
          // curve that cannot reach a strand cannot cross one, and so cannot take
          // in a strand that belongs to a different tangle.
          for (let pass = 0; pass < 2; pass++) {
            let hit = false, worst = clear, hx = 0, hy = 0;
            for (const k of near(strandAt, px, py, bag)) {
              const d = closest(strand[k], px, py);
              if (d < worst) { worst = d; hit = true; hx = cqx; hy = cqy; }
            }
            if (!hit) break;
            const ux = px - hx, uy = py - hy, L = Math.hypot(ux, uy);
            if (L < 1e-9) break;
            px = hx + ux / L * clear; py = hy + uy / L * clear;
          }
          // Whatever the rules above asked for, the move itself is swept against
          // everything nearby and stopped short of the first thing it would have
          // crossed. That bounds the point, but not the two segments it drags:
          // one of those can sweep over a strand while the point's own path never
          // touches it, which is how a curve slips out of its face. So the move
          // is also required to leave both segments crossing the diagram exactly
          // as often as they did before, and is halved until it does.
          let mx = px - ox, my = py - oy;
          const far = Math.hypot(mx, my), most = reach * gait;
          if (far > most) { mx = mx * most / far; my = my * most / far; }
          if (mx || my) {
            let stop = 1;
            const block = (items, from, skipSelf) => {
              for (const k of box(from, ox, oy, ox + mx, oy + my, bag)) {
                if (skipSelf) {
                  const tag = owner[k], oc = Math.floor(tag / 1e6), oi = tag % 1e6;
                  if (oc === c && (oi === i || oi === (i - 1 + n) % n)) continue;
                }
                const it = items[k], ex = it[2] - it[0], ey = it[3] - it[1];
                const den = mx * ey - my * ex;
                if (den > -1e-12 && den < 1e-12) continue;
                const rx = it[0] - ox, ry = it[1] - oy;
                const t = (rx * ey - ry * ex) / den, u = (rx * my - ry * mx) / den;
                if (t >= 0 && t < stop && u >= 0 && u <= 1) stop = t;
              }
            };
            block(strand, strandAt, false);
            block(curveSeg, curveAt, true);
            // Stop a fixed distance short of what was in the way, rather than a
            // fixed fraction, so a long move is held off by as much as a short one.
            if (stop < 1) {
              const travel = Math.hypot(mx, my) || 1;
              const back = Math.max(0, stop - Math.min(clear, apart) / 2 / travel);
              mx *= back; my *= back;
            }
          }
          if (mx || my) {
            const wasA = cuts(a.x, a.y, ox, oy), wasB = cuts(ox, oy, b.x, b.y);
            for (let f = 1; ; f /= 3) {
              if (f < 0.3) { mx = 0; my = 0; break; }
              const tx = ox + mx * f, ty = oy + my * f;
              if (cuts(a.x, a.y, tx, ty) === wasA && cuts(tx, ty, b.x, b.y) === wasB) { mx *= f; my *= f; break; }
            }
          }
          const step = Math.hypot(mx, my);
          if (step > shift) shift = step;
          const moved = { x: ox + mx, y: oy + my };
          pts[i] = moved;
          const tag = where[c][i];
          curveArcs[c][Math.floor(tag / 1e5)][tag % 1e5] = moved;
          const prev = base[c] + (i - 1 + n) % n, here = base[c] + i;
          curveSeg[prev][2] = moved.x; curveSeg[prev][3] = moved.y;
          curveSeg[here][0] = moved.x; curveSeg[here][1] = moved.y;
          relist(curveAt, curveSeg, prev); relist(curveAt, curveSeg, here);
        }
      }
      // Relaxation with a bounded step can, very occasionally, walk a curve
      // through itself. Rather than hope it does not, the last state that was
      // checked and found simple is kept, and a curve that ties itself up is put
      // back to it and left alone. The drawing is then always a simple curve.
      slide();
      // Sweeping a point's own path is not the whole story: each of the two
      // segments it carries sweeps a triangle, and an obstacle's end can sit
      // inside one without the path ever crossing it. That leaves a small fold,
      // always inside one arc and only a few points wide. Combing each arc out
      // here, before anything looks at the curve, is what keeps a curve from
      // being frozen at the first state it tripped over -- which is what left
      // notches in a curve that was supposed to be pulled straight.
      curveArcs.forEach(arcs => arcs.forEach(mend));
      // Whether it is still going anywhere is asked of the length it is
      // minimising, not of the furthest point: one point stuck against a strand
      // held the old test open for ever, so on anything big the curve never
      // reached the second phase at all and never came out convex.
      let now = 0;
      curveArcs.forEach(arcs => arcs.forEach(arc => { for (let i = 1; i < arc.length; i++) now += Math.hypot(arc[i].x - arc[i - 1].x, arc[i].y - arc[i - 1].y); }));
      quiet = Math.abs(was - now) < 6e-4 * now && shift < 4 * gait ? quiet + 1 : 0;
      was = now;
      const settled = quiet >= 3;
      if (round % 5 === 4 || round === limit - 1 || settled) {
        const ok = legal();
        for (let c = 0; c < curveArcs.length; c++) {
          if (stuck[c]) continue;
          if (ok[c]) { safe[c] = curveArcs[c].map(arc => arc.map(P => ({ x: P.x, y: P.y }))); keep[c] = curves[c].map(x => [frac[x], wide[x], wideBack[x]]); }
          else {
            // A curve that trips is put back to its last legal state and allowed
            // to try again; only one that keeps tripping is left where it is.
            // Tripping is normal here -- widening a region walks it up against
            // its neighbours -- so the budget is generous, and every attempt that
            // does come back legal is kept.
            curveArcs[c] = safe[c].map(arc => arc.map(P => ({ x: P.x, y: P.y })));
            curves[c].forEach((x, j) => { [frac[x], wide[x], wideBack[x]] = keep[c][j]; });
            if (++trips[c] >= 40) stuck[c] = true;
          }
        }
        if (stuck.every(Boolean)) break;
      }
      // Shortening first pulls the curve taut, which is what takes the slack and
      // the notches out of it. Taut is not the same as convex, though: wherever
      // the curve comes round an obstacle it leaves a dip behind it. So once it
      // has stopped moving, the same step is run again with only its outward half
      // kept. Dips fill, nothing already bulging is pulled back in, and the curve
      // walks out towards its own convex hull as far as the clearances allow.
      if (level > 1) {
        if (settled || round + 1 >= levelEnd) {
          yield* pullTaut(curveSeg, owner);
          level = Math.max(1, level >> 1);
          levelEnd = level > 1 ? round + 1 + Math.ceil(rounds / 3) : rounds;
          quiet = 0;
        }
      } else if (!shaping) { if (settled || round + 1 >= rounds) { yield* pullTaut(curveSeg, owner); shaping = true; quiet = 0; limit = round + 1 + shape; } }
      else if (!pulled) {
        // Convexifying pushes outwards everywhere it can, which puts a little
        // slack back into the parts that were already taut. It is pulled out
        // once more at the end, and the rounds after that settle the corners it
        // leaves back against the clearances.
        if (settled || round + 1 >= limit) { yield* pullTaut(curveSeg, owner); pulled = true; quiet = 0; limit = round + 1 + tail; }
      }
      else if (settled) break;
    }
    // Whatever the loop ended on, every curve is left at a state that was checked.
    for (let pass = 0; pass < 3; pass++) {
      const ok = legal();
      if (ok.every(Boolean)) break;
      for (let c = 0; c < curveArcs.length; c++) if (!ok[c]) { curveArcs[c] = safe[c]; curves[c].forEach((x, j) => { [frac[x], wide[x], wideBack[x]] = keep[c][j]; }); }
    }

    // The shape is settled; what is left on it is a pixel or two of raggedness.
    // Every point is placed against whichever strand happens to be nearest it,
    // and where the nearest one changes from a point to the next the placement
    // jumps. Plain smoothing takes that off, with two rules that keep it from
    // being another relaxation: no point may end up further than a clearance from
    // where the relaxation left it, so the curve cannot drift off the shape it
    // settled on, and the clearance is re-imposed after every move, so smoothing
    // can never walk a curve into a strand.
    const rested = curveArcs.map(arcs => arcs.map(arc => arc.map(P => ({ x: P.x, y: P.y }))));
    for (let pass = 0; pass < passes; pass++) {
      yield 'smooth';
      for (let c = 0; c < curveArcs.length; c++) curveArcs[c].forEach((arc, a) => {
        const home = rested[c][a], was = arc.map(P => ({ x: P.x, y: P.y }));
        for (let i = 1; i < arc.length - 1; i++) {
          let x = (was[i - 1].x + 2 * was[i].x + was[i + 1].x) / 4;
          let y = (was[i - 1].y + 2 * was[i].y + was[i + 1].y) / 4;
          const ox = x - home[i].x, oy = y - home[i].y, off = Math.hypot(ox, oy);
          if (off > stray) { x = home[i].x + ox * stray / off; y = home[i].y + oy * stray / off; }
          for (let push = 0; push < 2; push++) {
            let hit = false, worst = clear, hx = 0, hy = 0;
            for (const k of near(strandAt, x, y, bag)) {
              const d = closest(strand[k], x, y);
              if (d < worst) { worst = d; hit = true; hx = cqx; hy = cqy; }
            }
            if (!hit) break;
            const ux = x - hx, uy = y - hy, L = Math.hypot(ux, uy);
            if (L < 1e-9) break;
            x = hx + ux / L * clear; y = hy + uy / L * clear;
          }
          arc[i] = { x, y };
        }
      });
    }
    {
      const ok = legal();
      for (let c = 0; c < curveArcs.length; c++) if (!ok[c]) curveArcs[c] = rested[c].map(arc => arc.map(P => ({ x: P.x, y: P.y })));
    }
    yield 'draw';
    const curvePts = curveArcs.map(arcs => [].concat(...arcs));
    const held = curveArcs.map(arcs => [].concat(...arcs.map(arc => arc.map((_, i) => i === 0 || i === arc.length - 1))));

    // Bounded steps can still leave a fold of a few segments knotted up where the
    // curve turns hard. Each is a small loop; cutting it out is safe as long as
    // no marked point is caught inside, which would take the curve off its edge.
    curvePts.forEach((pts, c) => {
      const pin = held[c];
      for (let sweep = 0; sweep < 6; sweep++) {
        let cut = false;
        for (let i = 0; i < pts.length && !cut; i++) {
          for (let d = 2; d <= 12; d++) {
            const j = i + d;
            if (j + 1 > pts.length) break;
            const at = meet(pts[i], pts[i + 1], pts[j], pts[(j + 1) % pts.length]);
            if (!at) continue;
            if (pin.slice(i + 1, j + 1).some(Boolean)) continue;
            pts.splice(i + 1, j - i, at); pin.splice(i + 1, j - i, false);
            cut = true; break;
          }
        }
        if (!cut) break;
      }
    });

    const rounded = [], repaired = [];
    if (opt.round !== false) {
      // Use the actual vertices of every diagram edge, including the wrap at
      // the component seam. Sampling can miss a small excursion across a disk.
      const edgePoints = dart.filter((_, i) => !(i & 1)).map(D => {
        const cm = comps[D.c], pts = [{ ...pointAtS(cm, D.s0), s: D.s0 }];
        for (let i = 0; i < cm.pts.length; i++) {
          let s = cm.cum[i];
          if (s <= D.s0) s += cm.len;
          if (s < D.s1) pts.push({ ...cm.pts[i], s });
        }
        pts.sort((a, b) => a.s - b.s);
        pts.push({ ...pointAtS(cm, D.s1), s: D.s1 });
        return pts;
      });
      const inPoly = (p, q) => {
        let yes = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const a = p[i], b = p[j];
          if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
        }
        return yes;
      };
      const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const boundsOf = p => p.reduce((b, q) => ({ x0: Math.min(b.x0, q.x), y0: Math.min(b.y0, q.y), x1: Math.max(b.x1, q.x), y1: Math.max(b.y1, q.y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      const overlaps = (a, b, gap = 0) => a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap;
      const separated = (a, b, gap = apart) => {
        if (!overlaps(boundsOf(a), boundsOf(b), gap)) return true;
        for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
          const u = a[i], v = a[(i + 1) % a.length], p = b[j], q = b[(j + 1) % b.length];
          if (meet(u, v, p, q) || closest([p.x, p.y, q.x, q.y], u.x, u.y) < gap
            || closest([u.x, u.y, v.x, v.y], p.x, p.y) < gap) return false;
        }
        return true;
      };
      const freeComponents = comps.filter((_, c) => !dart.some(d => d.c === c));
      const proposal = curvePts.map(() => null), pendingRepairs = curvePts.map(() => null);
      for (let c = 0; c < curves.length; c++) {
        yield 'round';
        const region = dec.curveRegion[c];
        const repair = dec.curveRegion.filter(r => r === region).length !== 1;
        if (repair && opt.repair === false) continue;
        const core = [];
        edgePoints.forEach((pts, g) => {
          if (dec.regionOfX[dart[2 * g].xi] === region) {
            core.push(pts[0]);
            if (!dec.isNA[g]) core.push(...pts.slice(1));
          }
          if (dec.regionOfX[dart[2 * g + 1].xi] === region) core.push(pts[pts.length - 1]);
        });
        if (!core.length || !inPoly(curvePts[c], core[0])) continue;
        const inside = repair ? dart.map(d => inPoly(curvePts[c], pointAtS(comps[d.c], d.s0))) : null;
        const box = boundsOf(core), cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
        let xx = 0, xy = 0, yy = 0;
        for (const p of core) { const x = p.x - cx, y = p.y - cy; xx += x * x; xy += x * y; yy += y * y; }
        const angle = Math.atan2(2 * xy, xx - yy) / 2;
        // Prefer an actual circle. Only try modest elongation if the circle
        // would include a foreign strand or cut a connector more than once.
        for (const ratio of (repair ? [1] : [1, 1.25, 1.6, 2, 3])) {
          yield 'round-fit';
          const co = Math.cos(angle), si = Math.sin(angle);
          const local = core.map(p => ({ x: (p.x - cx) * co + (p.y - cy) * si, y: -(p.x - cx) * si + (p.y - cy) * co }));
          const b = boundsOf(local), ox = (b.x0 + b.x1) / 2, oy = (b.y0 + b.y1) / 2;
          const radius = local.reduce((r, p) => Math.max(r, Math.hypot((p.x - ox) / ratio, p.y - oy)), 0) + Math.max(pad, clear);
          const x = cx + ox * co - oy * si, y = cy + ox * si + oy * co;
          const count = Math.max(96, Math.ceil(2 * Math.PI * radius * ratio / fine));
          const pts = repair ? repairDecompositionDents(curvePts[c], clear) : Array.from({ length: count }, (_, i) => {
            const t = 2 * Math.PI * (i + 0.371) / count, u = radius * ratio * Math.cos(t), v = radius * Math.sin(t);
            return { x: x + co * u - si * v, y: y + si * u + co * v };
          });
          if (!pts || pts.length < 3) continue;
          const n = pts.length;
          const B = boundsOf(pts), segmentBounds = pts.map((p, i) => boundsOf([p, pts[(i + 1) % n]]));
          const hits = [], positions = new Map();
          let valid = !freeComponents.some(cm => inPoly(pts, cm.pts[0]));
          if (repair) for (let i = 0; i < n && valid; i++) {
            if (i && i % 64 === 0) yield 'repair-check';
            for (let j = i + 2; j < n; j++) {
              if (i === 0 && j === n - 1 || !overlaps(segmentBounds[i], segmentBounds[j])) continue;
              if (meet(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) { valid = false; break; }
            }
          }
          // Check which *edge* is cut, its arclength, and its order around the
          // disk, not just the total number of intersections with the diagram.
          for (let g = 0; g < edgePoints.length && valid; g++) {
            if (g && g % 16 === 0) yield 'round-edge';
            const edge = edgePoints[g], expected = [2 * g, 2 * g + 1].filter(d => dec.curveOf[d] === c);
            if (expected.length > 1) { valid = false; break; }
            if (inPoly(pts, edge[0]) !== (inside ? inside[2 * g] : dec.regionOfX[dart[2 * g].xi] === region)
              || inPoly(pts, edge[edge.length - 1]) !== (inside ? inside[2 * g + 1] : dec.regionOfX[dart[2 * g + 1].xi] === region)) { valid = false; break; }
            const cut = [];
            for (let j = 1; j < edge.length && valid; j++) {
              const a = edge[j - 1], b = edge[j], segmentBox = boundsOf([a, b]);
              if (!overlaps(B, segmentBox)) continue;
              for (let k = 0; k < pts.length; k++) {
                const u = pts[k], v = pts[(k + 1) % pts.length];
                if (!overlaps(segmentBox, segmentBounds[k])) continue;
                const den = cross({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y }, { x: v.x - u.x, y: v.y - u.y });
                if (Math.abs(den) < 1e-10) continue;
                const t = ((u.x - a.x) * (v.y - u.y) - (u.y - a.y) * (v.x - u.x)) / den;
                const q = ((u.x - a.x) * (b.y - a.y) - (u.y - a.y) * (b.x - a.x)) / den;
                if (t < -1e-8 || t > 1 + 1e-8 || q < -1e-8 || q > 1 + 1e-8) continue;
                // Tangencies and vertex contacts are ambiguous; keep the
                // already checked fallback instead of guessing their topology.
                if (t < 1e-8 || t > 1 - 1e-8 || q < 1e-8 || q > 1 - 1e-8) { valid = false; break; }
                cut.push({ s: a.s + t * (b.s - a.s), at: k + q });
              }
            }
            if (cut.length !== expected.length) valid = false;
            if (valid && cut.length === 1) {
              positions.set(expected[0], cut[0].s); hits.push({ d: expected[0], at: cut[0].at });
            }
          }
          // Crossing-free components are not in edgePoints, but must stay out
          // of the disk too, including those whose first vertex lies outside.
          if (valid && freeComponents.some(cm => !separated(pts, cm.pts, clear))) valid = false;
          if (!valid) continue;
          const order = hits.sort((a, b) => a.at - b.at).map(h => h.d), cyc = curves[c];
          const start = order.indexOf(cyc[0]);
          const same = sign => cyc.every((d, i) => order[mod(start + sign * i, order.length)] === d);
          if (!same(1) && !same(-1)) continue;
          (repair ? pendingRepairs : proposal)[c] = { pts, positions };
          break;
        }
      }
      // Choose the replacements together. A neighbour's old long sleeve may
      // disappear at the same time; rejecting disks against every old sleeve
      // would prevent either tangle from becoming round. If a replacement is
      // withdrawn, recheck its neighbours against the restored boundary.
      let changed;
      do {
        changed = false;
        for (let c = 0; c < proposal.length; c++) {
          if (!proposal[c]) continue;
          yield 'round-check';
          for (let j = 0; j < proposal.length; j++) {
            if (j === c) continue;
            const other = proposal[j] ? proposal[j].pts : curvePts[j];
            if (!separated(proposal[c].pts, other)
              || inPoly(proposal[c].pts, other[0]) !== inPoly(curvePts[c], curvePts[j][0])
              || inPoly(other, proposal[c].pts[0]) !== inPoly(curvePts[j], curvePts[c][0])) {
              proposal[c] = null; changed = true; break;
            }
          }
        }
        for (const g of nonAlt) {
          const a = dec.curveOf[2 * g], b = dec.curveOf[2 * g + 1];
          const s0 = proposal[a]?.positions.get(2 * g) ?? markAt(2 * g);
          const s1 = proposal[b]?.positions.get(2 * g + 1) ?? markAt(2 * g + 1);
          if (s1 - s0 < Math.min(2 * clear, span(2 * g) * 0.1) && (proposal[a] || proposal[b])) {
            proposal[a] = proposal[b] = null; changed = true;
          }
        }
      } while (changed);
      proposal.forEach((p, c) => {
        if (!p) return;
        curvePts[c] = p.pts; rounded.push(c);
        for (const [d, s] of p.positions) frac[d] = Math.abs(s - dart[d].s0) / span(d);
      });
      // Repairs see the completed layout and may only change their own outer
      // boundary. They must never resize or displace an enclosed tangle to fit.
      for (let c = 0; c < pendingRepairs.length; c++) {
        const p = pendingRepairs[c];
        if (!p) continue;
        yield 'repair-layout';
        let valid = true;
        for (let j = 0; j < curvePts.length && valid; j++) if (j !== c) {
          const other = curvePts[j];
          valid = separated(p.pts, other)
            && inPoly(p.pts, other[0]) === inPoly(curvePts[c], other[0])
            && inPoly(other, p.pts[0]) === inPoly(other, curvePts[c][0]);
        }
        for (const [d, s] of p.positions) {
          const gap = d & 1 ? s - markAt(d ^ 1) : markAt(d ^ 1) - s;
          if (gap < Math.min(2 * clear, span(d) * .1)) valid = false;
        }
        if (!valid) continue;
        curvePts[c] = p.pts; repaired.push(c);
        for (const [d, s] of p.positions) frac[d] = Math.abs(s - dart[d].s0) / span(d);
      }
    }

    // For drawing, drop the points that sit on a straight run. What is left is
    // the corners, which a fillet can then round properly; kept at full density
    // every corner is only one point wide and rounds over almost nothing. The
    // tolerance is a fraction of the clearance, so the drawn line still runs
    // where the relaxed one does.
    const outline = curvePts.map(pts => {
      if (rounded.some(c => curvePts[c] === pts)) return pts;
      const n = pts.length;
      if (n < 4) return pts;
      const off = (a, b, q) => {                       // how far q is off the chord a-b
        const ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey;
        let u = L2 ? ((q.x - a.x) * ex + (q.y - a.y) * ey) / L2 : 0;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        return Math.hypot(a.x + u * ex - q.x, a.y + u * ey - q.y);
      };
      const keep = [pts[0]];
      let anchor = 0;
      for (let i = 2; i < n; i++) {
        // The chord is kept only while every point it skips still lies on it,
        // so the line cannot drift away from the curve a fraction at a time.
        let fits = true;
        for (let j = anchor + 1; j < i && fits; j++) if (off(pts[anchor], pts[i], pts[j]) > tidy) fits = false;
        if (!fits) { keep.push(pts[i - 1]); anchor = i - 1; }
      }
      let fits = true;
      for (let j = anchor + 1; j < n && fits; j++) if (off(pts[anchor], pts[0], pts[j]) > tidy) fits = false;
      if (!fits) keep.push(pts[n - 1]);
      return keep.length >= 3 ? keep : pts;
    });

    const marks = [], gEdges = [];
    for (const g of nonAlt) {
      const a = markAt(2 * g), b = markAt(2 * g + 1), pts = sample(2 * g, a, b);
      marks.push(pts[0], pts[pts.length - 1]);
      gEdges.push({ pts, over: !!dart[2 * g].over, arc: g, s: [a, b] });
    }
    // To shade an alternating region, fill its own boundary curves by the
    // even-odd rule: crossing any of them toggles in and out of the region, so
    // the parity at a point says whether it is inside -- once it is known which
    // way round that reads. One crossing of the region settles it, and when the
    // parity there is even the region is the one holding the point at infinity,
    // so the fill has to be taken the other way about.
    const turns = (pts, q) => {
      let t = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const ax = a.x - q.x, ay = a.y - q.y, bx = b.x - q.x, by = b.y - q.y;
        t += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      return Math.round(t / (2 * Math.PI));
    };
    // The region that holds the point at infinity is bounded by the curves that
    // nothing else contains, and those are not the ones the combinatorics assigns
    // to it: a curve belongs to the region whose tangle it encircles, so a split
    // diagram can leave the outer region with no curves at all. Filling it then
    // covers the whole picture, which only showed once the fill became opaque.
    const holds = (pts, q) => {
      let w = false;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const A = pts[a], B = pts[b];
        if ((A.y > q.y) !== (B.y > q.y) && q.x < (B.x - A.x) * (q.y - A.y) / (B.y - A.y) + A.x) w = !w;
      }
      return w;
    };
    const bounds = curvePts.map(pts => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of pts) {
        if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
        if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
      }
      return { x0, y0, x1, y1 };
    });
    const outermost = curvePts.map((_, i) => i).filter(i => {
      const q = curvePts[i][0];
      return !curvePts.some((other, j) => {
        if (j === i) return false;
        const B = bounds[j];
        return q.x >= B.x0 && q.x <= B.x1 && q.y >= B.y0 && q.y <= B.y1 && holds(other, q);
      });
    });
    const regions = dec.regions.map((_, r) => {
      // Crossing-free pieces have no bounded tangle to cover with a fill.
      if (!dec.regions[r].length) return { region: r, curves: [], outer: false };
      const own = [];
      dec.curveRegion.forEach((cr, ci) => { if (cr === r) own.push(ci); });
      if (!own.length) return { region: r, curves: own, outer: true };
      const d = curves[own[0]][0], here = pointAtS(comps[dart[d].c], dart[d].s0);
      const parity = own.reduce((t, ci) => t + Math.abs(turns(curvePts[ci], here)), 0) % 2;
      return { region: r, curves: own, outer: parity === 0 };
    });
    return { curves: curvePts, outline, marks, gEdges, regions, outermost, side, rounded, repaired };
  }

  // Adjacent occurrences on every closed component must have opposite heights.
  // Crossing bits satisfy over[a] XOR over[b] = 1 XOR occurrence[a] XOR occurrence[b].
  function alternatingAssignment(comps,crossings) {
    const lists=comps.map(()=>[]),graph=crossings.map(()=>[]);
    crossings.forEach((X,i)=>X.occ.forEach((o,k)=>lists[o.c].push({i,k,s:o.s})));
    for(const list of lists) {
      list.sort((a,b)=>a.s-b.s);
      list.forEach((a,j)=>{
        const b=list[(j+1)%list.length],parity=1^a.k^b.k;
        graph[a.i].push({i:b.i,parity});graph[b.i].push({i:a.i,parity});
      });
    }
    const over=crossings.map(()=>-1);
    for(let root=0;root<crossings.length;root++) {
      if(over[root]!==-1)continue;
      const group=[root];over[root]=0;
      for(let j=0;j<group.length;j++)for(const edge of graph[group[j]]) {
        const value=over[group[j]]^edge.parity;
        if(over[edge.i]===-1){over[edge.i]=value;group.push(edge.i);}
        else if(over[edge.i]!==value)return {ok:false,reason:'Inconsistent crossing order'};
      }
      const flips=group.filter(i=>over[i]!==crossings[i].over).length,opposite=group.length-flips;
      if(opposite<flips || (opposite===flips&&over[root]!==crossings[root].over))group.forEach(i=>over[i]^=1);
    }
    return {ok:true,over,flips:over.filter((v,i)=>v!==crossings[i].over).length};
  }

  return {
    SEG, updateGeom, arcPosOfU, sDist, pointAtS, cloneComps, cloneCrossings, resampleComp, computeRaw, reconcile,
    attemptStep, relaxStep, moveWeighted, relaxMutator, smoothCorners, indexOfU, crossingDistances, crossingAngle, crossingAngles, separateCrossings, openCrossings, resampleClosed, fromCurves3D, torusCurve, figureEightCurve, circleCurve,
    braidCurves, analyze, alternatingAssignment, circD, mod,
    decompose, decompositionGenus, decompositionGenusRecursive, decompositionPaths, decompositionSteps, repairDecompositionDents
  };
})();



if (typeof module !== 'undefined' && module.exports) module.exports = KC;
