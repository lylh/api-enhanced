// 歌曲链接 - v1
// 此版本不再采用 br 作为音质区分的标准
// 而是采用 standard, exhigh, lossless, hires, jyeffect(高清环绕声), sky(沉浸环绕声), jymaster(超清母带) 进行音质判断
// 当unblock为true时, 会尝试使用toubiec.cn API作为最高优先级，然后使用unblockneteasemusic进行解锁

const axios = require('axios')
const logger = require('../util/logger.js')
const createOption = require('../util/option.js')

// toubiec.cn API解灰函数 - 支持音质级别自动遍历
async function getFromToubiec(songId, requestedLevel = 'jymaster') {
  // 音质级别优先级列表（从高到低）
  const qualityLevels = [
    'jymaster',   // 超清母带(最高音质)
    'sky',        // 沉浸环绕声
    'jyeffect',   // 高清环绕声
    'exhigh',     // 极高音质
    'standard',    // 标准音质
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
            freeTrialInfo: 'null',
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
  const match = require('@unblockneteasemusic/server')
  const source = ['pyncmd','kuwo', 'qq', 'migu', 'kugou']
  require('dotenv').config()
  const data = {
    ids: '[' + query.id + ']',
    level: query.level,
    encodeType: 'flac',
  }
  if (query.unblock === 'true') {
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
    try {
      const result = await match(query.id, source)
      logger.info('使用unblockneteasemusic解灰', query.id, result)
      if (result.url && result.url.includes('kuwo')) {
        const useProxy = process.env.ENABLE_PROXY || 'false'
        var proxyUrl = useProxy === 'true' ? process.env.PROXY_URL + result.url : result.url
      }
      let url = Array.isArray(result) ? (result[0]?.url || result[0]) : (result.url || result)
      if (url) {
        return {
          status: 200,
          body: {
            code: 200,
            data: [
              {
                id: Number(query.id),
                url,
                type: 'flac',
                level: query.level,
                freeTrialInfo: 'null',
                fee: 0,
                proxyUrl: proxyUrl || '',
              },
            ],
          },
          cookie: [],
        }
      }
    } catch (e) {
      console.error('Error in unblockneteasemusic:', e)
    }
    
    logger.error('所有解灰方案都失败', query.id)
  }
  if (data.level == 'sky') {
    data.immerseType = 'c51'
  }
  return request(`/api/song/enhance/player/url/v1`, data, createOption(query))
}
