const fs = require('fs')
const path = require('path')
const { cookieToJson, cookieObjToString } = require('./index')

class CookieManager {
  constructor() {
    this.cookieDir = path.join(__dirname, '..', 'data', 'cookies')
    this.memoryCache = new Map()
    this.ensureCookieDir()
  }

  /**
   * 确保cookie存储目录存在
   */
  ensureCookieDir() {
    if (!fs.existsSync(this.cookieDir)) {
      fs.mkdirSync(this.cookieDir, { recursive: true })
    }
  }

  /**
   * 生成cookie文件路径
   * @param {string} userId - 用户ID或标识符
   * @returns {string} cookie文件路径
   */
  getCookieFilePath(userId) {
    return path.join(this.cookieDir, `cookie_${userId}.json`)
  }

  /**
   * 保存cookie到文件和内存
   * @param {string} userId - 用户ID
   * @param {string|object} cookie - cookie字符串或对象
   * @param {object} userInfo - 用户信息（可选）
   * @returns {boolean} 是否保存成功
   */
  saveCookie(userId, cookie, userInfo = {}) {
    try {
      const cookieObj = typeof cookie === 'string' ? cookieToJson(cookie) : cookie
      const cookieString = typeof cookie === 'string' ? cookie : cookieObjToString(cookie)
      
      const cookieData = {
        userId,
        cookie: cookieObj,
        cookieString,
        userInfo,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }

      // 保存到文件
      const filePath = this.getCookieFilePath(userId)
      fs.writeFileSync(filePath, JSON.stringify(cookieData, null, 2), 'utf-8')

      // 保存到内存缓存
      this.memoryCache.set(userId, cookieData)

      console.log(`[CookieManager] Cookie saved for user: ${userId}`)
      return true
    } catch (error) {
      console.error(`[CookieManager] Failed to save cookie for user ${userId}:`, error)
      return false
    }
  }

  /**
   * 从存储中获取cookie
   * @param {string} userId - 用户ID
   * @returns {object|null} cookie数据或null
   */
  getCookie(userId) {
    try {
      // 先从内存缓存获取
      if (this.memoryCache.has(userId)) {
        const cookieData = this.memoryCache.get(userId)
        // 更新最后使用时间
        cookieData.lastUsed = new Date().toISOString()
        return cookieData
      }

      // 从文件获取
      const filePath = this.getCookieFilePath(userId)
      if (fs.existsSync(filePath)) {
        const cookieData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        // 更新最后使用时间
        cookieData.lastUsed = new Date().toISOString()
        
        // 同步到内存缓存
        this.memoryCache.set(userId, cookieData)
        
        // 更新文件中的最后使用时间
        fs.writeFileSync(filePath, JSON.stringify(cookieData, null, 2), 'utf-8')
        
        return cookieData
      }

      return null
    } catch (error) {
      console.error(`[CookieManager] Failed to get cookie for user ${userId}:`, error)
      return null
    }
  }

  /**
   * 删除cookie
   * @param {string} userId - 用户ID
   * @returns {boolean} 是否删除成功
   */
  deleteCookie(userId) {
    try {
      // 从内存缓存删除
      this.memoryCache.delete(userId)

      // 从文件删除
      const filePath = this.getCookieFilePath(userId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      console.log(`[CookieManager] Cookie deleted for user: ${userId}`)
      return true
    } catch (error) {
      console.error(`[CookieManager] Failed to delete cookie for user ${userId}:`, error)
      return false
    }
  }

  /**
   * 获取所有已保存的cookie列表
   * @returns {Array} cookie列表
   */
  getAllCookies() {
    try {
      this.ensureCookieDir()
      const cookies = []
      const files = fs.readdirSync(this.cookieDir)
      
      for (const file of files) {
        if (file.startsWith('cookie_') && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cookieDir, file)
            const cookieData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            cookies.push({
              userId: cookieData.userId,
              userInfo: cookieData.userInfo,
              createdAt: cookieData.createdAt,
              lastUsed: cookieData.lastUsed
            })
          } catch (error) {
            console.error(`[CookieManager] Failed to read cookie file ${file}:`, error)
          }
        }
      }

      return cookies
    } catch (error) {
      console.error('[CookieManager] Failed to get all cookies:', error)
      return []
    }
  }

  /**
   * 清理过期的cookie（超过30天未使用）
   * @param {number} maxAge - 最大保存天数，默认30天
   * @returns {number} 清理的cookie数量
   */
  cleanExpiredCookies(maxAge = 30) {
    try {
      let cleanedCount = 0
      const maxAgeMs = maxAge * 24 * 60 * 60 * 1000
      const now = new Date().getTime()

      const files = fs.readdirSync(this.cookieDir)
      
      for (const file of files) {
        if (file.startsWith('cookie_') && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cookieDir, file)
            const cookieData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            const lastUsed = new Date(cookieData.lastUsed).getTime()
            
            if (now - lastUsed > maxAgeMs) {
              fs.unlinkSync(filePath)
              this.memoryCache.delete(cookieData.userId)
              cleanedCount++
              console.log(`[CookieManager] Cleaned expired cookie for user: ${cookieData.userId}`)
            }
          } catch (error) {
            console.error(`[CookieManager] Failed to process cookie file ${file}:`, error)
          }
        }
      }

      console.log(`[CookieManager] Cleaned ${cleanedCount} expired cookies`)
      return cleanedCount
    } catch (error) {
      console.error('[CookieManager] Failed to clean expired cookies:', error)
      return 0
    }
  }

  /**
   * 从cookie字符串中提取用户ID
   * @param {string|object} cookie - cookie字符串或对象
   * @returns {string|null} 用户ID或null
   */
  extractUserId(cookie) {
    try {
      const cookieObj = typeof cookie === 'string' ? cookieToJson(cookie) : cookie
      
      // 尝试从MUSIC_U中提取用户ID
      if (cookieObj.MUSIC_U) {
        // MUSIC_U通常包含用户ID信息，这里简化处理
        return cookieObj.MUSIC_U.substring(0, 16) // 取前16位作为用户标识
      }
      
      // 如果没有MUSIC_U，使用时间戳作为临时ID
      return `temp_${Date.now()}`
    } catch (error) {
      console.error('[CookieManager] Failed to extract user ID:', error)
      return null
    }
  }

  /**
   * 检查cookie是否有效（包含MUSIC_U）
   * @param {string|object} cookie - cookie字符串或对象
   * @returns {boolean} 是否有效
   */
  isValidCookie(cookie) {
    try {
      const cookieObj = typeof cookie === 'string' ? cookieToJson(cookie) : cookie
      return !!(cookieObj && cookieObj.MUSIC_U)
    } catch (error) {
      return false
    }
  }
}

// 创建全局实例
const cookieManager = new CookieManager()

// 定期清理过期cookie（每24小时执行一次）
setInterval(() => {
  cookieManager.cleanExpiredCookies()
}, 24 * 60 * 60 * 1000)

module.exports = cookieManager