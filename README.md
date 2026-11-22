# portfolio

김가원 소개 및 포트폴리오 사이트. 홈서버 gawon-dev 에서 직접 운영함.

- 주소: https://gawon-dev.tail7c7524.ts.net (도메인 없이 Tailscale Funnel 로 공개)
- `main` 에 push 하면 홈서버의 GitHub Actions runner 가 테스트 후 자동 배포함

## 구조

```
apps/web/        Next.js 16 (App Router) 페이지. 홈, 포트폴리오, 블로그, 피드
apps/api/        NestJS 12 + Mongoose API (방문 수, 메시지, 서버 상태, 하이파이브, 피드, 블로그와 글 사진, 프로필 사진)
scripts/         포트폴리오 PDF 생성기와 테스트, PDF 용 글꼴(IBM Plex Sans KR, OFL), 로컬 개발 실행기
deploy/          배포 스크립트, compose, Caddyfile, Actions runner 사용자 유닛, 1회성 서버 설정
.github/workflows/deploy.yml
```

### apps/web 폴더 (Feature-Sliced Design)

gadoc, GoLe 와 같은 FSD 레이어로 나눈다. 위 레이어는 아래 레이어만 import 하고, 같은 레이어끼리는 서로 부르지 않는다 (`apps/web/eslint.config.mjs` 의 `boundaries/dependencies` 가 검사, CI 의 `npm run lint`). 슬라이스 밖에서는 `index.ts` 로만 가져다 쓴다.

```
src/
  app/         라우팅만. layout, page, 메타데이터, 옛 주소 리다이렉트 (community.html/route.ts)
               맨 바깥 layout 에서 로그인 상태(SessionProvider)와 로그인 창을 한 번만 둠. 페이지를 옮겨도 다시 받지 않음
    (site)/    홈(/), 포트폴리오(/portfolio). 다른 화면과 같은 상단 바(계정 칸 포함)
    feed/      피드(/feed/*). 가입 확인, 비밀번호 재설정 메일 링크 창을 여기 둠
               (board)/ 에 묶인 피드 화면에만 피드 머리를 두고, 관리실(/feed/admin)은 머리 없이 뜸
    blog/      블로그(/blog/*). 피드 계정으로 로그인, 빈 책상의 로키
  views/       화면 조립: home, portfolio, feed, post, post-editor, profile, admin, blog, blog-post, blog-editor
  widgets/     큰 화면 조각: site-header, site-footer, feed-header, account-menu, laptop(스티커), deploy-receipt,
               guest-terminal(숨은 터미널, 가짜 파일 시스템, tree 이스터에그), portfolio-sheet, post-list, comment-thread, server-topology, admin-inbox, admin-reports,
               blog-search(검색창과 분류 칩), blog-post-grid(카드 목록), blog-sidebar(주인 소개, 분류, 태그), blog-lock(잠긴 글 자리, 항복 문서), admin-blog-access(열람 요청과 허락 명단),
               admin-members(회원 수, 가입 막대, 회원 명부와 상세), rocky(빈 책상을 굴러다니는 로키 공)
  features/    한 가지 동작: theme-toggle(스탠드), open-terminal, copy-email, high-five, send-postcard, auth, write-post, manage-post,
               write-comment, report-content, edit-profile, change-password, change-avatar,
               write-blog-post(노션처럼 바로 바뀌는 편집기, 사진 올리기, 표지 고르기, 노션 붙여넣기, 공개 범위 고르기), manage-blog-post, prove-theorem(풀 수 없는 문제와 메모장, AI 빨간 펜 채점), request-blog-access,
               change-member-role(관리실에서 관리자 지정, 해제)
  entities/    도메인 데이터와 API: portfolio(내용 원본), server-status, visit, user(세션, 사진), post, comment, message, report,
               blog-post(글 API, 마크다운 그리기, 콜아웃), blog-access
  shared/      공통: api(fetch 도우미), config(주소), lib(날짜, 저장소, 한국어 줄바꿈 다듬기, 한글 글꼴 미리 받기), ui(Sheet, Dialog, FormStatus), styles(색 토큰, 바탕)
```

- 슬라이스 안은 `ui/`(컴포넌트와 그 CSS), `model/`(상태, 훅, 타입), `api/`(요청), `lib/`(순수 함수) 로 나눈다
- 스타일은 옛 정적 페이지의 클래스 이름을 그대로 두고, 쓰는 슬라이스 옆에 CSS 파일로 나눠 둠. 색과 글꼴은 `shared/styles/tokens.css`, 피드 공통은 `shared/styles/community.css`
- 포트폴리오, 홈의 글자는 서버에서 미리 그려 보내고(정적 생성), 서버 상태, 피드처럼 바뀌는 것은 브라우저에서 `/api` 를 불러 채움

### apps/api 폴더 (DDD)

영역(bounded context)마다 폴더를 두고, 그 안을 네 계층으로 나눈다. 규칙은 `apps/api/test/architecture.spec.ts` 가 검사한다 (CI 의 `npm test`).

```
src/
  main.ts, setup.ts, app.module.ts
  config/env.ts        환경변수 검사
  shared/              여러 영역이 같이 쓰는 조각
    domain/            ID 모양 같은 순수 규칙
    application/       응용 계층 도우미 (ID 가 틀리면 404)
    http/              같은 사이트 확인, JSON 만 받기, ADMIN_TOKEN, 방문자 해시, 입력 다듬기
    crypto/            세션, 메일 링크 비밀 토큰
    events/            영역 사이 이벤트 (예: 이름이 바뀌면 피드가 글쓴이 이름을 고침)
    infrastructure/    메일(SMTP), 사진 저장소(MinIO), 텔레메트리, Mongo 도우미
  modules/
    identity/          계정: 가입, 로그인, 세션, 역할과 권한, 프로필 사진
    feed/              피드: 글, 댓글, 신고, 회원 페이지
    blog/              블로그(gawon-log): 주인장 글, 공개 범위, 열람 요청과 허락
    messages/          홈 엽서 쪽지, 관리실 쪽지함
    visits/            홈 누적 방문 수
    high-fives/        하이파이브
    deploys/           배포 기록
    ops/               헬스체크, 홈서버 노트북 상태, 관리실 '지금 서버' 구성도
    backoffice/        관리실 요약 (새 쪽지, 신고 수). 여러 영역 숫자를 모으기만 함
```

| 계층 | 하는 일 | 쓸 수 있는 것 |
|---|---|---|
| `domain/` | 엔티티 모양, 규칙(누가 글을 읽을 수 있나 등), 저장소와 바깥 서비스의 약속(추상 클래스) | 같은 영역의 domain, `shared/domain` 만. Nest, Mongoose 를 모름 |
| `application/` | 유스케이스. 약속(추상 클래스)만 보고 일을 시킴. 실패는 Nest 예외로 알림 | domain, 다른 영역의 `index.ts`, `shared` |
| `infrastructure/` | Mongo 스키마와 저장소 구현, 메일 어댑터 | domain, application, `shared` |
| `presentation/` | 컨트롤러, DTO, 가드, 로그인 쿠키 | application, domain, 다른 영역의 `index.ts`, `shared` |

