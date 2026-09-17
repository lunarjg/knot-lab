# Release history

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
