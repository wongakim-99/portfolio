import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

// main.ts 와 e2e 테스트가 같은 설정을 쓰도록 한곳에 모음
export function configureApp(app: NestExpressApplication): void {
  // Funnel(tailscaled)이 같은 서버에서 프록시하므로 loopback 이 붙인 X-Forwarded-For 만 믿음
  app.set('trust proxy', 'loopback');
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
