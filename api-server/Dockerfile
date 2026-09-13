# 与根目录 Dockerfile 一致：国内环境默认走 DaoCloud 镜像源
ARG DOCKER_REGISTRY=docker.m.daocloud.io

FROM ${DOCKER_REGISTRY}/library/node:20-alpine
WORKDIR /app
COPY server.mjs .
ENV PORT=8788
VOLUME /data
EXPOSE 8788
CMD ["node", "server.mjs"]
