# Render Free — API Dockerfile (simple, sin etapa de build)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "src/main.ts"]
