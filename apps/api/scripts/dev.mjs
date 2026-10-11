// 로컬 개발용: 메모리 Mongo 를 띄우고 그 주소로 API 를 watch 모드 실행함
// http://127.0.0.1:3000 에서 apps/web 페이지와 /api 를 같이 볼 수 있음
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
    SERVE_WEB_DIR: new URL('../../web', import.meta.url).pathname,
  },
});

const stop = async () => {
  child.kill('SIGTERM');
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
