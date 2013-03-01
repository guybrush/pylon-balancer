#!/usr/bin/env node

var PB = require('../pylon-balancer')
var path = require('path')
var pkg = require('../package.json')
var opti = require('optimist')
var fs = require('fs')
var debug = require('debug')('pylon-balancer-cli')
var crypto = require('crypto')
var argv = opti.argv
var common = {apps:{}}
var optsB = {}
var optsP = {}

var help = {}
help.usage =
[ '           _                 _         _'
, ' ___  _ _ | | ___  ___  ___ | |_  ___ | | ___  ___  ___  ___  ___'
, '| . || | || || . ||   ||___|| . || . || || . ||   ||  _|| -_||  _|'
, '|  _||_  ||_||___||_|_|     |___||__,||_||__,||_|_||___||___||_|'
, '|_|  |___|v'+pkg.version
, ''
, 'pylon-balancer -p <balancer-port>        [-P <pylon-port>]     \\'
, '              [-h <balancer-host>]       [-H <pylon-host>]     \\'
, '              [-k <balancer-https-key>]  [-K <pylon-tls-key>]  \\'
, '              [-c <balancer-https-cert>] [-C <pylon-tls-cert>] \\'
, '              [-s <sni-directory>]       [-r <pylon-remote>]'
, ''
, 'note: at least -p AND -P or -r must be set'
, 'note: if -s is set, SNICallback will look into that directory'
, '      for <hostname>.{key,cert}.'
, '      e.g: `pylon-balancer -p 8080 -s /sniDir` will look for'
, '      "/sniDir/foo.com.cert" and "/sniDir/foo.com.key".'
].join('\n')

if (!argv.p || (!argv.P && !argv.r)) return exit(null,help.usage)

parseArgs()

function parseArgs(){
  optsB.port = argv.p
  optsB.host = argv.h || '0.0.0.0'
  if (argv.k && argv.c) {
    optsB.key = fs.readFileSync(argv.k)
    optsB.cert = fs.readFileSync(argv.c)
  }
  if (argv.s) {
    var contexts = getCredentialsContexts(argv.s)
    optsB.SNICallback = function(hostname){
      return contexts[hostname]
    }
  }

  if (!argv.r) {
    optsP.port = argv.P
    optsP.host = argv.H || '0.0.0.0'
    if (argv.K && argv.C) {
      optsP.key = fs.readFileSync(argv.K)
      optsP.cert = fs.readFileSync(argv.C)
    }
  }
  else
    optsP = argv.r

  var pb = PB()
  var server = pb.listen(optsB)
  var client = pb.connect(optsP,{reconnect:1000})
}

function getCredentialsContexts(dir) {
  var keys = {}, certs = {}, contexts = {}
  fs.readdirSync(dir).forEach(function(x){
    var ext = path.extname(x)
    var name = x.split('.')
    name.pop()
    name = name.join('.')
    if (ext == '.key')
      keys[name] = fs.readFileSync(path.join(dir,x))
    else if (ext == '.cert')
      certs[name] = fs.readFileSync(path.join(dir,x))
  })
  Object.keys(keys).forEach(function(x){
    if (!certs[x]) return
    contexts[x] = crypto.createCredentials({key:keys[x],cert:certs[x]}).context
  })
  return contexts
}

function exit(err, msg) {
  if (err) console.error(err)
  else console.log(msg)
  process.exit(0)
}

