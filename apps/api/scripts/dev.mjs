// 로컬 개발용: 메모리 Mongo 를 띄우고 그 주소로 API 를 watch 모드 실행함
// 페이지는 apps/web 의 Next dev 서버(http://127.0.0.1:3001)가 띄우고 /api 를 여기로 넘겨 줌
import { spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
console.log(`[dev] memory mongo: ${mongo.getUri()}`);

const child = spawn('npx', ['nest', 'start', '--watch'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri('portfolio'),
    ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? 'dev-admin-token-0123456789abcdef',
    HASH_SALT: process.env.HASH_SALT ?? 'dev-salt',
  },
});

const stop = async () => {
  child.kill('SIGTERM');
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