- 다른 영역은 그 영역의 `index.ts` 로만 가져다 쓴다. 계정을 읽을 때는 컬렉션을 직접 읽지 않고 `UserDirectory` 를 쓴다
- 약속(추상 클래스)과 구현은 `<영역>.module.ts` 의 `{ provide: 약속, useClass: 구현 }` 으로 잇는다
- 주소(`/api/community/*`, `/api/blog/*` 등)와 Mongo 컬렉션 이름은 예전 그대로다. 피드를 처음 만들 때 붙인 `community_*` 이름도 데이터가 있어 바꾸지 않는다

## 페이지

상단의 홈, 포트폴리오, 블로그, 피드 탭으로 페이지를 이동한다. 각 페이지는 책상을 위에서 내려다본 디자인을 공유한다. 상단 바 오른쪽의 계정 칸(로그인 전에는 로그인, 뒤에는 관리실, 내 페이지, 로그아웃)은 모든 화면에 있다.

- `/` 홈: 스티커 붙은 홈서버 노트북, 페이지 안내, 배포 영수증과 엽서
- `/portfolio`: 소개, 경력, 프로젝트, 기술, 이력을 담은 종이 포트폴리오. 목차는 이 페이지 안에서만 이동
- `/blog`: 주인장(`owner` 역할)만 쓰는 블로그. 아래 '블로그' 참고
- `/blog/posts/<글_ID>`, `/blog/write`, `/blog/posts/<글_ID>/edit`: 글 읽기, 새 글 쓰기, 글 고치기
- `/feed`: 긴 글과 댓글을 읽고, 이메일 확인을 마친 계정으로 작성하는 피드
- `/feed/posts/<글_ID>`, `/feed/write`, `/feed/posts/<글_ID>/edit`: 글 읽기, 새 글 쓰기, 내 글 고치기
- `/feed/users/<회원_ID>`: 회원 페이지. 프로필 사진, 이름, 소개, 쓴 글. 내 페이지에서는 사진과 프로필을 고치고 비밀번호 변경, 로그아웃, 화면 설정(로키 보이기)을 함
- `/feed/admin`: 관리실 (아래 RBAC)
- 정적 페이지 시절 주소도 그대로 열림. `/portfolio.html`, `/index.html` 은 새 주소로, `/community.html?post=`, `?user=`, `?edit=`, `?write=`, `?admin=` 은 해당 피드 화면으로 영구 이동(308)
- 옛 `/#about`, `/#projects` 등의 링크는 해당 포트폴리오 섹션으로 이동

