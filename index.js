const pull = require('pull-stream')
const htime = require('human-time')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const {debug} = opts

  // match by type, author, repository, repositoryBranch

  return function findMatching(kv, cb) {
    const messages = []
    pull(
      ssb.revisions.messagesByType(kv.value.content.type),
      pull.drain( e =>{
        const revRoot = e.key.slice(-1)[0]
        const {content} = e.value.value
        console.error('',
          `${revRoot.substr(0,5)}:${e.value.key.substr(0,5)}`, content.name, content.repositoryBranch, content.commit, htime(new Date(e.value.value.timestamp)), 'by', e.value.value.author.substr(0, 5))
        messages.push(e.value) // kv
      }, err => {
        if (err) return cb(err)
        const message = findMessage(messages, kv)
        cb(null, message)
      })
    )
  }
  function findMessage(kvs, kv) {
    const {author} = kv.value
    const {repository, repositoryBranch} = kv.value.content
    return kvs.find( ({key, value}) => {
      if (debug) console.error(`${key.substr(0,5)}: `)
      const {content} = value
      if (value.author !== author) {
        if (debug) console.error('wrong author')
        return false
      }
      if (content.repository !== repository) {
        if (debug) console.error('wrong repo')
        return false
      }
      if (content.repositoryBranch !== repositoryBranch) {
        if (debug) console.error('wrong repo branch')
        return false
      }
      return true
    })
  }
}
  
