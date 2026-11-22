#!/usr/bin/env bash
# 사진 저장소(MinIO community-media 버킷: 블로그 글 사진, 프로필 사진)를 매일 떠 두는 스크립트
# systemd 사용자 타이머(portfolio-minio-backup.timer)가 실행함. deploy.sh 가 ~/.local/share/portfolio/ 에 복사해 둠
#   - 읽기 전용 계정 portfolio-backup 으로 내부 망(portfolio_data)의 minio 에 붙음. 비밀번호는 ~/.config/portfolio/minio-backup.env
#   - ~/backups/minio/portfolio/<UTC 시각>/community-media 에 버킷 전체를 받음
#   - 사진 파일은 이름이 바뀌지 않으므로 직전 백업과 같은 파일은 하드 링크로 나눠 씀. 디스크는 새로 올린 사진만큼만 늘어남
#   - 14일이 지난 백업은 지움 (Mongo 백업과 같은 기간). 가장 최근 백업은 늘 남김
set -euo pipefail

ROOT="${MINIO_BACKUP_ROOT:-$HOME/backups/minio/portfolio}"
CONTAINER="${MINIO_BACKUP_CONTAINER:-portfolio-minio-1}"
NETWORK="${MINIO_BACKUP_NETWORK:-portfolio_data}"
SECRETS="${MINIO_BACKUP_SECRETS:-$HOME/.config/portfolio/minio-backup.env}"
BUCKET=community-media
KEEP_DAYS=14

log() { echo "[minio-backup] $*"; }

# shellcheck disable=SC1090
. "$SECRETS"
: "${MINIO_BACKUP_SECRET_KEY:?minio-backup.env 에 MINIO_BACKUP_SECRET_KEY 가 없음}"
# 접속 정보는 docker 명령 인자가 아니라 환경변수로만 넘겨서 프로세스 목록에 남지 않게 함
export MC_HOST_src="http://portfolio-backup:${MINIO_BACKUP_SECRET_KEY}@minio:9000"
# 지금 도는 minio 와 같은 이미지(mc 포함)를 써서 따로 받을 이미지가 없음
image=$(docker inspect --format '{{.Config.Image}}' "$CONTAINER")

umask 077
mkdir -p "$ROOT/.partial"
# 지난번에 중간에 끊긴 작업은 버림. 완성된 백업만 날짜 이름으로 옮겨 둠
rm -rf "${ROOT:?}/.partial/"*
stamp=$(date -u +%Y-%m-%d_%H-%M-%S)
work="$ROOT/.partial/$stamp"
mkdir -p "$work/$BUCKET"

latest=$(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -n 1)
if [[ -n "$latest" && -d "$latest/$BUCKET" ]]; then
  cp -al "$latest/$BUCKET/." "$work/$BUCKET/"
fi

# 버킷에 없는 파일(지운 사진)은 이번 백업에서만 빼고, 새 파일만 받음. 이미 있는 파일은 건드리지 않아 하드 링크로 이어진 옛 백업이 바뀌지 않음
docker run --rm --network "$NETWORK" --user "$(id -u):$(id -g)" -e MC_HOST_src \
  -v "$work/$BUCKET:/backup" --entrypoint mc "$image" \
  --config-dir /tmp/mc --quiet --no-color mirror --remove "src/$BUCKET" /backup >/dev/null

mv "$work" "$ROOT/$stamp"
files=$(find "$ROOT/$stamp/$BUCKET" -type f | wc -l | tr -d ' ')

# 보관 기간이 지난 백업 정리. 이름이 UTC 시각이라 글자 순서로 비교함
cutoff=$(date -u -d "-$KEEP_DAYS days" +%Y-%m-%d_%H-%M-%S)
pruned=0
while IFS= read -r dir; do
  name=$(basename "$dir")
  if [[ "$name" < "$cutoff" && "$dir" != "$ROOT/$stamp" ]]; then
    rm -rf "$dir"
    pruned=$((pruned + 1))
  fi
done < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*')

log "$stamp 완료: 사진 $files개, 지난 백업 $pruned개 정리"
