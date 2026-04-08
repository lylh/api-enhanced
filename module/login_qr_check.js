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
        cookie: result.cookie.join(';'),
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
