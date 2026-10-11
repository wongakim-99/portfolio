import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

// main.ts 와 e2e 테스트가 같은 설정을 쓰도록 한곳에 모음
export function configureApp(app: NestExpressApplication): void {
  // 요청은 tailscaled(호스트) → Caddy 컨테이너 → API 컨테이너 순서로 들어옴
  // Caddy 는 Docker 사설망 주소로 보이므로 loopback 과 사설 대역이 붙인 X-Forwarded-For 만 믿음
  app.set('trust proxy', ['loopback', 'uniquelocal']);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
