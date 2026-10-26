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
