FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

# Build
FROM base AS build
COPY package.json tsconfig.json ./
COPY src/ src/
RUN npm install && npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle/ drizzle/
COPY drizzle.config.ts ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
