# 使用官方 Node.js LTS Alpine 镜像作为基础镜像
FROM node:lts-alpine

# 设置维护者信息
LABEL maintainer="netease-music-api"
LABEL description="网易云音乐 API 服务"

# 安装必要的系统依赖
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

# 复制 package 文件
COPY package*.json ./

# 【修改点】使用 --omit=dev 和 --ignore-scripts
# --omit=dev: 只安装生产依赖
# --ignore-scripts: 忽略 prepare 等生命周期脚本，避免因缺少 devDependencies 而报错
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

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

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# 使用 tini 作为 init 进程，避免僵尸进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "app.js"]