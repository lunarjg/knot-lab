# Release history

Entries `v1`–`v17` (tagged releases), and the codebase state this repository
started from, were built by an earlier Codex-based development process.
Everything below this line was implemented by a Claude Code session
continuing that work, across two pull requests; none of it has been tagged
as a new release yet.

## Stop refusing legitimate R2 moves in crowded diagrams (Claude Code, unreleased)

Dragging a strand down onto another one kept being refused with "Blocked: a strand cannot pass through another strand", on moves that were plainly ordinary R2s. Instrumenting `reconcile` on a seven-component diagram supplied by the project owner caught it exactly: a step with **2 births and 0 deaths**, the two new crossings **14.6 units apart**, matching components, pairing cost 36.8 against a limit of 224 — a textbook R2 birth, refused only because the empty-bigon test said the bigon was not empty.

That test was too strict, and the reasoning is geometric: a strand passing *through* the bigon an R2 has just created must enter and leave across that bigon's own boundary, so it necessarily leaves a crossing on one of the two bounding arcs. Counting every such crossing against the pairing meant any R2 formed in a busy region was rejected.

The emptiness test now only considers crossings that **changed in the same step** — other births when pairing births, other deaths when pairing deaths. A crossing that was already there and stayed put is just another strand threading the bigon, which is legal. What genuinely makes a pairing unsafe is another *birth* interleaved between the candidates, which is the ambiguity the original fix was for.

Measured on the supplied diagram (7 components × 12 grab points × 3 drag radii, each pulled 350 units down):

| | false "pass" rejections | drags reaching their target | topology violations |
| --- | --- | --- | --- |
| before | 56 | 98/144 | 0/60 |
| after | **8** | **107/144** | **0/60** |

The knot-type guarantee is untouched: still zero violations across five fixtures × three radii × four grab points. The 8 remaining rejections are genuinely ambiguous — four births crammed into 2.5 units, where no matcher can tell which pairs with which — and refusing there is the safe answer. That also explains why auto-relax, or lifting the strand and lowering it again, clears the block: both separate the crossings enough for the pairing to be unambiguous.

- Test: a ring lowered onto a bar with a post already threaded through the gap, so the new bigon has the post running through it. `reconcile` must accept it as exactly one R2 and keep all six pre-existing crossings. It fails on the unfixed code with `reason=pass`.
- Service-worker cache bumped to `knot-lab-v25-r2-bigon-fix`.

## Erase a whole curve; select with a rectangle (Claude Code, unreleased)

- **Erase curve**, a third eraser mode beside Erase strand and Erase segment. Tapping a curve removes all of it, which is how you take one component off a link and leave the rest of the diagram alone; dragging sweeps up every curve the pointer crosses. Open arcs count too, so a half-drawn stroke goes the same way. Hovering highlights the entire curve that would be removed, closing the loop for a closed component so it reads as one object rather than a strand. <kbd>E</kbd> now cycles all three modes instead of toggling two.
- **Rectangle lasso.** A second control in the lasso's options bar chooses the selection shape: Freehand (tracing a loop, as before) or Rectangle (drag a box). The rectangle is rebuilt as four corners on every pointer move and handed to `finishLasso` as an ordinary polygon, so selection, Region cutting, the menu and the transform handles all work unchanged. The shape is independent of the Whole curves / Region mode, so all four combinations are available.
- The new shape control needed the `lassomodes` class: `.seg.sub button[aria-pressed="true"]` is the eraser's warn red, and only `.seg.sub.lassomodes` overrides it to the accent colour, so without it the active Rectangle button rendered red.
- Tests: erasing one ring of a two-ring link leaves exactly the other one with no crossings, undo restores it, tapping empty space erases nothing, and <kbd>E</kbd> cycles all three modes; the rectangle selects only what it encloses, an empty rectangle selects nothing, and freehand still works. The mock DOM's `querySelectorAll` learned the new `#lassoShapes button` group.
- Service-worker cache bumped to `knot-lab-v24-erase-curve-rect-lasso`.

## Fix Save failing on desktop (Claude Code, unreleased)

Saving a diagram on desktop Chrome or Edge either showed "Could not export the file. Please try again", or appeared to freeze, and in both cases nothing was saved.

`saveFile` preferred the native share sheet whenever `navigator.canShare({files})` returned true, falling back to a download otherwise. That reads as an iPad-first choice, but **desktop Chrome and Edge support Web Share too**, so on Windows every desktop save was routed into an OS share dialog instead of a plain download — and the share branch `return`ed unconditionally, so there was no fallback. Reproduced all three outcomes by stubbing `canShare`/`share`:

