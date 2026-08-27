# Render Free — API Dockerfile (multi-stage, build con tsc)
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dependencies
RUN npm ci --ignore-scripts || npm install --ignore-scripts

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npx tsc

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
