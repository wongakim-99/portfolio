# 홈서버 앞단 리버스 프록시(Caddy) 이미지. 저장소 루트를 빌드 컨텍스트로 씀
# 페이지는 web 컨테이너(Next.js, apps/web/Dockerfile), /api 는 api 컨테이너로 넘김
FROM caddy:2.11-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8090
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8090/"]
