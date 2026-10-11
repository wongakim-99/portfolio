#!/usr/bin/env bash
# GitHub Actions self-hosted runner(홈서버)가 체크아웃한 저장소 루트에서 실행함
# 1) API 를 새 릴리스 폴더에 설치하고 current 링크를 바꾼 뒤 재시작
# 2) 헬스체크 실패 시 직전 릴리스로 되돌림
# 3) 성공하면 정적 페이지를 Funnel 이 서비스하는 ~/portfolio/site 로 교체
set -euo pipefail

BASE="$HOME/portfolio"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
SITE_DIR="$BASE/site"
UNIT=portfolio-api.service
HEALTH_URL=http://127.0.0.1:3000/api/health

SHA=$(git rev-parse --short HEAD)
RELEASE="$RELEASES/$(date +%Y%m%d-%H%M%S)-$SHA"
PREV=$(readlink -f "$CURRENT" 2>/dev/null || true)

echo "[deploy] 릴리스 준비: $RELEASE"
mkdir -p "$RELEASE/apps/api"
cp package.json package-lock.json "$RELEASE/"
cp -r apps/api/dist apps/api/package.json "$RELEASE/apps/api/"
(cd "$RELEASE" && npm ci --omit=dev --no-audit --no-fund)

echo "[deploy] systemd 유닛 갱신"
mkdir -p "$HOME/.config/systemd/user"
cp deploy/portfolio-api.service "$HOME/.config/systemd/user/$UNIT"
systemctl --user daemon-reload
systemctl --user enable "$UNIT" >/dev/null

wait_healthy() {
  for _ in $(seq 1 30); do
    curl -fsS "$HEALTH_URL" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

ln -sfn "$RELEASE" "$CURRENT"
systemctl --user restart "$UNIT"

if ! wait_healthy; then
  echo "[deploy] 헬스체크 실패, 로그:" >&2
  journalctl --user -u "$UNIT" -n 40 --no-pager >&2 || true
  if [[ -n "$PREV" && -d "$PREV" ]]; then
    echo "[deploy] 직전 릴리스로 되돌림: $PREV" >&2
    ln -sfn "$PREV" "$CURRENT"
    systemctl --user restart "$UNIT"
  fi
  exit 1
fi
echo "[deploy] API 정상: $(curl -fsS "$HEALTH_URL")"

echo "[deploy] 정적 페이지 교체"
rsync -a --delete apps/web/ "$SITE_DIR/"

# 최근 릴리스 3개만 남김
ls -1dt "$RELEASES"/*/ | tail -n +4 | xargs -r rm -rf
echo "[deploy] 완료: $SHA"
