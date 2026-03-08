// 喜欢歌曲

const createOption = require('../util/option.js')
module.exports = (query, request) => {
  query.like = query.like == 'false' ? false : true
  const data = {
    trackId: query.id,
    userid: query.uid,
    like: query.like,
  }
  return request(`/api/song/like`, data, createOption(query))
}
