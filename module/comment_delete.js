// 删除评论

const createOption = require('../util/option.js')
module.exports = (query, request) => {
  const data = {
    commentId: query.commentId,
    threadId: query.threadId,
  }
  return request(`/api/resource/comments/delete`, data, createOption(query))
}
