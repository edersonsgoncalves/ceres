FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Chromium + Xvfb para o scraper de QR Code rodar em modo "headed"
# (a SEFAZ usa TSPD/Akamai que bloqueia navegadores headless)
RUN apk add --no-cache chromium xvfb

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Copia o prisma.config.ts e .env de forma limpa
COPY --from=builder /app/prisma.config.t[s] ./
COPY --from=builder /app/.en[v] ./

EXPOSE 3000
CMD ["./entrypoint.sh"]