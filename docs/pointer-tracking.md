# v19 pointer-speed strand dragging

This records the v19 experiment. Its large drag steps were replaced by the
original deformation in v20; see [drag-feel.md](drag-feel.md).

The v18 scheduler kept the UI responsive but still advanced a strand by at most
2.5 world units per expensive geometry check. A fast pointer could outpace that
work. The editor now tries the remaining distance to the current pointer, and
subdivides only when it cannot certify the complete motion.

## Continuous check

The candidate moves every affected vertex linearly from its current position
to the proposed position. A swept spatial grid finds potentially interacting
segments. Fixed separating axes and quadratic orientation bounds certify pairs
that remain disjoint or transverse throughout the interval.

Crossings may pass ordinary sampling vertices without a Reidemeister event.
The check solves the quadratic vertex/edge contact times, requires opposite
sides for the two incident edges, and carries the crossing's ID and overstrand
through the resulting segment-pair transitions in time order. It rejects
tangencies, ambiguous or coincident endpoint contacts, collapsing segments and
adjacent-edge folds. A triangle in the union of visited segment-intersection
pairs conservatively identifies a possible triple point and forces subdivision.

A certified move preserves those tracked identities through the existing
projection-preserving resampling fallback. It does not use nearest-crossing
matching to assign heights after a large movement. Uncertain moves retry with
smaller distances, down to the existing 2.5-unit Reidemeister checker. The
certificate never authorizes a crossing change or skips a possible transient
bigon just because the endpoint diagrams look alike.

The approximately 6 ms task budget, coalesced painting and sleeping of settled
or blocked grips remain. One check is indivisible and may exceed that budget.
Pointer-up applies its own final coordinates within one bounded work slice;
unsafe or unusually expensive remaining travel is not teleported on release.
Queued tasks carry a gesture generation, so work from a released gesture cannot
advance the next gesture. Release smoothing now respects **Smooth corners**.

## Measurements

Paired local headless Chrome runs against v18 (`2838be8`) on 2026-10-27:

| Workload | v18 | Adaptive |
| --- | ---: | ---: |
| 32 crossings / 4,742 points: fixed 180-unit target | 138.8 ms / 72 steps | 22.6 ms / 1 step |
| 88 crossings / 3,178 points: fixed 180-unit target | 184.5 ms / 72 steps | 17.8 ms / 1 step |
| 32 crossings: remaining distance after final fast input | 32.5 units | 0 units |
| 88 crossings: remaining distance after final fast input | 115 units | 31.4 units |

The fast path is 360 world units over 240 ms. The final-input distance is
measured before the existing release cleanup. The dense case still encounters
subdivision and has measurable residual lag; there is no guarantee of zero lag
at every crossing or on every device. The first full 180-unit checks took
14.8 ms and 13.8 ms; subsequent fast-gesture task medians were about 3.6 ms and
3.3 ms. These are diagnostic measurements, not timing assertions for CI.

The 32-crossing drawing retains `(c,sA,sB,gT) = (32,21,1,6)` in every scenario.
The synthetic drawing ends at `(88,9,1,40)` on the normal path. On the fast path,
v18 stops earlier at `(88,9,1,40)` and the adaptive drag reaches `(90,10,2,40)`.
A separate event trace confirms that the two crossings are added by an
ordinary small-step RII; certified moves report no Reidemeister events.
These paths include local Reidemeister checks, so their crossing counts need
not stay fixed. Larger local movements can also produce different point
coordinates and smoothing than a sequence of 72 tiny moves. No global layout
or Auto-relax behavior changes.

The benchmark commands and environment variables remain those in
[drag-performance.md](drag-performance.md). Numeric reports contain hashes and
metrics only, in [pointer-tracking-benchmark.json](pointer-tracking-benchmark.json).
The private input drawing is not included.

## Regression coverage

- Transverse crossings travel across many sampling vertices while retaining
  their exact IDs and heights.
- A sweep with crossing-free endpoints but a transient bigon forces subdivision.
- Adjacent folds and both legal and cyclic RIII candidates use the local checker.
- Failed certificates leave geometry, crossing data and `nextId` unchanged.
- Accepted moves preserve exact Jones polynomials across trefoil, figure-eight
  and Hopf-link fixtures; intermediate sampled projections retain crossing counts.
- Fast mouse, pen and touch input reaches a clear target in one display frame,
  including after a slow start. It includes release coordinates, preserves
  undo and isolates stale queued work.
- The existing scheduler, seven Node suites and browser regressions remain
  applicable. Physical iPad/Apple Pencil and Safari have not been tested.

## Independent review

A geometry reviewer exercised 12,000 deterministic random motions. The 6,438
certified cases included 1,058 self-crossing cases and 422 sampling-segment
transfers. All preserved labeled over/under Gauss words through resampling and
154,512 intermediate samples. The implementation author reran the probe with
the same results. This finite check supplements the focused regressions; it
does not establish correctness for every floating-point degeneracy.

A separate runtime review found that four slow pointer samples could install
an unnecessary speed cap. Growth now applies only to caps introduced by
subdivision. The new slow-to-fast mouse/pen/touch test failed before the fix
and passed afterward. Review also corrected the dense fast-path crossing
counts in the measurement description above.
