// 获取指定用户的cookie

const cookieManager = require('../util/cookie-manager.js')

module.exports = (query, request) => {
  try {
    const { userId } = query
    
    if (!userId) {
      return {
        status: 400,
        body: {
          code: 400,
          data: null,
          message: 'Missing required parameter: userId'
        }
      }
    }
    
    const cookieData = cookieManager.getCookie(userId)
    
    if (!cookieData) {
      return {
        status: 404,
        body: {
          code: 404,
          data: null,
          message: 'Cookie not found for the specified user'
        }
      }
    }
    
    // 返回cookie数据，但不包含敏感的cookie字符串（除非明确请求）
    const responseData = {
      userId: cookieData.userId,
      userInfo: cookieData.userInfo,
      createdAt: cookieData.createdAt,
      lastUsed: cookieData.lastUsed
    }
    
    // 如果请求包含includeCookie参数，则返回cookie字符串
    if (query.includeCookie === 'true') {
      responseData.cookieString = cookieData.cookieString
      responseData.cookie = cookieData.cookie
    }
    
    return {
      status: 200,
      body: {
        code: 200,
        data: responseData,
        message: 'success'
      }
    }
  } catch (error) {
    console.error('[Cookie Get] Error:', error)
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