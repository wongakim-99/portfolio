import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

// main.ts 와 e2e 테스트가 같은 설정을 쓰도록 한곳에 모음
export function configureApp(app: NestExpressApplication): void {
  // 요청은 tailscaled(호스트) → Caddy 컨테이너 → API 컨테이너 순서로 들어옴
  // Caddy 는 Docker 사설망 주소로 보이므로 loopback 과 사설 대역이 붙인 X-Forwarded-For 만 믿음
  app.set('trust proxy', ['loopback', 'uniquelocal']);
  app.setGlobalPrefix('api');
  // 프로필 사진 업로드는 사진 파일을 본문 그대로 받음. 형식은 API 가 파일 내용으로 다시 확인함
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
