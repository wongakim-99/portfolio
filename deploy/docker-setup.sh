#!/usr/bin/env bash
# Docker 전환용 1회성 설정 (sudo 불필요). 이미 있는 파일은 건드리지 않음
# 먼저 계정을 docker 그룹에 넣고 사용자 서비스 관리자를 다시 띄워야 함 (README '처음 한 번만 한 설정' 참고)
#   - mongo.env       : 컨테이너 MongoDB 의 root, 앱, 백업(읽기 전용) 계정 비밀번호 (서버에서 새로 만듦)
#   - api.docker.env  : 기존 api.env 의 ADMIN_TOKEN, HASH_SALT 를 그대로 쓰고 DB 주소만 컨테이너로 바꿈
set -euo pipefail

CONFIG="$HOME/.config/portfolio"
umask 077

if ! docker info >/dev/null 2>&1; then
  echo "docker 에 접근할 수 없음. docker 그룹 추가 뒤 사용자 서비스 관리자를 다시 띄웠는지 확인" >&2
  exit 1
fi

if [[ ! -f "$CONFIG/mongo.env" ]]; then
  printf 'MONGO_INITDB_ROOT_USERNAME=root\nMONGO_INITDB_ROOT_PASSWORD=%s\nAPP_DB_PASSWORD=%s\n' \
    "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" > "$CONFIG/mongo.env"
  echo "만듦: $CONFIG/mongo.env"
fi
# 관리 패널 백업용 읽기 전용 계정 비밀번호 (나중에 추가된 값이라 기존 파일에도 없으면 덧붙임)
if ! grep -q '^BACKUP_DB_PASSWORD=' "$CONFIG/mongo.env"; then
  printf 'BACKUP_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> "$CONFIG/mongo.env"
  echo "추가: $CONFIG/mongo.env BACKUP_DB_PASSWORD"
fi

if [[ ! -f "$CONFIG/api.docker.env" ]]; then
  (
    set -a
    # shellcheck disable=SC1091
    . "$CONFIG/api.env"
    # shellcheck disable=SC1091
    . "$CONFIG/mongo.env"
    set +a
    # 방문자 해시가 이어지도록 HASH_SALT 는 기존 값을 그대로 씀
    printf 'NODE_ENV=production\nADMIN_TOKEN=%s\nHASH_SALT=%s\nMONGODB_URI=mongodb://portfolio:%s@mongo:27017/portfolio?authSource=portfolio\n' \
      "$ADMIN_TOKEN" "$HASH_SALT" "$APP_DB_PASSWORD" > "$CONFIG/api.docker.env"
  )
  echo "만듦: $CONFIG/api.docker.env"
fi

ls -l "$CONFIG"
