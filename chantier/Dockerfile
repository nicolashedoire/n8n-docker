FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.mjs quantities.mjs reports.mjs pdf-report.mjs catalog.json rules.json ./
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
