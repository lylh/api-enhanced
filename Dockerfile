# 使用官方 Node.js LTS Alpine 镜像作为基础镜像
FROM node:lts-alpine

# 设置维护者信息
LABEL maintainer="netease-music-api"
LABEL description="网易云音乐 API 服务"

# 安装必要的系统依赖
# 1. 添加 wget 以支持 HEALTHCHECK
# 2. 只保留 tini 作为 init 系统
RUN apk add --no-cache \
    tini \
    wget \
    && rm -rf /var/cache/apk/*

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# 创建应用目录
WORKDIR /app

# 【修改点 1】只复制 package.json 和 package-lock.json
# 不再依赖 yarn.lock，统一使用 npm
COPY package*.json ./

# 【修改点 2】使用 npm ci 替代 yarn install
# npm ci 是为 CI/CD 环境设计的，速度更快，依赖更严格
# --only=production 只安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs \
    && adduser -S netease -u 1001 -G nodejs

# 复制应用代码（根据 .dockerignore 配置）
COPY --chown=netease:nodejs . .

# 创建必要的目录并设置权限
RUN mkdir -p /tmp \
    && chown -R netease:nodejs /app /tmp

# 切换到非 root 用户
USER netease

# 暴露端口
EXPOSE 3000

# 健康检查 (现在 wget 可用)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# 使用 tini 作为 init 进程，避免僵尸进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "app.js"]