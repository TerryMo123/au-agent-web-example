# 前端静态资源
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# 有 lockfile 用 npm ci（可复现）；没有则 npm install（兼容未提交 lock 的仓库）
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# Nginx 托管 + 反代 /api
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# alpine 镜像可能无 wget，用 nginx 自带的方式探测
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz 2>/dev/null || exit 0
