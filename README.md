# portfolio

김가원 소개 및 포트폴리오 사이트. 홈서버 gawon-dev 에서 직접 운영함.

- 주소: https://gawon-dev.tail7c7524.ts.net (도메인 없이 Tailscale Funnel 로 공개)
- `main` 에 push 하면 홈서버의 GitHub Actions runner 가 테스트 후 자동 배포함

## 구조

```
apps/web/        정적 페이지 (index.html, style.css, app.js). 빌드 없음
apps/api/        NestJS 12 + Mongoose API (방문 수, 메시지, 서버 상태, 하이파이브)
scripts/         포트폴리오 PDF 생성기와 테스트, PDF 용 글꼴(IBM Plex Sans KR, OFL)
deploy/          배포 스크립트, Caddyfile, systemd 사용자 유닛, 1회성 서버 설정
.github/workflows/deploy.yml
```

## 페이지

책상을 위에서 내려다본 구도. 스티커 붙은 홈서버 노트북, 출력한 포트폴리오 한 장, 배포 영수증, 엽서로 구성함.

- 노트북 스티커는 끌어서 옮길 수 있음. 위치는 방문자 브라우저에만 저장
- 노트북 LED 와 영수증은 `/api/server` 를 10초마다 불러 실제 가동 시간, CPU 온도, 배터리, 배포 커밋을 보여 줌
- 오른쪽 위 스탠드 버튼으로 밝은 화면과 어두운 화면 전환
- 하이파이브 버튼: 연타를 모아 보내고, 한 사람이 하루 50번까지 셈
- `` ` `` 키를 누르면 숨은 터미널이 열림 (`help`, `neofetch`, `cat about`, `curl /api/health`, `pdf` 등)

## 포트폴리오 PDF

- `npm run build` 가 `apps/web/index.html` 을 읽어 `apps/web/gawon-portfolio.pdf` 를 만듦 (git 에는 안 올림)
- 페이지의 `data-pdf="..."` 표시가 PDF 에 들어갈 내용을 가리킴. 내용은 index.html 한곳만 고치면 됨
- 표시를 지우거나 구조를 바꿔서 내용을 못 찾으면 생성이 실패하고, 배포도 멈춤
- `npm test` 가 금지 문자(가운뎃점, em dash 등)와 '(이론상 비교)' 단서 누락도 검사함
- 로컬에서 바로 보려면 `npm run pdf`

## 서버 구성

```
인터넷 → Tailscale Funnel (HTTPS, gawon-dev:443)
           └─ Caddy 127.0.0.1:8090          (caddy.service, deploy/Caddyfile)
                ├─ /      → ~/portfolio/site      (apps/web 복사본)
                └─ /api/* → 127.0.0.1:3000        (portfolio-api.service)
                              └─ MongoDB 8.0      (127.0.0.1:27017, 인증 켜짐, apt 설치)
```

Funnel 은 Caddy 하나만 가리킴. 경로 분기는 Caddyfile 에서 하므로 라우팅을 바꿔도 sudo 가 필요 없고, API 가 죽어도 정적 페이지는 계속 뜸.
서버 밖에서 직접 열리는 포트는 없음 (3000, 8090, 27017 모두 127.0.0.1).

| 항목 | 위치 |
|---|---|
| API 릴리스 | `~/portfolio/releases/<시각>-<커밋>`, 실행 중인 것은 `~/portfolio/current` 링크 |
| API 환경변수 | `~/.config/portfolio/api.env` (권한 600, git 에 없음) |
| Mongo 관리자 계정 | `~/.config/portfolio/mongo-admin.env` (권한 600) |
| Node | `~/.local/node` (v24 LTS, 사용자 영역 설치) |
| Caddy | `~/.local/bin/caddy`, 설정 `~/portfolio/Caddyfile`, 접속 로그 `~/portfolio/logs/access.log` |
| Actions runner | `~/actions-runner`, `github-runner.service` (사용자 유닛) |

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB 연결까지 확인. 배포 스크립트가 사용 |
| GET | `/api/views` | 누적 방문 수 |
| POST | `/api/views` | 방문 기록. 같은 방문자는 30분 안에 다시 와도 한 번만 셈 (TTL 인덱스) |
| POST | `/api/messages` | 메시지 남기기. IP 당 10분 3건, honeypot 으로 봇 차단 |
| GET | `/api/messages` | 최근 메시지 50건. `Authorization: Bearer <ADMIN_TOKEN>` 필요 |
| GET | `/api/server` | 가동 시간, 부하, 메모리, CPU 온도, 배터리, 배포 커밋. 5초 캐시 |
| GET | `/api/high-fives` | 누적 하이파이브 수 |
| POST | `/api/high-fives` | `{ "count": 1~10 }`. 한 사람 하루 50번까지, IP 당 1분 20회 |

메시지 확인 (서버에서):

```bash
source ~/.config/portfolio/api.env
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:3000/api/messages
```

## 로컬 개발

```bash
npm install
npm run dev        # PDF 생성 후 메모리 Mongo + API watch, http://127.0.0.1:3000 에서 페이지까지 확인
npm run typecheck
npm run build      # API 빌드 + 포트폴리오 PDF 생성
npm test           # API e2e 14건(메모리 Mongo) + PDF 생성기 7건
```

## 배포 흐름

1. GitKraken 이나 터미널에서 `main` 에 커밋, push
2. 홈서버 runner 가 `npm ci → typecheck → build(PDF 포함) → test → deploy/deploy.sh` 실행
3. `deploy.sh` 가 새 릴리스를 깔고 API 재시작, `/api/health` 가 30초 안에 응답하지 않으면 직전 릴리스로 되돌림
4. API 가 정상이면 `apps/web` 을 `~/portfolio/site` 로 교체하고(PDF 포함), Caddyfile 을 검사한 뒤 reload
5. 정적 파일은 `Cache-Control: no-cache` 로 내보내서 배포 직후 옛 CSS 가 남지 않음

진행 상황은 GitHub 저장소의 Actions 탭에서 확인.

## 처음 한 번만 한 설정

1. `deploy/root-setup.sh` 를 서버에서 `sudo bash` 로 실행: MongoDB 8.0 설치, 인증 켜기, tailscale operator 지정
2. Mongo 계정 생성: localhost exception 으로 관리자 생성 후 앱 전용 `portfolio` 계정(readWrite). 비밀번호는 서버에서 생성해 `~/.config/portfolio/` 에만 저장
3. `deploy/server-setup.sh` 실행 (sudo 불필요): linger, Node, Caddy, Actions runner 설치와 등록
4. 첫 배포 후 Funnel 을 Caddy 로 연결: `tailscale funnel --bg http://127.0.0.1:8090`

## 공개 전 확인할 것

- 소개 문장(회사에서, 학교에서, 집에서)은 본인 말투로 다시 쓰기 (`apps/web/index.html` 의 TODO 주석)
- 회사 항목은 보안서약서 기준(`~/.claude/skills/resume/security.md`)으로 한 번 더 확인
- 완성되면 `<meta name="robots" content="noindex">` 삭제
