#!/usr/bin/env node

var PB = require('../pylon-balancer')
var path = require('path')
var pkg = require('../package.json')
var opti = require('optimist')
var argv = opti.argv

var help = {}
help.usage = 
[ '           _                 _         _' 
, ' ___  _ _ | | ___  ___  ___ | |_  ___ | | ___  ___  ___  ___  ___'
, '| . || | || || . ||   ||___|| . || . || || . ||   ||  _|| -_||  _|'
, '|  _||_  ||_||___||_|_|     |___||__,||_||__,||_|_||___||___||_|'
, '|_|  |___|v'+pkg.version
, ''
, 'pylon-balancer -p <balancer-port>        -P <pylon-port>      \\'
, '              [-h <balancer-host>]      [-H <pylon-host>]     \\'
, '              [-k <balancer-https-key>] [-K <pylon-tls-key>]  \\'
, '              [-c <balancer-https-cert>][-C <pylon-tls-cert>]'
].join('\n')

if (!argv.p && !argv.P) return exit(null,help.usage)
if (!argv.p) return exit(new Error('no balancer-port defined'))
if (!argv.P) return exit(new Error('no pylon-port defined'))

var pb = PB()
pb.listen(argv.P)
pb.connect(argv.p)

function exit(err, msg) {
  if (err) console.error(err)
  else console.log(msg)
  process.exit(0)
}

