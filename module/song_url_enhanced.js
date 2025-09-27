// 增强版歌曲链接解灰 - 集成toubiec.cn API作为最高优先级音源
// 支持toubiec.cn、qq音乐、酷狗音乐、酷我音乐、咪咕音乐等多音源解灰

const axios = require('axios')
const logger = require('../util/logger.js')
const createOption = require('../util/option.js')

// toubiec.cn API解灰函数 - 支持音质级别自动遍历
async function getFromToubiec(songId, requestedLevel = 'lossless') {
  // 音质级别优先级列表（从高到低）
  const qualityLevels = [
    'jymaster',   // 超清母带(最高音质) - 5.7Mbps FLAC
    'sky',        // 沉浸环绕声 - 2.3Mbps FLAC  
    'jyeffect',   // 高清环绕声 - 3.0Mbps FLAC
    'hires',      // Hi-Res - 962kbps FLAC
    'lossless',   // 无损音质 - 962kbps FLAC
    'exhigh',     // 极高音质 - 320kbps MP3
    'standard'    // 标准音质 - 128kbps MP3
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

// 备用解灰函数 - 使用原有的unblockneteasemusic
async function getFromUnblockNeteaseMusic(songId, source = ['pyncmd', 'kuwo', 'qq', 'migu', 'kugou']) {
  try {
    const match = require('@unblockneteasemusic/server')
    const result = await match(songId, source)
    logger.info('unblockneteasemusic解灰', songId, result)
    
    let url = Array.isArray(result) ? (result[0]?.url || result[0]) : (result.url || result)
    if (url) {
      return {
        id: Number(songId),
        url,
        type: 'flac',
        level: 'standard',
        freeTrialInfo: null,
        fee: 0,
        source: 'unblockneteasemusic'
      }
    }
  } catch (error) {
    logger.error('unblockneteasemusic解灰失败', songId, error.message)
  }
  return null
}

module.exports = async (query, request) => {
  const songId = query.id
  const level = query.level || 'jymaster'
  
  // 如果启用解灰
  if (query.unblock === 'true') {
    logger.info('开始增强解灰', songId, '音质级别:', level)
    
    // 1. 首先尝试toubiec.cn API (最高优先级)
    const toubiecResult = await getFromToubiec(songId, level)
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
    
    // 2. 如果toubiec.cn失败，尝试其他音源
    const source = query.source ? query.source.split(',') : ['pyncmd', 'kuwo', 'qq', 'migu', 'kugou']
    const unblockResult = await getFromUnblockNeteaseMusic(songId, source)
    if (unblockResult) {
      // 处理酷我音乐代理
      if (unblockResult.url && unblockResult.url.includes('kuwo')) {
        const useProxy = process.env.ENABLE_PROXY || 'false'
        if (useProxy === 'true') {
          unblockResult.proxyUrl = process.env.PROXY_URL + unblockResult.url
        }
      }
      
      return {
        status: 200,
        body: {
          code: 200,
          data: [unblockResult],
        },
        cookie: [],
      }
    }
    
    // 3. 所有解灰方案都失败
    logger.error('所有解灰方案都失败', songId)
  }
  
  // 如果不启用解灰或解灰失败，回退到原始API
  const data = {
    ids: '[' + songId + ']',
    level: level,
    encodeType: 'flac',
  }
  
  if (data.level == 'sky') {
    data.immerseType = 'c51'
  }
  
  return request(`/api/song/enhance/player/url/v1`, data, createOption(query))
}

