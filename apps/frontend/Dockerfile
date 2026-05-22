# ==== Stage 1: Build ====
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite env vars must be set at build time
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ==== Stage 2: Serve with Caddy ====
FROM caddy:2-alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /srv

# Caddy config
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