| share outcome | what the user saw |
| --- | --- |
| rejects | "Could not export the file. Please try again", export lost |
| never settles | no download, no toast — looks frozen |
| cancelled | nothing at all |

- The share sheet is now used **only on iPhone and iPad**, where a blob download is genuinely awkward; every other platform downloads directly. Detection is `/iP(hone|ad|od)/` on the user agent, plus `platform === 'MacIntel' && maxTouchPoints > 1` for iPadOS, which reports itself as a Mac.
- A share that fails for any reason other than the user cancelling now **falls back to the download** instead of dead-ending. Cancelling stays a no-op, since that is a deliberate choice.
- Verified in a browser under a desktop UA (all three share outcomes now download) and under an iPad UA (share is tried first; a failed share still downloads; a cancelled one does not).
- Tests: a new case covering all three paths, which fails on the unfixed code ("Desktop must not open a share sheet"). The existing async export rename/edit race test relied on the share path, so it now presents an iPad user agent to reach it — and while fixing that, a stray top-level `return` in a test block turned out to be silently skipping every test after it, so the app suite goes from 29 reported tests to 30.
- Service-worker cache bumped to `knot-lab-v23-save-fix`.

## Fix pasting rewriting the crossings of the diagram already on the canvas (Claude Code, unreleased)

Copying a diagram and pasting it changed the **original** diagram's crossings: on a 20-crossing diagram supplied by the project owner, only 10 of the 20 survived a paste with their over/under intact, and the writhe stayed at 20 instead of doubling to 40. Drawing a new closed loop over an existing diagram, and dropping a moved partial selection, were hit the same way.

A regression from the topology fix in the previous round. `integrateClosed` validates the new geometry with `reconcile`, and on `!r.ok` it falls back to renumbering **every** crossing and re-deriving every height from crossing memory. Integrating a whole curve adds a complete strand at once, so its crossings are born in numbers that cannot pair up as R1 or R2 — exactly what `reconcile` had just started rejecting. The rejection threw away the entire match, and the fallback then rewrote the crossings that had never moved.

The rejection is right for a drag and wrong here: adding a component is not a Reidemeister move at all. `reconcile` gains an `integrate` mode that runs the matching pass as usual — every crossing it recognises keeps its id and its over/under — and hands the leftovers back as fresh for the caller to assign, without any R1/R2/R3 classification and without ever rejecting. `integrateClosed` is its only caller, which covers all three affected paths (paste, dropped selection, newly drawn loop).

- Verified against the supplied diagram in a browser: 20/20 original crossings preserved at identical positions and heights, writhe 20 → 40, no console errors. Against the deployed build the same run preserves 10/20.
- Drawing a loop over a trefoil: 3/3 preserved after the fix, 2/3 before.
- Tests: an app-level copy/paste test asserting every original crossing is unchanged, the writhe doubles, and undo restores exactly (it fails on the unfixed code); and a core test that plain `reconcile` still rejects a whole new component while `integrate` mode preserves ids, heights and positions, numbers only the new crossings, and keeps ids unique.
- Service-worker cache bumped to `knot-lab-v22-paste-fix`.

## Eraser gets Clear all; flip the arrow and grid defaults (Claude Code, unreleased)

- Add **Clear all** to the Eraser tool's options bar, beside "Erase strand" and "Erase segment", so emptying the canvas no longer means opening the inspector. Both buttons now call one `clearAll()`, so they behave identically and stay one undo step. Styled with the warn colour via a new `.toolopt .iconbtn.danger` rule, since `.danger` was only defined inside `.selmenu`.
- **Orientation arrows now default off** and the **background grid defaults on** (Settings → Display), matching how the diagrams are normally read.
- Bump the service-worker cache to `knot-lab-v21-topology-fix` so installed clients pick up this round.

## Resize a lasso selection (Claude Code, unreleased)

