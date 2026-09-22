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
- Each document tab has its own diagram, zoom/pan position, and undo/redo history.
- Tap the active tab's name to rename it. Select an inactive tab first, then tap its name again. Enter or tapping outside saves the name; Escape cancels. F2 also starts editing. Names and suggested export filenames are autosaved without changing diagram undo history.
- **Save**: export the current tab as JSON. On iPhone and iPad this offers the native share sheet; every other platform downloads the file directly, and a share that fails falls back to a download so an export is never lost.
- **Autosave**: restore open tabs and diagrams on the next visit. Undo stacks last only for the current session.
- **Import PD**: replace the current diagram with a PD code; Undo restores the previous diagram.
- Drag the inspector's left handle to resize it. Drag it to the right edge and release to hide the panel.
- Use the arrow on the right edge to reopen the inspector.

The Eraser has three modes, cycled with <kbd>E</kbd>: **Erase strand** removes one strand between crossings or endpoints, **Erase segment** rubs out only what the cursor covers, and **Erase curve** removes the whole curve under the pointer — the way to take one component off a link without disturbing the others. Hovering in that mode highlights the entire curve that would go. Its options bar also carries **Clear all**, so emptying the canvas does not need the inspector; that is one undo step, the same as the inspector's button.

Display defaults: orientation arrows are **off** and the background grid is **on**; both are in Settings → Display.

The lasso takes either shape: **Freehand** traces a loop around what you want, **Rectangle** just drags a box. The shape is independent of the Whole curves / Region choice, so all four combinations work.

Selections made with the lasso can be moved (drag inside the box), rotated (the handle above it) and resized (the grip at the bottom-right corner). Resizing is uniform — a non-uniform scale would distort the strands without making the diagram easier to work with — and keeps the selection centred, so the diagram grows in place. Like moving and rotating, the whole resize is one undo step.

PD input accepts `[[a,b,c,d], ...]` or `PD[X[a,b,c,d], ...]`. The first label is the incoming understrand; the remaining labels proceed counterclockwise. Each arc label must appear twice. Import supports up to 80 crossings. If a layout is too crowded to construct reliably, an error is shown and the existing diagram is preserved. Crossing-free components cannot be represented by PD code alone.

The displayed Turaev genus is the value for the current diagram, not the minimum over all diagrams of the knot.

## Alternating decomposition

The **Alt. decomposition** view, alongside the all-A, all-B and Seifert state views, shows Thistlethwaite's decomposition of the diagram into its maximal alternating pieces, in the form used by Armond and Lowrance.

Read the diagram D as a 4-valent plane graph. An edge of it is *nonalternating* when the strand is the overstrand at both of its ends, or the understrand at both. Mark every nonalternating edge with two points and, inside each face, join the marked points that are adjacent along the boundary without lying on the same edge; the arcs close up into disjoint simple closed curves that cut the sphere into maximal *alternating regions*. The *alternating decomposition graph* G has one vertex per curve and one edge per nonalternating edge of D, and an alternating diagram gives a single vertex with no edges.

The view is laid out the way the paper's figures are. The **alternating regions are shaded**, each one ringed by the closed curves that bound it, so a shaded patch is a vertex of G. The diagram itself stays neutral — the shading already says which region a strand is in. The middle piece of each nonalternating edge, the part that is an edge of G, is a heavy bar between its two marked points, coloured + blue for an overstrand edge and − orange for an understrand edge.

A region should be a comfortable neighbourhood of its tangle rather than a sleeve on it, so the curve is placed halfway across whatever corridor it is in, up to a target thickness. Where the corridor is narrow that is the middle of it; where it opens out the curve stops at the target instead of drifting off. Shortening would otherwise pull it straight back onto the strand it came from, so the thickness is set rather than pushed for.

Within that, a curve is drawn as the shortest curve of its kind. It has to pass through its marked points, it has to stay clear of every strand, and it has to stay clear of every other curve; length is then minimised under those rules, which pulls it taut around its alternating tangle and takes the slack and the notches out of it.

