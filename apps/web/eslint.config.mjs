import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

// FSD 레이어 경계. 위에서 아래로만 import 함: app > views > widgets > features > entities > shared
// 같은 레이어끼리는 shared 만 서로 씀. 다른 슬라이스가 필요하면 한 층 위에서 조립함
const to = (...types) => types.map((type) => ({ to: { element: { type } } }));
const LAYERS_BELOW = {
  app: to('views', 'widgets', 'features', 'entities', 'shared'),
  views: to('widgets', 'features', 'entities', 'shared'),
  widgets: to('features', 'entities', 'shared'),
  features: to('entities', 'shared'),
  entities: to('shared'),
  shared: to('shared'),
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'views', pattern: 'src/views/**' },
        { type: 'widgets', pattern: 'src/widgets/**' },
        { type: 'features', pattern: 'src/features/**' },
        { type: 'entities', pattern: 'src/entities/**' },
        { type: 'shared', pattern: 'src/shared/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: Object.entries(LAYERS_BELOW).map(([type, allow]) => ({ from: [{ element: { type } }], allow })),
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts']),
]);
