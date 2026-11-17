FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/voice-relay/package.json apps/voice-relay/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/fixtures/package.json packages/fixtures/package.json
COPY packages/voice-core/package.json packages/voice-core/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @mindguard/voice-core --workspace @mindguard/voice-relay --include-workspace-root=false
COPY . .
RUN npm run build -w @mindguard/voice-core \
    && npm run build -w @mindguard/voice-relay \
    && npm run test:voice \
    && npm prune --omit=dev --workspace @mindguard/voice-core --workspace @mindguard/voice-relay --include-workspace-root=false

FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/voice-core/package.json ./packages/voice-core/package.json
COPY --from=build /app/packages/voice-core/dist ./packages/voice-core/dist
COPY --from=build /app/apps/voice-relay/package.json ./apps/voice-relay/package.json
COPY --from=build /app/apps/voice-relay/dist ./apps/voice-relay/dist
COPY apps/voice-relay/local-aws.config apps/voice-relay/read-local-credentials.cjs ./apps/voice-relay/
USER node
EXPOSE 3001
CMD ["node", "apps/voice-relay/dist/main.js"]
