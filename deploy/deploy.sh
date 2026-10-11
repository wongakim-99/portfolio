#!/usr/bin/env bash
# GitHub Actions self-hosted runner(홈서버)가 체크아웃한 저장소 루트에서 실행함
# 1) 커밋 태그로 API 이미지와 웹(Caddy + 정적 페이지) 이미지를 만듦
# 2) docker compose 로 교체하고, Caddy 를 거쳐 새 커밋이 응답하는지까지 확인
# 3) 실패하면 직전 태그로 되돌림. systemd 에서 처음 넘어오는 배포였다면 예전 서비스를 다시 켬
set -euo pipefail

CONFIG="$HOME/.config/portfolio"
STATE="$HOME/portfolio/docker-release"
PDF=apps/web/gawon-portfolio.pdf
PROXY_URL=http://127.0.0.1:8090
LEGACY_UNITS=(portfolio-api.service caddy.service)

SHA=$(git rev-parse --short HEAD)
PREV=$(cat "$STATE" 2>/dev/null || true)
export PORTFOLIO_CONFIG="$CONFIG"

compose() {
  local release=$1
  shift
  RELEASE="$release" docker compose -f deploy/docker-compose.yml "$@"
}

# 컨테이너 안에서 root 계정으로 mongo 도구를 실행함. 비밀번호는 컨테이너 환경변수에서 읽어 명령줄에 남기지 않음
mongo_root() {
  compose "$SHA" exec -T mongo sh -c "$1"' -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'
}

legacy_active() {
  local unit
  for unit in "${LEGACY_UNITS[@]}"; do
    systemctl --user is-active --quiet "$unit" && return 0
  done
  return 1
}

# Caddy 를 거쳐 이번 커밋의 API 가 응답하고 페이지와 PDF 가 열리는지 확인
serving() {
  local tag=$1
  for _ in $(seq 1 15); do
    if curl -fsS "$PROXY_URL/api/server" 2>/dev/null | grep -q "\"commit\":\"$tag\"" \
      && curl -fsS -o /dev/null "$PROXY_URL/" \
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
if [[ ! -f "$CONFIG/api.docker.env" || ! -f "$CONFIG/mongo.env" ]]; then
  echo "[deploy] $CONFIG 에 api.docker.env, mongo.env 가 없음. deploy/docker-setup.sh 를 먼저 실행할 것" >&2
  exit 1
fi

echo "[deploy] 이미지 빌드: $SHA"
docker build -q -f apps/api/Dockerfile \
  --build-arg RELEASE_COMMIT="$SHA" \
  --build-arg RELEASE_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -t "portfolio-api:$SHA" . >/dev/null
docker build -q -f deploy/web.Dockerfile -t "portfolio-web:$SHA" . >/dev/null
compose "$SHA" config -q

echo "[deploy] DB 준비"
compose "$SHA" up -d --wait --wait-timeout 90 mongo
mongo_root 'mongosh --quiet --norc --file /dev/stdin' < deploy/mongo-ensure-user.js

MIGRATING=false
if legacy_active; then
  MIGRATING=true
  echo "[deploy] systemd 에서 Docker 로 첫 전환. 예전 API 를 멈추고 호스트 MongoDB 데이터를 옮김"
  systemctl --user stop portfolio-api.service
  # 호스트 MongoDB 는 읽기만 하므로 실패해도 예전 서비스로 바로 되돌릴 수 있음
  if ! (
    set -a
    # shellcheck disable=SC1091
    . "$CONFIG/api.env"
    set +a
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    printf 'uri: "%s"\n' "$MONGODB_URI" > "$tmp/dump.yaml"
    mongodump --config "$tmp/dump.yaml" --archive --quiet
  ) | mongo_root 'mongorestore --quiet --archive --drop --nsInclude "portfolio.*"'; then
    echo "[deploy] 데이터 옮기기 실패. 예전 API 를 다시 켬" >&2
    systemctl --user start portfolio-api.service
    exit 1
  fi
  systemctl --user stop caddy.service
fi

echo "[deploy] 컨테이너 교체"
if ! compose "$SHA" up -d --wait --wait-timeout 90 --remove-orphans || ! serving "$SHA"; then
  echo "[deploy] 새 버전 확인 실패, 로그:" >&2
  compose "$SHA" logs --tail 40 api web >&2 || true
  if [[ -n "$PREV" ]]; then
    echo "[deploy] 직전 버전으로 되돌림: $PREV" >&2
    compose "$PREV" up -d --wait --wait-timeout 90 || true
  elif $MIGRATING; then
    echo "[deploy] 예전 systemd 서비스로 되돌림" >&2
    compose "$SHA" stop web api || true
    systemctl --user start "${LEGACY_UNITS[@]}"
  fi
  exit 1
fi

if $MIGRATING; then
  # 서비스 파일은 지우지 않고 꺼 두기만 함. 필요하면 systemctl --user enable --now 로 되살림
  systemctl --user disable "${LEGACY_UNITS[@]}" >/dev/null 2>&1 || true
  echo "[deploy] 예전 systemd 서비스 끔: ${LEGACY_UNITS[*]}"
fi

mkdir -p "$(dirname "$STATE")"
echo "$SHA" > "$STATE"
echo "[deploy] 방문 수 확인: $(curl -fsS "$PROXY_URL/api/views")"

# 최근 이미지 3개만 남기고 빌드 중간 산출물 정리
for repo in portfolio-api portfolio-web; do
  docker image ls "$repo" --format '{{.Tag}}' | tail -n +4 | xargs -r -I{} docker image rm -f "$repo:{}" >/dev/null
done
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null
echo "[deploy] 완료: $SHA"
