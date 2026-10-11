#!/usr/bin/env bash
# 홈서버 1회성 root 설정. 서버에서 `sudo bash root-setup.sh` 로 실행함
# - MongoDB 8.0 Community 설치 (공식 apt 저장소), 인증 켜기, 부팅 시 자동 시작
# - ggw1999 를 tailscale operator 로 지정 (Funnel 경로 변경을 sudo 없이 하려고)
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

if [[ $EUID -ne 0 ]]; then
  echo "sudo bash $0 로 실행해 주세요" >&2
  exit 1
fi

if ! command -v mongod >/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
    | gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update
  apt-get install -y mongodb-org
fi

# bindIp 는 기본값 127.0.0.1 그대로 둠 (서버 밖에서 접속 불가)
if ! grep -q "authorization: enabled" /etc/mongod.conf; then
  sed -i 's/^#security:/security:\n  authorization: enabled/' /etc/mongod.conf
fi
systemctl enable mongod
systemctl restart mongod

tailscale set --operator=ggw1999

echo
echo "완료: $(mongod --version | head -1)"
echo "mongod: $(systemctl is-active mongod) / bindIp: $(grep bindIp /etc/mongod.conf | xargs)"
