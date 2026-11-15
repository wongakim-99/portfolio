#!/usr/bin/env bash
# Run locally after creating a NAVER application password. The secret travels only over SSH stdin.
set -euo pipefail
set +x

if [[ ! -t 0 ]]; then
  echo '터미널에서 직접 실행해 주세요.' >&2
  exit 1
fi

read -r -p '네이버 메일 주소: ' mail_address </dev/tty
read -r -s -p '새 애플리케이션 비밀번호 (화면에 표시되지 않음): ' app_password </dev/tty
trap 'unset app_password' EXIT
printf '\n' >/dev/tty

remote_code=$(cat <<'PY'
import os
import pathlib
import re
import sys
import tempfile

values = sys.stdin.read().splitlines()
if len(values) != 2:
    raise SystemExit("입력 형식이 올바르지 않습니다.")
email, password = values
email = email.strip().lower()
password = password.replace(" ", "")
if not re.fullmatch(r"[a-z0-9._-]+@naver\.com", email):
    raise SystemExit("네이버 메일 주소를 확인해 주세요.")
if not re.fullmatch(r"[A-Za-z0-9]{8,64}", password):
    raise SystemExit("애플리케이션 비밀번호 형식을 확인해 주세요.")

config = pathlib.Path.home() / ".config/portfolio/api.docker.env"
if not config.is_file():
    raise SystemExit("홈서버의 포트폴리오 환경설정 파일을 찾을 수 없습니다.")
existing = config.read_text(encoding="utf-8").splitlines()
updates = {
    "COMMUNITY_SMTP_USER": email,
    "COMMUNITY_SMTP_PASSWORD": password,
    "COMMUNITY_BASE_URL": "https://gawon-dev.tail7c7524.ts.net",
}
kept = [line for line in existing if not any(line.startswith(key + "=") for key in updates)]
kept.extend(f"{key}={value}" for key, value in updates.items())
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
print("홈서버에 메일 설정을 저장했습니다. 비밀번호 값은 출력하지 않았습니다.")
PY
)

encoded_code=$(printf '%s' "$remote_code" | base64 | tr -d '\n')
printf '%s\n%s\n' "$mail_address" "$app_password" |
  ssh homeserver "python3 -c \"import base64; exec(base64.b64decode('$encoded_code'))\""
unset app_password
