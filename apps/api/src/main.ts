import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  // 로컬 개발에서만 정적 페이지까지 같이 띄움. 서버에서는 Funnel 이 apps/web 을 직접 서비스함
  if (process.env.SERVE_WEB_DIR) {
    app.useStaticAssets(process.env.SERVE_WEB_DIR);
  }

  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
}
await bootstrap();