Taut is not the same as convex: wherever the curve comes round an obstacle it leaves a dip behind it. So once the shortening has stopped moving, the same step runs again with only its outward half kept. Dips fill, nothing already bulging is pulled back in, and the curve walks out towards its own convex hull as far as the clearances allow. A dip is measured against a window of eleven points rather than against the point's two neighbours, since filling one over two points at nine pixels apart still leaves a corner. Where a region stays long and thin, that is the diagram: its tangle is a chain of crossings that other strands run between, and a rounder region would have to swallow one of them.

A curve under tension is a string: where it is not held against something it runs straight, so a dent left in one is a dent something is holding. The relaxation walks each point downhill a step at a time and settles into whatever local minimum it is nearest, which does leave dents that nothing holds. So the arcs are also pulled taut outright — the chord between two points of an arc replaces everything between them whenever that chord is one the curve is allowed to take, which is the same rule the relaxation obeys asked globally rather than a step at a time. A chord can miss every strand and still close over one, since a strand that loops inside the pocket it cuts off crosses neither the chord nor the arc, so the pocket is asked directly whether anything is in it before the shortcut is taken.

Shortening a curve is a heat flow, so a dent takes about as many rounds to fill as the square of its width in points — and at the drawn spacing the wide dents in a big diagram are never reached. A 63-crossing diagram still had grooves in it after 400 rounds. So the curve is pulled taut on a coarse copy of itself first, at four times the spacing with a quarter of the points and the same shapes sixteen times sooner, and the spacing is halved back down to the drawn one as it goes. Every rule holds at every level, since they are written in pixels rather than in points, and a level that stops moving hands what is left to the next one straight away instead of spending its budget. Whether the relaxation is still going anywhere is asked of the length it is minimising rather than of its furthest point: one point stuck against a strand used to hold that test open for ever, so anything bigger than a few crossings never reached the convexifying phase at all, and everything paid for the whole budget whether it needed it or not.

What is left when the shape has settled is a pixel or two of raggedness, from each point being placed against whichever strand happens to be nearest it and the placement jumping where the nearest one changes. A dozen passes of plain smoothing take that off, under two rules that keep it from being another relaxation: no point may end up further than a clearance from where the relaxation left it, and the clearance is re-imposed after every move, so smoothing can never walk a curve into a strand.

The clearance rule is the first principle rather than an afterthought, and it is checked rather than assumed. Every move a point makes is swept against everything near it and stopped short of the first thing it would have crossed, and is additionally required to leave both of the segments it drags crossing the diagram exactly as often as they did before — a point's own path can miss a strand that one of its segments sweeps over. The relaxation then stops every five rounds and asks whether each curve is still simple, still disjoint from the others, and still meeting D exactly once per marked point. A curve that fails is put back to the last state that passed, and one that keeps failing is left there. The drawing is therefore always a legal decomposition curve.

Where the marked points sit on their edge is not fixed. The paper puts two points on each nonalternating edge without saying where, so they are free to slide, and each round they move a little towards whichever way shortens the two arcs meeting there — subject to staying clear of the crossings at either end, leaving a bar between them, and not straying far from where they started. Held still they pinched every region to a neck at each nonalternating edge whatever the rest of the relaxation did; left completely free, shortening walks both points onto the crossings, which is shorter and says less. A marked point moves under the same rule as every other point: the segments it carries must go on crossing the diagram exactly as often as they did, and the chord must still cross its own edge once, or the move is dropped.

Each curve is kept as the arcs between its marked points, re-spaced as it shortens; without that, points crowd onto a pin and the curve folds over its own marked point. For drawing, the points that sit on a straight run are dropped and every corner is rounded with a fillet — kept at full density a corner is one point wide and rounds over almost nothing.

The overlay geometry is computed only when that view asks for it, and only once per edit. Anything that is still moving strands about — a gesture, or auto-relax stepping the whole diagram — shows the plain diagram until it stops, and the decomposition comes back then. Rebuilding it on every frame of an auto-relax run made that button look as though it had hung.

