# Knot Diagram Lab

A static web app for drawing and analyzing knot diagrams with pen, touch, and mouse input, including on iPad.

- [Live site](https://jgkim.piano5788.chatgpt.site), deployed through Sites.
- [Private source backup](https://github.com/lunarjg/knot-lab).
- The application UI and repository documentation are in English. GitHub pushes and CI runs do not deploy the production site.

## Project files

- `dist/index.html`: interface, knot geometry engine, Reidemeister move validation, calculations, document tabs, and file saving/restoration.
- `dist/pd-import.js`: PD input validation and planar diagram construction.
- `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icon-*.png`: home-screen installation and offline support.
- `dist/invariants.js`, `dist/invariants-worker.js`: exact invariant calculations and a cancellable Web Worker.
- `tests/*.test.cjs`: geometry, PD import, application state, invariant, and offline regression tests.
- `.github/workflows/ci.yml`: automated tests on Node.js 22 and 24 for pushes and pull requests.
- `.openai/hosting.json`: deployment configuration for the existing Sites project. Preserve its `project_id` and the `dist` static directory.

Serve `dist` with a static web server. No external packages or build step are required. Diagram data is not sent to a server; autosave uses local storage in the device's browser.

## Run locally

Install Git, Node.js 22 or later, and Python 3. Authenticate with a GitHub account that can read the private repository, then clone it:

```sh
git clone https://github.com/lunarjg/knot-lab.git
cd knot-lab
node --version
```

In a new clone created this way, `origin` points to GitHub. In the existing Sites checkout, `origin` remains the Sites repository and GitHub uses a separate `github` remote. Check `git remote -v` before pushing.

From the repository directory, start a local server:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000` in a browser. Use HTTPS or localhost for service-worker offline access; opening the HTML file directly does not enable the service worker. Home-screen installation depends on browser support.

For other static hosting providers, publish the contents of `dist` at the site root. Update the cache name in `dist/sw.js` when changing application assets.

## Usage

- **New tab**: create a blank diagram.
- **Open files**: open JSON files in new tabs. Multiple files can be selected at once.
- Each document tab has its own diagram, zoom/pan position, undo/redo history, and move counts.
- Tap the active tab's name to rename it. Select an inactive tab first, then tap its name again. Enter or tapping outside saves the name; Escape cancels. F2 also starts editing. Names and suggested export filenames are autosaved without changing diagram undo history.
- **Save**: export the current tab as JSON, including move counts.
- **Autosave**: restore open tabs, diagrams, and move counts on the next visit. Undo stacks last only for the current session.
- **Import PD**: replace the current diagram with a PD code; Undo restores the previous diagram.
- Drag the inspector's left handle to resize it. Drag it to the right edge and release to hide the panel.
- Use the arrow on the right edge to reopen the inspector.

PD input accepts `[[a,b,c,d], ...]` or `PD[X[a,b,c,d], ...]`. The first label is the incoming understrand; the remaining labels proceed counterclockwise. Each arc label must appear twice. Import supports up to 80 crossings. If a layout is too crowded to construct reliably, an error is shown and the existing diagram is preserved. Crossing-free components cannot be represented by PD code alone.

The displayed Turaev genus is the value for the current diagram, not the minimum over all diagrams of the knot.

## Geometry and editing behavior

- Resampling preserves corners that affect crossings, preventing crossings from disappearing and being counted as R2 moves without an actual movement.
- Dragging does not automatically round corners. Separate smoothing actions are available.
- R2 validation checks whether adjacent crossings on both strands bound an empty bigon.
- R3 validation checks crossing-order reversals on all three sides of an empty triangle and verifies a consistent height order.
- Intermediate frames at an exact triple point are compared with the last regular diagram to avoid counting a move twice.
- Undo and redo restore move counts as well as geometry.
- Document tabs support multiple-file opening, workspace autosave, and migration from older single-document saves.

## Tests

Run these commands from the repository directory with Node.js 22 or later:

```sh
node tests/moves.test.cjs
node tests/pd.test.cjs
node tests/app.test.cjs
node tests/invariants.test.cjs
node tests/offline.test.cjs
```

Coverage includes R1/R2 births and deaths, forward/reverse R3 moves, triple-point intermediate frames, invalid height orders, PD calculations, independent document tabs, saving/restoration, and service-worker offline paths.

Application-state and service-worker tests use Node mock environments. They do not validate Safari rendering or physical Apple Pencil input.

## Site ownership and data

Keep using the existing Sites project and production address. The GitHub backup does not require creating a new site or changing its audience or editing permissions.

The owning account manages source editing and publication through Sites. Visitors are not granted repository or publication permissions. The application has no server API for changing shared diagram data: drawing, opening files, and autosaving happen in each visitor's browser.

## Interaction update

- Open files is next to the document tabs. Each selected JSON opens in its own tab; invalid files do not replace existing documents or prevent subsequent files from opening.
- Protect non-R2 bigons and Protect R1 kinks independently constrain the size of those regions during dragging. R2-compatible bigons and other crossing pairs have no size floor. Minimum areas are adjustable; existing undersized protected regions may expand. Rejected moves restore geometry and crossing IDs.
- The precise eraser outline follows pointer-down, drag, coalesced samples, and release coordinates. One erase gesture remains one undo step.
- Regression checks cover batch file opening, selected tabs, mouse/pen/touch erasing, crossing proximity, and the original Reidemeister classification.

## Drawing and joining open arcs

When a drawn stroke starts or ends at an existing open endpoint, its new connecting segments pass **under** existing arcs at new crossings, including older parts of the same arc and closed components. Previously assigned crossings retain their heights. Open arcs display undercrossing gaps, but remain excluded from knot/link invariant calculations until closed.

The crossing choices survive later joins and closure, either closure order, undo/redo, document tabs, JSON export/import, and browser autosave. JSON files may contain an optional `crossingMemory` array of `[x, y, overDirectionX, overDirectionY]` records; older files without that field remain supported. The draw hint explains the joining rule in English. Free strokes and the separate drag-under setting keep their existing defaults.

## R1 drag assistance

Small empty monogons near the dragged strand can now straighten during a drag (enabled by default). Loops containing a closed component or intersecting an open stroke are protected. The candidate must remove exactly one R1 crossing while preserving every surviving crossing and its over/under strands. The action is included in the drag undo step and move counts. Disable “Remove small R1 loops while dragging” to retain curls.

Self-crossings are allowed through valid R1/R2 moves. New R1 loops may begin below the kink area/thickness floor and grow; subsequent steps protect their existing size when R1 protection is enabled. Automatic R1 assistance only considers crossings present at the beginning of the drag, so it cannot immediately undo a self-crossing just created by that gesture. Existing topology checks still reject invalid R2/R3 moves and unclassified strand passages that could change the knot type.

## Bigon and kink size protection

The old all-pairs crossing-distance guard is replaced by tracing bounded one-edge (R1 kink) and two-edge (bigon) faces, using the full curved boundaries. **Bigon size protection applies only when each boundary strand is over at one crossing and under at the other**, which prevents R2 removal. When the same boundary strand is over at both crossings, the bigon is exempt from all size floors (area, thickness, and crossing separation), allowing it to shrink for R2 removal. Classification follows the actual boundary occurrences, including two strands belonging to the same component; it does not compare component IDs or raw crossing indices.

Both protection options are off by default. When enabled, their default minimum areas are 400 screen px² for protected bigons and 180 screen px² for kinks, separately adjustable. The guard also checks effective thickness (2 × area / perimeter; 8 px for protected bigons, 6 px for kinks) and a 16 px crossing separation for protected bigons. Limits scale with the current zoom. Existing undersized protected faces can grow but cannot shrink further. Valid disappearance of a face is still handled by the Reidemeister checks, and local R1 untwisting remains available.

Regression cases cover fixed crossing positions with a collapsing bigon, a single-crossing kink, thin regions with sufficient area, independent controls, zoom, cyclic seams, near-zero area, R3 through a triple point, pointer-driven dragging, and rollback.

Additional cases compare identical geometry with the two possible over/under patterns, R2 shrink/disappear/reappear and move counts, one-component bigons, mirrored height order, reversed occurrences, and pointer dragging with protection enabled.

## Default crossing clearance

Independent of the optional bigon/kink size protection above, a small clearance floor (16 screen px, scaled by zoom) is always active while dragging. It stops any two crossings from collapsing toward the same point — including three or more arcs converging near one spot — unless they form a genuine R2-removable bigon (the same strand over at both crossings), which stays free to shrink toward release as before. A blocked drag shows “These crossings cannot pass each other. Drag away to separate them.” and can always be reversed by dragging back; valid R1/R2/R3 moves, including the exact triple-point frame inside an R3 slide, are never blocked by this floor.

On release, a tiny genuine bigon that this drag tightened (newly formed, or shrunk from where it started) is kept — its crossings are not deleted — but gently nudged back out to the clearance distance so it stays visible and distinguishable rather than pinned near-coincident. This correction is part of the same undo step as the drag, so one undo reverts both together. A tangential touch that never actually crosses to the other side does not register as a crossing at all.

## Make an alternating diagram

Use **Make alternating** under **Diagram actions** on the inspector’s **Diagram** page. The operation changes over/under assignments so that crossing visits alternate along every closed component, including the cyclic join. It keeps the projected curves fixed and selects the fewest crossing changes for that fixed projection, independently across disconnected pieces. This is not a search over other projections or a knot invariant, and crossing changes can change the knot/link type. Open arcs are excluded.

The actual changes are added to **Crossing changes**, not R1/R2/R3 counts, and the entire conversion is one undo/redo step. Existing invariant calculations are canceled and their results invalidated. Already-alternating or crossing-free diagrams need no change; the button is disabled. An inconsistent crossing order fails without editing the diagram.

## Knot and link invariants

Click **Calculate invariants** in the side panel. Only closed components are included. The panel separates invariants from diagram-dependent crossing count, writhe, and genus. Results are invalidated when the combinatorial diagram changes or a different document is selected.

- Component count and pairwise oriented linking numbers.
- Knot determinant and Fox 3-coloring counts, using exact integer elimination and modular linear algebra. Determinant is shown for single-component knots only. The coloring count includes the three constant colorings; nonconstant colorings are reported separately. These matrix calculations support up to 200 crossings.
- Jones polynomial, normalized to 1 for the unknot, via the writhe-normalized Kauffman bracket. Exact state expansion supports up to 18 crossings and half-integer exponents for links.

Calculations run in a cancellable Web Worker, keeping drawing responsive. Unsupported sizes are reported explicitly rather than approximated. The worker and its dependencies are cached for offline use.

Tests include the unknot, trefoil and mirror, figure-eight, Hopf link and mirror, unlinks, R1/R2/R3 equivalence, braid stabilization, exact large integers, calculation limits, worker messages, cancellation, stale results, and tab changes. These are automated Node tests, not physical device tests.

## Version history and rollback

See `CHANGELOG.md`. The original six commits are preserved, with annotated release tags:

| Tag | Commit | Release |
| --- | --- | --- |
| v1 | `9fbf988` | Initial import |
| v2 | `5df475b` | English UI |
| v3 | `747a1a6` | Document tabs, crossing spacing, eraser fix |
| v4 | `8b55e5b` | R1 drag assistance |
| v5 | `71a74d0` | Bigon/kink protection |
| v6 | `f98759e3bd78758956a9af142ef6cb4b5a179528` | Invariant calculator |
| v7 | See annotated tag `v7` | Protect only alternating, non-R2 bigons |
| v8 | See annotated tag `v8` | Allow new R1 self-crossings with protection enabled |
| v9 | See annotated tag `v9` | Connecting arcs pass under existing arcs |
| v10 | See annotated tag `v10` | Tap the active tab title to rename it |
| v11 | See annotated tag `v11` | Make the closed diagram alternating |

The backup/CI commit follows v6 and does not change application behavior. It is not a new Sites deployment. Tags identify source commits; saved Sites version numbers are separate deployment checkpoints.

### Backup and future releases

Use English for repository documentation, commit messages, issue and pull-request text, and release notes.

In the existing Sites checkout, `origin` remains the Sites source repository and `github` points to `https://github.com/lunarjg/knot-lab.git`. Never embed credentials in remote URLs or tracked files. No collaborators are required for this private backup.

```sh
git status
git remote -v
git push github main
git push github --tags
git ls-remote --heads --tags github
```

Before every future production deployment, run all five tests above, make a tested commit, choose a new unused release tag (for example v18 for the next application release), and create an annotated tag:

```sh
git tag -a v18 -m "Describe the tested application release"
git push github main
git push github v18
```

Do not move existing tags, force-push, or rewrite shared history. Wait for GitHub Actions to pass on the intended commit. Then use the existing Sites workflow: push that exact source state to Sites, save a version for its full commit SHA, and deploy it to the same project. Preserve `.openai/hosting.json`, the site address, and its access level. GitHub Actions only runs tests and has read-only repository permissions; it contains no deployment job or Sites credentials.

### Roll back the live Sites deployment

Select and redeploy a previously saved Sites version to the **same existing project**. This changes what visitors receive without changing GitHub branches or tags. Record which saved version and source commit were restored. A GitHub push, a local checkout, or a Git revert alone never changes the live site. After a deployment rollback, verify the served version and service-worker update behavior in a real browser; previously cached clients can require a reload.

### Roll back source history without rewriting it

For inspection only, use `git switch --detach v6` in a clean checkout; return with `git switch main`. This changes only the local working tree.

To undo a selected change on the shared branch, first identify its full SHA with `git log --oneline`, ensure the worktree is clean, and use `git revert <commit-sha>`. Resolve any conflicts, run all five tests, and push the resulting new commit. For merge commits or several dependent changes, inspect the history and plan the reverts before applying them. Do not use `reset --hard` or force-push as the shared-history rollback method. If the reverted source should go live, give the tested result a new annotated release tag and complete the separate Sites save/deploy workflow.

### What the backup does not contain

Source history does **not** back up visitors' diagrams, document tabs, browser-local autosave, or local undo history. Users must export their diagrams as JSON and keep those files separately. The static JavaScript is delivered to browsers and can be inspected, but visitors receive no repository write permission or Sites deployment permission.

CI and the local test commands use automated Node mock environments. They do not establish real Safari rendering, touch behavior, Apple Pencil hardware behavior, or production service-worker behavior; validate those separately when making UI/input/offline changes.

### Strand eraser

Erase strand removes the touched arc between consecutive crossings or open endpoints. Its hover preview shows that arc only. Boundaries stay fixed throughout one gesture so removing a crossing cannot cascade into deleting the rest of the component. Crossing-free loops are one strand. Erase segment remains available for small local cuts. Remaining pieces stay open and can be joined again; surviving crossing heights, JSON/autosave and undo/redo are preserved.
