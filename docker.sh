# 构建镜像
###
 # @Author: paner 328538688@qq.com
 # @Date: 2025-10-12 10:59:16
 # @LastEditors: paner 328538688@qq.com
 # @LastEditTime: 2025-10-12 10:59:20
 # @FilePath: \api-enhanced\docker.sh
 # @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%A
### 
docker build -t netease-music-api .

# 运行容器
docker run -d \
  --name netease-api \
  -p 4000:3000 \
  --restart unless-stopped \
  netease-music-api

# 查看日志
docker logs -f netease-api

# 健康检查
docker exec netease-api wget -qO- http://localhost:4000
