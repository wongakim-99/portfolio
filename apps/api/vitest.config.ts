import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // 메모리 Mongo 첫 기동(바이너리 다운로드)이 느릴 수 있음
    hookTimeout: 120_000,
  },
});
