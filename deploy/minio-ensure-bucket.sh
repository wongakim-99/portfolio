# deploy.sh 가 minio 컨테이너 안에서 실행함 (sh). 이미 있는 버킷과 계정은 그대로 두고 권한만 다시 맞춤
# 비밀번호는 컨테이너 환경변수(~/.config/portfolio/minio.env)에서 읽음
#   - community-media : 피드 프로필 사진 버킷. 익명 접근 없음, API 가 읽어서 내보냄
#   - portfolio-api   : API 가 쓰는 계정. 이 버킷의 객체 읽기, 쓰기, 삭제만 할 수 있음
#   - portfolio-backup: 매일 사진 백업(deploy/minio-backup.sh)이 쓰는 계정. 이 버킷의 목록 보기와 읽기만 할 수 있음
#     비밀번호는 deploy.sh 가 ~/.config/portfolio/minio-backup.env 에서 읽어 이 스크립트 앞에 붙여 넘김 (MINIO_BACKUP_SECRET_KEY)
set -eu

export MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"
policy=/tmp/portfolio-api-policy.json
backup_policy=/tmp/portfolio-backup-policy.json
trap 'rm -f "$policy" "$backup_policy"' EXIT

mc mb --quiet --ignore-existing local/community-media >/dev/null
mc anonymous set none local/community-media >/dev/null

cat > "$policy" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    "Resource": ["arn:aws:s3:::community-media/*"]
  }]
}
JSON
mc admin policy create local portfolio-api "$policy" >/dev/null
# 이미 있는 계정이면 비밀번호만 minio.env 값으로 다시 맞춤. 정책 연결도 여러 번 해도 그대로임
mc admin user add local portfolio-api "$MINIO_API_SECRET_KEY" >/dev/null
mc admin policy attach local portfolio-api --user portfolio-api >/dev/null
echo "[minio] community-media 버킷과 portfolio-api 계정 확인"

if [ -z "${MINIO_BACKUP_SECRET_KEY:-}" ]; then
  echo "[minio] MINIO_BACKUP_SECRET_KEY 가 없어 portfolio-backup 계정은 건너뜀" >&2
  exit 0
fi
cat > "$backup_policy" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": ["arn:aws:s3:::community-media"] },
    { "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": ["arn:aws:s3:::community-media/*"] }
  ]
}
JSON
mc admin policy create local portfolio-backup "$backup_policy" >/dev/null
mc admin user add local portfolio-backup "$MINIO_BACKUP_SECRET_KEY" >/dev/null
mc admin policy attach local portfolio-backup --user portfolio-backup >/dev/null
echo "[minio] portfolio-backup 읽기 전용 계정 확인"