- 노트북 스티커는 끌어서 옮길 수 있음. 위치는 방문자 브라우저에만 저장
- 노트북 LED 와 영수증은 `/api/server` 를 10초마다 불러 실제 가동 시간, CPU 온도, 배터리, 배포 커밋을 보여 줌
- 영수증의 '최근 배포' 품목은 실제 배포 기록 5건 (`/api/deploys`). `deploy/deploy.sh` 가 배포를 마칠 때마다 커밋, 제목, 걸린 시간, 성공이나 되돌림을 남김
- 누적 방문 수는 같은 IP 를 브라우저와 상관없이 평생 한 번만 셈. IP 원문은 저장하지 않고 salt 섞은 해시만 남김 (2026-11-21 전까지는 30분마다 다시 셌고, 그때까지의 수에 이어서 더함)
- 오른쪽 위 스탠드 버튼으로 밝은 화면과 어두운 화면 전환
- 하이파이브 버튼: 연타를 모아 보내고, 한 사람이 하루 50번까지 셈
- 상단의 터미널 버튼이나 `` ` `` 키로 어느 페이지에서든 숨은 터미널이 열림. 사이트를 폴더처럼 돌아다님 (`apps/web/src/widgets/guest-terminal`)
  - `~` 가 홈이고 `portfolio/`(about, work, projects, skills, history), `blog/`, `feed/`(posts, write, admin), `server`, `note`, PDF 가 들어 있음. `feed/posts` 와 `blog` 는 API 에서 최근 글 10개를 받아 글 ID 이름의 파일로 보여 줌. 잠긴 블로그 글을 `cat` 하면 Permission denied
  - `ls`, `cd`, `pwd`, `cat`, `open`, `tree <경로>`, `history`, Tab 자동 완성. `cd` 로 다른 페이지 디렉터리에 가면 실제로 그 페이지로 옮기고 터미널을 닫음. 다시 열면 기록과 위치가 이어짐
  - `git log` 는 진짜 저장소 대신 홈서버의 배포 기록을 보여 줌 (`--oneline`, `-n 5`). `mail gawon` 은 이름, 답장 메일, 메시지를 차례로 묻고 `.` 만 있는 줄에서 홈 엽서와 같은 쪽지함으로 보냄
  - 그 밖에 `neofetch`, `curl /api/health`, `hi5`, `lamp`, `pdf` 등
  - 인자 없이 `tree` 를 치면 크리스마스 트리 이스터에그. 줄기가 서고, 잎이 코드 글자로 흐르며 아래에서부터 자라고, 전구가 감기고, 별이 꽂힌 뒤 돌기 시작함 (`widgets/guest-terminal/lib/christmas-tree.ts`). q 또는 Esc 로 나가고, 12월 1~25일에는 첫인사에 살짝 알려 줌

## 블로그

- 글은 주인장만 쓰고, 글마다 공개 범위를 고름. 새 글은 '허락한 사람만'으로 시작함 (넋두리를 실수로 공개하는 쪽이 더 곤란해서)
- 화면은 다른 페이지와 같은 책상 위에 종이 카드를 늘어놓는 블로그 모양. 목록의 제목, 검색창, 분류 칩, 카드는 포트폴리오, 피드와 같은 920px 가운데 단에 놓아 탭을 옮겨도 자리가 같음. 1920px 이상 넓은 모니터에서는 빈 책상이 너무 넓어서 단을 1236px 로 넓혀 카드를 4장씩 놓음(카드 한 장 크기는 같음). 주인 소개, 분류별 글 수, 태그 사이드바는 단 옆에 따로 빼서 제목부터 목록 끝까지 세로로 길게 차지하고, 스크롤하면 화면 위에 붙어 따라옴(화면보다 길면 사이드바 안에서 스크롤). 넓은 화면(1520px 이상)에서는 단 왼쪽 책상 위에, 그보다 좁으면 사이드바와 단을 나란히, 960px 이하에서는 맨 아래에 놓임. 글 화면은 가운데 종이 한 장에 제목, 날짜와 읽는 시간, 태그, 본문, 글 끝 소개 카드. 본문은 글쓰기 칸과 같은 종이 폭 전체를 써서 쓸 때 본 줄바꿈 그대로 읽힘
- 글마다 태그를 8개까지 붙임 (글쓰기에서 Enter 나 쉼표로 붙임). 목록은 주소의 `?tag=`, `?q=`(제목, 태그 검색), `?visibility=` 로 거르고, 사이드바 숫자는 `/api/blog/summary`
- 검색은 잠긴 글이면 제목과 태그만 뒤지고 본문은 보지 않음. 본문 검색은 누구나 읽는 글에서만 (주인장은 전부)

| 공개 범위 | 목록 | 본문 |
|---|---|---|
| `public` 전체 공개 | 누구나 | 누구나 |
| `approved` 허락한 사람만 | 누구나 제목만 (잠김 도장) | 주인장, 허락받은 회원 |
| `private` 나만 보기 | 주인장만 | 주인장만 (남에게는 없는 글, 404) |

- 목록의 잠긴 글 카드는 본문 자리를 기밀 문서처럼 줄로 지움(줄 모양은 글 ID 로 정함, 진짜 본문은 내려오지 않음). 마우스를 올리면 아래 '열어 보기' 가 빨간 펜 '풀 수 있으면 열릴지도...?' 로 바뀜. 문제는 글을 열어야 나와서 목록에서 농담이 새지 않음 (`entities/blog-post/ui/blog-card.tsx`)
- 허락받지 못한 사람이 잠긴 글을 열면 본문 자리에 '허락 없이도 볼 수 있을지도' 하는 풀 수 없는 문제(밀레니엄 난제 등 글마다 하나)와 노란 메모장이 나옴. 무엇을 써 내든 빨간 펜으로 0점. '더 쉬운 문제 주세요' 를 누르면 리만 가설, P = NP 에 이어 쉬워 보이지만 안 쉬운 문제가 차례로 나옴. 리만 가설과 P = NP 는 어느 글이든 한 번씩 나옴. 실제로 풀리는 문제(CSS 로 div 가운데 놓기, 1 + 1 = 2 공리 증명)는 '풀었는데 왜 안 열림' 소리가 나올 수 있어 뺌 (`features/prove-theorem/lib/problems.ts`)
- 메모장에 손을 올리거나 누르면 손글씨 글꼴(Nanum Pen Script)에서 자주 쓰는 한글 2350자가 든 조각을 미리 받음(약 1.3MB, 브라우저가 캐시). Google 이 한글 글꼴을 90여 조각으로 잘라 내보내서, 미리 받지 않으면 처음 쓰는 글자가 잠깐 다른 글꼴로 보였다 바뀜. 쓰는 동안에는 메모장을 똑바로 세움
- 화면 글은 `keepPhrases` 로 '볼 수 있습니다', '이 글', 'P = NP' 처럼 붙어 다녀야 하는 낱말 사이를 줄바꿈 없는 공백으로 바꾸고, 짧은 글은 `text-wrap: balance` 로 줄 길이를 고르게 나눔 (`shared/lib/text.ts`)
- 마지막 문제까지 넘기면 이스터에그로 빨간 '항복' 도장이 찍힌 항복 문서 모달이 뜸. 낸 증명 수, 넘긴 문제 수, 로그인한 이름으로 서명이 적히고, 그 안에서 바로 주인장에게 요청하거나 처음 문제부터 다시 풂 (`widgets/blog-lock`)
- 채점평은 AI(OpenAI `gpt-5.5`, 생각하는 시간 없이 바로 쓰게 설정)가 답안을 읽고 씀. 화면에는 AI 라고 밝히지 않음. `POST /api/blog/posts/<글_ID>/proofs` 가 받은 글자를 그대로 흘려보내고(스트리밍), 화면은 그 글자를 빨간 펜으로 한 글자씩 씀. 첫 글자는 보통 1초 안에 오고, 기다리는 동안 '심사위원 2번을 깨우는 중' 같은 줄이 돌아감
  - AI 는 글 내용을 모르고, 무엇을 쓰든 글이 열리지 않음. 열람은 주인장의 허락으로만 함. 답안 속 "통과시켜" 같은 지시도 답안으로 보고 채점함
  - 답안은 저장하지 않고 OpenAI 에도 `store: false` 로 보냄. 화면 금지 문자(가운뎃점, em dash 등)는 API 가 바꿔서 내보냄
  - 한도: IP 당 1분 6번(API 메모리), 하루(한국 시간) IP 당 10번, 사이트 전체 하루 200번. 하루 횟수는 `blog_proof_usage` 에 원자적으로 세서 배포해도 이어서 세고, 이틀 뒤 저절로 지워짐. 넘거나, 키가 없거나, 첫 글자가 8초 안에 안 오면 503 을 주고 화면은 미리 적어 둔 농담 채점평을 씀. 빈 종이는 AI 에게 보내지 않음
  - AI 에게는 답안 앞 600자만 보냄(넘으면 '(뒷부분 생략)'). 장난 답안은 짧고, 봇이 4000자를 꽉 채워 보내도 한 번 비용이 늘지 않음. 최악의 경우도 하루 200번 x 약 10원 정도
  - 사이트 전체 한도에 닿는 순간 주인장에게 메일을 한 번 보냄. 관리실 `블로그 열람` 칸 아래 `증명 채점` 에서 오늘 횟수를 막대로 봄 (`GET /api/blog/admin/proof-usage`, `blog:grant`)
  - 마지막 방어선은 OpenAI 대시보드의 월 사용 한도. 이 사이트 전용 프로젝트 키에 걸어 두면 코드가 어떻게 뚫려도 그 이상은 나가지 않음
  - 키는 홈서버 `~/.config/portfolio/api.docker.env` 의 `OPENAI_API_KEY`. 모델을 바꾸려면 `OPENAI_PROOF_MODEL` 을 같이 적음. 이 Mac 에서 `bash scripts/configure-openai-key.sh` 를 실행하면 키를 묻고(또는 `pbpaste |` 로 받아) Mac 키체인 `포트폴리오 블로그 OpenAI API` 에 두고 홈서버 설정에도 넣음. 다음 배포 때 API 컨테이너가 새로 뜨며 읽음
  - 로컬 `npm run dev` 는 같은 키체인 항목을 읽어 AI 채점을 켬. 없으면 미리 적어 둔 채점평만 나옴
- 그 아래 '주인장에게 요청하기'. 피드 계정으로 로그인한 회원만 보내고, 주인장에게 알림 메일이 감. 관리실의 `블로그 열람 요청` 에서 '이 글만 허락', '잠긴 글 모두 허락'(앞으로 쓸 글 포함), '거절' 중 하나로 답함. 허락하면 요청한 사람에게 메일이 감
- 거절된 요청은 3일 뒤에 다시 보낼 수 있음. 허락은 관리실의 `열람 허락 명단` 에서 언제든 거둠
- 본문은 API 가 허락된 계정에게만 내려 줌. 블로그 읽기 응답은 보는 사람마다 달라서 `Cache-Control: private, no-store`. 글 화면은 미리 그리지 않고 브라우저에서 로그인 상태를 확인한 뒤 받음
- 글을 공개나 나만 보기로 바꾸면 그 글에 온 요청은 지우고, 글을 지우면 그 글의 요청과 허락도 같이 지움
- 데이터는 `blog_posts`, `blog_images`, `blog_access_requests`, `blog_grants`, `blog_proof_usage` 컬렉션 (`apps/api/src/modules/blog`)

### 글 쓰기 (마크다운, 사진, 표지)

- 본문은 마크다운으로 씀. 노션에서 쓰던 제목, 굵게, 기울임, 취소선, 인라인 코드, 링크, 목록, 번호 목록, 체크리스트, 인용, 표, 코드 블록, 구분선, 사진을 그대로 그림 (`entities/blog-post/ui/blog-markdown.tsx`, react-markdown + remark-gfm)
  - 이모지로 시작하는 인용(`> 💡 내용`)은 노션 콜아웃처럼 포스트잇 상자로 그림 (`entities/blog-post/lib/remark-callout.ts`)
  - 코드 블록은 숨은 터미널과 같은 어두운 판에 언어 이름, 복사 단추, 문법 색을 붙임 (rehype-highlight)
  - 본문의 `#` 은 글 제목 아래 단계 제목으로 그림. 줄바꿈은 쓴 그대로 살려서 예전 줄글도 그대로 보임
  - 글 안의 HTML 은 그리지 않고 글자로만 둠. 링크의 `javascript:` 같은 주소도 걸러짐
