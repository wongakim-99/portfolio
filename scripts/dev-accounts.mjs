// 로컬 개발용 계정 만들기. 로컬에는 메일(SMTP) 설정이 없어 가입이 막혀 있으므로 확인을 마친 계정을 바로 넣음
// npm run dev 를 띄운 채로 node scripts/dev-accounts.mjs (메모리 Mongo 주소는 .dev-mongo-uri 에서 읽음)
// 만드는 계정 (비밀번호는 모두 local-test-password): owner@local.test(주인장), friend@local.test, stranger@local.test
import { randomBytes, scrypt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const mongoose = require('mongoose');

const savedUri = () => {
  try {
    return readFileSync(new URL('../.dev-mongo-uri', import.meta.url), 'utf8').trim();
  } catch {
    return undefined;
  }
};
const uri = process.argv[2] ?? savedUri();
if (!uri?.startsWith('mongodb://127.0.0.1') && !uri?.startsWith('mongodb://localhost')) {
  console.error('로컬 Mongo 주소를 못 찾았습니다. npm run dev 를 먼저 띄우거나 [dev] memory mongo: 주소를 넘겨 주세요.');
  process.exit(1);
}

// apps/api/src/modules/identity/infrastructure/scrypt-password-hasher.ts 와 같은 방식
const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };
const derive = (password, salt) => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => (error ? reject(error) : resolve(key)));
});
const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${(await derive('local-test-password', salt)).toString('hex')}`;

await mongoose.connect(new URL('portfolio', uri.endsWith('/') ? uri : `${uri}/`).toString());
const users = mongoose.connection.collection('community_users');
const now = new Date();
for (const [email, name, role] of [
  ['owner@local.test', '김가원', 'owner'],
  ['friend@local.test', '오랜 친구', 'member'],
  ['stranger@local.test', '지나가던 개발자', 'member'],
]) {
  await users.updateOne(
    { email },
    { $set: { email, name, role, passwordHash, verifiedAt: now }, $setOnInsert: { bio: '', avatar: null, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
}
console.log('로컬 계정 3개를 만들었습니다. 비밀번호: local-test-password');
await mongoose.disconnect();
