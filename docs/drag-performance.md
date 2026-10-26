# v18 drag performance verification

This records the v18 scheduler/core optimization. The subsequent adaptive
movement change is documented in [pointer-tracking.md](pointer-tracking.md).
The current restoration of the original drag behavior is in [drag-feel.md](drag-feel.md).

The editor keeps each validated drag substep at most 2.5 world units. A task
attempts at most 18 substeps and yields after approximately 6 ms of geometry
work. One substep is indivisible, so this is a work budget, not a hard deadline.
Unfinished work continues through a dedicated MessageChannel. Settled or blocked
grips sleep until the pointer, Shift, or an option changes. Browsers without
MessageChannel use requestAnimationFrame.

Continuation tasks keep analysis and invariant-worker invalidation current,
while coalescing inspector, canvas and autosave updates onto display frames.
Decomposition waits until editing stops; stopping Auto-relax by button or pan
also refreshes it. Computed styles are shared within one paint only.

The geometry core precomputes segment data in a packed buffer without changing
crossing enumeration order. Resampling reports actual point-list changes, so
unchanged sampling can reuse the projection. Pre-resampling snapshots retain
arrays that resampling never mutates; the mutator still has a deep rollback
copy. All projection fallback and R1/R2/R3 checks remain in place.

## Measurements

Measured on 2026-10-26 against `5d16067`, using local headless Chrome on macOS
and a user-provided 32-crossing, 4,742-point drawing. The browser's observed
rAF interval was approximately 33.3 ms. These are representative local runs,
not FPS guarantees or physical iPad measurements.

| Workload / metric | Baseline | Optimized |
| --- | ---: | ---: |
| Fixed 180-unit target: time to settle | 192.2 ms | 185.1 ms |
| Fixed target: longest geometry task | 51.8 ms | 9.2 ms |
| Fixed target: median geometry task | 38.7 ms | 7.1 ms |
| 180 units over 600 ms: release gap | 9.77 units | 1.37 units |
| 360 units over 240 ms: release gap | 111.15 units | 62.5 units |
| 360 identical substeps in Node: total core time | 799.9 ms | 574.1 ms |

The fixed target required exactly 72 accepted substeps in both versions, with
the same final geometry hash. The separate 360-substep replay compares full
geometry, crossings, persistent IDs, accepted/rejected results and R-event
records using deep equality. Its initial analysis is `(32,21,1,6)`.

Time-sampled moving gestures receive different intermediate target updates when
scheduling changes; their final coordinates need not match. All three browser
scenarios retain `(32,21,1,6)`. The fast-gesture gap is reduced, not eliminated;
release never teleports a strand past the topology checks. The browser test also
runs without a private fixture on an 88-crossing, 3,178-point synthetic torus knot.

Numeric results are recorded in [drag-benchmark-2026-10-26.json](drag-benchmark-2026-10-26.json).
The private input drawing is not included.

## Reproduce

Use Node 22+ for the existing test suite. The optional browser benchmark needs
Playwright and Google Chrome, like the editor/research browser tests.

```sh
node tests/drag-performance.browser.cjs
KNOT_FIXTURE=/path/to/diagram.json node tests/drag-performance.browser.cjs
```

Optional environment variables:

- `PLAYWRIGHT_MODULE`: path to an existing Playwright installation.
- `CHECK_ROOT`: the **dist directory** of the baseline checkout.
- `PERF_OUTPUT`: JSON output path.
- `KNOT_FIXTURE`: a native Knot Lab JSON; otherwise a synthetic knot is generated.

The test serves files on loopback only. It reports work-task times, observed rAF
intervals, fixed-target convergence, release gaps, final analysis and geometry
hashes. Compare these together: reducing work per frame alone can make the grip
slower. Do not turn these host-dependent timings into CI thresholds.

For the identical-substep core comparison:

```sh
git show 5d16067:dist/knot-core.js > /tmp/knot-core-before.js
BASELINE_CORE=/tmp/knot-core-before.js KNOT_FIXTURE=/path/to/diagram.json node tests/drag-core.bench.cjs
```

## Verification and review

- All seven Node suites passed: moves, PD import, app state/input, invariants,
  offline cache, decomposition, and research.
- The spatial-index regression compares independent all-pairs intersections on
  80 deterministic diagrams and pins the baseline crossing enumeration order.
- The scheduler tests use a virtual display clock, an advancing work clock and
  separate fake MessageChannel tasks. They cover budgets, actual deferred
  painting, live analysis, idle/blocked sleep, pointer/Shift/radius wakeups,
  release cancellation, undo/redo and Auto-relax interruption.
- Chrome editor and research suites passed, including synthetic mouse/pen/touch
  input, phone layout, clipboard heights, worker results and preferences.
- Claude reviewed the changes through Reason Network in successive rounds. Its
  relaxation-stop, throughput, paint-coalescing and test-coverage feedback was
  incorporated. Claude independently ran all seven Node suites and compared
  complete ordered crossing results against the baseline on 400 random diagrams
  containing 2,220,383 intersections. Final review had no blocking findings.

Physical Apple Pencil, iPad Safari, 120 Hz ProMotion and iOS Low Power Mode have
not been tested. Headless Chrome timing does not establish WebKit scheduling or
hardware touch latency. A single expensive substep and release-time cleanup can
still exceed the slice budget.
