const createOption = require('../util/option.js')
module.exports = async (query, request) => {
  const data = {
    type: 3,
  }
  const options = createOption({
    ...query,
    randomCNIP: query.randomCNIP !== undefined ? query.randomCNIP : true,
  })
  const result = await request(
    `/api/login/qrcode/unikey`,
    data,
    options,
  )
  return {
    status: 200,
    body: {
      data: result.body,
      code: 200,
    },
    cookie: result.cookie,
  }
}
