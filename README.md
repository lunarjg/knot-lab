# Knot Diagram Lab

아이패드의 펜·터치 입력으로 매듭 도식을 그리고 계산하는 정적 웹앱입니다.

- 운영 사이트: https://jgkim.piano5788.chatgpt.site (Sites 배포)
- 비공개 소스 백업: https://github.com/lunarjg/knot-lab
- 웹사이트 UI는 영어를 유지합니다. GitHub push와 CI 실행은 Sites 운영 배포를 수행하지 않습니다.

## 파일 구성

- `dist/index.html`: 화면, 매듭 기하 엔진, Reidemeister 이동 판정, 계산, 파일별 탭, 파일 저장·복원
- `dist/pd-import.js`: PD 입력 검증과 평면 도식 구성
- `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icon-*.png`: 홈 화면 설치와 오프라인 지원
- `dist/invariants.js`, `dist/invariants-worker.js`: 정확한 불변량 계산과 취소 가능한 Web Worker
- `tests/*.test.cjs`: 기하·PD·작업 상태·불변량·오프라인 회귀 검사
- `.github/workflows/ci.yml`: push 및 pull request 시 Node.js 22/24 자동 검사
- `.openai/hosting.json`: 현재 Sites 프로젝트의 배포 설정. 기존 project_id와 dist 정적 경로를 유지하세요.

외부 패키지 설치나 빌드 과정 없이 `dist` 폴더를 정적 웹서버로 제공하면 됩니다. 서버로 도식 데이터를 전송하지 않습니다. 자동 저장은 기기 브라우저의 로컬 저장소를 사용합니다.

## 로컬 실행

Git, Node.js 22 이상, Python 3이 필요합니다. npm 패키지 설치나 빌드 단계는 없습니다. 비공개 저장소를 읽을 수 있는 GitHub 계정으로 인증한 뒤 복제합니다.

```sh
git clone https://github.com/lunarjg/knot-lab.git
cd knot-lab
node --version
```

이 명령으로 새로 복제한 사본은 GitHub가 `origin`입니다. 기존 Sites 작업 사본에서는 Sites를 `origin`으로 유지하고 GitHub는 별도 `github` remote로 사용합니다. 서로 다른 사본의 remote를 혼동하지 않도록 push 전에 `git remote -v`를 확인하세요.

Python 3이 설치된 컴퓨터에서 이 폴더를 연 뒤 실행합니다.

```sh
python3 -m http.server 8000 --directory dist
```

브라우저에서 `http://localhost:8000`으로 접속합니다. 홈 화면 설치와 서비스 워커의 오프라인 사용은 HTTPS 또는 localhost 환경을 사용하세요. 로컬 HTML 파일을 직접 열면 서비스 워커는 작동하지 않습니다.

다른 정적 호스팅 서비스에서는 `dist` 안의 파일들을 사이트 루트에 배포하면 됩니다. 사이트 내용을 업데이트할 때는 `dist/sw.js`의 캐시 이름도 변경하세요.

## 사용

- 위쪽 `＋` 버튼: 빈 도식을 새 탭에 생성
- `열기`: JSON 파일을 새 탭에 열기. 여러 파일을 한 번에 선택할 수 있음
- 파일 탭: 도식, 확대·이동 위치, 실행 취소·다시 실행, 이동 횟수를 각각 유지
- `저장`: 현재 탭을 JSON으로 내보내기. 이동 횟수도 파일에 포함됨
- 자동 저장: 열린 탭과 도식·이동 횟수를 다음 접속 때 복원. 실행 취소 스택은 현재 세션에서만 유지
- `PD 불러오기`: 현재 탭의 도식을 PD 코드로 교체. 실행 취소 가능
- 오른쪽 패널의 왼쪽 손잡이: 너비 조절. 오른쪽 끝으로 밀고 놓으면 숨기기
- 오른쪽 가장자리의 화살표: 패널 다시 펼치기

PD 입력은 `[[a,b,c,d], ...]` 또는 `PD[X[a,b,c,d], ...]` 형식을 받습니다. 첫 번호는 들어오는 아래 현이며 나머지는 반시계 방향입니다. 각 현 번호는 두 번 나타나야 합니다. 최대 80개 교차까지 처리하며, 수치적으로 너무 촘촘한 배치는 오류 메시지와 함께 기존 작업을 유지합니다. 교차 없는 성분은 PD 코드만으로 표현되지 않습니다.

계산되는 Turaev genus는 현재 도식에 대한 값입니다. 매듭 전체의 최소 genus를 구하는 것은 아닙니다.

## 이번 수정