- 글쓰기 편집기는 노션처럼 치는 대로 바로 모양이 바뀜 (Tiptap, `features/write-blog-post/ui/rich-editor.tsx`). 저장은 지금처럼 마크다운이라 읽는 화면과 예전 글은 그대로
  - `# ` 제목, `- ` 목록, `1. ` 번호, `[ ] ` 할 일, `> ` 인용, `> 💡 ` 콜아웃, ```` ```ts ```` 코드 블록, `---` 구분선, `**굵게**`, `*기울임*`, `` `코드` ``, `[글](주소)` 링크
  - 편집기 안에서도 읽는 화면과 같은 `.md` 스타일을 써서 쓰는 모양이 올린 모양과 같음. 코드 블록은 쓰는 동안에도 문법 색이 붙음
  - 위에 붙어 따라오는 도구 막대로도 같은 일을 하고, 커서가 있는 곳의 모양은 켜진 단추로 보임. 표 안에서는 줄, 칸 추가와 지우기 단추가 더 나옴. ⌘B, ⌘I, ⌘E, ⌘⇧S, ⌘K(링크)
  - '마크다운' 탭에서 원문을 바로 고칠 수도 있음
- 사진은 ⌘V 붙여넣기, 끌어다 놓기, '사진' 단추로 올림. 붙이는 순간 그 자리에 보이고(브라우저 안 임시 주소), 긴 변 2000px 이하 WebP(안 되면 JPG)로 다시 그려 올린 뒤 진짜 주소로 바뀜. 촬영 위치 같은 사진 속 정보(EXIF)가 빠짐. 커서는 사진 아래 줄로 옮겨서 바로 이어 씀
  - 올리는 동안의 임시 사진은 마크다운에 넣지 않고, 저장 단추도 막음
- 붙여넣기는 내용을 보고 바로 모양을 입힘
  - 노션 같은 웹 글(HTML)은 마크다운으로 바꿔 넣음 (turndown). 노션 사진 주소는 시간이 지나면 막혀서 빼고, 그 자리에 '사진을 다시 올려 주세요' 콜아웃을 남김
  - 마크다운 글(text)은 제목, 목록, 표 등으로 바로 바뀜. VS Code 에서 복사한 여러 줄 코드는 그 언어의 코드 블록이 됨
  - 글을 고른 채 주소를 붙이면 링크가 걸림
- API 는 `POST /api/blog/images` (`blog:write` 권한, 같은 출처만, 1시간 120장) 로 받아 파일 내용으로 JPG, PNG, WebP 인지와 5MB, 가로세로 4096px 이하인지 다시 확인하고 MinIO `community-media` 의 `blog/` 에 임의 파일 이름으로 저장함
- 사진은 `/api/blog/images/<파일>` 로 내보냄. 파일 이름이 바뀌지 않으므로 1년 캐시하고, 다른 사이트가 끌어다 쓰지 못하게 같은 출처에서만 읽힘
- 글을 저장하면 본문과 표지에 남은 사진만 그 글에 붙여 두고, 글에서 뺀 사진과 지운 글의 사진은 버킷에서도 지움. 올려 놓고 글에 쓰지 않은 사진은 7일 뒤 다음 사진을 올릴 때 치움
- 표지(썸네일)는 글쓰기에서 따로 고르고, 안 고르면 본문 첫 사진을 씀. 목록 카드 위에 16:9 로 보이고, 글 화면 맨 위에는 따로 고른 표지만 크게 놓음
- 잠긴 글은 본문 첫 사진을 표지로 쓰지 않음 (본문 일부가 새지 않게). 따로 고른 표지는 흐리게 보여 줌
- 사진 때문에 API 의 파일 받기 한도를 6MB 로 올렸고, 프로필 사진은 서비스에서 따로 1MB 로 막음
- 블로그 화면의 빈 책상에는 이스터에그로 소설 속 외계인 로키를 직접 그린 공이 굴러다님 (`widgets/rocky`, `app/blog/layout.tsx`)
  - 노트북, 데스크톱(마우스나 트랙패드, 1024px 이상)에서만 나옴. 휴대폰, 태블릿은 빈 책상이 좁고 손가락으로 잡기 어려워 엔진을 돌리지 않음
  - 종이, 카드, 사이드바가 없는 자리만 골라 걸어 다니고, 스크롤로 종이가 밑으로 들어오면 빈 곳으로 비킴. 빈 자리가 없으면 숨음
  - 생김새는 소설 묘사와 영화 스틸의 특징을 참고해 직접 그림: 마른 진흙처럼 금 간 황토빛 바윗덩이 몸, 무릎이 몸 위로 솟은 다리 다섯 개(납작한 돌판 두 마디, 골이 진 주름 관절, 세 손가락), 초록빛 도는 삼각 격자 제노나이트 공 (`widgets/rocky/ui/rocky-art.tsx`)
  - 누르면 화음(브라우저에서 직접 합성)과 함께 로키 말투의 대사를 하고, 말풍선의 '주먹 맞대기' 를 누르면 앞다리를 들어 공 벽에 주먹을 댐. '잠깐 쉬기' 를 누르면 그 탭에서만 숨음
  - 내 페이지의 '화면 설정' 에서 '로키 보이기' 를 켜고 끔 (코랩의 강아지 모드처럼). 이 브라우저에 남고(localStorage `rocky`), 켜면 쉬던 탭에서도 다시 나옴. 다른 탭에서 바꿔도 바로 반영됨 (`widgets/rocky/lib/preference.ts`)
  - 공을 잡아 끌고 던지면 화면 가장자리에 튕기며 구르고, 세게 던지면 로키가 공 안에서 같이 굴러 어지러워함. 화살표 키로도 밈. 마우스가 가까이 오면 그쪽을 돌아봄
  - 움직임 줄이기 설정을 켠 사람에게는 걷지 않고 빈 자리에 가만히 있음. 영화 이미지나 소리 같은 공식 자료는 쓰지 않음

## 피드 계정과 운영

- 글은 누구나 읽을 수 있고, 이메일 확인을 마친 회원만 글과 댓글을 작성, 수정, 삭제할 수 있음
- 가입 확인 링크는 1시간, 비밀번호 재설정 링크는 30분 동안 한 번만 사용함. 링크 토큰과 세션 토큰은 해시만 MongoDB에 저장함
- 비밀번호는 10자 이상이고 scrypt로 해시하며, 로그인 세션은 30일 만료 HttpOnly, Secure, SameSite=Strict 쿠키로 유지함. 로컬 HTTP 개발에서는 Secure 대신 별도 개발 쿠키를 사용함
- 게시글 본문은 줄바꿈을 살린 일반 텍스트다. 페이지는 사용자 글을 React 의 글자 노드로만 그리고 HTML 로 해석하지 않음
- 프로필 사진은 브라우저에서 가운데 기준 정사각형 512px 이하로 다시 그려 올림. 이때 촬영 위치 같은 사진 속 정보(EXIF)가 빠짐
- API 는 파일 내용으로 JPG, PNG, WebP 인지와 가로세로 2048px 이하인지를 다시 확인하고 MinIO 버킷 `community-media` 의 `avatars/` 에 저장함. 1MB 를 넘으면 413
- 버킷은 공개하지 않음. 사진은 `/api/community/avatars/<파일>` 로 API 가 읽어 내보내고, 사진을 바꾸면 새 파일 이름을 쓰므로 1년 캐시함. 옛 사진은 바꾸거나 지울 때 버킷에서도 지움
- 이름을 바꾸면 그동안 쓴 글과 댓글의 작성자 이름도 함께 바뀜. 이메일은 내 페이지에서 본인에게만 보임
- 가입, 로그인, 글쓰기, 댓글, 신고에는 요청 제한이 적용됨. 신고 내역은 아래 관리자 API로 확인하고 글과 댓글을 삭제할 수 있음
- 기존 MongoDB 백업은 `portfolio` 데이터베이스 전체를 덤프하므로 피드 컬렉션도 포함됨

메일을 설정하기 전에는 가입 탭이 비활성화되고 가입 API도 503으로 응답한다. 네이버 애플리케이션 비밀번호를 새로 발급한 뒤, 이 Mac의 터미널에서 다음 스크립트를 실행한다. 비밀번호 입력은 화면에 표시되지 않는다. 스크립트는 비밀번호를 Mac 로그인 키체인의 `포트폴리오 피드 네이버 SMTP` 항목에 저장하고, SSH 표준 입력으로 홈서버에도 전달한다. 홈서버의 환경설정 파일은 git에 넣지 않으며 권한 600을 유지한다.

```bash
bash scripts/configure-community-smtp.sh
```

나중에 비밀번호를 확인하려면 Mac의 **키체인 접근** 앱에서 `포트폴리오 피드 네이버 SMTP`를 검색하고 `암호 보기`를 선택한다. 저장된 값은 저장소나 채팅에 기록되지 않는다.
홈서버 설정만 다시 동기화할 때는 `bash scripts/configure-community-smtp.sh --from-keychain <네이버 메일 주소>`를 사용한다.

스크립트는 홈서버의 `~/.config/portfolio/api.docker.env`에 아래 값을 설정한다.

```dotenv
COMMUNITY_SMTP_USER=<네이버 이메일 주소>
COMMUNITY_SMTP_PASSWORD=<네이버 애플리케이션 비밀번호>
COMMUNITY_BASE_URL=https://gawon-dev.tail7c7524.ts.net
```

기본 SMTP 서버는 `smtp.naver.com:465`(SSL)이다. 다른 서버를 쓸 때만 `COMMUNITY_SMTP_HOST`와 `COMMUNITY_SMTP_PORT`를 추가한다. 이 설정에서는 네이버 메일 환경설정의 POP3/SMTP 사용을 켜고, 네이버ID의 2단계 인증 관리에서 별도 애플리케이션 비밀번호를 만든다. 기존에 발급한 애플리케이션 비밀번호의 값은 네이버에서 다시 볼 수 없다.

### 관리자 역할과 관리실 (RBAC)

권한은 역할 단위로 묶어 둔다 (`apps/api/src/modules/identity/domain/role.ts`). 회원 문서에는 역할만 적고, 서버가 요청마다 DB 의 역할에서 권한을 다시 계산한다. 그래서 역할을 바꾸면 이미 로그인한 세션에도 바로 반영된다.

| 역할 | 권한 |
|---|---|
| `member` (기본) | 없음. 글, 댓글, 신고, 내 페이지 같은 일반 기능만 씀 |
| `admin` | `messages:read`, `messages:delete` (홈 엽서 쪽지), `reports:read`, `reports:dismiss` (신고), `content:moderate` (남의 글과 댓글 삭제), `server:read` (지금 서버 구성도), `members:read` (회원 목록, 이메일 포함) |
| `owner` | 사이트 주인 한 사람. `admin` 권한 전부와 `blog:write` (블로그 글쓰기, 나만 보기 글까지 읽기), `blog:grant` (블로그 열람 요청 허락, 거절, 허락 거두기), `members:role` (회원을 관리자로 지정, 해제). 회원 페이지에 `주인장` 도장 |

- 내 글과 댓글만 고치고 지우는 규칙은 역할이 아니라 글쓴이가 누구인지로 따진다. 관리자도 남의 글 내용은 고칠 수 없고 삭제만 할 수 있다
- 관리자로 로그인하면 피드 위에 `관리실` 버튼과 새 쪽지 수가 보이고, `/feed/admin` 에서 쪽지함과 신고를 처리한다. 쪽지함을 열면 그때까지 온 쪽지는 읽은 것으로 바뀐다
- 관리실은 한 번에 한 칸(지금 서버, 회원, 블로그 열람, 쪽지함, 신고)만 펼친다. 칸은 종이 왼쪽 사이드 패널로 고른다. 1424px 이상에서는 종이를 다른 페이지와 같은 가운데 자리에 두고 패널만 왼쪽 책상 위에, 그보다 좁으면 패널과 종이를 나란히, 960px 이하에서는 종이 위 카드로 놓는다. 칸 이름 옆에는 새 쪽지, 신고, 기다리는 열람 요청 수가 빨간 숫자로 붙는다. 고른 칸은 주소의 `#server`, `#members`, `#blog-requests`, `#inbox`, `#reports` 로 남아서 블로그 머리와 알림 메일의 `/feed/admin#blog-requests` 링크가 그 칸을 바로 연다
- `회원` 칸: 가입 확인을 마친 회원, 최근 7일 가입, 확인 대기, 운영진 수와 최근 30일 날짜별 가입 막대, 이름이나 이메일로 찾는 회원 명부(가입일, 마지막 로그인). 회원을 누르면 이메일, 소개, 가입과 확인 시각, 마지막 로그인, 로그인해 둔 브라우저 수, 피드 글과 댓글 수가 보이고, 주인장은 그 자리에서 관리자로 지정하거나 해제한다 (`GET /api/community/admin/members`, `PATCH /api/community/admin/members/<회원_ID>/role`)
  - 마지막 로그인은 로그인할 때마다 계정 문서의 `lastLoginAt` 에 적는다. 2026-11-22 전에 로그인한 회원은 아직 열린 세션 중 가장 늦은 것의 시작 시각으로 어림한다
  - 목록은 이메일이 들어 있어 `Cache-Control: private, no-store`. 1000명까지 한 번에 받아 화면에서 찾고 거른다
