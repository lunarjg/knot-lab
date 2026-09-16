# 매듭 도식 실험실

아이패드의 펜·터치 입력으로 매듭 도식을 그리고 계산하는 정적 웹앱입니다.

## 파일 구성

- `dist/index.html`: 화면, 매듭 기하 엔진, Reidemeister 이동 판정, 계산, 파일별 탭, 파일 저장·복원
- `dist/pd-import.js`: PD 입력 검증과 평면 도식 구성
- `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icon-*.png`: 홈 화면 설치와 오프라인 지원
- `tests/*.test.cjs`: 기하·PD·작업 상태·오프라인 회귀 검사
- `.openai/hosting.json`: 현재 Sites 프로젝트의 배포 설정. 다른 Sites 프로젝트를 만들 때는 해당 프로젝트의 설정을 사용하세요.

외부 패키지 설치나 빌드 과정 없이 `dist` 폴더를 정적 웹서버로 제공하면 됩니다. 서버로 도식 데이터를 전송하지 않습니다. 자동 저장은 기기 브라우저의 로컬 저장소를 사용합니다.

## 로컬 실행

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
node tests/offline.test.cjs
```

R1/R2 생성·소멸, R3 왕복과 삼중점 중간 프레임, 허용되지 않는 높이 관계, PD 계산값 보존, 파일별 탭의 독립성, 저장·복원 및 서비스 워커의 오프라인 경로를 검사합니다.

화면 상태와 서비스 워커 검사는 Node의 모의 환경을 사용합니다. 실제 Safari의 렌더링이나 Apple Pencil 하드웨어 입력을 검증하는 브라우저 테스트는 아닙니다.

## 사이트 소유권과 데이터

이 사본은 현재 계정의 별도 Sites 프로젝트로 게시합니다. 이전 계정의 사이트 주소나 권한은 변경하지 않습니다.
사이트 코드의 수정 및 재게시 권한은 Sites에서 소유 계정으로 관리하며, 방문자에게 편집 권한을 부여하지 않습니다.
앱에는 공유 데이터를 수정하는 서버 API가 없습니다. 그리기·파일 열기·자동 저장은 각 방문자의 브라우저에서만 작동합니다.

## Interaction update

- Open files is next to the document tabs. Each selected JSON opens in its own tab; invalid files do not replace existing documents or prevent subsequent files from opening.
- Keep crossings apart is on by default for strand dragging, with a 20-screen-pixel minimum. Existing dense diagrams can spread out. The check also guards the swept crossing path and rolls back rejected geometry and crossing IDs. Turn it off for R2/R3 moves requiring close crossings.
- The precise eraser outline follows pointer-down, drag, coalesced samples, and release coordinates. One erase gesture remains one undo step.
- Regression checks cover batch file opening, selected tabs, mouse/pen/touch erasing, crossing proximity, and the original Reidemeister classification.
