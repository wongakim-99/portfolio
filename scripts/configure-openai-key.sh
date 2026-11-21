#!/usr/bin/env bash
# 블로그 잠긴 글의 AI 채점에 쓰는 OpenAI API 키를 Mac 키체인에 두고, 홈서버 api.docker.env 에 SSH 표준 입력으로 넣음
#   bash scripts/configure-openai-key.sh                   키를 묻고(화면에 안 보임) 저장
#   pbpaste | bash scripts/configure-openai-key.sh         클립보드의 키로 저장
#   bash scripts/configure-openai-key.sh --from-keychain   키체인에 둔 키를 홈서버에만 다시 넣음
# 로컬 npm run dev 도 키체인의 이 키를 씀 (apps/api/scripts/dev.mjs). 홈서버는 다음 배포 때 API 컨테이너가 새로 뜨며 읽음
set -euo pipefail
set +x

service=gawon-portfolio-openai
account=openai-api-key
from_keychain=false
if [[ ${1:-} == --from-keychain ]]; then
  from_keychain=true
  api_key=$(security find-generic-password -a "$account" -s "$service" -w)
elif [[ -t 0 ]]; then
  read -r -s -p 'OpenAI API 키 (화면에 표시되지 않음): ' api_key </dev/tty
  printf '\n' >/dev/tty
else
  read -r api_key || true
fi
trap 'unset api_key' EXIT
api_key=${api_key//[[:space:]]/}
# macOS bash 3.2 의 정규식은 반복 횟수를 255 까지만 받아서 길이는 따로 봄
if [[ ! "$api_key" =~ ^sk-[A-Za-z0-9_-]{20,}$ || ${#api_key} -gt 300 ]]; then
  echo 'OpenAI API 키 형식을 확인해 주세요.' >&2
  exit 1
fi

if ! $from_keychain; then
  printf '%s' "$api_key" |
    swift "$(dirname "$0")/store-community-smtp-password.swift" "$account" "$service" '포트폴리오 블로그 OpenAI API'
fi

remote_code=$(cat <<'PY'
import os
import pathlib
import re
import sys
import tempfile

key = sys.stdin.read().strip()
if not re.fullmatch(r"sk-[A-Za-z0-9_-]{20,300}", key):
    raise SystemExit("OpenAI API 키 형식이 올바르지 않습니다.")

config = pathlib.Path.home() / ".config/portfolio/api.docker.env"
if not config.is_file():
    raise SystemExit("홈서버의 포트폴리오 환경설정 파일을 찾을 수 없습니다.")
kept = [line for line in config.read_text(encoding="utf-8").splitlines() if not line.startswith("OPENAI_API_KEY=")]
kept.append(f"OPENAI_API_KEY={key}")
path = None
try:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=config.parent, prefix=".api.docker.env.", delete=False) as temporary:
        path = pathlib.Path(temporary.name)
        os.fchmod(temporary.fileno(), 0o600)
        temporary.write("\n".join(kept) + "\n")
    os.replace(path, config)
finally:
    if path is not None:
        path.unlink(missing_ok=True)
print("홈서버에 OpenAI API 키를 저장했습니다. 키 값은 출력하지 않았습니다.")
PY
)

encoded_code=$(printf '%s' "$remote_code" | base64 | tr -d '\n')
printf '%s\n' "$api_key" |
  ssh homeserver "python3 -c \"import base64; exec(base64.b64decode('$encoded_code'))\""
unset api_key
