import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (layer: string) => fileURLToPath(new URL(`./src/${layer}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app': src('app'),
      '@views': src('views'),
      '@widgets': src('widgets'),
      '@features': src('features'),
      '@entities': src('entities'),
      '@shared': src('shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
