# Release history

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