- Add a resize grip to the lasso's selection box, at its bottom-right corner, alongside the existing move and rotate. Dragging it scales the selection about its centre by the ratio of the pointer's distance from that centre to where the grab started, clamped to 0.1x–12x and snapping to quarter steps (hold <kbd>Shift</kbd> to force the snap). The live percentage is drawn above the grip.
- Scaling is uniform only: a non-uniform scale would distort the strands without making the diagram easier to work with. It reuses the existing lift/transform/drop machinery, so it composes into the same `sel.xf` affine as move and rotate, rides one undo step, and re-integrates through `integrateClosed`. The crossing-memory directions carried through `xf` stay correct because they are only ever compared against each other, so a uniform factor cancels.
- The motivation is measured: auto-relax shrinks a diagram monotonically as it runs, with no floor — over 600 steps a trefoil goes from 420 to 367 units of span (88%), a figure-eight to 90%, a torus(3,4) to 91%, and it keeps going. A small diagram is harder to edit precisely, which is the "strands don't move the way I want" complaint. The grip scales it back up without redrawing.
- Browser-verified end to end: after 250 relax steps, lasso everything and drag the grip — span 798 → 1755 with the crossing count and writhe unchanged, and no console errors. The grip's glyph is two corner brackets facing apart rather than a full diagonal, which inside a circle reads as a "no entry" sign.
- **Change the Separation distance default from 24 to 10**, the bottom of its range. The tests that exercised separation now set the slider explicitly instead of relying on the default.

## Keep separated crossings readable, and make the separation distance adjustable (Claude Code, unreleased)

- **Crossings no longer end up flat.** Pushing a pair apart stretches the arcs between them, so both strands ran nearly parallel through each crossing: measured on a squeezed bigon, the angles collapsed from 67°/57° to 33°/56° at a 24-unit gap and to 15°/22° at 60. A new `KC.openCrossings` turns each crossing the gesture flattened back open to at least 40°. It displaces the strand by `u(s) = A·s·exp(−s²/2σ²)` along the normal, so `u(0) = 0` — the crossing itself does not move — while the tangent there turns by `A` and the effect fades within a couple of σ. The largest displacement is about `0.6·A·σ`, a couple of units, so it opens the angle without redrawing the curve. Like the separation it goes through `attemptStep` and is rolled back if it would change the topology.
- Only crossings this gesture is responsible for are touched: the ones it created, and the ones whose angle it made shallower than it was at drag start. Separating one pair squashes nearby crossings too, not just the pair being moved — in a browser run a pre-existing 84° crossing was collapsed to 10° as collateral — so eligibility is by angle change, not by which pair moved. A crossing that was already flat is left as the user drew it.
- **Ordering, in both directions.** Separation runs before the drag-end corner smoothing, because smoothing first pulls a squeezed bigon tighter (5.2-unit gap instead of 27.2). The angle opening has to run *after* it, because smoothing straightens the curve and otherwise flattens a tightly separated pair straight back — 40° down to 11° in a browser run. Getting this wrong is silent, so both directions are recorded here.
- **Add a Separation distance slider** (Settings → Dragging, 10–60, default 24) next to the existing on/off switch. Verified in a browser at 12, 24 and 45: the closest pair ends at 13.1, 19.4 and 44.8 units, with the worst crossing angle 38°, 31° and 36° respectively — against 15°/11° before this change.
- Tests: `openCrossings` improves every flattened angle to at least 35° at gaps 24/40/60 without undoing the separation or changing the crossing count, and leaves an already-square crossing byte-for-byte untouched; the app test drives the slider at 14 and 50 and requires both the distance to follow it and the resulting crossings to stay at 30° or more.

## Fix dragging being able to change the knot type (Claude Code, unreleased)

A drag is supposed to be a sequence of Reidemeister moves, so it can never change the knot. It could. Dragging a point of a trefoil across the diagram at the then-default drag radius turned it into the **unknot** (Jones polynomial 1), and lower radii produced other wrong knots. Two independent causes, both introduced by earlier rounds on this branch:

- **Unpairable births and deaths were accepted silently.** Removing the "a strand would pass through another strand" rejection (done on the theory that such a step is just the reverse of an R2) meant a crossing could appear or vanish without being classified as R1 or R2 at all. That is exactly a strand sliding through another one. Reinstated: a birth or death that matches neither an R2 bigon nor an R1 kink now rejects the step, which is rolled back.
- **R2 pairs were matched by proximity alone.** Two crossings that merely landed near each other were paired as an R2, so a step that was not an R2 passed validation. `pairCost` now also requires a genuine *empty* bigon — the two crossings adjacent along both strands with no third crossing between them.

Because the emptiness test does the structural work, the distance cap that used to stand in for it can be generous: the old 70/60 thresholds rejected a legitimate separation of two unlinked components costing ~153, so both are replaced by `R2_REACH = 32 * SEG`. Measured on a sweep, ≥160 is where that legal separation is allowed; violations stay at zero all the way up to 1000.

The fix is free for ordinary editing. Over 40 random drags (pull a strand 60–160 units in a random direction) at radius 20, 40 and 80, it blocks **0%** of steps and every drag still reaches its target — identical to before. It only refuses the pathological gesture, where refusing is correct.

