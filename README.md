# portfolio

김가원 소개 및 포트폴리오 사이트. 홈서버 gawon-dev 에서 직접 운영함.

- 주소: https://gawon-dev.tail7c7524.ts.net (도메인 없이 Tailscale Funnel 로 공개)
- `main` 에 push 하면 홈서버의 GitHub Actions runner 가 테스트 후 자동 배포함

## 구조

```
apps/web/        Next.js 16 (App Router) 페이지. 홈, 포트폴리오, 피드
apps/api/        NestJS 12 + Mongoose API (방문 수, 메시지, 서버 상태, 하이파이브, 피드, 프로필 사진)
scripts/         포트폴리오 PDF 생성기와 테스트, PDF 용 글꼴(IBM Plex Sans KR, OFL), 로컬 개발 실행기
deploy/          배포 스크립트, compose, Caddyfile, Actions runner 사용자 유닛, 1회성 서버 설정
.github/workflows/deploy.yml
```

### apps/web 폴더 (Feature-Sliced Design)

gadoc, GoLe 와 같은 FSD 레이어로 나눈다. 위 레이어는 아래 레이어만 import 하고, 같은 레이어끼리는 서로 부르지 않는다 (`apps/web/eslint.config.mjs` 의 `boundaries/dependencies` 가 검사, CI 의 `npm run lint`). 슬라이스 밖에서는 `index.ts` 로만 가져다 쓴다.

```
src/
  app/         라우팅만. layout, page, 메타데이터, 옛 주소 리다이렉트 (community.html/route.ts)
    (site)/    홈(/), 포트폴리오(/portfolio). 상단 바만 있는 틀
    feed/      피드(/feed/*). 로그인 상태(SessionProvider), 계정 칸, 로그인 창, 메일 링크 창을 여기서 한 번 둠
  views/       화면 조립: home, portfolio, feed, post, post-editor, profile, admin
  widgets/     큰 화면 조각: site-header, site-footer, feed-header, account-menu, laptop(스티커), deploy-receipt,
               guest-terminal(숨은 터미널, 가짜 파일 시스템, tree 이스터에그), portfolio-sheet, post-list, comment-thread, server-topology, admin-inbox, admin-reports
  features/    한 가지 동작: theme-toggle(스탠드), open-terminal, copy-email, high-five, send-postcard, auth, write-post, manage-post,
               write-comment, report-content, edit-profile, change-password, change-avatar
  entities/    도메인 데이터와 API: portfolio(내용 원본), server-status, visit, user(세션, 사진), post, comment, message, report
  shared/      공통: api(fetch 도우미), config(주소), lib(날짜, 저장소), ui(Sheet, Dialog, FormStatus), styles(색 토큰, 바탕)
```

- 슬라이스 안은 `ui/`(컴포넌트와 그 CSS), `model/`(상태, 훅, 타입), `api/`(요청), `lib/`(순수 함수) 로 나눈다
- 스타일은 옛 정적 페이지의 클래스 이름을 그대로 두고, 쓰는 슬라이스 옆에 CSS 파일로 나눠 둠. 색과 글꼴은 `shared/styles/tokens.css`, 피드 공통은 `shared/styles/community.css`
- 포트폴리오, 홈의 글자는 서버에서 미리 그려 보내고(정적 생성), 서버 상태, 피드처럼 바뀌는 것은 브라우저에서 `/api` 를 불러 채움

## 페이지

상단의 홈, 포트폴리오, 피드 탭으로 페이지를 이동한다. 각 페이지는 책상을 위에서 내려다본 디자인을 공유한다.

