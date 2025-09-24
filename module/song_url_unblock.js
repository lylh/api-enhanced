// 网易云歌曲解灰
// 支持toubiec.cn API(最高优先级)、qq音乐、酷狗音乐、酷我音乐、咪咕音乐、第三方网易云API等等

const axios = require('axios')
const createOption = require('../util/option.js')
const logger = require('../util/logger.js')

// toubiec.cn API解灰函数 - 支持音质级别自动遍历
async function getFromToubiec(songId, requestedLevel = 'lossless') {
  // 音质级别优先级列表（从高到低）
  const qualityLevels = [
    'standard' ,   // 标准音质
    'exhigh',      // Hi-Res
    'jymaster',   // 超清母带(最高音质)
    'sky',        // 沉浸环绕声
    'jyeffect',   // 高清环绕声
    'hires',     // Hi-Res
    'lossless'   // 无损音质
  ]
  
  // 从请求的音质级别开始，向下遍历
  let startIndex = qualityLevels.indexOf(requestedLevel)
  if (startIndex === -1) {
    startIndex = 0 // 如果请求的级别不存在，从最高级别开始
  }
  
  for (let i = startIndex; i < qualityLevels.length; i++) {
    const currentLevel = qualityLevels[i]
    
    try {
      logger.info(`尝试toubiec.cn解灰 - 歌曲ID: ${songId}, 音质: ${currentLevel}`)
      
      const response = await axios.post(`https://wyapi.toubiec.cn/api/music/url`, {
        id: songId,
        level: currentLevel
      }, {
        headers: {
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'content-type': 'application/json',
          'origin': 'https://wyapi.toubiec.cn',
          'priority': 'u=1, i',
          'referer': 'https://wyapi.toubiec.cn/',
          'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
        },
        timeout: 10000
      })

      if (response.data && response.data.code === 200 && response.data.data && response.data.data.length > 0) {
        const songData = response.data.data[0]
        if (songData.url) {
          logger.info(`toubiec.cn解灰成功 - 歌曲ID: ${songId}, 音质: ${currentLevel}`, songData)
          return {
            id: Number(songId),
            url: songData.url,
            br: songData.br || 999000,
            size: songData.size || 0,
            md5: songData.md5 || '',
            type: songData.url.includes('.flac') ? 'flac' : 'mp3',
            level: currentLevel,
            freeTrialInfo: null,
            fee: 0,
            source: 'toubiec'
          }
        }
      }
      
      logger.info(`toubiec.cn音质${currentLevel}无可用链接，尝试下一级别`)
    } catch (error) {
      logger.error(`toubiec.cn解灰失败 - 歌曲ID: ${songId}, 音质: ${currentLevel}, 错误: ${error.message}`)
    }
  }
  
  logger.error(`toubiec.cn所有音质级别都失败 - 歌曲ID: ${songId}`)
  return null
}

module.exports = async (query, request) => {
    try {
        logger.info('开始增强解灰', query.id, '音质级别:', query.level)
        
        // 1. 首先尝试toubiec.cn API (最高优先级)
        const toubiecResult = await getFromToubiec(query.id, query.level)
        if (toubiecResult) {
            return {
                status: 200,
                body: {
                    code: 200,
                    data: [toubiecResult],
                },
                cookie: [],
            }
        }
        
        // 2. 如果toubiec.cn失败，尝试unblockneteasemusic
        const match = require("@unblockneteasemusic/server")
        const source = query.source
            ? query.source.split(',') : ['pyncmd', 'kuwo', 'qq', 'migu', 'kugou']
        const server = query.server ? query.server.split(',') : query.server
        const result = await match(query.id, !server? source : server)
        const proxy = process.env.PROXY_URL;
        logger.info("使用unblockneteasemusic解灰", query.id, result)
        const useProxy = process.env.ENABLE_PROXY || "false"
        if (result.url && result.url.includes('kuwo') && useProxy === "true") { result.proxyUrl = proxy + result.url }
        
        if (result && result.url) {
            return {
                status: 200,
                body: {
                    code: 200,
                    data: result,
                },
            }
        }
        
        logger.error('所有解灰方案都失败', query.id)
    } catch (e) {
        logger.error('增强解灰出错:', e.message)
        return {
            status: 500,
            body: {
                code: 500,
                msg: e.message || 'unblock error',
                data: [],
            },
        }
    }
    return createOption(query, request)
}
