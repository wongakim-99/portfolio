# 포트폴리오 페이지(Next.js) 이미지. 저장소 루트를 빌드 컨텍스트로 씀 (deploy/deploy.sh 참고)
# apps/web/public/gawon-portfolio.pdf 는 npm run build(npm run pdf)가 먼저 만들어 둬야 함
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# 페이지 워크스페이스의 의존성만 받음. 설치 스크립트는 막음
RUN npm ci -w apps/web --ignore-scripts --no-audit --no-fund
COPY apps/web apps/web
RUN npm run build -w apps/web

# 실행 이미지에는 next build 가 추려 둔 standalone 서버와 정적 파일만 넣음
FROM node:24-alpine
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3001 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
COPY --from=build /app/apps/web/public apps/web/public
RUN test -s apps/web/public/gawon-portfolio.pdf
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
