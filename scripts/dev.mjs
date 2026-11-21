// 로컬 개발: API(메모리 Mongo, :3000)와 Next 페이지(:3001)를 한 터미널에서 같이 띄움
// 로그를 따로 보고 싶으면 터미널 두 개에서 npm run dev:api, npm run dev:web 을 각각 실행
import { spawn } from 'node:child_process';

const children = [
  ['api', ['run', 'dev', '-w', 'apps/api']],
  ['web', ['run', 'dev', '-w', 'apps/web']],
].map(([name, args]) => {
  const child = spawn('npm', args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} 종료 (${code ?? 'signal'})`);
    stop(code ?? 0);
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
