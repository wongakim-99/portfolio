# portfolio

김가원 소개 및 포트폴리오 사이트. 홈서버 gawon-dev 에서 직접 운영함.

- 주소: https://gawon-dev.tail7c7524.ts.net (도메인 없이 Tailscale Funnel 로 공개)
- `main` 에 push 하면 홈서버의 GitHub Actions runner 가 테스트 후 자동 배포함

## 구조

```
apps/web/        정적 페이지 (index.html, style.css, app.js). 빌드 없음
apps/api/        NestJS 12 + Mongoose API (방문 수, 메시지)
deploy/          서버 배포 스크립트, systemd 사용자 유닛, 1회성 root 설정
.github/workflows/deploy.yml
```

## 서버 구성

```
인터넷 → Tailscale Funnel (gawon-dev:443)
           ├─ /     → ~/portfolio/site        (apps/web 복사본, tailscaled 가 직접 서비스)
           └─ /api  → 127.0.0.1:3000          (portfolio-api.service, systemd 사용자 유닛)
                         └─ MongoDB 8.0       (127.0.0.1:27017, 인증 켜짐, apt 설치)
```

| 항목 | 위치 |
|---|---|
| API 릴리스 | `~/portfolio/releases/<시각>-<커밋>`, 실행 중인 것은 `~/portfolio/current` 링크 |
| API 환경변수 | `~/.config/portfolio/api.env` (권한 600, git 에 없음) |
| Mongo 관리자 계정 | `~/.config/portfolio/mongo-admin.env` (권한 600) |
| Node | `~/.local/node` (v24 LTS, 사용자 영역 설치) |
| Actions runner | `~/actions-runner`, `github-runner.service` (사용자 유닛) |

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB 연결까지 확인. 배포 스크립트가 사용 |
| GET | `/api/views` | 누적 방문 수 |
| POST | `/api/views` | 방문 기록. 같은 방문자는 30분 안에 다시 와도 한 번만 셈 (TTL 인덱스) |
| POST | `/api/messages` | 메시지 남기기. IP 당 10분 3건, honeypot 으로 봇 차단 |
| GET | `/api/messages` | 최근 메시지 50건. `Authorization: Bearer <ADMIN_TOKEN>` 필요 |

메시지 확인 (서버에서):

```bash
source ~/.config/portfolio/api.env
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:3000/api/messages
```

## 로컬 개발

```bash
npm install
npm run dev        # 메모리 Mongo + API watch, http://127.0.0.1:3000 에서 페이지까지 확인
npm run typecheck
npm run build
npm test           # e2e 8건, 메모리 Mongo 사용
```

## 배포 흐름

1. GitKraken 이나 터미널에서 `main` 에 커밋, push
2. 홈서버 runner 가 `npm ci → typecheck → build → test → deploy/deploy.sh` 실행
3. `deploy.sh` 가 새 릴리스를 깔고 API 재시작, `/api/health` 가 30초 안에 응답하지 않으면 직전 릴리스로 되돌림
4. API 가 정상이면 `apps/web` 을 `~/portfolio/site` 로 교체

진행 상황은 GitHub 저장소의 Actions 탭에서 확인.

## 처음 한 번만 한 설정

- `deploy/root-setup.sh` 를 서버에서 `sudo bash` 로 실행: MongoDB 8.0 설치, 인증 켜기, tailscale operator 지정
- Mongo 계정 생성 (localhost exception 으로 관리자 생성 후 앱 전용 `portfolio` 계정, readWrite)
- `loginctl enable-linger ggw1999`: 로그인하지 않아도 사용자 서비스가 부팅 시 뜨도록
- Funnel: `tailscale funnel --bg /home/ggw1999/portfolio/site`, `tailscale funnel --bg --set-path /api http://127.0.0.1:3000/api`

## 공개 전 확인할 것

- 소개 문단은 본인 말투로 다시 쓰기 (`apps/web/index.html` 의 TODO 주석)
- 회사 항목은 보안서약서 기준(`~/.claude/skills/resume/security.md`)으로 한 번 더 확인
- 완성되면 `<meta name="robots" content="noindex">` 삭제
