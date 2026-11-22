#!/usr/bin/env bash
# GitHub Actions self-hosted runner(홈서버)가 체크아웃한 저장소 루트에서 실행함
# 1) 커밋 태그로 API, 페이지(Next.js), 앞단 프록시(Caddy) 이미지를 만들고, 페이지 이미지가 혼자 뜨는지 먼저 확인
# 2) docker compose 로 교체하고, Caddy 를 거쳐 새 커밋이 응답하는지까지 확인
# 3) 실패하면 직전 태그와 그때의 compose 파일로 되돌림
# 4) 결과를 API 의 배포 기록(/api/deploys)에 남김. 홈의 영수증과 숨은 터미널 git log 가 보여 줌
# 5) 사진 저장소(MinIO) 매일 백업 타이머를 설치하거나 갱신함 (deploy/minio-backup.sh)
set -euo pipefail

CONFIG="$HOME/.config/portfolio"
STATE="$HOME/portfolio/docker-release"
# 지금 돌고 있는 버전의 compose 파일. 되돌릴 때는 그 버전의 서비스 구성으로 띄워야 해서 따로 남겨 둠
STATE_COMPOSE="$HOME/portfolio/docker-compose.release.yml"
PDF=apps/web/public/gawon-portfolio.pdf
PROXY_URL=http://127.0.0.1:8090

SHA=$(git rev-parse --short HEAD)
PREV=$(cat "$STATE" 2>/dev/null || true)
export PORTFOLIO_CONFIG="$CONFIG"

compose() {
  local release=$1
  shift
  RELEASE="$release" docker compose -f deploy/docker-compose.yml "$@"
}

# 직전 버전으로 되돌릴 때는 그 버전을 띄웠던 compose 파일을 씀. 페이지가 Caddy 정적 파일이던 시절로는 자동으로 못 돌아감
compose_previous() {
  local release=$1
  shift
  if [[ ! -f "$STATE_COMPOSE" ]]; then
    echo "[deploy] 직전 버전의 compose 파일($STATE_COMPOSE)이 없어 되돌릴 수 없음. README 의 '되돌리기' 참고" >&2
    return 1
  fi
  RELEASE="$release" docker compose -p portfolio --project-directory deploy -f "$STATE_COMPOSE" "$@"
}

# 컨테이너 안에서 root 계정으로 mongo 도구를 실행함. 비밀번호는 컨테이너 환경변수에서 읽어 명령줄에 남기지 않음
mongo_root() {
  compose "$SHA" exec -T mongo sh -c "$1"' -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'
}

# 배포 기록 한 건. 토큰은 명령줄에 남지 않게 헤더 파일로 넘기고, 기록에 실패해도 배포는 그대로 둠
record_deploy() {
  local result=$1 token subject body
  token=$(sed -n 's/^ADMIN_TOKEN=//p' "$CONFIG/api.docker.env" | head -n 1)
  subject=$(git log -1 --format=%s)
  body=$(node -e 'const [commit, subject, seconds, result] = process.argv.slice(1); console.log(JSON.stringify({ commit, subject, durationSec: Number(seconds), result }))' \
    "$SHA" "$subject" "$SECONDS" "$result")
  if ! curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' -H @<(printf 'Authorization: Bearer %s\n' "$token") \
    --data "$body" "$PROXY_URL/api/deploys"; then
    echo "[deploy] 배포 기록을 남기지 못함 ($result). 배포 자체는 그대로" >&2
  fi
}