- Coverage added to `tests/moves.test.cjs`: dragging can never change the Jones polynomial, across four knots × three drag radii × four grab points; and two unlinked components can still be dragged apart, which is the case the pass-through rejection was originally removed for. The old test asserting that a wide pass-through "must not be blocked" encoded the bug and is gone; it also used an axis-aligned fixture whose edges were exactly parallel, and a single 900-unit jump no validation could decompose.
- **Lower the default drag radius back from 80 to 40.** At 80 the Gaussian reaches 3σ = 240 arc units, so a part of the curve 150–300 units away from the grip still moved up to 50 units when the pointer travelled 120 — which is what "I touch one place and a different part comes along" was. At 40 the same band moves 17. Grab fidelity itself was never the problem: the grabbed point tracks the pointer to 0.00 units. The slider still goes to 160.

## Verify that exported PD codes really encode the drawn diagram (Claude Code, unreleased)

`invariants.js` reads `analyze()`'s internal structures, never the `pd` field, so nothing checked the PD writer — the existing PD test only round-tripped diagram quantities. Added a test that computes the Kauffman bracket, writhe and Jones polynomial **from the PD integers alone**, deriving each crossing's orientation structurally rather than assuming a labelling convention. For eight geometric fixtures it must agree with the geometry-derived Jones and with the PD read back through the independent importer, and where the knot is nameable (trefoil, figure-8, 8_19, Hopf link) with the published polynomial. All three agree everywhere, so the exported PD is faithful; the gap was in the tests, not the code.

## Separate overlapping crossings when a drag ends (Claude Code, unreleased)

- Add **Separate overlapping crossings** (Settings → Dragging, on by default). When a drag ends, any two crossings the drag pushed into each other repel slightly, like weak magnets, until they clear 24 world units — enough that their drawn undercrossing breaks (`min(12, 8/view.s)` either side) cannot touch at any zoom, while staying a few segments (`SEG` is 7) of nudge rather than a rearrangement.
- Only pairs the gesture actually tightened move. `KC.crossingDistances` snapshots pairwise distances by crossing id when the drag starts, and `KC.separateCrossings` skips any pair that is neither newly formed nor measurably closer than it was then — so an import, or a region deliberately drawn tight, is left exactly as it is.
- The pass cannot change the topology: every nudge goes through the same `attemptStep` as any other move and is rolled back unless the crossing count and the R1/R2/R3 event counters both come back untouched. A pair with nowhere to go is recorded as stuck and skipped, so one wedged pair does not stop the pass for the rest.
- It rides the drag's own undo step, so one undo takes back the drag and the separation together, and it runs *before* the drag-end corner smoothing rather than after — smoothing first pulls a squeezed bigon tighter, and on a tight fixture that ordering settles at a 5.2-unit gap instead of 27.2. The push overshoots the gap by 15% to absorb the few percent the following smoothing pulls back.
- Rewrote the test that previously asserted the opposite ("no release correction", from when the old clearance machinery was removed) to run the same squeeze both ways: the drag is still never blocked and both crossings still survive, the setting off leaves them where the drag left them, and the setting on separates them. Added core coverage that a pre-existing tight pair is not rearranged, that a tightened pair is, and that neither changes the crossing count.
- Verified in a browser on an imported trefoil by dragging one crossing directly onto another: the closest pair goes to 0.0 while held either way, and on release stays 0.0 with the setting off versus 21.8 with it on, with no console or page errors.

## Remove the Reidemeister move counters (Claude Code, unreleased)

- Remove the inspector's "Reidemeister move counts" section entirely: the R1/R2/R3 tiles, their pulse-on-change animation, and the "Crossing changes" tally that lived in the same section. The `stats` object and all of its plumbing go with them — undo/redo snapshots, `serializeState`, saved JSON, workspace autosave, and per-tab state no longer carry counts.
- Saved files no longer write a `stats` field. Older files that still have one load fine; the field is simply ignored.
- The `reconcile` classification itself stays exactly as it was — it is what decides whether a step is a valid Reidemeister move, and `smoothSharpCorners` still reads its events to roll back a smoothing pass that would change the topology. Only the user-visible tallying is gone. One consequence: the R3 double-count quirk noted below no longer has any visible effect.
- Tests that used the counters as their observable were rewritten against surviving state rather than dropped: the per-tab flip/undo/redo test now follows `analysis.writhe`, and the Make alternating test now asserts that exactly one serialized crossing changes height instead of reading `stats.flips`.
- Bump the service-worker cache name to `knot-lab-v20-reference-drawing`, which had not been touched since `v19` despite the engine rewrite on this branch, so installed clients refresh their offline precache.

