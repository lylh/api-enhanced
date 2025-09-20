// 手动保存cookie

const cookieManager = require('../util/cookie-manager.js')

module.exports = (query, request) => {
  try {
    const { cookie, userId, userInfo } = query
    
    if (!cookie) {
      return {
        status: 400,
        body: {
          code: 400,
          data: null,
          message: 'Missing required parameter: cookie'
        }
      }
    }
    
    // 验证cookie是否有效
    if (!cookieManager.isValidCookie(cookie)) {
      return {
        status: 400,
        body: {
          code: 400,
          data: null,
          message: 'Invalid cookie: missing MUSIC_U'
        }
      }
    }
    
    // 如果没有提供userId，尝试从cookie中提取
    const finalUserId = userId || cookieManager.extractUserId(cookie)
    
    if (!finalUserId) {
      return {
        status: 400,
        body: {
          code: 400,
          data: null,
          message: 'Unable to determine userId'
        }
      }
    }
    
    // 解析userInfo（如果是字符串）
    let parsedUserInfo = {}
    if (userInfo) {
      try {
        parsedUserInfo = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
      } catch (error) {
        console.warn('[Cookie Save] Failed to parse userInfo:', error)
      }
    }
    
    // 添加保存时间和类型
    parsedUserInfo.loginTime = new Date().toISOString()
    parsedUserInfo.loginType = parsedUserInfo.loginType || 'manual'
    
    const saved = cookieManager.saveCookie(finalUserId, cookie, parsedUserInfo)
    
    if (saved) {
      return {
        status: 200,
        body: {
          code: 200,
          data: { 
            userId: finalUserId, 
            saved: true,
            userInfo: parsedUserInfo
          },
          message: 'Cookie saved successfully'
        }
      }
    } else {
      return {
        status: 500,
        body: {
          code: 500,
          data: { userId: finalUserId, saved: false },
          message: 'Failed to save cookie'
        }
      }
    }
  } catch (error) {
    console.error('[Cookie Save] Error:', error)
    return {
      status: 500,
      body: {
        code: 500,
        data: null,
        message: 'Internal Server Error'
      }
    }
  }
}