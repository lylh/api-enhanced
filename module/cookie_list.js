// 获取所有已保存的cookie列表

const cookieManager = require('../util/cookie-manager.js')

module.exports = (query, request) => {
  try {
    const cookies = cookieManager.getAllCookies()
    
    return {
      status: 200,
      body: {
        code: 200,
        data: cookies,
        message: 'success'
      }
    }
  } catch (error) {
    console.error('[Cookie List] Error:', error)
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