# Caddy 를 거쳐 이번 커밋의 API 가 응답하고 페이지와 PDF 가 열리는지 확인
serving() {
  local tag=$1
  for _ in $(seq 1 15); do
    if curl -fsS "$PROXY_URL/api/server" 2>/dev/null | grep -q "\"commit\":\"$tag\"" \
      && curl -fsS -o /dev/null "$PROXY_URL/" \
      && curl -fsS -o /dev/null "$PROXY_URL/portfolio" \
      && curl -fsS -o /dev/null "$PROXY_URL/feed" \
      && curl -fsS -o /dev/null "$PROXY_URL/gawon-portfolio.pdf"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if [[ ! -s "$PDF" ]]; then
  echo "[deploy] $PDF 가 없음. npm run build 결과 확인 필요" >&2
  exit 1
fi
if [[ ! -f "$CONFIG/api.docker.env" || ! -f "$CONFIG/mongo.env" || ! -f "$CONFIG/minio.env" ]] \
  || ! grep -q '^MINIO_ACCESS_KEY=' "$CONFIG/api.docker.env"; then
  echo "[deploy] $CONFIG 의 api.docker.env, mongo.env, minio.env 설정이 모자람. deploy/docker-setup.sh 를 먼저 실행할 것" >&2
  exit 1
fi

echo "[deploy] 이미지 빌드: $SHA"
docker build -q -f apps/api/Dockerfile \
  --build-arg RELEASE_COMMIT="$SHA" \
  --build-arg RELEASE_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "portfolio-api:$SHA" . >/dev/null
docker build -q -f apps/web/Dockerfile -t "portfolio-web:$SHA" . >/dev/null
docker build -q -f deploy/proxy.Dockerfile -t "portfolio-proxy:$SHA" . >/dev/null
compose "$SHA" config -q

# 페이지 이미지를 운영과 같은 읽기 전용 설정으로 혼자 띄워 첫 화면이 열리는지 봄. 안 뜨면 지금 버전을 건드리지 않고 멈춤
echo "[deploy] 페이지 이미지 확인"
WEB_CHECK=$(docker run -d --rm --read-only --tmpfs /tmp --tmpfs /app/apps/web/.next/cache --cap-drop ALL "portfolio-web:$SHA")
web_health=starting
for _ in $(seq 1 30); do
  web_health=$(docker inspect -f '{{.State.Health.Status}}' "$WEB_CHECK" 2>/dev/null || echo gone)
  [[ "$web_health" == starting ]] || break
  sleep 2
done
if [[ "$web_health" != healthy ]]; then
  echo "[deploy] 페이지 이미지가 뜨지 않음 ($web_health), 로그:" >&2
  docker logs --tail 40 "$WEB_CHECK" >&2 || true
  docker rm -f "$WEB_CHECK" >/dev/null 2>&1 || true
  exit 1
fi
docker rm -f "$WEB_CHECK" >/dev/null

echo "[deploy] DB 준비"
compose "$SHA" up -d --wait --wait-timeout 90 mongo
mongo_root 'mongosh --quiet --norc --file /dev/stdin' < deploy/mongo-ensure-user.js

echo "[deploy] 사진 저장소 준비"
# 사진 백업 계정(portfolio-backup) 비밀번호. 없으면 만들어 둠 (권한 600, git 에 없음)
if [[ ! -f "$CONFIG/minio-backup.env" ]]; then
  (umask 077 && printf 'MINIO_BACKUP_SECRET_KEY=%s\n' "$(openssl rand -hex 24)" > "$CONFIG/minio-backup.env")
  echo "[deploy] 만듦: $CONFIG/minio-backup.env"
fi
compose "$SHA" up -d --wait --wait-timeout 90 minio
# 백업 계정 비밀번호는 명령 인자가 아니라 표준 입력으로 스크립트 앞에 붙여 넘겨서 프로세스 목록에 남지 않게 함
{ sed 's/^/export /' "$CONFIG/minio-backup.env"; cat deploy/minio-ensure-bucket.sh; } | compose "$SHA" exec -T minio sh -s

echo "[deploy] 컨테이너 교체"
if ! compose "$SHA" up -d --wait --wait-timeout 90 --remove-orphans || ! serving "$SHA"; then
  echo "[deploy] 새 버전 확인 실패, 로그:" >&2
  compose "$SHA" logs --tail 40 api web proxy >&2 || true
  if [[ -n "$PREV" ]]; then
    echo "[deploy] 직전 버전으로 되돌림: $PREV" >&2
    compose_previous "$PREV" up -d --wait --wait-timeout 90 --remove-orphans || true
    record_deploy rolled-back
  fi
  exit 1
fi

mkdir -p "$(dirname "$STATE")"
echo "$SHA" > "$STATE"
cp deploy/docker-compose.yml "$STATE_COMPOSE"
record_deploy success
echo "[deploy] 방문 수 확인: $(curl -fsS "$PROXY_URL/api/views")"

# 사진 백업 타이머 설치(또는 갱신). 사이트는 이미 새 버전으로 떴으므로 여기서 실패해도 배포는 성공으로 두고 크게 알림
install_photo_backup() {
  local units="$HOME/.config/systemd/user" bin="$HOME/.local/share/portfolio"
  mkdir -p "$units" "$bin" || return 1
  install -m 700 deploy/minio-backup.sh "$bin/minio-backup.sh" || return 1
  install -m 644 deploy/portfolio-minio-backup.service deploy/portfolio-minio-backup.timer "$units/" || return 1
  systemctl --user daemon-reload || return 1
  systemctl --user enable --now portfolio-minio-backup.timer 2>/dev/null || return 1
  # 아직 백업이 하나도 없으면 바로 한 번 뜸
  if ! compgen -G "$HOME/backups/minio/portfolio/20*" >/dev/null; then
    systemctl --user start --no-block portfolio-minio-backup.service || return 1
  fi
}
if install_photo_backup; then
  echo "[deploy] 사진 백업 타이머: 다음 $(systemctl --user show -p NextElapseUSecRealtime --value portfolio-minio-backup.timer)"
else
  echo "[deploy] 경고: 사진 백업 타이머를 설치하지 못함. systemctl --user status portfolio-minio-backup.timer 로 확인할 것" >&2
fi

# 최근 이미지 3개만 남기고 빌드 중간 산출물 정리
for repo in portfolio-api portfolio-web portfolio-proxy; do
  docker image ls "$repo" --format '{{.Tag}}' | tail -n +4 | xargs -r -I{} docker image rm -f "$repo:{}" >/dev/null
done
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null
echo "[deploy] 완료: $SHA"
