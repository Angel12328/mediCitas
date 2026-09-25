FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma
COPY . .
RUN npm run build
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]