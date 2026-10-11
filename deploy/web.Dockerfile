# 정적 페이지와 리버스 프록시(Caddy) 이미지. 저장소 루트를 빌드 컨텍스트로 씀
# apps/web/gawon-portfolio.pdf 는 npm run build 가 먼저 만들어 둬야 함
FROM caddy:2.11-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY apps/web /srv
RUN test -s /srv/gawon-portfolio.pdf \
  && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8090
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8090/"]