## Take up a stretched strand's slack while dragging it (Claude Code, unreleased)

- Port the reference build's slack-absorbing drag from `knot-lab.html`: each drag step now also runs one corner-smoothing pass over the stretch of strand around the grip (out to three drag radii), so re-pulling an already-stretched strand draws it back in a little instead of only ever lengthening it. It runs inside the drag's own validated `attemptStep`, so it cannot change the topology, and it is gated on the existing **Smooth corners** setting rather than a new one.
- Verified in a browser on an imported trefoil (drag radius 25, one hard stretch then five whips back and forth): with the pass on, each re-pull shortens the strand (4843 → 4801 → 4749 → 4719) and it stays rounded at 3 crossings; with it off, the length only oscillates upward (5065 → 5050 → 5038), the tongue folds into a spike (max turn angle 2.39 rad vs 0.62), and two spurious crossings are left behind.
- One deliberate behavior change falls out of this: the pass rounds off the very tight curl a grip would otherwise leave right at the grabbed point, so forming a tiny self-crossing directly under the cursor now needs **Smooth corners** off. Crossings between different strands, and self-crossings between arcs further apart than the smoothing reach, are unaffected — checked both ways in the tests.

## Stop blocking strand pass-throughs, fix the stretched-drag grab, auto-smooth after a drag (Claude Code, unreleased)

- Remove the "a strand would pass through another strand" rejection. A step that carries a strand clean across another one — too wide a jump for the two births/deaths to pair up as an R2 — is just the reverse of the R2 that would undo it, so it is now accepted and simply left uncounted. A contradictory height order (R2 with different overstrands, cyclic R3) is still rejected. `reconcile`'s `allowUnclassifiedBirths` escape hatch is gone with it, since that is now the only behavior.
- Fix a drag pulling the strand from beside the grabbed point: `tick()` measured the distance still to travel on the interpolated position at the grabbed material coordinate, but the mutator moved the *nearest vertex* to it — up to half a segment apart (measured 3.4px on a fresh curve, more once stretched, and multiplied by zoom on screen). Both now use the same vertex, and the grab is re-anchored to it after each step so the points resampling inserts into a stretched segment cannot walk the grab backwards along the strand. Verified over repeated stretch cycles in a browser: the curve stays within 0.03px of the pointer and stops creeping entirely while the pointer is held still.
- Smooth sharp corners automatically when a drag ends, folded into the drag's own undo step. The pass is cosmetic only: a smoothing step that would add or remove a crossing is rolled back, so it cannot quietly undo a curl the drag just made. The manual "Smooth sharp corners" action gets the same guard.
- Add <kbd>A</kbd> as the Auto-relax shortcut, and an Auto-relax button in the Drag strand tool's own options bar. Both share the main button's run state and label.

## Go all the way to the reference build's drawing engine, including computeRaw/reconcile/resampleComp (Claude Code, unreleased)

The previous entry below kept this branch's `computeRaw`, `reconcile`, and `resampleComp` deliberately unreverted, for their correctness fixes. The project owner asked to drop that distinction and switch "drawing" to the reference build's code across the board instead, adding fixes back later only as actually needed:

- `computeRaw`, `reconcile`, and `resampleComp` now match the reference build exactly. This drops: grid-boundary cell-ownership stability (a crossing could very rarely go missing when it fell exactly on a spatial-hash cell boundary), the tangential-touch fix (a curve vertex merely touching another strand without crossing to the other side can now register as a false crossing), the requirement that an R2 pairing be a genuine adjacent bigon (matching is now by proximity only, within a fixed distance threshold), and the exact-triple-point handling in `attemptStep` (`moveCheckpoint`) that existed to stop the old `reconcile` from double-counting an R3 slide sampled exactly at its coincidence point — sampled that way, R3 can now count twice for one slide (a move-count quirk, not a topology error). `compactStep`/`compactPts` are removed again along with them, since the reference build's `resampleComp` doesn't grow the point count the same way.
- Updated or removed the moves.test.cjs coverage that exercised the dropped fixes directly (subpixel/grid-boundary crossing stability, the tangential-touch distinction, the exact double-count suppression), and rescaled a couple of small-coordinate fixtures that turned out to depend on the stricter `resampleComp` merely to keep their crossings.
- Updated the README's "Geometry and editing behavior" and "No size or distance floor" sections to describe the reference build's simpler, threshold-based matching accurately instead of the dropped guarantees.

