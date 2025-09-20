const createOption = require('../util/option.js')
const cookieManager = require('../util/cookie-manager.js')

module.exports = async (query, request) => {
  const data = {
    key: query.key,
    type: 3,
  }
  try {
    let result = await request(
      `/api/login/qrcode/client/login`,
      data,
      createOption(query),
    )
    
    const cookieString = result.cookie.join(';')
    
    result = {
      status: 200,
      body: {
        ...result.body,
        cookie: cookieString,
      },
      cookie: result.cookie,
    }

    // 如果登录成功（状态码803表示登录成功），自动保存cookie
    if (result.body.code === 803 && cookieManager.isValidCookie(cookieString)) {
      const userId = cookieManager.extractUserId(cookieString)
      if (userId) {
        const userInfo = {
          nickname: result.body.nickname || '',
          avatarUrl: result.body.avatarUrl || '',
          loginTime: new Date().toISOString(),
          loginType: 'qr'
        }
        
        const saved = cookieManager.saveCookie(userId, cookieString, userInfo)
        if (saved) {
          console.log(`[QR Login] Cookie automatically saved for user: ${userId}`)
          // 在响应中添加保存状态信息
          result.body.cookieSaved = true
          result.body.userId = userId
        }
      }
    }
    
    return result
  } catch (error) {
    return {
      status: 200,
      body: {},
      cookie: result.cookie,
    }
  }
}
