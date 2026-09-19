# Knot Diagram Lab

A static web app for drawing and analyzing knot diagrams with pen, touch, and mouse input, including on iPad.

- Live site: [Sites](https://jgkim.piano5788.chatgpt.site), deployed through Sites, and its [GitHub Pages mirror](https://lunarjg.github.io/knot-lab/), auto-deployed from `dist/` on every push to `main` by `.github/workflows/pages.yml`.
- [Private source backup](https://github.com/lunarjg/knot-lab).
- The application UI and repository documentation are in English.

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

Keep using the existing Sites project and production address. The GitHub backup does not require creating a new site or changing its audience or editing permissions. Separately, `dist/` is also auto-deployed to a GitHub Pages mirror at every push to `main`; it serves the same static files but is independent of the Sites deployment and its own save/rollback workflow.

The owning account manages source editing and publication through Sites. Visitors are not granted repository or publication permissions. The application has no server API for changing shared diagram data: drawing, opening files, and autosaving happen in each visitor's browser.

## Interaction update

- Open files is next to the document tabs. Each selected JSON opens in its own tab; invalid files do not replace existing documents or prevent subsequent files from opening.
- Only real topology (Reidemeister validity) gates a drag or auto-relax step — there is no separate size or distance floor on bigons, kinks, or crossing spacing. Crossings are free to pass arbitrarily close together, or briefly overlap, as long as the move is valid.
- The precise eraser outline follows pointer-down, drag, coalesced samples, and release coordinates. One erase gesture remains one undo step.
- Regression checks cover batch file opening, selected tabs, mouse/pen/touch erasing, crossing proximity, and the original Reidemeister classification.

## Drawing and joining open arcs

When a drawn stroke starts or ends at an existing open endpoint, its new connecting segments pass **under** existing arcs at new crossings, including older parts of the same arc and closed components. Previously assigned crossings retain their heights. Open arcs display undercrossing gaps, but remain excluded from knot/link invariant calculations until closed.

The crossing choices survive later joins and closure, either closure order, undo/redo, document tabs, JSON export/import, and browser autosave. JSON files may contain an optional `crossingMemory` array of `[x, y, overDirectionX, overDirectionY]` records; older files without that field remain supported. The draw hint explains the joining rule in English. Free strokes and the separate drag-under setting keep their existing defaults.

Self-crossings are allowed through valid R1/R2 moves: a drag can cross a strand over itself to form a new curl, and can straighten one out again, with no automatic assistance either way — existing topology checks still reject invalid R2/R3 moves and unclassified strand passages that could change the knot type.

## No size or distance floor on dragging or auto-relax

A drag or an auto-relax step is gated only by real topology (Reidemeister validity, via `reconcile`) — there is no separate size floor on bigons or kinks, and no minimum distance floor between crossings. Crossings are free to pass arbitrarily close together, or briefly overlap, for as long as the move stays a valid Reidemeister move; whatever the diagram is left holding when the gesture ends is exactly what stays, with no automatic separation or correction afterward. A tangential touch that never actually crosses to the other side still does not register as a crossing at all.

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

Do not move existing tags, force-push, or rewrite shared history. Wait for GitHub Actions to pass on the intended commit. Then use the existing Sites workflow: push that exact source state to Sites, save a version for its full commit SHA, and deploy it to the same project. Preserve `.openai/hosting.json`, the site address, and its access level. GitHub Actions runs two separate workflows: `ci.yml` runs tests only, with read-only repository permissions; `pages.yml` deploys `dist/` to the GitHub Pages mirror on every push to `main`. Neither workflow has Sites credentials or touches the Sites deployment.

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