- 재샘플링에서 짧은 꼭짓점을 무조건 삭제하던 동작을 변경: 실제 이동 없이 교차가 사라지고 R2로 집계되던 재현 사례 수정
- 현을 끄는 도중의 자동 모서리 보정 제거. 별도의 다듬기 기능은 유지
- R2는 양쪽 현에서 인접한 교차가 빈 이각형을 이루는지 검사
- R3는 빈 삼각형의 세 현에서 교차 순서가 모두 바뀌는지와 높이 관계를 검사
- 정확히 삼중점에 걸친 중간 프레임은 마지막 정상 도식과 비교해 중복 집계 방지
- 실행 취소·다시 실행 시 이동 횟수도 함께 복원
- 파일별 탭, 여러 파일 열기, 탭별 자동 저장 및 기존 단일 작업 저장의 이전 지원

## 검사

Node.js 22 이상에서 프로젝트 폴더를 기준으로 실행합니다.

```sh
node tests/moves.test.cjs
node tests/pd.test.cjs
node tests/app.test.cjs
node tests/invariants.test.cjs
node tests/offline.test.cjs
```

R1/R2 생성·소멸, R3 왕복과 삼중점 중간 프레임, 허용되지 않는 높이 관계, PD 계산값 보존, 파일별 탭의 독립성, 저장·복원 및 서비스 워커의 오프라인 경로를 검사합니다.

화면 상태와 서비스 워커 검사는 Node의 모의 환경을 사용합니다. 실제 Safari의 렌더링이나 Apple Pencil 하드웨어 입력을 검증하는 브라우저 테스트는 아닙니다.

## 사이트 소유권과 데이터

기존 Sites 프로젝트와 운영 주소를 계속 사용합니다. GitHub 백업을 위해 새 사이트를 만들거나 공개 범위·편집 권한을 변경하지 않습니다.
사이트 코드의 수정 및 재게시 권한은 Sites에서 소유 계정으로 관리하며, 방문자에게 편집 권한을 부여하지 않습니다.
앱에는 공유 데이터를 수정하는 서버 API가 없습니다. 그리기·파일 열기·자동 저장은 각 방문자의 브라우저에서만 작동합니다.

## Interaction update

- Open files is next to the document tabs. Each selected JSON opens in its own tab; invalid files do not replace existing documents or prevent subsequent files from opening.
- Protect non-R2 bigons and Protect R1 kinks independently constrain the size of those regions during dragging. R2-compatible bigons and other crossing pairs have no size floor. Minimum areas are adjustable; existing undersized protected regions may expand. Rejected moves restore geometry and crossing IDs.
- The precise eraser outline follows pointer-down, drag, coalesced samples, and release coordinates. One erase gesture remains one undo step.
- Regression checks cover batch file opening, selected tabs, mouse/pen/touch erasing, crossing proximity, and the original Reidemeister classification.

## R1 drag assistance

Small empty monogons near the dragged strand can now straighten during a drag (enabled by default). Loops containing a closed component or intersecting an open stroke are protected. The candidate must remove exactly one R1 crossing while preserving every surviving crossing and its over/under strands. The action is included in the drag undo step and move counts. Disable “Loosen small R1 loops while dragging” to retain curls.

## Bigon and kink size protection

The old all-pairs crossing-distance guard is replaced by tracing bounded one-edge (R1 kink) and two-edge (bigon) faces, using the full curved boundaries. **Bigon size protection applies only when each boundary strand is over at one crossing and under at the other**, which prevents R2 removal. When the same boundary strand is over at both crossings, the bigon is exempt from all size floors (area, thickness, and crossing separation), allowing it to shrink for R2 removal. Classification follows the actual boundary occurrences, including two strands belonging to the same component; it does not compare component IDs or raw crossing indices.

Default minimum areas remain 400 screen px² for protected bigons and 180 screen px² for kinks, separately adjustable. The guard also checks effective thickness (2 × area / perimeter; 8 px for protected bigons, 6 px for kinks) and a 16 px crossing separation for protected bigons. Limits scale with the current zoom. Existing undersized protected faces can grow but cannot shrink further. Valid disappearance of a face is still handled by the Reidemeister checks, and local R1 untwisting remains available.

Regression cases cover fixed crossing positions with a collapsing bigon, a single-crossing kink, thin regions with sufficient area, independent controls, zoom, cyclic seams, near-zero area, R3 through a triple point, pointer-driven dragging, and rollback.

Additional cases compare identical geometry with the two possible over/under patterns, R2 shrink/disappear/reappear and move counts, one-component bigons, mirrored height order, reversed occurrences, and pointer dragging with protection enabled.

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

The backup/CI commit follows v6 and does not change application behavior. It is not a new Sites deployment. Tags identify source commits; saved Sites version numbers are separate deployment checkpoints.

### Backup and future releases

In the existing Sites checkout, `origin` remains the Sites source repository and `github` points to `https://github.com/lunarjg/knot-lab.git`. Never embed credentials in remote URLs or tracked files. No collaborators are required for this private backup.

```sh
git status
git remote -v
git push github main
git push github --tags
git ls-remote --heads --tags github
```

Before every future production deployment, run all five tests above, make a tested commit, choose a new unused release tag (for example v8 for the next application release), and create an annotated tag:

```sh
git tag -a v8 -m "Describe the tested application release"
git push github main
git push github v8
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