Relaxing the curves is a few hundred milliseconds of arithmetic, which is long enough to be felt, so it is never done on the way to the screen. It is written as a generator that gives the thread back between rounds, and the app drives it about six milliseconds per frame: the diagram paints as soon as the gesture ends and the overlay arrives shortly after, rather than the page freezing at every release. A run started while the strands are still moving is dropped rather than finished, and only one ever runs at a time. Starting a run from the previous one's curves was tried and taken out — it is twice as quick, but the error accumulates over a chain of edits until curves are crossing strands, so every run starts clean.

Every alternating region is tinted the same. They are already told apart by the curves that separate them, and a colour per region suggested a difference between tangles that is not there. How strongly they are tinted is a setting, from the 22% they have by default down to none at all.

The signs are a setting too. Colouring each edge of G by its sign and writing + or &minus; beside it is an annotation on the edge rather than the edge itself, so it switches off on its own: the bar stays, drawn neutrally, and the glyphs go. The graph figure in the inspector always shows the signs, since the way they alternate around a vertex is what makes a parallel class countable. The marked points themselves carry no dot — the two ends of a bar are exactly where they are.

The region a curve bounds is filled from the curve itself by the even-odd rule: crossing any boundary curve toggles in and out of the region. Which way round that reads is settled by one crossing of the region, since the region holding the point at infinity has to be filled the other way about.

The inspector's **Alternating decomposition** section reports the counts and draws **G on its own** — a disk per decomposition curve and an arc per nonalternating edge, with the arcs of a parallel class bowed apart and interleaved by sign so the multiplicity can be counted. Edge colour is the sign there too, and the signs alternate around every vertex.

G determines the Turaev surface, so the app computes the Turaev genus a second time, from the graph alone: the recursion of Corollary 3.9 never looks at the diagram, and its answer must equal the g<sub>T</sub>(D) read off the all-A and all-B state counts at the top of the inspector. The panel says which it is. Tests check the two against each other, and against a third computation — the genus of the twisted ribbon embedding of G, which is the Turaev surface itself — on 2460 diagrams.

The drawing is tested, not just the numbers. Every drawn curve is required to be simple, disjoint from the others, and to meet D exactly at its own marked points — which is what says it encircles its own tangle and never strays into a neighbouring one — to separate the crossings of the region it bounds from the middle pieces of the edges of G that meet it, and to shade that region over the first set and none of the second.

