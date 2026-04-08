const createOption = require('../util/option.js')
module.exports = async (query, request) => {
  const data = {
    key: query.key,
    type: 3,
  }
  let result
  try {
    const options = createOption({
      ...query,
      randomCNIP: false,
      realIP: global.cnIp,
    })
    result = await request(
      `/api/login/qrcode/client/login`,
      data,
      options,
    )
    result = {
      status: 200,
      body: {
        ...result.body,
        // 只保留 key=value 部分，去掉 Path/HttpOnly/Expires 等属性
        cookie: result.cookie
          .map((c) => c.split(';')[0])
          .filter((c) => c.includes('=') && !c.startsWith('__'))
          .join(';'),
      },
      cookie: result.cookie,
    }
    return result
  } catch (error) {
    return {
      status: 200,
      body: {},
      cookie: result ? result.cookie : [],
    }
  }
}
