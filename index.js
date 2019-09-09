const pull = require('pull-stream')
const htime = require('human-time')
const readline = require('readline')

module.exports = function(ssb, opts) {
  opts = opts || {}
  const {debug} = opts

  // match by type, author, repository, repositoryBranch

  return function findMatching(kv, cb) {
    const messages = []
    let i=0
    let currentIndex
    pull(
      ssb.revisions.messagesByType(kv.value.content.type),
      pull.drain( e =>{
        const revRoot = e.key.slice(-1)[0]
        const {content} = e.value.value
        const current = revisionRoot(kv) == revRoot 
        if (current) currentIndex = i
        console.error(` ${current ? '*' : ' '} ${++i}) ${revRoot.substr(0,5)}:${e.value.key.substr(0,5)}`, content.name, content.repositoryBranch, content.commit, htime(new Date(e.value.value.timestamp)), 'by', e.value.value.author.substr(0, 5))
        messages.push(e.value) // kv
      }, err => {
        if (err) return cb(err)
        let message
        if (opts.interactive) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr
          })
          const question = 'Pick a system image to switch to. The one marked with * is currently installed [ENTER for no change]:'
          const ask = (cb) => {
            rl.question(question, answer => {
              if (answer=='') return cb(null, currentIndex)
              const i = Number(answer)
              if (i>=1 && i<=messages.length) {
                return cb(null, i-1)
              }
              console.error('Invalid input')
              ask(cb)
            })
          }
          ask( (err, sel) =>{
            rl.close()
            if (err) return cb(err)
            cb(null, messages[sel])
          })
        } else {
          message = findMessage(messages, kv)
          cb(null, message)
        }
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
  
function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}
