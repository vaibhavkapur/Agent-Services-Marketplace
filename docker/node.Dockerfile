FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
COPY fixtures ./fixtures
COPY migrations ./migrations
RUN pnpm install --frozen-lockfile=false
ARG APP_DIR
ENV APP_DIR=${APP_DIR}
EXPOSE 3000 3001 3002 3003 3004
CMD ["pnpm", "--filter", "@asm/api", "dev"]
