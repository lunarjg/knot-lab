# Seifert / Homogeneous research

Open **Inspector → Research** for a closed oriented diagram. This mode reads the editor's finalized components and reconstructed crossings. Open arcs suspend research certification. Selection, smoothing previews, calculations and exports do not alter the diagram or add undo steps.

## Mathematical model

1. **Oriented smoothing.** At each crossing, join an incoming half-edge to the outgoing half-edge of the other strand. The implementation reuses `KC.analyze().info[].Sf`, not a second smoothing or sign convention. Tracing the resulting directed-arc permutation gives the Seifert circles. Crossing-free components each contribute one circle.
2. **Signed Seifert multigraph.** A vertex represents a Seifert circle; each original crossing contributes its own signed edge, with its crossing ID. Parallel edges are never merged. Circle IDs are derived from the least crossing-ID/incident-branch pair on the circle, and remain stable under coordinate changes that retain those crossings. IDs are local diagram identifiers, not knot invariants; reconstruction, Reidemeister moves or reimport can change them.
3. **Blocks.** An iterative edge-stack Tarjan DFS finds articulation vertices and maximal biconnected edge blocks. The parent *edge* is skipped, so other parallel edges remain back edges. Bridges count as dyad blocks of rank zero. Isolated vertices are retained separately and contribute no edge block. Each connected block has rank `E − V + 1`.
4. **Homogeneity.** Every edge block must be entirely positive or entirely negative. Opposite signs in different blocks are allowed. A mixed block fails the diagram test. A homogeneous diagram certifies that the represented knot/link is homogeneous; a non-homogeneous diagram does **not** prove the knot/link non-homogeneous. Self-loops, non-bipartiteness or inconsistent surface counts are diagnostics, never certificates.
5. **Surface genus.** With `c` crossings, `s` circles, `μ` link components and `k` canonical-surface components, `χ = s − c` and the **sum of the genera of this diagram's canonical surfaces** is `(2k − μ − s + c)/2`. When the surface is connected, `k = 1`; for a knot this is `(c − s + 1)/2`. This is not the minimum canonical genus over all diagrams. For a homogeneous knot diagram, Cromwell's minimal-surface result additionally certifies the knot genus. No knot-genus certificate is issued for a failed/unknown test or for a multi-component link.