Method: [Armond and Lowrance, "Turaev genus and alternating decompositions", *Algebr. Geom. Topol.* 17 (2017) 793–830](https://doi.org/10.2140/agt.2017.17.793).

## Geometry and editing behavior

- Resampling drops a polyline point once it is merely close to its neighbor, not only when it sits exactly on an unchanged straight chord; at very small scale (well under typical on-screen drawing size) this can occasionally let a resample-only step (an auto-relax frame, or even a true no-op) shift or drop a crossing with no user movement.
- A drag rounds off its own sharp corners when it ends, and takes up the slack around the grip while it is in progress; the standalone smoothing actions remain available for everything else.
- A drag that pushed crossings into each other eases them back apart when it ends, by an adjustable distance, and turns each one back open so the strands still meet at a readable angle. Both are switched off together in Settings.
- The drag radius (Drag strand tool's options bar, 10 to 160, default 60) is also on <kbd>+</kbd> and <kbd>−</kbd>, which work from any tool and clamp to the slider's own range. Because the options bar is only on screen for the Drag strand tool, the keys report the new value in a toast rather than silently changing a number that is not visible.
- A lasso selection can be resized by its corner grip, as well as moved and rotated. Auto-relax shrinks a diagram as it runs — measured at about 12% of its span over 600 steps, with no floor — and a small diagram is harder to edit precisely, so the grip is how you scale it back up without redrawing it.
- Adding a whole curve to the diagram — pasting, dropping a moved selection, or drawing a new closed loop — is not a Reidemeister move, so `reconcile` runs in an `integrate` mode for it: the matching pass still carries every crossing it recognises across with its id and over/under, and only genuinely new crossings are assigned. Validating it as a Reidemeister move instead made the match fail, and the fallback rewrote the heights of crossings that had never moved.
- A drag can never change the knot type. That is covered by a test that drags four knots across the canvas at three drag radii from four grab points and requires the Jones polynomial to be unchanged every time.
- The exported PD code is verified against the drawn diagram by a test that computes the Kauffman bracket from the PD integers alone and compares it with the geometry, with the PD read back through the independent importer, and with published polynomials.
- A drag holds the vertex it grabbed: the distance still to travel is measured on that same vertex, and the grab is re-anchored to it after each step so resampling cannot walk it backwards along a stretched strand.
- R2 matching requires the two crossings to be adjacent along both strands — nothing else that *appeared or vanished in the same step* may sit between them — with a generous distance cap (`R2_REACH`) as a sanity check rather than as the test itself. Crossings that were already there and did not change do not count: a strand passing through the bigon an R2 just created enters and leaves across that bigon's own boundary, so it necessarily leaves a crossing on one of the two arcs, and that is an ordinary thing for a drag to produce rather than evidence of a pass-through. R3 matching is still by proximity. The classification decides only whether a step is accepted; it is not displayed, so a step sampled exactly on an R3 slide's triple point being classified as two R3s rather than one has no visible effect.
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
- Only real topology (Reidemeister validity) gates a drag or auto-relax step — there is no separate size or distance floor on bigons, kinks, or crossing spacing. Crossings are free to pass arbitrarily close together, or briefly overlap, as long as the move is valid; the optional release-time separation is the one correction that can follow, after the gesture is over.
- The precise eraser outline follows pointer-down, drag, coalesced samples, and release coordinates. One erase gesture remains one undo step.
- Regression checks cover batch file opening, selected tabs, mouse/pen/touch erasing, crossing proximity, and the original Reidemeister classification.

## Drawing and joining open arcs

When a drawn stroke starts or ends at an existing open endpoint, its new connecting segments pass **under** existing arcs at new crossings, including older parts of the same arc and closed components. Previously assigned crossings retain their heights. Open arcs display undercrossing gaps, but remain excluded from knot/link invariant calculations until closed.

The crossing choices survive later joins and closure, either closure order, undo/redo, document tabs, JSON export/import, and browser autosave. JSON files may contain an optional `crossingMemory` array of `[x, y, overDirectionX, overDirectionY]` records; older files without that field remain supported. The draw hint explains the joining rule in English. Free strokes and the separate drag-under setting keep their existing defaults.

Self-crossings are allowed through valid R1/R2 moves: a drag can cross a strand over itself to form a new curl, and can straighten one out again, with no automatic assistance either way. A step that carries a strand clean across another one is accepted too, since it is just the reverse of the R2 that would undo it; only a contradictory height order (R2 with different overstrands, or a cyclic R3) is still rejected.

When a drag ends, the strand's sharp corners are smoothed automatically, inside the drag's own undo step. That pass is cosmetic only — any smoothing that would add or remove a crossing is rolled back, so it never quietly undoes a curl that was just made.

While a drag is in progress, the same smoothing runs each step over the stretch of strand around the grip (out to three drag radii), so pulling on a strand that is already stretched takes up its slack and draws it back in instead of letting it fold into a sharp spike. The pass shares the **Smooth corners** setting: turning that off restores the plain behavior, where re-pulling a stretched strand only ever lengthens it. Because it runs inside the same validated step as the movement itself, it cannot change the topology — but it does round off the very tight curl a grip would otherwise leave right at the grabbed point, so a deliberate tiny self-crossing made exactly under the cursor wants **Smooth corners** off.

## No size or distance floor on dragging or auto-relax

A drag or an auto-relax step is gated only by real topology (Reidemeister validity, via `reconcile`) — there is no separate size floor on bigons or kinks, and no minimum distance floor between crossings. "Real topology" is enforced strictly: every crossing that appears or disappears has to be accounted for as an R1 kink or as half of an R2 bigon that is genuinely empty (the two crossings adjacent along both strands, with no third crossing between them). A step that cannot be accounted for is a strand sliding through another one, which would change the knot, so it is rejected and rolled back rather than accepted. Blocking is rare in practice: over random editing drags it refuses none of them, and only the deliberate attempt to haul a strand clean through another runs into it. Crossings are free to pass arbitrarily close together, or briefly overlap, for as long as the move stays a valid Reidemeister move. Nothing gates or corrects the geometry while the gesture is in progress; the one correction that can follow is the release-time separation below, and switching it off restores exactly the old behavior of keeping whatever the gesture left.

## Separating overlapping crossings

**Separate overlapping crossings** (Settings → Dragging, on by default) runs once a drag ends. Any two crossings the drag pushed into each other repel slightly, like weak magnets, until they clear the **Separation distance** — a slider in the same section, 10 to 60, default 30. Raising it to about 24 is where the two crossings' drawn undercrossing breaks (which reach `min(12, 8/view.s)` either side) can no longer touch at any zoom; the default deliberately sits at the bottom of the range, nudging only enough to pull a genuine overlap apart.

Pushing a pair apart stretches the arcs between them, which leaves both strands running nearly parallel through each crossing — separated, but too flat to read. At a 60-unit gap the crossing angles collapse from 67° to 15°. So a second pass turns each crossing the gesture flattened back open to at least 40°, by displacing the strand along `u(s) = A·s·exp(−s²/2σ²)` times the normal: `u(0) = 0`, so the crossing itself does not move, while the tangent there turns by `A` and the effect dies away within a couple of σ. It costs almost nothing in distance (measured 70.8 → 70.9 units) and, like the separation, is rolled back if it would change the topology. Only crossings this gesture created or made shallower are touched; one that was already flat is left as it was drawn.

The order matters in both directions: separation runs **before** the drag-end corner smoothing (smoothing first pulls a squeezed bigon tighter, ending at a 5.2-unit gap instead of 27.2), and the angle opening runs **after** it (smoothing straightens the curve, which otherwise flattens a tightly separated pair straight back — measured 40° down to 11°).

Three properties keep it from acting behind the user's back:

- **Only pairs the gesture tightened move.** Pairwise crossing distances are snapshotted by id when the drag starts; a pair is eligible only if it is newly formed, or measurably closer than it was then. A diagram that was already drawn tight — an import, or a deliberately crowded region — is left exactly as it is.
- **It cannot change the topology.** Every nudge goes through the same `attemptStep` as any other move and is rolled back unless the crossing count and the Reidemeister event counters both come back untouched. Separating can never add, remove, or reorder a crossing.
- **A pair with nowhere to go is skipped, not forced.** It is recorded as stuck and the pass moves on to the pairs that can still separate, so one wedged pair does not stop the rest.

The nudge rides the drag's own undo step, so one undo takes back the drag and the separation together. It runs before the drag-end corner smoothing, not after: smoothing first pulls a squeezed bigon tighter, and measured on a tight fixture that ordering ends at a 5.2-unit gap instead of 27.2.

## Make an alternating diagram

Use **Make alternating** under **Diagram actions** on the inspector’s **Diagram** page. The operation changes over/under assignments so that crossing visits alternate along every closed component, including the cyclic join. It keeps the projected curves fixed and selects the fewest crossing changes for that fixed projection, independently across disconnected pieces. This is not a search over other projections or a knot invariant, and crossing changes can change the knot/link type. Open arcs are excluded.

The entire conversion is one undo/redo step. Existing invariant calculations are canceled and their results invalidated. Already-alternating or crossing-free diagrams need no change; the button is disabled. An inconsistent crossing order fails without editing the diagram.

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