- `/` 홈: 스티커 붙은 홈서버 노트북, 페이지 안내, 배포 영수증과 엽서
- `/portfolio`: 소개, 경력, 프로젝트, 기술, 이력을 담은 종이 포트폴리오. 목차는 이 페이지 안에서만 이동
- `/feed`: 긴 글과 댓글을 읽고, 이메일 확인을 마친 계정으로 작성하는 피드
- `/feed/posts/<글_ID>`, `/feed/write`, `/feed/posts/<글_ID>/edit`: 글 읽기, 새 글 쓰기, 내 글 고치기
- `/feed/users/<회원_ID>`: 회원 페이지. 프로필 사진, 이름, 소개, 쓴 글. 내 페이지에서는 사진과 프로필을 고치고 비밀번호 변경, 로그아웃을 함
- `/feed/admin`: 관리실 (아래 RBAC)
- 정적 페이지 시절 주소도 그대로 열림. `/portfolio.html`, `/index.html` 은 새 주소로, `/community.html?post=`, `?user=`, `?edit=`, `?write=`, `?admin=` 은 해당 피드 화면으로 영구 이동(308)
- 옛 `/#about`, `/#projects` 등의 링크는 해당 포트폴리오 섹션으로 이동

- 노트북 스티커는 끌어서 옮길 수 있음. 위치는 방문자 브라우저에만 저장
- 노트북 LED 와 영수증은 `/api/server` 를 10초마다 불러 실제 가동 시간, CPU 온도, 배터리, 배포 커밋을 보여 줌
- 오른쪽 위 스탠드 버튼으로 밝은 화면과 어두운 화면 전환
- 하이파이브 버튼: 연타를 모아 보내고, 한 사람이 하루 50번까지 셈
- 상단의 터미널 버튼이나 `` ` `` 키로 어느 페이지에서든 숨은 터미널이 열림. 사이트를 폴더처럼 돌아다님 (`apps/web/src/widgets/guest-terminal`)
  - `~` 가 홈이고 `portfolio/`(about, work, projects, skills, history), `feed/`(posts, write, admin), `server`, `note`, PDF 가 들어 있음. `feed/posts` 는 API 에서 최근 글 10개를 받아 글 ID 이름의 파일로 보여 줌
  - `ls`, `cd`, `pwd`, `cat`, `open`, `tree <경로>`, `history`, Tab 자동 완성. `cd` 로 다른 페이지 디렉터리에 가면 실제로 그 페이지로 옮기고 터미널을 닫음. 다시 열면 기록과 위치가 이어짐
  - 그 밖에 `neofetch`, `curl /api/health`, `hi5`, `lamp`, `pdf` 등. 인자 없이 `tree` 를 치면 크리스마스 트리 이스터에그 (q 또는 Esc 로 나감, 12월 1~25일에는 첫인사에 살짝 알려 줌)

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

권한은 역할 단위로 묶어 둔다 (`apps/api/src/community/community-roles.ts`). 회원 문서에는 역할만 적고, 서버가 요청마다 DB 의 역할에서 권한을 다시 계산한다. 그래서 역할을 바꾸면 이미 로그인한 세션에도 바로 반영된다.

| 역할 | 권한 |
|---|---|
| `member` (기본) | 없음. 글, 댓글, 신고, 내 페이지 같은 일반 기능만 씀 |
| `admin` | `messages:read`, `messages:delete` (홈 엽서 쪽지), `reports:read`, `reports:dismiss` (신고), `content:moderate` (남의 글과 댓글 삭제), `server:read` (지금 서버 구성도) |

- 내 글과 댓글만 고치고 지우는 규칙은 역할이 아니라 글쓴이가 누구인지로 따진다. 관리자도 남의 글 내용은 고칠 수 없고 삭제만 할 수 있다
- 관리자로 로그인하면 피드 위에 `관리실` 버튼과 새 쪽지 수가 보이고, `/feed/admin` 에서 쪽지함과 신고를 처리한다. 쪽지함을 열면 그때까지 온 쪽지는 읽은 것으로 바뀐다
- 관리자 계정의 회원 페이지에는 `운영자` 도장이 찍힌다
- 관리실 맨 위 `지금 서버` 는 방문자 → Tailscale Funnel → proxy(Caddy) → api(NestJS) → mongo, minio 구성도다. 2초마다 `/api/community/admin/topology` 를 불러, 실제 요청과 DB 명령, 사진 저장소 작업을 일어난 간격 그대로 점으로 흘려보낸다. 요청은 파란 점으로 api 까지 갔다가 응답 상태 색(정상 초록, 4xx 노랑, 5xx 빨강)으로 돌아오고, 칸마다 상태 불빛과 분당 횟수, 노트북 온도와 배터리, 최근 요청 12건이 같이 바뀐다
- 이 기록은 API 메모리에 최근 400건만 두고 재시작하면 비운다 (`apps/api/src/telemetry`). 경로는 `:id` 같은 라우트 모양으로만, 방문자는 salt 섞은 해시로만 센다. 배포 헬스체크와 관리실 자신의 새로고침은 세지 않는다. 페이지 요청은 web(Next.js) 컨테이너가 받아 API 를 거치지 않으므로 API 요청만 보인다
- 페이지는 권한 목록으로 버튼만 보이거나 숨기고, 실제 허용 여부는 서버의 `PermissionGuard` 가 확인한다

역할 지정은 서버의 `ADMIN_TOKEN` 으로만 한다. 페이지에서 스스로 관리자가 되는 길은 없다. 이메일 확인을 마친 회원만 지정할 수 있다.

```bash
source ~/.config/portfolio/api.docker.env
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"<회원 이메일>","role":"admin"}' http://127.0.0.1:8090/api/community/admin/users/role
# 되돌릴 때는 "role":"member"
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
                                  └─ minio 컨테이너 :9000  (pgsty/minio, 볼륨 portfolio_minio-data, 프로필 사진)
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
| MinIO 계정 | `~/.config/portfolio/minio.env` (root 와 `portfolio-api` 계정 비밀번호, 권한 600) |
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

