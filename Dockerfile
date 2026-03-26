# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Pass backend URL at build time for docker-compose local testing
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Production stage (nginx serves the SPA) ───────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: SPA routing + no-cache on index.html so browsers always get fresh bundles
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  # Proxy /uploads/ to the backend container so avatar images load in Docker\n\
  location /uploads/ {\n\
    proxy_pass http://backend:3001/uploads/;\n\
    proxy_http_version 1.1;\n\
    proxy_set_header Host $host;\n\
  }\n\
  # Proxy /api/ to the backend container\n\
  location /api/ {\n\
    proxy_pass http://backend:3001/api/;\n\
    proxy_http_version 1.1;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
  }\n\
  # Hashed assets: cache forever\n\
  location ~* \\.(?:js|css)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
  # index.html: never cache so new deploys take effect immediately\n\
  location = /index.html {\n\
    add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
