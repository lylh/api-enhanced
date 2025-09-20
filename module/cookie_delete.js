// 删除指定用户的cookie

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
    
    const deleted = cookieManager.deleteCookie(userId)
    
    if (deleted) {
      return {
        status: 200,
        body: {
          code: 200,
          data: { userId, deleted: true },
          message: 'Cookie deleted successfully'
        }
      }
    } else {
      return {
        status: 500,
        body: {
          code: 500,
          data: { userId, deleted: false },
          message: 'Failed to delete cookie'
        }
      }
    }
  } catch (error) {
    console.error('[Cookie Delete] Error:', error)
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