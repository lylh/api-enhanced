// 清理过期的cookie

const cookieManager = require('../util/cookie-manager.js')

module.exports = (query, request) => {
  try {
    const maxAge = parseInt(query.maxAge) || 30 // 默认30天
    
    if (maxAge < 1 || maxAge > 365) {
      return {
        status: 400,
        body: {
          code: 400,
          data: null,
          message: 'maxAge must be between 1 and 365 days'
        }
      }
    }
    
    const cleanedCount = cookieManager.cleanExpiredCookies(maxAge)
    
    return {
      status: 200,
      body: {
        code: 200,
        data: { 
          cleanedCount,
          maxAge
        },
        message: `Successfully cleaned ${cleanedCount} expired cookies`
      }
    }
  } catch (error) {
    console.error('[Cookie Clean] Error:', error)
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