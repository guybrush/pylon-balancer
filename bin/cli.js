#!/usr/bin/env node

var PB = require('../pylon-balancer')
var path = require('path')
var pkg = require('../package.json')
var opti = require('optimist')
var fs = require('fs')
var debug = require('debug')('pylon-balancer-cli')
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
, '                                         [-r <pylon-remote>]'
, ''
, 'note: at least -p AND -P or -r must be set'
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

function exit(err, msg) {
  if (err) console.error(err)
  else console.log(msg)
  process.exit(0)
}

