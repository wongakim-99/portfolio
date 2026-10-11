// deploy.sh 가 mongo 컨테이너 안에서 root 로 실행함. 없는 계정만 만듦
// 비밀번호는 컨테이너 환경변수(~/.config/portfolio/mongo.env)에서 읽음
//   - portfolio        : API 가 쓰는 계정 (readWrite)
//   - portfolio-backup : 관리 패널(gawon-control) 백업용 읽기 전용 계정
const app = db.getSiblingDB('portfolio');
const users = [
  { user: 'portfolio', pwd: process.env.APP_DB_PASSWORD, role: 'readWrite' },
  { user: 'portfolio-backup', pwd: process.env.BACKUP_DB_PASSWORD, role: 'read' },
];
for (const { user, pwd, role } of users) {
  if (!pwd || app.getUser(user)) continue;
  app.createUser({ user, pwd, roles: [{ role, db: 'portfolio' }] });
  print(`[mongo] ${user} 계정 만듦`);
}
