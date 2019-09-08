const multicb = require('multicb')
const {exec} = require('child_process')

module.exports = function gitInfo(cwd, cb) {
  const done = multicb({pluck: 1, spread: true})

  exec('git describe --dirty --always', {cwd}, done())
  exec('git remote get-url origin', {cwd}, done())
  exec('git symbolic-ref --short HEAD', {cwd}, done())

  done( (err, ref, url, branch) => {
    if (err) return cb(err)
    cb(null, {
      commit: ref.replace(/\n/,''),
      repository: url.replace(/\n/,''),
      repositoryBranch: branch.replace(/\n/,'')
    })
  })
}