- 관리자 계정의 회원 페이지에는 `운영자` 도장이 찍힌다
- 관리실의 `지금 서버` 칸은 방문자 → Tailscale Funnel → proxy(Caddy) → api(NestJS) → mongo, minio 구성도다. 2초마다 `/api/community/admin/topology` 를 불러, 실제 요청과 DB 명령, 사진 저장소 작업을 일어난 간격 그대로 점으로 흘려보낸다. 요청은 파란 점으로 api 까지 갔다가 응답 상태 색(정상 초록, 4xx 노랑, 5xx 빨강)으로 돌아오고, 칸마다 상태 불빛과 분당 횟수, 노트북 온도와 배터리, 최근 요청 12건이 같이 바뀐다
- 이 기록은 API 메모리에 최근 400건만 두고 재시작하면 비운다 (`apps/api/src/shared/infrastructure/telemetry`). 경로는 `:id` 같은 라우트 모양으로만, 방문자는 salt 섞은 해시로만 센다. 배포 헬스체크와 관리실 자신의 새로고침은 세지 않는다. 페이지 요청은 web(Next.js) 컨테이너가 받아 API 를 거치지 않으므로 API 요청만 보인다
- 페이지는 권한 목록으로 버튼만 보이거나 숨기고, 실제 허용 여부는 서버의 `PermissionGuard` 가 확인한다

