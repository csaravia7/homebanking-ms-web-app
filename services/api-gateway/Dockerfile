FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
# npm install (not ci) so missing transitive types are resolved cleanly
RUN npm install

COPY . .
RUN npm run build

# ── Runtime image ────────────────────────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/package*.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]
