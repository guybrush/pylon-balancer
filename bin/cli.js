#!/usr/bin/env node
    
var PB = require('../pylon-balancer')
var path = require('path')
var pkg = require('../package.json')
var opti = require('optimist')
//var AA = require('async-array')
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
, 'pylon-balancer -p <balancer-port>        -P <pylon-port>      \\'
, '              [-h <balancer-host>]      [-H <pylon-host>]     \\'
, '              [-k <balancer-https-key>] [-K <pylon-tls-key>]  \\'
, '              [-c <balancer-https-cert>][-C <pylon-tls-cert>]'
].join('\n')

if (!argv.p || !argv.P) return exit(null,help.usage)

parseArgs()

function parseArgs(){
  optsB.port = argv.p
  optsP.port = argv.P
  optsB.host = argv.h || '0.0.0.0'
  optsP.host = argv.H || '0.0.0.0'
  if (argv.k && argv.c) {
    optsB.key = fs.readFileSync(argv.k)
    optsB.cert = fs.readFileSync(argv.c)
  }
  if (argv.K && argv.C) {
    optsP.key = fs.readFileSync(argv.K)
    optsP.cert = fs.readFileSync(argv.C)
  }
  debug('parsed args',{balancer:optsB,pylon:optsP})
  
  var pb = PB()
  var server = pb.listen(optsB)
  var client = pb.connect(optsP)
  
  // startApp('a',rndPort(),'foo.eyzn.doesntexist.org',10,function(){
  //   debug('started app a -> http://foo.eyzn.doesntexist.org:'+argv.p)
  // }) 
}

function exit(err, msg) {
  if (err) console.error(err)
  else console.log(msg)
  process.exit(0)
}

/* * /
// setInterval(function(){pb.set('x',1)},1000)

function startApp(x, port, route, weight, cb) {
  debug('starting app',arguments)
  common.apps[x] = {}
  common.apps[x].sumReq = 0
  common.apps[x].server = require('http').createServer(function(req,res){
    common.apps[x].sumReq++
    res.end('this is app '+x)
  }).listen(port,function(){
    common.apps[x].pylon = require('pylon')()
    common.apps[x].client = common.apps[x].pylon.connect(optsP,function(r,s){
      console.log('connected to pylon')
    })
    common.apps[x].pylon.set
    ( 'balancer'
    , { route  : route
      , port   : port
      , host   : '0.0.0.0'
      , weight : weight
      } )
    // common.p.once('set * balancer',function(){
    //   setTimeout(cb,10) // this is kinda lame... but for now it will do...
    // })
  })
}


function ee2log(name){return function(){
  debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
}}

function rndPort(){return ~~(Math.random()*50000)+10000}

/* */

