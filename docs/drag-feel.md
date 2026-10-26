# Original drag behavior with retained optimizations

v20 restores the pre-optimization deformation recipe: move at most 2.5 world
units, smooth within the drag radius, validate Reidemeister moves, resample,
and re-anchor the grip. v19's large adaptive steps changed the deformation
path. With the default smoothing enabled, some direction changes repeatedly
pulled the grip backward and kept it chasing a stationary pointer.

The optimized crossing calculations, projection reuse, coalesced rendering,
live analysis, sleeping settled/blocked grips and deferred decomposition stay.
The drag no longer uses the large-motion certificate or an inherited step cap.
No crossing changes or global relaxations are introduced.

Foreground work follows the current target before painting instead of yielding
after only 6 ms. It has a 40 ms guard; background continuations retain the 6 ms
budget. Both stop after 256 substeps as a fallback for stalled clocks or a
nonconverging grip. Each substep is indivisible, so one expensive check may
exceed the guard. Release consumes its final coordinates within one foreground
slice, then performs the existing cleanup in the same undo action.

A pending MessageChannel callback must not prevent fresh input from reaching
the next paint. The display-frame callback now integrates before painting and
invalidates the older continuation using a gesture generation and work ticket.
The rAF fallback, release and cancellation use the same ticket checks.

## Verification

The app regression replays the original recipe on a circle and an 88-crossing
diagram with default smoothing, including outward moves, turns and reversals.
At every settled target it compares the complete coordinates, crossing IDs,
over/under assignments and ID counter. The test fails on v19 and passes on the
restored implementation. Separate tests force input to arrive between a
background step and its queued paint, before the pending message can run.
Budget, stale-work, mouse/pen/touch, blocking and undo checks remain in place.

Paired local headless Chrome measurements on 2026-10-27 used the same private
32-crossing, 4,742-point drawing and pre-optimization source `c801933`:

| Measurement | Before optimization | Restored drag |
| --- | ---: | ---: |
| Fixed 180-unit target | 178.5 ms | 134.4 ms |
| Longest task for that target | 55.9 ms | 41.3 ms |
| Remaining distance after final fast input | 77.85 units | 0 units |

The fixed target uses 72 accepted steps and the **same final geometry hash**
in both versions. The fast path travels 360 units over 240 ms. Its restored
median task is 13.4 ms. Final-input distance is measured before release cleanup;
it does not mean every intermediate frame has zero pointer lag. The drawing
retains `(c,sA,sB,gT) = (32,21,1,6)` throughout these scenarios.

On the synthetic 88-crossing, 3,178-point drawing, the same fast path still
leaves 52.05 units after the final input slice; the longest task is 42.5 ms.
Restoring deformation does not make arbitrarily dense geometry instantaneous.

Use `tests/drag-performance.browser.cjs` and the environment variables documented
in [drag-performance.md](drag-performance.md) to repeat the measurements. They
are diagnostics, not timing assertions. The private drawing is not committed.
Physical iPad/Pencil and Safari latency have not been measured. Dense geometry
can still require multiple slices; a topology barrier remains a real stop.

## v21: reduce the work behind pointer catch-up

The deformation recipe and scheduling budgets remain unchanged. Crossing
matching now rejects pairs whose position or first arc distance already
exceeds the matching threshold, preserving candidate order and costs for all
remaining pairs. Validated drag state can copy current arc-length buffers for
rollback; other callers still recompute them. Resampling skips a second
geometry refresh only when the point list is unchanged and the caller has
just refreshed it. Rollback buffers are independent of the live component.

Release applies its final input and cleanup before one analysis and paint.
The former intermediate paint happened inside the same event handler and
could never be presented. Background callbacks already stop on release;
the browser benchmark now verifies zero later steps and unchanged geometry.

Paired local Chrome measurements on 2026-10-27 compare v20 (`eba3841`) with
v21, using the synthetic 88-crossing, 3,178-point diagram. The fast path
travels 360 world units over 240 ms; the stationary-pointer test then holds
the pointer until the grip settles or reaches a topology barrier.

| Measurement | v20 | v21 |
| --- | ---: | ---: |
| Catch-up after stopping the pointer | 53.9 ms | 18.3 ms |
| Gap after final fast release input, before cleanup | 52.13 units | 0.10 units |
| Longest task on the fast path | 41.3 ms | 24.9 ms |
| Cleanup after a settled release | 18.2 ms | 14.0 ms |

The fixed 180-unit target completes in 186.4 versus 132.7 ms with identical
geometry hashes. On the private 32-crossing drawing, that fixed target is
about 122 ms in both versions; the fast path reaches zero final-input gap in
both, while its longest task falls from 30.2 to 23.7 ms. These are individual
diagnostic runs, not guarantees or timing assertions. Intermediate gaps and
event sampling depend on frame ordering; sufficiently large jumps or dense
diagrams still take multiple slices. The settling tolerance remains 0.8
world units. Release cleanup can slightly move the grip after it has settled.

All seven Node suites and Chrome editor/research checks pass. The single-paint
regression fails on v20 and passes on v21. Independent geometry review compared
5,000 trials and 900 chained moves against v20, including accepted/rejected
steps, crossing identities/heights, event classification and rollback.
Independent runtime review checked release-only crossing creation, invariant
worker invalidation, decomposition, mouse/pen/touch, both schedulers and undo.
The 360-step core benchmark and default-smoothed direction/reversal traces
also retain exact geometry. Private fixture coordinates remain outside the
repository.
