FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/
COPY shared/package.json shared/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile
COPY . .
RUN cd client && pnpm build
RUN cd server && npx prisma generate && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/server/dist server/dist/
COPY --from=builder /app/server/prisma server/prisma/
COPY --from=builder /app/client/dist client/dist/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/server/node_modules server/node_modules/
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
