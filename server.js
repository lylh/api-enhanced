require("dotenv").config();
const fs = require('fs')
const path = require('path')
const express = require('express')
const axios = require('axios')
const request = require('./util/request')
const packageJSON = require('./package.json')
const exec = require('child_process').exec
const cache = require('./util/apicache').middleware
const { cookieToJson } = require('./util/index')
const fileUpload = require('express-fileupload')
const decode = require('safe-decode-uri-component')
const logger = require('./util/logger.js')

// toubiec.cn API解灰函数 - 支持音质级别自动遍历
async function getFromToubiec(songId, requestedLevel = 'jymaster') {
  // 音质级别优先级列表（从高到低）
  const qualityLevels = [
    'lossless',   // 无损音质
    'hires',      // Hi-Res
    'jymaster',   // 超清母带(最高音质)
    'sky',        // 沉浸环绕声
    'jyeffect',   // 高清环绕声
    'exhigh',     // 极高音质
    'standard'    // 标准音质
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
      
      const response = await axios.get(`https://api.toubiec.cn/wyapi/getMusicUrl.php`, {
        params: {
          id: songId,
          level: currentLevel
        },
        headers: {
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'priority': 'u=1, i',
          'referer': 'https://api.toubiec.cn/wyapi/Song.html',
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

/**
 * The version check result.
 * @readonly
 * @enum {number}
 */
const VERSION_CHECK_RESULT = {
  FAILED: -1,
  NOT_LATEST: 0,
  LATEST: 1,
}

/**
 * @typedef {{
 *   identifier?: string,
 *   route: string,
 *   module: any
 * }} ModuleDefinition
 */

/**
 * @typedef {{
 *   port?: number,
 *   host?: string,
 *   checkVersion?: boolean,
 *   moduleDefs?: ModuleDefinition[]
 * }} NcmApiOptions
 */

/**
 * @typedef {{
 *   status: VERSION_CHECK_RESULT,
 *   ourVersion?: string,
 *   npmVersion?: string,
 * }} VersionCheckResult
 */

/**
 * @typedef {{
 *  server?: import('http').Server,
 * }} ExpressExtension
 */

/**
 * Get the module definitions dynamically.
 *
 * @param {string} modulesPath The path to modules (JS).
 * @param {Record<string, string>} [specificRoute] The specific route of specific modules.
 * @param {boolean} [doRequire] If true, require() the module directly.
 * Otherwise, print out the module path. Default to true.
 * @returns {Promise<ModuleDefinition[]>} The module definitions.
 *
 * @example getModuleDefinitions("./module", {"album_new.js": "/album/create"})
 */
async function getModulesDefinitions(
  modulesPath,
  specificRoute,
  doRequire = true,
) {
  const files = await fs.promises.readdir(modulesPath)
  const parseRoute = (/** @type {string} */ fileName) =>
    specificRoute && fileName in specificRoute
      ? specificRoute[fileName]
      : `/${fileName.replace(/\.js$/i, '').replace(/_/g, '/')}`

  const modules = files
    .reverse()
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const identifier = file.split('.').shift()
      const route = parseRoute(file)
      const modulePath = path.join(modulesPath, file)
      const module = doRequire ? require(modulePath) : modulePath

      return { identifier, route, module }
    })

  return modules
}

/**
 * Check if the version of this API is latest.
 *
 * @returns {Promise<VersionCheckResult>} If true, this API is up-to-date;
 * otherwise, this API should be upgraded and you would
 * need to notify users to upgrade it manually.
 */
async function checkVersion() {
  return new Promise((resolve) => {
    exec('npm info NeteaseCloudMusicApi version', (err, stdout) => {
      if (!err) {
        let version = stdout.trim()

        /**
         * @param {VERSION_CHECK_RESULT} status
         */
        const resolveStatus = (status) =>
          resolve({
            status,
            ourVersion: packageJSON.version,
            npmVersion: version,
          })

        resolveStatus(
          packageJSON.version < version
            ? VERSION_CHECK_RESULT.NOT_LATEST
            : VERSION_CHECK_RESULT.LATEST,
        )
      } else {
        resolve({
          status: VERSION_CHECK_RESULT.FAILED,
        })
      }
    })
  })
}

/**
 * Construct the server of NCM API.
 *
 * @param {ModuleDefinition[]} [moduleDefs] Customized module definitions [advanced]
 * @returns {Promise<import("express").Express>} The server instance.
 */
async function consturctServer(moduleDefs) {
  const app = express()
  const { CORS_ALLOW_ORIGIN } = process.env
  app.set('trust proxy', true)

  /**
   * Serving static files
   */
  app.use(express.static(path.join(__dirname, 'public')))
  /**
   * CORS & Preflight request
   */
  app.use((req, res, next) => {
    if (req.path !== '/' && !req.path.includes('.')) {
      res.set({
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Origin':
          CORS_ALLOW_ORIGIN || req.headers.origin || '*',
        'Access-Control-Allow-Headers': 'X-Requested-With,Content-Type',
        'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
      })
    }
    req.method === 'OPTIONS' ? res.status(204).end() : next()
  })

  /**
   * Cookie Parser
   */
  app.use((req, _, next) => {
    req.cookies = {}
    //;(req.headers.cookie || '').split(/\s*;\s*/).forEach((pair) => { //  Polynomial regular expression //
    ;(req.headers.cookie || '').split(/;\s+|(?<!\s)\s+$/g).forEach((pair) => {
      let crack = pair.indexOf('=')
      if (crack < 1 || crack == pair.length - 1) return
      req.cookies[decode(pair.slice(0, crack)).trim()] = decode(
        pair.slice(crack + 1),
      ).trim()
    })
    next()
  })

  /**
   * Body Parser and File Upload
   */
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: false, limit: '50mb' }))

  app.use(fileUpload())

  /**
   * Cache
   */
  app.use(cache('2 minutes', (_, res) => res.statusCode === 200))

  /**
   * Special Routers
   */
  const special = {
    'daily_signin.js': '/daily_signin',
    'fm_trash.js': '/fm_trash',
    'personal_fm.js': '/personal_fm',
  }

  /**
   * Load every modules in this directory
   */
  const moduleDefinitions =
    moduleDefs ||
    (await getModulesDefinitions(path.join(__dirname, 'module'), special))

  for (const moduleDef of moduleDefinitions) {
    // Register the route.
    app.use(moduleDef.route, async (req, res) => {
      ;[req.query, req.body].forEach((item) => {
        if (typeof item.cookie === 'string') {
          item.cookie = cookieToJson(decode(item.cookie))
        }
      })

      let query = Object.assign(
        {},
        { cookie: req.cookies },
        req.query,
        req.body,
        req.files,
      )

      try {
        const moduleResponse = await moduleDef.module(query, (...params) => {
          // 参数注入客户端IP
          const obj = [...params]
          let ip = req.ip

          if (ip.substring(0, 7) == '::ffff:') {
            ip = ip.substring(7)
          }
          if (ip == '::1') {
            ip = global.cnIp
          }
          // logger.info(ip)
          obj[3] = {
            ...obj[3],
            ip,
          }
          return request(...obj)
        })
        logger.info(`Request Success: ${decode(req.originalUrl)}`)

        if (
          (req.baseUrl === '/song/url/v1' || req.baseUrl === '/song/url') &&
          process.env.ENABLE_GENERAL_UNBLOCK === 'true'
        ) {
          const song = moduleResponse['body']['data'][0]
            if (song.freeTrialInfo !== null || !song.url || [1, 4].includes(song.fee)) {
              logger.info("开始增强解灰", req.query.id, "音质级别:", req.query.level)
              
              // 1. 首先尝试toubiec.cn API (最高优先级)
              const toubiecResult = await getFromToubiec(req.query.id, req.query.level)
              if (toubiecResult && toubiecResult.url) {
                song.url = toubiecResult.url
                song.br = toubiecResult.br
                song.size = toubiecResult.size
                song.md5 = toubiecResult.md5
                song.type = toubiecResult.type
                song.freeTrialInfo = null
                song.fee = 0
                logger.info("toubiec.cn解灰成功!", req.query.id)
              } else {
                // 2. 如果toubiec.cn失败，尝试unblockneteasemusic
                const match = require('@unblockneteasemusic/server')
                const source = process.env.UNBLOCK_SOURCE ? process.env.UNBLOCK_SOURCE.split(',') : ['pyncmd', 'kuwo', 'qq', 'migu', 'kugou']
                logger.info("使用unblockneteasemusic解灰", source)
                const { url } = await match(req.query.id, source)
                if (url) {
                  song.url = url
                  song.freeTrialInfo = 'null'
                  logger.info("unblockneteasemusic解灰成功!")
                } else {
                  logger.error("所有解灰方案都失败", req.query.id)
                }
              }
          }
          if (song.url && song.url.includes('kuwo')) {
            const proxy = process.env.PROXY_URL;
            const useProxy = process.env.ENABLE_PROXY || 'false'
            if (useProxy === 'true' && proxy) {song.proxyUrl = proxy + song.url}
          }
        }

        const cookies = moduleResponse.cookie
        if (!query.noCookie) {
          if (Array.isArray(cookies) && cookies.length > 0) {
            if (req.protocol === 'https') {
              // Try to fix CORS SameSite Problem
              res.append(
                'Set-Cookie',
                cookies.map((cookie) => {
                  return cookie + '; SameSite=None; Secure'
                }),
              )
            } else {
              res.append('Set-Cookie', cookies)
            }
          }
        }
        res.status(moduleResponse.status).send(moduleResponse.body)
      } catch (/** @type {*} */ moduleResponse) {
        // 处理普通错误对象
        if (moduleResponse instanceof Error) {
          logger.error(`${decode(req.originalUrl)}`, {
            message: moduleResponse.message,
            stack: moduleResponse.stack
          })
          res.status(500).send({
            code: 500,
            data: null,
            msg: 'Internal Server Error',
          })
          return
        }
        
        // 处理模块响应错误
        logger.error(`${decode(req.originalUrl)}`, {
          status: moduleResponse?.status || 500,
          body: moduleResponse?.body || null,
        })
        if (!moduleResponse?.body) {
          res.status(404).send({
            code: 404,
            data: null,
            msg: 'Not Found',
          })
          return
        }
        if (moduleResponse.body.code == '301')
          moduleResponse.body.msg = '需要登录'
        if (!query.noCookie) {
          res.append('Set-Cookie', moduleResponse.cookie)
        }

        res.status(moduleResponse.status).send(moduleResponse.body)
      }
    })
  }

  return app
}

