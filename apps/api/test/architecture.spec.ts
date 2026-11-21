import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 백엔드 DDD 계층 규칙. 화면의 FSD 경계(apps/web/eslint.config.mjs)처럼 어기면 CI 에서 실패함
// src/modules/<영역>/{domain,application,infrastructure,presentation}
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const MODULES = path.join(SRC, 'modules');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith('.ts') ? [full] : [];
  });
}

function imports(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^'"]*?from\s+'([^']+)'/gm)].map((match) => match[1]!);
}

// 파일이 속한 영역과 계층. 영역 바로 아래 파일(*.module.ts, index.ts)은 계층 없음
function where(file: string): { module: string; layer: string | null } | null {
  const parts = path.relative(MODULES, file).split(path.sep);
  if (parts[0] === '..' || parts.length < 2) return null;
  return { module: parts[0]!, layer: parts.length > 2 ? parts[1]! : null };
}

const sources = files(MODULES);
const violations = (check: (file: string, target: string, resolved: string) => string | null) =>
  sources.flatMap((file) => imports(file).flatMap((target) => {
    const resolved = target.startsWith('.') ? path.resolve(path.dirname(file), target) : target;
    const problem = check(file, target, resolved);
    return problem ? [`${path.relative(SRC, file)} -> ${target}: ${problem}`] : [];
  }));

describe('백엔드 계층 규칙', () => {
  it('영역은 이 다섯 계층 폴더만 가짐', () => {
    const layers = new Set(['domain', 'application', 'infrastructure', 'presentation']);
    const unknown = sources.map(where).filter((place) => place?.layer && !layers.has(place.layer));
    expect(unknown).toEqual([]);
  });

  it('domain 은 Nest, Mongoose, Express 와 다른 계층을 모름', () => {
    expect(violations((file, target, resolved) => {
      if (where(file)?.layer !== 'domain') return null;
      if (/^(@nestjs\/|mongoose$|express$|minio$|nodemailer$)/.test(target)) return '도메인에 프레임워크';
      const place = where(resolved);
      if (place && place.layer && place.layer !== 'domain') return '도메인이 다른 계층을 씀';
      if (resolved.startsWith(path.join(SRC, 'shared')) && !resolved.startsWith(path.join(SRC, 'shared', 'domain'))) return '도메인이 shared 의 기술 조각을 씀';
      return null;
    })).toEqual([]);
  });

  it('application 은 자기 영역의 infrastructure, presentation 을 모름', () => {
    expect(violations((file, target, resolved) => {
      const from = where(file);
      if (from?.layer !== 'application') return null;
      if (/^(@nestjs\/mongoose|mongoose)$/.test(target)) return '응용 계층에 Mongoose';
      const to = where(resolved);
      return to && to.module === from.module && (to.layer === 'infrastructure' || to.layer === 'presentation') ? '응용 계층이 바깥 계층을 씀' : null;
    })).toEqual([]);
  });

  it('infrastructure 는 presentation 을 모름', () => {
    expect(violations((file, _target, resolved) => {
      const from = where(file);
      const to = where(resolved);
      return from?.layer === 'infrastructure' && to?.module === from.module && to.layer === 'presentation' ? '구현이 컨트롤러를 씀' : null;
    })).toEqual([]);
  });

  it('다른 영역은 그 영역의 index.ts 로만 가져다 씀', () => {
    expect(violations((file, _target, resolved) => {
      const from = where(file);
      const to = where(resolved);
      if (!from || !to || to.module === from.module) return null;
      return path.basename(resolved) === 'index.js' && to.layer === null ? null : '다른 영역의 안쪽 파일을 직접 씀';
    })).toEqual([]);
  });
});