## Rebuild the engine directly against the project owner's reference build; drop Assisted R1 and the drag perf shortcut (Claude Code, unreleased)

The project owner supplied a second, different reference build (an earlier, minimal prototype with no PD import, invariants, tabs or offline support) and asked to rebuild the drawing/dragging/relax engine directly from its code, keeping this branch's other structural features (PD import, tabs, invariants, offline install). Compared line-by-line against that file:

- `attemptStep`, `moveWeighted`, and `relaxMutator` now match the reference build exactly (`moveWeighted` walks outward from the grabbed point along the polyline instead of scanning every point by arc-length distance from a precise fractional position).
- `computeRaw` and `reconcile` (crossing detection and Reidemeister-move validation) are kept as they are on this branch, not reverted to the reference build's versions: the reference build's `computeRaw` doesn't have the grid-boundary-stability or tangential-touch fixes from v16/v18, and its `reconcile` uses a looser, distance-threshold-based R2/R3 match instead of requiring genuine bigon adjacency. `attemptStep` still keeps its own `moveCheckpoint`/exact-triple-point handling to match, since without it the current `reconcile`'s neighbor-adjacency R3 detection breaks across an R3 slide's exact coincidence frame.
- `resampleComp` is also kept as it is on this branch rather than switched to the reference build's version: reverting it reintroduced a previously-fixed bug where a real no-op (or even a tiny/tight self-crossing) could lose a crossing purely from resampling, with no user action at all, because the reference build drops a point whenever it's merely *close* to its neighbor rather than only when it sits exactly on the unchanged straight chord between them. `compactPts`/`compactStep` (bounding the point count across repeated relax runs) stay for the same reason — they exist specifically to work with this stricter `resampleComp`.
- Remove `loosenR1` (Assisted R1: auto-straightening a small empty loop during a drag) and its "Remove small R1 loops while dragging" setting entirely — not in the reference build, and not asked for. A drag can now form or undo a self-crossing with no automatic assistance either way.
- Remove the `touchedComps` drag-performance shortcut (skip backup-cloning/resampling components a drag mutator won't touch) — not in the reference build. Every drag frame again deep-clones and resamples every component in the diagram, same as before that optimization; it can be reintroduced if dragging a busy multi-component diagram feels slow again.

## Remove all bigon/kink/clearance protection; rebuild drawing and auto-relax against a reference build (Claude Code, unreleased)

- Remove crossing clearance, non-R2 bigon protection, and R1 kink protection entirely, along with their settings (the "Crossing clearance" slider and switch, "Protect R2"/"Protect R1" toggles, bigon/kink area sliders) and the release-time separation pass. A drag or auto-relax step is now gated only by real topology (`reconcile`) — no size or distance floor of any kind. This matches the "feel" of an earlier, simpler build the project owner identified as the one they actually wanted, checked directly against its source.
- Restore `relaxMutator` to that build's simpler force formula: raw per-point repulsion (not arc-length/mass-normalized) and smoothing toward the immediate-neighbor midpoint (not a wider arc-length-reach neighborhood), with a fixed displacement clamp. `relaxStep`/`attemptStep`/`relaxed`/`relaxFrames` no longer take or thread through a clearance argument, and no longer retry at a shrinking scale (`adaptiveStep` is removed) — a blocked relax or drag step simply stops.
- Keep two things that are independent of clearance/bigon protection and not part of this reversion: the point-count-bounding periodic compaction (`compactStep`/`compactPts`) added earlier this branch, and the touched-component backup/resample scoping (`touchedComps`) that keeps a crowded multi-component drag smooth.
- Update the README and tests to match: the "Bigon and kink size protection" and "Default crossing clearance" sections are replaced with one section describing the no-floor behavior, and tests exercising the removed settings are removed or rewritten against the new, simpler engine.

## Auto-relax overlap handling, configurable crossing clearance, drag performance (Claude Code, unreleased)

- Restore auto-relax to Codex's original algorithm: relaxStep's retry-at-shrinking-scale mechanism (down to 1/64 strength on a topology block) and relaxMutator's force formula are unchanged from Codex's last commit touching them (verified against `82c9671`), reverting an intermediate hard-stop-plus-local-damping mechanism from earlier in this branch that squared crossings off into a "cross" shape instead of leaving them smooth. The one intentional change from Codex's original: relaxStep now also carries the crossing-clearance floor through the same opt interactive dragging uses, so crossings still get a minimum gap while a diagram shrinks. Because one relax call mutates every component atomically, a region permanently stuck at the floor correctly stops the whole call rather than drifting past it; separateCrowdedCrossings still cleans up whatever a run leaves crowded once it ends.
- Let crossings overlap freely while dragging; separate on release: dragging used to reject the whole step the moment any two crossings passed closer than the clearance floor, regardless of whether the move was actually a valid Reidemeister move. Real topology validation already decides what's legal, so the drag itself now carries no clearance floor at all; on release, a generalized separation pass (covering any crowded pair, not just two-crossing bigons) spreads back out whatever the gesture left crowded, bundled into the same undo step as the drag.
- Make crossing clearance configurable and switchable, instead of a fixed constant: a "Crossing clearance" slider in Settings > Dragging (8–100px, default 32) controls the minimum gap, and a matching on/off switch sits in the Drag strand tool's own options bar next to Protect R1/R2 and Pass underneath.
- Raise the default Drag radius from 40 to 80.
- Optimize the drag hot path: profiling showed each blocked/crowded drag step doing far more work than necessary — duplicate face-structure rebuilds, the retry ladder recomputing unchanged state on every attempt, and every step deep-cloning/resampling every component even though a drag only ever touches one. ~33% less time per drag frame on a synthetic crowded diagram (33ms → 22ms).
- Document that `dist/` now auto-deploys to a GitHub Pages mirror on every push to `main`.

## v18 — Gentle auto-relax and crossing clearance

- Restore auto-relax to a plain step that stops cleanly the moment it would violate topology, as in the original relaxation, instead of creeping through blocked configurations via ever-smaller adaptive steps; that retry now belongs only to interactive crowded-crossing dragging.
- Add a default, always-on crossing clearance floor beneath the optional bigon/kink size protection: no two crossings may collapse toward the same point — including three or more arcs converging near one spot — unless they form a genuine R2-removable bigon, which stays free to shrink. The exact triple-point frame inside a valid R3 slide is exempt, so valid R1/R2/R3 moves stay unrestricted. A blocked drag can always be reversed by dragging away.
- On release, a tiny genuine bigon this drag tightened is kept, not deleted, and gently nudged back out to the clearance distance rather than left pinned near-coincident; the correction is part of the drag's own undo step.
- Fix a tangential curve touch landing exactly on another strand's vertex (without crossing to the other side) being miscounted as a crossing; a genuine transversal dip through the same point is unaffected.
- Cover the relaxation change, non-resolvable crossing clusters, R2-birth and R3 exemptions, tangential touches, and pointer-driven release separation with undo/redo.

## v17 — Strand eraser

- Replace whole-curve Erase stroke with Erase strand: delete only between crossings or open endpoints, with a matching hover preview.
- Freeze gesture boundaries to prevent cascading deletion as crossings disappear; prefer the visible overstrand on exact crossing hits.
- Retain the remaining geometry as open arcs, remember crossing heights for reconnection, and keep precise segment erasing unchanged.
- Cover mouse/pen/touch, cyclic and open arcs, repeated samples, multi-strand gestures, unrelated components, reconnecting, JSON and undo/redo. Verify deletion and restoration in the browser; refresh offline assets.

## v16 — Crowded crossing and relaxation fixes

- Stabilize crossing ownership at spatial-grid boundaries and segment endpoints, preventing floating-point noise from dropping closely spaced crossings and blocking valid drags.
- Hit-test complete strand segments at any zoom; apply drag weights around the entire curve and retry blocked steps with smaller displacements.
- Normalize relaxation repulsion by arc length, use a continuous force near intersections, and smooth over a fixed arc-length neighborhood to avoid density-dependent corners.
- Add Stop relaxing and cancel pending frames on undo, edits and tab changes; isolate restarted runs.
- Cover crowded pairs, translated/scaled fixtures, mouse/pen/touch drags, high-zoom segment hits, repeated relaxation, sample subdivision, invariant preservation and animation cancellation. Verify a real browser trefoil relaxation and calculation.
- Keep Auto-close, R1 protection and non-R2 bigon protection off by default; refresh the offline cache.

## v15 — Bigon protection off by default

- Default non-R2 bigon protection to off and initially disable its area slider. Enabling protection restores the slider.
- Refresh the offline cache.

## v14 — R1 protection off by default

- Default existing R1 loop protection to off and initially disable its area slider. Enabling protection restores the slider.
- Refresh the offline cache.

## v13 — Start with open arcs

- Default Auto-close on release to off in both the checkbox and drawing state. Users can still enable it manually or join endpoints to close a loop.
- Refresh the offline cache.

## v12 — Clearer inspector and UI debugging

- Split the inspector into Diagram, Settings and Files pages with a persistent header and navigation.
- Group drag, display and pen settings; align slider values and disable size sliders when their protection is off.
- Remove duplicate Open/Save actions, shorten repeated explanations, and move detailed controls and installation help into disclosures.
- Preserve newer document names and edits when an earlier native file share finishes.
- Verify all five regression suites and real in-app-browser flows: four viewport widths (320–1440 px), PD import/errors, invariant workers, tab rename/switch, autosave reload, mirror and undo/redo. Apple Pencil hardware and Safari remain untested.
- Refresh the offline cache.

## v11 — Make alternating

- Add an English Make alternating action for closed knot/link diagrams without moving the curves.
- Solve cyclic over/under constraints jointly across components and choose the minimum number of crossing changes for the current projection.
- Record crossing changes separately from Reidemeister moves; support one-step undo/redo and invalidate in-flight invariant results.
- Test knots, links, disconnected diagrams, minimum-change assignments, no-op/error handling, persistence and tab isolation; refresh the offline cache.

## v10 — Rename document tabs in place

- Tap the active tab title or press F2 to edit its name; inactive tabs retain one-tap selection.
- Save with Enter or blur and cancel with Escape. Ignore composing Enter events and empty names.
- Preserve names and filename suggestions through tab switches and autosave without changing diagram undo/redo history.
- Add rename regression coverage and refresh the offline cache.

## v9 — Join arcs underneath existing strands

- Make newly drawn endpoint connectors pass under existing open arcs, closed components, and older parts of their own arc.
- Show over/under gaps for open-arc crossings while excluding open arcs from invariant calculations.
- Preserve crossing choices through later joins, closure, undo/redo, tabs, JSON and autosave, with backward-compatible optional crossing memory.
- Add pointer-path regression coverage for mouse/pen/touch, both joining directions, both closure orders, smoothing, and persistence; refresh offline assets.

## v8 — Allow new R1 self-crossings

- Exempt newly born R1 loops from the initial size floor so a strand can cross over/under itself to form a valid curl.
- Keep subsequent kink size protection and existing non-R2 bigon and topology checks.
- Restrict automatic R1 assistance to crossings present when the drag started, preserving newly created curls for that gesture.
- Test self-crossing birth, growth, later size protection, pointer dragging, move counting, and undo/redo; refresh the offline cache.

## v7 — Protect only non-R2 bigons

- Apply bigon area, thickness, and crossing-spacing floors only to alternating over/under boundary strands, which cannot cancel by R2.
- Allow same-overstrand R2 bigons to shrink below all size floors while retaining the existing topology checks and move counting.
- Preserve R1 kink protection, adjustable defaults, zoom scaling, undo, and all existing features.
- Clarify the English setting and refresh the offline cache.
- Add geometry and pointer-path regressions for both height patterns, self-crossings, mirrors, cyclic seams, and R2 birth/death.

## GitHub backup and CI (source maintenance; no Sites deployment)

- Preserve the complete six-commit Sites history and annotate its releases with tags v1–v6.
- Back up source to the private `lunarjg/knot-lab` repository using a separate GitHub remote; retain the Sites origin.
- Run all five regression suites on Node.js 22 and 24 for pushes and pull requests.
- Document setup, tested release commits and tags, and separate Sites deployment rollback from Git history rollback.
- Preserve application files, hosting configuration, site address, and access level.

## Sites version 6 — `f98759e`

- Add oriented linking numbers, knot determinant, Fox 3-coloring counts, and an exact Jones polynomial calculator.
- Run calculations in a cancellable worker; discard stale results after topology or document changes.
- Explain conventions and computation limits in the English UI, with mathematical references.
- Add invariant regression tests and offline caching for both new scripts.

## Sites version 5 — `71a74d0`

- Separate protection for bigon and R1 kink area, thickness, and bigon crossing separation.
- Allow existing undersized regions to expand and leave unrelated crossings unrestricted.

## Sites version 4 — `8b55e5b`

- Let small empty R1 loops straighten during dragging, with topology safeguards and undo support.

## Sites version 3 — `747a1a6`

- Add document tabs, crossing spacing, and precise eraser pointer fixes.

## Sites version 2 — `5df475b`

- Translate the site UI into English.

## Sites version 1 — `9fbf988`

- Import the application into the owner's Sites project.

Saved Sites versions are immutable deployment checkpoints. Redeploy the desired saved version to roll back the live site; source commits also retain the corresponding code.
