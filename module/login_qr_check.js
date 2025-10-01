/*
 * @Author: paner 328538688@qq.com
 * @Date: 2025-09-21 10:36:26
 * @LastEditors: paner 328538688@qq.com
 * @LastEditTime: 2025-09-27 09:28:47
 * @FilePath: \api-enhanced\module\login_qr_check.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
        let userInfo = {
          nickname: result.body.nickname || '',
          avatarUrl: result.body.avatarUrl || '',
          loginTime: new Date().toISOString(),
          loginType: 'qr'
        }
        
        // 尝试获取用户详细信息
        try {
          // 使用用户账户API获取基本信息
          const userAccountResult = await request(
            `/api/nuser/account/get`,
            {},
            {
              ...createOption(query, 'weapi'),
              cookie: cookieString
            }
          )
          
          if (userAccountResult.body && userAccountResult.body.profile) {
            userInfo.nickname = userAccountResult.body.profile.nickname || userInfo.nickname
            userInfo.avatarUrl = userAccountResult.body.profile.avatarUrl || userInfo.avatarUrl
            userInfo.userId = userAccountResult.body.profile.userId || userId
          }
        } catch (error) {
          console.warn(`[QR Login] Failed to fetch user account details: ${error.message}`)
          
          // 如果账户API失败，尝试使用用户详细信息API
          try {
            const userDetailResult = await request(
              `/api/v1/user/detail/${userId}`,
              {},
              {
                ...createOption(query, 'weapi'),
                cookie: cookieString
              }
            )
            
            if (userDetailResult.body && userDetailResult.body.profile) {
              userInfo.nickname = userDetailResult.body.profile.nickname || userInfo.nickname
              userInfo.avatarUrl = userDetailResult.body.profile.avatarUrl || userInfo.avatarUrl
              userInfo.userId = userDetailResult.body.profile.userId || userId
            }
          } catch (detailError) {
            console.warn(`[QR Login] Failed to fetch user details: ${detailError.message}`)
          }
        }
        
        const saved = cookieManager.saveCookie(userId, cookieString, userInfo)
        if (saved) {
          console.log(`[QR Login] Cookie automatically saved for user: ${userId}`)
          // 在响应中添加保存状态信息
          result.body.cookieSaved = true
          result.body.userId = userId
          result.body.userInfo = userInfo
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