These definitions follow [Cromwell](https://doi.org/10.1112/jlms/s2-39.3.535) and [Manchón](https://arxiv.org/abs/1102.0890), particularly the latter's graph definition, block decomposition and minimal-genus corollary ([journal PDF](https://msp.org/pjm/2012/255-2/pjm-v255-n2-p06-p.pdf)). The graph algorithm follows the standard [biconnected-component DFS](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.components.biconnected_components.html), adapted to edge identities in a multigraph.

## Visualization

The signed graph shows circle IDs (`S…`), crossing IDs (`X…`), crossing signs, separate parallel edges, block colours and double rings at articulation vertices. Select an edge to highlight its crossing. Enable **Select crossings in the diagram** to make canvas taps read-only crossing selections; disable it to resume normal editing. Closing the inspector also disables interception. Select a block to highlight its crossings and incident circles. Select a circle to see its coloured oriented smoothing and ID. The existing Seifert renderer supplies the smoothing geometry.

Graph coordinates are only a deterministic illustration; they are not included as mathematical data. Large graphs can scroll, and the circle/edge list remains available for selection.

## Exact Jones coefficient data

The existing invariant worker and BigInt state-sum engine are unchanged. Normalization remains `V(unknot) = 1`, `V(t) = (−A³)^(−w) ⟨D⟩`, `A = t^(−1/4)`. Structured terms store `power2 = 2 × exponent` and decimal-string integer coefficients. Thus link half-exponents and arbitrarily large coefficients remain exact. No rendered polynomial is parsed and no floating-point evaluation is used to test triviality.

Research records include the normalized polynomial, minimum/maximum exponents, their difference (span), the lowest/highest and next-lowest/next-highest **occupied** coefficients, and the nonzero term count. A single-term polynomial has no second occupied coefficient (`null`). `isTrivialJones` is true exactly for the sole term `(power2: 0, coefficient: "1")`; it is not an unknot certificate. An absent, canceled or limited Jones computation gives `null`, never false or zero.

Jones calculation retains the existing limit of **18 crossings**. Coloring/determinant retain their limit of 200 crossings. The research panel reuses any current invariant result and invalidates stale results on relevant edits or tab changes. The primary state-model reference is [Kauffman, State Models and the Jones Polynomial](https://www.maths.ed.ac.uk/~v1ranick/papers/kauffmanjones.pdf); the existing engine's [Kauffman reference](https://arxiv.org/html/2204.12104v2) explains the same normalization.

## Local batch datasets

Batch analysis runs reconstruction and calculation in a separate Web Worker. It never loads a PD-only mathematical state into the editor. Each PD uses `PDImport.fromPD`, including its crossing reconstruction checks, before `KC.analyze` and research analysis. Failed rows retain their name and error; later rows continue. Progress counts completed rows. Cancellation immediately terminates the worker and keeps completed records; restarting discards the previous batch. Editor tabs and their undo history are independent of batch work.

Accepted formats:

```text
Trefoil: PD[X[1,4,2,5], X[3,6,4,1], X[5,2,6,3]]
Curl: [[1,2,2,1]]
```

```json
[
  {"name":"Trefoil", "pd":[[1,4,2,5],[3,6,4,1],[5,2,6,3]]},
  {"name":"Unknot", "unknot":true}
]
```

JSON also accepts a single PD, arrays of PD codes, and an object with a `diagrams` array. CSV/TSV uses a `name` column and `pd`, `pd_code` or `pd_notation` column; quote the PD field in CSV. JSON research exports with a `records` array and nonempty PD fields can be analyzed as datasets, but statistics exports do not replace diagram save files, particularly for crossing-free components omitted by PD notation.

Up to 10,000 rows and a 5 MB input are accepted; the existing PD importer allows at most 80 crossings per row. Batch exact Jones is optional and retains its 18-crossing limit. No website is contacted to fetch a dataset. Native DT/KnotScape generator files and spreadsheets need conversion to one of the supported PD formats; arbitrary source formats are not guessed.

The [KnotInfo database](https://knotinfo.org/) and [downloads](https://linkinfo.knotinfo.org/homelinks/database_download.php) are potential local PD/invariant sources. Preserve each dataset's orientation and mirror conventions when comparing Jones values. [Stoimenow's canonical-genus paper](https://stoimenov.net/stoimeno/homepage/papers/gen2.pdf) and [generator tables](https://stoimenov.net/stoimeno/homepage/ptab/) explain the **4,017 genus-3 generators**: these generate families under further diagram operations and are not a complete finite list of genus-3 knots. This release does not download or enumerate those families.

## Deterministic exports and experiments

JSON has `format: "knot-lab-research"`, `version: 1`, and a `records` array. Every valid record contains the name, crossing/component/sign counts, writhe, circle count, Euler characteristic, surface component count, canonical genus, homogeneity/certified-genus fields, full signed graph, circles, blocks, articulation vertices, block signs/ranks, finalized PD, Jones terms/statistics/status, determinant, Fox colouring count, pairwise linking numbers, all-A/all-B counts, adequacy and Turaev genus. Unknown quantities are JSON `null`. Self-loop/bipartite/genus inconsistencies appear in `diagnostics` and suppress certification.

CSV uses a fixed header with the corresponding scalar research fields, block sign/rank lists and diagnostics; unavailable cells are empty. Exact coefficients stay decimal strings in JSON and decimal text in CSV. Spreadsheet applications may coerce CSV numbers, so use JSON or import those columns as text for exact arithmetic. Names beginning with a spreadsheet formula marker receive a protective apostrophe in CSV. Neither export includes time-dependent metadata.

Batch columns can be sorted; numeric, boolean and exact-coefficient filters can be combined. Unknown values do not satisfy numerical or boolean filters. **Homogeneous genus 3 knots** selects `μ = 1`, genus 3, and a successful homogeneity test. Export follows the active filters and sort order. Pagination limits rendered rows without dropping records.

For such samples, compare the minimum and maximum coefficients, block signs/ranks, articulation count, adequacy, Turaev genus and Jones span. The records support searching for failures of `|a_min| = 1 or |a_max| = 1` and for small spans. These are experimental data, not proofs, knot equivalence tests or a complete classification.
