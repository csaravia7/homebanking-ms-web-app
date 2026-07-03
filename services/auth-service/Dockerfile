# ── Build stage (Debian — glibc para módulos nativos) ────────────────────────
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

# 1. Instala sin ejecutar scripts nativos (evita compilar sqlite3, que no se usa)
RUN npm install --ignore-scripts

# 2. Compila SOLO better-sqlite3; -g0 reduce uso de memoria de g++ (~50%)
ENV CFLAGS="-g0" CXXFLAGS="-g0"
RUN npm rebuild better-sqlite3

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:18-slim

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/package*.json ./

EXPOSE 3001
CMD ["node", "dist/index.js"]