주인장(`owner`) 지정은 서버의 `ADMIN_TOKEN` 으로만 한다. 관리자(`admin`) 지정과 해제는 주인장이 관리실 회원 칸에서도 할 수 있다. 주인장 자신과 다른 주인장의 역할은 페이지에서 바꿀 수 없고, 페이지에서 스스로 역할을 올리는 길은 없다. 이메일 확인을 마친 회원만 지정할 수 있다.

```bash
source ~/.config/portfolio/api.docker.env
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"<회원 이메일>","role":"admin"}' http://127.0.0.1:8090/api/community/admin/users/role
# 블로그 주인은 "role":"owner", 되돌릴 때는 "role":"member"
```

관리 API 는 관리자 세션 말고도 `ADMIN_TOKEN` 으로 쓸 수 있다. 토큰을 브라우저에 저장하거나 공개 페이지에 넣지 않는다.

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/community/admin/messages
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/community/admin/reports
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/community/admin/reports/<신고_ID>
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/community/admin/posts/<글_ID>
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/community/admin/comments/<댓글_ID>
```

## 포트폴리오 PDF

- `npm run build`(`npm run pdf`)가 `apps/web/src/entities/portfolio/model/content.ts` 를 읽어 `apps/web/public/gawon-portfolio.pdf` 를 만듦 (git 에는 안 올림). Next 가 `/gawon-portfolio.pdf` 로 내보냄
- 홈, 포트폴리오 페이지, 숨은 터미널(`cat portfolio/about`), PDF 가 모두 `content.ts` 를 읽음. 내용은 이 파일 한곳만 고치면 됨. PDF 생성기가 Node 로 바로 불러오므로 이 파일은 다른 모듈을 import 하지 않음
- 표시를 지우거나 구조를 바꿔서 내용을 못 찾으면 생성이 실패하고, 배포도 멈춤
- `npm test` 가 금지 문자(가운뎃점, em dash 등, `content.ts` 와 `apps/web/src` 전체)와 PDF 내용 추출을 검사함
- 로컬에서 바로 보려면 `npm run pdf`

## 다이어그램

원본은 `docs/diagrams/*.drawio` 이다. draw.io 앱으로 열어 고친 뒤 PNG 로 다시 내보낸다.

```bash
/Applications/draw.io.app/Contents/MacOS/draw.io --export --format png --scale 2 --border 24 \
  -o docs/diagrams/architecture.png docs/diagrams/architecture.drawio
```

![전체 구조](docs/diagrams/architecture.png)

![배포 파이프라인](docs/diagrams/deploy-pipeline.png)

## 서버 구성

포트폴리오는 Docker 컨테이너 다섯 개로 돎 (`deploy/docker-compose.yml`, 프로젝트 이름 `portfolio`).

```
인터넷 → Tailscale Funnel (HTTPS, gawon-dev:443)
           └─ 호스트 127.0.0.1:8090
                └─ proxy 컨테이너: Caddy                  (deploy/proxy.Dockerfile, deploy/Caddyfile)
                     ├─ /      → web 컨테이너 :3001      (Next.js standalone, apps/web/Dockerfile, PDF 포함)
                     └─ /api/* → api 컨테이너 :3000      (apps/api/Dockerfile)
                                  ├─ mongo 컨테이너 :27017 (mongo:8.0, 볼륨 portfolio_mongo-data)
                                  └─ minio 컨테이너 :9000  (pgsty/minio, 볼륨 portfolio_minio-data, 프로필 사진과 블로그 글 사진)
```

- 호스트에 열리는 포트는 `127.0.0.1:8090` 하나뿐. Docker 로 연 포트는 UFW 를 거치지 않아서 반드시 127.0.0.1 로 묶음
- DB 망(`data`)은 인터넷으로 나가는 길이 없고, mongo 와 minio 는 api 컨테이너에서만 닿음
- MinIO 가 공식 Docker 이미지 배포를 멈춰서 같은 소스를 빌드해 올리는 `pgsty/minio` 를 태그 고정으로 씀. 웹 콘솔은 끄고, 읽기 전용 파일 시스템과 모든 권한(capability)을 뺀 채로 돎
- API 는 MinIO root 가 아니라 `portfolio-api` 계정으로 붙음. 이 계정은 `community-media` 버킷의 객체 읽기, 쓰기, 삭제만 할 수 있고 목록 조회와 버킷 생성은 못 함. 버킷과 계정은 배포 때마다 `deploy/minio-ensure-bucket.sh` 가 확인함
- api, web 컨테이너는 `node` 사용자, 읽기 전용 파일 시스템, 모든 권한(capability)을 뺀 채로 돎. web 은 Next 캐시 폴더만 메모리(tmpfs)에 씀
- 노트북 센서(CPU 온도, 배터리)는 컨테이너에서도 호스트 `/sys` 가 그대로 보여서 따로 연결하지 않음

| 항목 | 위치 |
|---|---|
| 지금 돌고 있는 버전 | `~/portfolio/docker-release` (커밋 태그). 이미지는 `portfolio-api:<커밋>`, `portfolio-web:<커밋>`, `portfolio-proxy:<커밋>` 최근 3개 보관. 그 버전의 compose 파일은 `~/portfolio/docker-compose.release.yml` |
| API 환경변수 | `~/.config/portfolio/api.docker.env` (권한 600, git 에 없음. `MINIO_*` 포함) |
| Mongo 계정 | `~/.config/portfolio/mongo.env` (root 와 앱 계정 비밀번호, 권한 600) |
| MinIO 계정 | `~/.config/portfolio/minio.env` (root 와 `portfolio-api` 계정 비밀번호, 권한 600), `~/.config/portfolio/minio-backup.env` (사진 백업용 읽기 전용 `portfolio-backup` 계정 비밀번호, 권한 600, 없으면 deploy.sh 가 만듦) |
| 사진 백업 | `~/backups/minio/portfolio/<UTC 시각>/community-media/`, 매일 04:30(한국 시간) 사용자 타이머 `portfolio-minio-backup.timer`. 아래 '사진 백업' 참고 |
| 접속 로그 | `docker logs portfolio-proxy-1` (Caddy, JSON, 10MB 5개까지 보관). 페이지 서버 로그는 `docker logs portfolio-web-1` |
| Actions runner | `~/actions-runner`, `github-runner.service` (사용자 유닛, docker 그룹) |
| 예전 방식 | Docker 이전의 `portfolio-api.service`, `caddy.service`, `~/portfolio/site` 는 더 쓰지 않음. 배포 코드에서도 지움. 서버에서 정리하려면 `systemctl --user disable --now portfolio-api caddy && rm ~/.config/systemd/user/{portfolio-api,caddy}.service && rm -rf ~/portfolio/site` |

자주 쓰는 명령 (서버에서):

```bash
cd ~/actions-runner/_work/portfolio/portfolio
export PORTFOLIO_CONFIG=~/.config/portfolio RELEASE=$(cat ~/portfolio/docker-release)
docker compose -f deploy/docker-compose.yml ps          # 상태
docker compose -f deploy/docker-compose.yml logs -f api  # API 로그
# 버킷에 든 프로필 사진 보기 (root 비밀번호는 컨테이너 환경변수에서 읽음)
docker compose -f deploy/docker-compose.yml exec minio sh -c \
  'MC_HOST_local="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@127.0.0.1:9000" mc ls -r local/community-media'
```

### 사진 백업

- 블로그 글 사진과 프로필 사진(MinIO `community-media` 버킷)은 매일 04:30(한국 시간) 사용자 타이머 `portfolio-minio-backup.timer` 가 `~/backups/minio/portfolio/<UTC 시각>/` 에 통째로 받아 둠 (`deploy/minio-backup.sh`). Mongo 백업(관리 패널, 04:00)과 따로 돎
- 읽기 전용 계정 `portfolio-backup`(버킷 목록 보기와 읽기만)으로 내부 망 `portfolio_data` 의 minio 에 붙고, 지금 도는 minio 이미지 안의 `mc mirror` 를 씀. 따로 받는 이미지가 없음
- 사진 파일은 이름이 바뀌지 않아서 직전 백업과 같은 파일은 하드 링크로 나눠 씀. 날마다 전체가 들어 있지만 디스크는 새로 올린 사진만큼만 늘어남. 지운 사진은 그 뒤 백업에서만 빠지고 앞선 백업에는 남음
- 14일이 지난 백업은 지우고(가장 최근 것은 늘 남김), 노트북이 꺼져 있어 놓친 날은 다시 켜졌을 때 바로 백업함 (`Persistent=true`)
- 타이머와 스크립트는 배포 때마다 deploy.sh 가 `~/.config/systemd/user/`, `~/.local/share/portfolio/` 에 설치하고, 백업이 하나도 없으면 바로 한 번 받음
- 관리 패널(gawon-control)의 백업 모듈은 원본(kscold-control)을 따라가는 코드라 MongoDB 만 다루고, 사진 백업은 MinIO 를 가진 이 저장소가 맡음

```bash
systemctl --user list-timers portfolio-minio-backup.timer   # 다음 백업 시각
systemctl --user start portfolio-minio-backup               # 지금 바로 백업
journalctl --user -u portfolio-minio-backup -n 20           # 지난 백업 기록
ls ~/backups/minio/portfolio/                               # 백업 목록

# 되살리기: 고른 백업을 버킷에 다시 올림 (root 계정, 이미 있는 사진은 건너뜀)
SNAP=~/backups/minio/portfolio/<고른 시각>/community-media
docker run --rm --network portfolio_data --env-file ~/.config/portfolio/minio.env -v "$SNAP:/restore:ro" \
  --entrypoint sh "$(docker inspect -f '{{.Config.Image}}' portfolio-minio-1)" -c \
  'MC_HOST_local="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@minio:9000" mc --config-dir /tmp/mc mirror /restore local/community-media'
```

## 관리 패널 (gawon-control)

서버의 컨테이너는 관리 패널 [gawon-control](https://github.com/wongakim-99/gawon-control) 에서 봄 (kscold-control 기반, 비공개 저장소).

- 주소: `https://gawon-dev.tail7c7524.ts.net:8443` (Tailscale Serve, **내 tailnet 기기에서만** 열림. 공개 아님)
- tailnet 밖에서는 SSH 터널로: `ssh -L 4100:127.0.0.1:4100 homeserver` 후 `http://127.0.0.1:4100`
- 할 수 있는 것: 컨테이너 상태와 시작, 중지, 로그, 서버 CPU, 메모리, 디스크, Docker 정리, 웹 터미널(`docker` 명령), 감사 로그
- 백업: 대상 `portfolio` 를 매일 04:00 에 덤프, 14일 보관. 읽기 전용 계정(`portfolio-backup`)으로 내부 망(`portfolio_data`)에 붙어서 뜸. 파일은 서버 `~/backups/mongodb/portfolio/`
- MinIO 볼륨(`portfolio_minio-data`, 프로필 사진과 블로그 글 사진)은 패널이 아니라 이 저장소의 사진 백업 타이머가 매일 백업함 (위 '사진 백업')
- 관리자 비밀번호 변경: 관리 패널의 `권한 관리 → 사용자 목록 → 본인 계정의 열쇠 아이콘 → 변경`

새 서비스(예: gawon-log 블로그)를 올릴 때도 같은 방식으로 함: 자기 저장소에 compose 를 두고, 포트는 `127.0.0.1` 로만 열고, DB 는 내부 망에 둠. 패널은 서버의 모든 컨테이너를 자동으로 보여 줌.


| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB 연결까지 확인. 배포 스크립트가 사용 |
| GET | `/api/views` | 누적 방문 수 |
| POST | `/api/views` | 방문 기록. 같은 IP 는 평생 한 번만 셈 (`view_visitors` 에 IP 해시 표식) |
| GET | `/api/deploys?limit=10` | 최근 배포 기록 (커밋 앞 7자, 제목, 시각, 걸린 시간, 결과). 최대 30건 |
| POST | `/api/deploys` | 배포 기록 남기기. `Authorization: Bearer <ADMIN_TOKEN>` 필요. `deploy/deploy.sh` 가 씀 |
| POST | `/api/messages` | 메시지 남기기. IP 당 10분 3건, honeypot 으로 봇 차단 |
| GET | `/api/messages` | 최근 메시지 50건. `Authorization: Bearer <ADMIN_TOKEN>` 필요. 사이트에서는 관리실 쪽지함으로 봄 |
| GET | `/api/server` | 가동 시간, 부하, 메모리, CPU 온도, 배터리, 배포 커밋. 5초 캐시 |
| GET | `/api/high-fives` | 누적 하이파이브 수 |
| POST | `/api/high-fives` | `{ "count": 1~10 }`. 한 사람 하루 50번까지, IP 당 1분 20회 |

메시지 확인 (서버에서):

```bash
source ~/.config/portfolio/api.docker.env
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8090/api/messages
```

## 로컬 개발

```bash
npm install
npm run dev        # PDF 생성 후 API(메모리 Mongo, :3000)와 Next 개발 서버(:3001)를 같이 띄움. http://127.0.0.1:3001 에서 확인
                   # 로그를 따로 보려면 터미널 두 개에서 npm run dev:api, npm run dev:web
                   # Next 개발 서버가 /api 를 :3000 으로 넘겨 줌 (apps/web/next.config.ts 의 rewrites, 운영에서는 Caddy 가 맡음)
                   # MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY 를 함께 주면 사진 올리기도 켜짐 (없으면 꺼진 채로 뜸)
npm run typecheck  # API, 페이지 타입 검사
npm run lint       # 페이지 ESLint (Next 권장 규칙, FSD 레이어 경계)
npm run build      # 포트폴리오 PDF 생성 + API 빌드 + Next 빌드
npm test           # API 34건(e2e 는 메모리 Mongo, MinIO 는 메모리 가짜) + 페이지 단위 33건 + PDF 생성기 7건
```

## 배포 흐름

1. GitKraken 이나 터미널에서 `main` 에 커밋, push
2. 홈서버 runner 가 `npm ci → typecheck → lint → build(PDF 포함) → test → deploy/deploy.sh` 실행
3. `deploy.sh` 가 커밋 태그로 api, web, proxy 이미지를 만들고, web 이미지를 운영과 같은 읽기 전용 설정으로 혼자 띄워 첫 화면이 열리는지 먼저 확인. 안 뜨면 지금 버전을 건드리지 않고 멈춤
4. `docker compose up --wait` 로 교체하고, Caddy 를 거쳐 `/api/server` 가 이번 커밋을 돌려주고 `/`, `/portfolio`, `/feed`, PDF 가 열리는지 확인. 실패하면 직전 태그와 그때의 compose 파일로 되돌림
5. Next 가 만든 `/_next/static` 파일은 이름에 해시가 붙어 오래 캐시하고, 페이지는 매번 새로 받음. 배포 직후 옛 CSS 가 섞이지 않음

### 되돌리기

`deploy.sh` 는 성공한 배포마다 그때의 compose 파일을 `~/portfolio/docker-compose.release.yml` 에 남기고, 실패하면 그 파일과 직전 커밋 태그로 되돌린다. Next.js 로 옮긴 첫 배포에는 이 파일이 아직 없어서 자동으로 되돌리지 못한다. 그때는 서버에서 직전 커밋의 compose 파일로 직접 띄운다.

```bash
cd ~/actions-runner/_work/portfolio/portfolio
PREV=$(cat ~/portfolio/docker-release)            # 실패한 배포는 이 값을 바꾸지 않으므로 직전 커밋 그대로
git fetch --unshallow origin 2>/dev/null || git fetch origin   # runner 는 최신 커밋만 받아 두므로 지난 커밋을 받아 옴
git show "$PREV:deploy/docker-compose.yml" > /tmp/compose-prev.yml
docker rm -f portfolio-proxy-1                     # 새 구성에만 있는 Caddy 컨테이너가 8090 을 잡고 있으면 먼저 내림
PORTFOLIO_CONFIG=~/.config/portfolio RELEASE=$PREV docker compose -p portfolio --project-directory deploy -f /tmp/compose-prev.yml up -d --wait --remove-orphans
```

진행 상황은 GitHub 저장소의 Actions 탭에서 확인.

## 처음 한 번만 한 설정

1. `deploy/root-setup.sh` 를 서버에서 `sudo bash` 로 실행: MongoDB 8.0 설치, 인증 켜기, tailscale operator 지정 (호스트 mongod 바이너리는 CI 의 API e2e 테스트가 씀)
2. `deploy/server-setup.sh` 실행 (sudo 불필요): linger, Node, Actions runner 설치와 등록
3. Funnel 을 연결: `tailscale funnel --bg http://127.0.0.1:8090`
4. Docker 전환 (2026-10-11):
   - sudo 로 계정을 docker 그룹에 넣고 사용자 서비스 관리자를 다시 띄움: `sudo usermod -aG docker $USER && sudo systemctl restart user@$(id -u).service`
   - `deploy/docker-setup.sh` 실행 (sudo 불필요): `mongo.env`, `api.docker.env` 생성. HASH_SALT, ADMIN_TOKEN 은 기존 값 유지
   - 다음 push 의 `deploy.sh` 가 예전 API 를 멈추고 호스트 MongoDB 데이터를 컨테이너로 옮긴 뒤 교체함 (이 전환 코드는 끝난 뒤 지움)
5. 프로필 사진 저장소 추가 (2026-11-15): `deploy/docker-setup.sh` 를 다시 실행해 `minio.env` 를 만들고 `api.docker.env` 에 `MINIO_*` 를 덧붙임. 다음 push 의 `deploy.sh` 가 minio 컨테이너, 버킷, API 계정을 만듦

docker 그룹은 사실상 root 권한이라 runner 를 거치는 이 저장소는 private 으로 유지함.

## 공개 전 확인할 것

- 경력과 프로젝트 문구는 최신 이력서 및 공개 가능 범위와 주기적으로 대조하기
- 회사 항목은 보안서약서 기준(`~/.claude/skills/resume/security.md`)으로 한 번 더 확인
- 완성되면 `<meta name="robots" content="noindex">` 삭제
