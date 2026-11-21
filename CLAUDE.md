# portfolio (gawon-dev 사이트)

김가원 소개, 포트폴리오, 피드, 블로그(gawon-log)를 한 앱으로 서비스하는 저장소. 홈서버 노트북 `gawon-dev` 에서 Docker 로 돈다.
자세한 운영 정보(서버 구성, 비밀값 위치, 관리자 역할)는 `README.md` 가 원본이다. 이 파일은 작업 규칙만 둔다.

- 같이 보는 곳: 로컬 `~/Desktop/github-repo/gawon-dev/` 아래에 이 저장소와 관리 패널 `gawon-control` 이 같이 있다 (상위 `CLAUDE.md`)
- 현황판: 노션 "홈서버 구축 및 개인 포트폴리오" 페이지. 작업을 끝내면 그 안의 "홈서버 작업 기록" DB 에 한 행 남긴다
- 공개 사이트: https://gawon-dev.tail7c7524.ts.net (Tailscale Funnel). 이력서에 걸린 주소라 채용담당자가 본다

## 배포 주의

- **`main` 에 push 하면 바로 운영에 배포된다.** 홈서버의 GitHub Actions runner 가 typecheck, lint, build, test 뒤에 `deploy/deploy.sh` 를 실행하고, 실패하면 직전 이미지로 되돌린다
- push 전에 아래 검증을 직접 돌린다. 다른 세션의 "통과했다"를 믿지 않는다
- compose 프로젝트 이름 `portfolio` 와 Mongo 컬렉션 이름(`community_*`, `blog_*` 등)은 바꾸지 않는다. 볼륨과 데이터가 그 이름에 묶여 있다
- 운영 DB 를 건드리기 전에는 사용자에게 먼저 묻는다. 읽기 조회도 꼭 필요할 때만 한다

## 명령

```bash
npm run dev          # API(메모리 Mongo, :3000) + 페이지(:3001). 사용자가 보도록 Orca 터미널에 띄운다
node scripts/dev-accounts.mjs   # dev 를 띄운 채로 로컬 계정 3개 만들기 (owner@local.test 등, 비밀번호 local-test-password)
npm run typecheck && npm run lint && npm run build && npm test   # push 전 검증 (CI 와 같음)
```

- 로컬에는 메일 설정이 없어 가입이 막혀 있다. 로그인이 필요한 화면은 `dev-accounts.mjs` 계정으로 확인한다
- 화면 확인은 Orca 브라우저로 `http://127.0.0.1:3001`. 모바일은 320px, 390px 까지 본다

## 구조와 규칙

### apps/web (Next.js 16, FSD)

- 레이어: `app > views > widgets > features > entities > shared`. 아래로만 import 하고 같은 레이어끼리는 부르지 않는다. `npm run lint` 의 `boundaries/dependencies` 가 검사한다
- 슬라이스 밖에서는 그 슬라이스의 `index.ts` 로만 가져다 쓴다
- 이 Next 버전은 예전과 다르다. 낯선 API 는 `node_modules/next/dist/docs/` 를 먼저 읽는다 (`apps/web/AGENTS.md`)
- 디자인은 책상을 위에서 내려다본 구도(점박이 책상 바탕, 종이 그림자, 손글씨 한 줄, 라벨 테이프 버튼)다. 새 화면도 이 톤을 따른다. 흔한 템플릿 모양(회색 실선, 파란 강조, 대문자 소제목, 유리 효과)은 피한다
- 색은 `shared/styles/tokens.css` 의 토큰만 쓰고, 밝은 화면과 어두운 화면(스탠드 끄기)을 둘 다 확인한다

### apps/api (NestJS 12, DDD)

- `src/modules/<영역>/{domain,application,infrastructure,presentation}`. 영역: identity, feed, blog, messages, visits, high-fives, deploys, ops, backoffice
- domain 은 Nest, Mongoose 를 모른다. 저장소와 바깥 서비스는 domain 에 추상 클래스로 약속하고, infrastructure 가 구현하고, `<영역>.module.ts` 가 `{ provide, useClass }` 로 잇는다
- 다른 영역은 그 영역의 `index.ts` 로만 쓴다. 계정 정보는 `UserDirectory`, 로그인 확인은 `CurrentUser`, 권한은 `RequirePermission` 을 쓴다
- 영역끼리 직접 부르기 어려운 일(예: 이름 변경을 피드에 알리기)은 `shared/events` 의 이벤트로 알린다
- 규칙은 `apps/api/test/architecture.spec.ts` 가 검사한다. 새 영역을 만들어도 같은 폴더 모양을 지킨다
- API 주소와 응답 모양을 바꾸면 `apps/web/src/entities/*/model/types.ts` 도 같이 고친다

## 글 쓰는 규칙 (화면, 주석, 커밋)

- 화면 글에 가운뎃점, em dash, 수학 마이너스, 검은 사각형 문자를 쓰지 않는다. `npm test` 가 `apps/web/src` 와 포트폴리오 내용에서 검사한다
- 회사 이름, 발주처, 과제 세부 같은 재직 회사 정보는 사이트 어디에도 쓰지 않는다 (이력서 스킬의 `security.md` 기준)
- 주석과 문서는 지금처럼 한국어 개조식으로, 무엇을 왜 하는지 한두 줄로 쓴다
- 커밋 메시지 형식은 전역 규칙(`~/.claude/CLAUDE.md`)을 따른다: 제목 한 줄 + 불릿, 마지막 불릿에 검증
