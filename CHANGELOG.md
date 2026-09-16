# Release history

## Invariant calculator update

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