/**
 * Serve the NCM API.
 * @param {NcmApiOptions} options
 * @returns {Promise<import('express').Express & ExpressExtension>}
 */
async function serveNcmApi(options) {
  const port = Number(options.port || process.env.PORT || '3000')
  const host = options.host || process.env.HOST || ''

  const checkVersionSubmission =
    options.checkVersion &&
    checkVersion().then(({ npmVersion, ourVersion, status }) => {
      if (status == VERSION_CHECK_RESULT.NOT_LATEST) {
        logger.info(
          `最新版本: ${npmVersion}, 当前版本: ${ourVersion}, 请及时更新`,
        )
      }
    })
  const constructServerSubmission = consturctServer(options.moduleDefs)

  const [_, app] = await Promise.all([
    checkVersionSubmission,
    constructServerSubmission,
  ])

  /** @type {import('express').Express & ExpressExtension} */
  const appExt = app
  appExt.server = app.listen(port, host, () => {
    console.log(`
   _   _  _____ __  __           _    ____ ___ 
  | \\ | |/ ____|  \\/  |     /\\   | |  |  _ \\_ |
  |  \\| | |    | \\  / |    /  \\  | |  | |_) | |
  | . \` | |    | |\\/| |   / /\\ \\ | |  |  __/| |
  | |\\  | |____| |  | |  / ____ \\| |__| |   | |
  |_| \\_|\\_____|_|  |_| /_/    \\_\\____|_|   |_|
    `)
    console.log(`
    ╔═╗╔═╗╦    ╔═╗╔╗╔╦ ╦╔═╗╔╗╔╔═╗╔═╗╔╦╗
    ╠═╣╠═╝║    ║╣ ║║║╠═╣╠═╣║║║║  ║╣  ║║
    ╩ ╩╩  ╩═╝  ╚═╝╝╚╝╩ ╩╩ ╩╝╚╝╚═╝╚═╝═╩╝
    `)
    logger.info(`
- Server started successfully @ http://${host ? host : 'localhost'}:${port}
- Environment: ${process.env.NODE_ENV || 'development'}
- Node Version: ${process.version}
- Process ID: ${process.pid}`)
  })

  return appExt
}

module.exports = {
  serveNcmApi,
  getModulesDefinitions,
}
