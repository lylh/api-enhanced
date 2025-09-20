/*
 * @Author: Paner luh1@xiaopeng.com
 * @Date: 2025-09-17 13:57:07
 * @LastEditors: Paner luh1@xiaopeng.com
 * @LastEditTime: 2025-09-20 23:56:05
 * @FilePath: \api-enhanced\module\login_cellphone.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 手机登录

const CryptoJS = require('crypto-js')
const cookieManager = require('../util/cookie-manager.js')

const createOption = require('../util/option.js')
module.exports = async (query, request) => {
  const data = {
    type: '1',
    https: 'true',
    phone: query.phone,
    countrycode: query.countrycode || '86',
    captcha: query.captcha,
    [query.captcha ? 'captcha' : 'password']: query.captcha
      ? query.captcha
      : query.md5_password || CryptoJS.MD5(query.password).toString(),
    remember: 'true',
  }
  let result = await request(
    `/api/w/login/cellphone`,
    data,
    createOption(query),
  )

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
          phone: query.phone,
          countrycode: query.countrycode || '86',
          loginTime: new Date().toISOString(),
          loginType: 'cellphone'
        }
        
        const saved = cookieManager.saveCookie(userId, cookieString, userInfo)
        if (saved) {
          console.log(`[Cellphone Login] Cookie automatically saved for user: ${userId}`)
          result.body.cookieSaved = true
          result.body.userId = userId
        }
      }
    }
  }
  return result
}
