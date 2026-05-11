# Static landing page served as the apex (mohe.today/) by Caddy.
# Tiny: nginx:alpine + a single index.html. No build step.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/   /usr/share/nginx/html/

EXPOSE 80

# Health check — Caddy can fall back if this dies.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/ >/dev/null 2>&1 || exit 1
