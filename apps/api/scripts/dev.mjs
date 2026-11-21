// 로컬 개발용: 메모리 Mongo 를 띄우고 그 주소로 API 를 watch 모드 실행함
// 페이지는 apps/web 의 Next dev 서버(http://127.0.0.1:3001)가 띄우고 /api 를 여기로 넘겨 줌
import { execFileSync, spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
console.log(`[dev] memory mongo: ${mongo.getUri()}`);
// scripts/dev-accounts.mjs 가 이 주소로 로컬 계정을 만듦 (git 에는 안 올림)
const uriFile = new URL('../../../.dev-mongo-uri', import.meta.url);
writeFileSync(uriFile, mongo.getUri());

// 잠긴 글의 AI 채점 키. 환경변수가 없으면 scripts/configure-openai-key.sh 가 Mac 키체인에 둔 값을 씀. 없으면 미리 적어 둔 채점평만 나옴
function openAiKey() {
  if (process.env.OPENAI_API_KEY || process.platform !== 'darwin') return process.env.OPENAI_API_KEY;
  try {
    return execFileSync('security', ['find-generic-password', '-a', 'openai-api-key', '-s', 'gawon-portfolio-openai', '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}
const openAi = openAiKey();
console.log(`[dev] 잠긴 글 AI 채점: ${openAi ? '켜짐' : '꺼짐 (키 없음)'}`);

const child = spawn('npx', ['nest', 'start', '--watch'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri('portfolio'),
    ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? 'dev-admin-token-0123456789abcdef',
    HASH_SALT: process.env.HASH_SALT ?? 'dev-salt',
    ...(openAi ? { OPENAI_API_KEY: openAi } : {}),
  },
});

const stop = async () => {
  child.kill('SIGTERM');
  rmSync(uriFile, { force: true });
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
