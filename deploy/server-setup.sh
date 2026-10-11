#!/usr/bin/env bash
# 홈서버 1회성 사용자 영역 설정 (sudo 불필요). 이미 된 단계는 건너뜀
# root 가 필요한 MongoDB 설치는 root-setup.sh 를 먼저 실행할 것
#   사용: RUNNER_TOKEN=<등록 토큰> bash server-setup.sh
#   토큰: gh api -X POST repos/wongakim-99/portfolio/actions/runners/registration-token --jq .token
set -euo pipefail

NODE_VERSION=v24.21.0
CADDY_VERSION=2.11.7
RUNNER_VERSION=2.338.0
RUNNER_SHA256=af4b794c1bc41d73d40535e3fe092a39f9679cd8d965954c2aca25a05ca41d32
REPO_URL=https://github.com/wongakim-99/portfolio

mkdir -p ~/.local/opt ~/.local/bin ~/.config/systemd/user ~/portfolio/site
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 로그인하지 않아도 사용자 서비스가 부팅 시 뜨도록
loginctl enable-linger "$USER"

if [[ ! -x ~/.local/opt/node-$NODE_VERSION-linux-x64/bin/node ]]; then
  f=node-$NODE_VERSION-linux-x64.tar.xz
  curl -fsSL -o "$tmp/$f" https://nodejs.org/dist/$NODE_VERSION/$f
  (cd "$tmp" && curl -fsSL https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt | grep " $f\$" | sha256sum -c -)
  tar -xJf "$tmp/$f" -C ~/.local/opt
fi
ln -sfn ~/.local/opt/node-$NODE_VERSION-linux-x64 ~/.local/node
grep -q '.local/node/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.bashrc

if ! ~/.local/bin/caddy version 2>/dev/null | grep -q "v$CADDY_VERSION"; then
  f=caddy_${CADDY_VERSION}_linux_amd64.tar.gz
  base=https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION
  curl -fsSL -o "$tmp/$f" "$base/$f"
  (cd "$tmp" && curl -fsSL "$base/caddy_${CADDY_VERSION}_checksums.txt" | grep " $f\$" | sha512sum -c -)
  tar -xzf "$tmp/$f" -C "$tmp" caddy
  install -m 755 "$tmp/caddy" ~/.local/bin/caddy
fi

if [[ ! -f ~/actions-runner/.runner ]]; then
  : "${RUNNER_TOKEN:?RUNNER_TOKEN 이 필요함 (파일 상단 주석 참고)}"
  f=actions-runner-linux-x64-$RUNNER_VERSION.tar.gz
  mkdir -p ~/actions-runner
  curl -fsSL -o "$tmp/$f" https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/$f
  echo "$RUNNER_SHA256  $tmp/$f" | sha256sum -c -
  tar -xzf "$tmp/$f" -C ~/actions-runner
  (cd ~/actions-runner && ./config.sh --unattended --replace --url "$REPO_URL" --token "$RUNNER_TOKEN" \
    --name "$(hostname)" --labels homeserver --work _work)
fi

here=$(cd "$(dirname "$0")" && pwd)
cp "$here/github-runner.service" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now github-runner.service

echo "완료: node $(~/.local/node/bin/node -v), $(~/.local/bin/caddy version | cut -d' ' -f1), runner $(systemctl --user is-active github-runner)"
echo "API, Caddy 서비스와 Caddyfile 은 첫 배포(deploy.sh) 때 설치됨"
