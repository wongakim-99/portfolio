# 포트폴리오 API 이미지. 저장소 루트를 빌드 컨텍스트로 씀 (deploy/deploy.sh 참고)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
# 설치 스크립트는 막음. 테스트용 메모리 Mongo 바이너리 다운로드 같은 건 이미지에 필요 없음
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
# 페이지 영수증의 '버전, 배포 시각' 으로 보임
ARG RELEASE_COMMIT=""
ARG RELEASE_BUILT_AT=""
ENV RELEASE_COMMIT=$RELEASE_COMMIT RELEASE_BUILT_AT=$RELEASE_BUILT_AT
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
