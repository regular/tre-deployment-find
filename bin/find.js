#!/usr/bin/env node

/* Usage: 
 *
 *   find [--config PATH-TO-SSB-CONFIG] [--type TYPE] [--author AUTHOR] [MESSAGE.JSON] [--write-back] [--format FORMAT] [--interactive] [--debug]
 * 
 * Find a webapp or system deployment in the ssb network that matches
 * the config file's git repository origin URL and git branch and the given author and type.
 *
 * Author and type can also be specified using a serialized ssb message. In this case, revisionBranch and
 * revisionRoot, if found, will be written back to the input file when --write-back is set.
 *
 * It ignores deployments by authors other than ssb.whoami or, if present, the one given in AUTHOR
 *
 * TYPE typically is either webapp or system
 * AUTHOR defaults to ssb.whoami
 * MESSAGE.JSON serialized ssb message
 * FORMAT is either 'json' (default) or 'revision-root'
*/

const fs = require('fs')
const client = require('tre-cli-client')
const gitInfo = require('../lib/git-info')
const multicb = require('multicb')
const {dirname} = require('path')
const FindMatching = require('..')
const merge = require('lodash.merge')

client( (err, ssb, conf, keys) => {
  if (err) bail(err)
  
  const findMatching = FindMatching(ssb, conf)

  if (!conf.type && conf._.length<1) {
    bail(new Error('Either --type TYPE or MESSAGE.JSON is needed as input'))
  }

  let inputFile, inputKv = {}
  if (conf._.length) {
    inputFile = conf._[0]
    console.error(`input file: ${inputFile}`)
    try {
      inputKv = JSON.parse(fs.readFileSync(inputFile))
      if (!inputKv.value) throw new Error('input message has no .value')
    } catch(err) {
      bail(err)
    }
  }
  const type = conf.type || (inputKv.value && inputKv.value.content.type)
  if (!type) {
    bail(new Error('type is not defined'))
  }
  
  let author = conf.author || (inputKv.value && inputKv.value.author)
  const done = multicb({pluck:1, spread: true})

  function getGitInfo(cb) {
    if (inputKv.value && inputKv.value.content) {
      const {repository, repositoryBranch} = inputKv.value.content
      if (repository && repositoryBranch) {
        console.error(`Found git info in ${inputFile}`)
        return cb(null, {
          repository,
          repositoryBranch
        })
      }
    }
    const dir = dirname(conf.config)
    console.error(`directory: ${dir}`)
    gitInfo(dir, cb)
  }

  ssb.whoami(done())
  getGitInfo(done())

  done( (err, feed, git) => {
    bail(err)
    author = author || feed.id
    console.error(`author: ${author}`)
    console.error(`type: ${type}`)
    console.error(`repository: ${git.repository}`)
    console.error(`branch: ${git.repositoryBranch}`)
    const revRoot = inputKv && revisionRoot(inputKv)
    if (revRoot) {
      console.error(`revisionRoot: ${revRoot}`)
    }
    const searchKv = {
      value: {
        author,
        content: {
          type,
          repository: git.repository,
          repositoryBranch: git.repositoryBranch,
          revisionRoot: revRoot
        }
      }
    }
    findMatching(searchKv, (err, kv) => {
      bail(err)
      const outputKv = merge(inputKv, searchKv, {
        value: {
          content: {
            revisionBranch: kv.key,
            revisionRoot: revisionRoot(kv)
          }
        }
      })
      if (conf['write-back'] && inputFile) {
        fs.writeFileSync(inputFile, JSON.stringify(outputKv, null, 2), 'utf8')
      } else {
        if (conf.format == 'revision-root') {
          console.log(revisionRoot(kv))
        } else {
          console.log(JSON.stringify(outputKv, null, 2))
        }
      }
      ssb.close()
    })
  })
})

function bail(err) {
  if (!err) return
  console.error(err.message)
  process.exit(1)
}

function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}

