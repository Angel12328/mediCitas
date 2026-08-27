FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY dist ./dist
COPY prisma ./prisma
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
