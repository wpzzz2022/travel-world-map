# ==== 构建阶段 ====
# Docker Hub 直连不通的环境（国内服务器/本机），默认走 DaoCloud 镜像源；
# 能直连 Docker Hub 的环境传 --build-arg DOCKER_REGISTRY=docker.io
ARG DOCKER_REGISTRY=docker.m.daocloud.io

FROM ${DOCKER_REGISTRY}/library/node:20-alpine AS build
WORKDIR /app

# 默认走国内镜像源，海外构建时传 --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==== 运行阶段：纯静态站，nginx 托管 ====
FROM ${DOCKER_REGISTRY}/library/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
