// 邮箱登录

const CryptoJS = require('crypto-js')
const cookieManager = require('../util/cookie-manager.js')

const createOption = require('../util/option.js')
module.exports = async (query, request) => {
  const data = {
    type: '0',
    https: 'true',
    username: query.email,
    password: query.md5_password || CryptoJS.MD5(query.password).toString(),
    rememberLogin: 'true',
  }
  let result = await request(`/api/w/login`, data, createOption(query))
  if (result.body.code === 502) {
    return {
      status: 200,
      body: {
        msg: '账号或密码错误',
        code: 502,
        message: '账号或密码错误',
      },
    }
  }
  if (result.body.code === 200) {
    const cookieString = result.cookie.join(';')
    
    result = {
      status: 200,
      body: {
        ...JSON.parse(
          JSON.stringify(result.body).replace(
            /avatarImgId_str/g,
            'avatarImgIdStr',
          ),
        ),
        cookie: cookieString,
      },
      cookie: result.cookie,
    }

    // 登录成功后自动保存cookie
    if (cookieManager.isValidCookie(cookieString)) {
      const userId = cookieManager.extractUserId(cookieString)
      if (userId) {
        const userInfo = {
          nickname: result.body.profile?.nickname || '',
          avatarUrl: result.body.profile?.avatarUrl || '',
          email: query.email,
          loginTime: new Date().toISOString(),
          loginType: 'email'
        }
        
        const saved = cookieManager.saveCookie(userId, cookieString, userInfo)
        if (saved) {
          console.log(`[Email Login] Cookie automatically saved for user: ${userId}`)
          result.body.cookieSaved = true
          result.body.userId = userId
        }
      }
    }
  }
  return result
}