## 관리 패널 (gawon-control)

서버의 컨테이너는 관리 패널 [gawon-control](https://github.com/wongakim-99/gawon-control) 에서 봄 (kscold-control 기반, 비공개 저장소).

- 주소: `https://gawon-dev.tail7c7524.ts.net:8443` (Tailscale Serve, **내 tailnet 기기에서만** 열림. 공개 아님)
- tailnet 밖에서는 SSH 터널로: `ssh -L 4100:127.0.0.1:4100 homeserver` 후 `http://127.0.0.1:4100`
- 할 수 있는 것: 컨테이너 상태와 시작, 중지, 로그, 서버 CPU, 메모리, 디스크, Docker 정리, 웹 터미널(`docker` 명령), 감사 로그
- 백업: 대상 `portfolio` 를 매일 04:00 에 덤프, 14일 보관. 읽기 전용 계정(`portfolio-backup`)으로 내부 망(`portfolio_data`)에 붙어서 뜸. 파일은 서버 `~/backups/mongodb/portfolio/`
- MinIO 볼륨(`portfolio_minio-data`, 프로필 사진)은 아직 백업 대상이 아님. 사진을 잃으면 각자 다시 올리면 되는 정도라 두었고, 필요해지면 따로 추가
- 관리자 비밀번호 변경: 관리 패널의 `권한 관리 → 사용자 목록 → 본인 계정의 열쇠 아이콘 → 변경`

새 서비스(예: gawon-log 블로그)를 올릴 때도 같은 방식으로 함: 자기 저장소에 compose 를 두고, 포트는 `127.0.0.1` 로만 열고, DB 는 내부 망에 둠. 패널은 서버의 모든 컨테이너를 자동으로 보여 줌.


| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB 연결까지 확인. 배포 스크립트가 사용 |
| GET | `/api/views` | 누적 방문 수 |
| POST | `/api/views` | 방문 기록. 같은 방문자는 30분 안에 다시 와도 한 번만 셈 (TTL 인덱스) |
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
npm test           # API e2e 21건(메모리 Mongo, MinIO 는 메모리 가짜) + 페이지 단위 12건 + PDF 생성기 7건
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
