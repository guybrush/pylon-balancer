var ME = module.exports
var pb = require('../pylon-balancer')
var pylon = require('pylon')
var assert = require('assert')
var http = require('http')
var common = {}
var debug = require('debug')('test')
var ws = require('websocket')

ME['requesting a route which is not set yet'] = function(done) {
  setup()
  sendRequest('foo.bar', function(res){
    assert.equal(res.statusCode,502)
    res.setEncoding('utf8')
    var data = ''
    res.on('data',function(d){data+=d})
    res.on('end',function(){
      assert.equal(data,'<div>default-msg</div>')
      done()
    })
  })
}

ME['requesting a route with one app'] = function(done) {
  setup()
  var port = ~~(Math.random()*50000)+10000
  var route = port+'.com'
  startApp(port, port, [route], function(){
    setTimeout(function(){
      sendRequest(route, function(res){
        assert.equal(res.statusCode,200)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'this is app '+port)
          stopApp(port,done)
        })
      })
    },200)
  })
}

ME['after stopping the app it should display the default-msg'] = function(done) {
  setup()
  var port = ~~(Math.random()*50000)+10000
  var routeA = port+'A.com'
  var routeB = port+'B.com'
  startApp(port,port,[routeA,routeB], function(){
    sendRequest(routeA, function(res){
      assert.equal(res.statusCode,200)
      stopApp(port, function(err){
        debug('stopped '+port)
        setTimeout(function(){
          sendRequest(routeB, function(res){
            debug('requested '+routeB,res.statusCode)
            assert.equal(res.statusCode,502)
            var data = ''
            res.on('data',function(d){data+=d})
            res.on('end',function(){
              assert.equal(data,'<div>default-msg</div>')
              done()
            })
          })
        },50)
      })
    })
  })
}

ME['balancer connecting after apps'] = function(done) {
  setup()
  var port = ~~(Math.random()*50000)+10000
  var route = port+'.com'
  startApp(port,port,[route], function(){
    var _pb = pb({defaultTpl:'div default-msg'})
    var _pbPort   = ~~(Math.random()*50000)+10000
    debug('connecting to pylon')
    var _pbClient = _pb.connect(common.pPort,function(){
      debug('starting the pb-server')
      var _pbServer = _pb.listen(_pbPort,function(){
        setTimeout(function(){
          sendRequest(route, _pbPort, function(res){
            assert.equal(200,res.statusCode)
            var data = ''
            res.on('data',function(d){data+=d})
            res.on('end',function(){
              assert.equal(data,'this is app '+port)
              stopApp(port,done)
            })
          })
        },200)
      })
    })
  })
}

ME['start balancer, start app, start pylon'] = function(done) {
  this.timeout(20000)
  var p = pylon()
  var pPort = ~~(Math.random()*50000)+10000
  var b = pb({defaultTpl:'div default-msg'})
  var bPort = ~~(Math.random()*50000)+10000
  var port = ~~(Math.random()*50000)+10000
  var route = port+'.com'
  var appPylon = pylon()
  var app = http.createServer(function(req,res){
    res.end('hello')
  })

  var bClient = b.connect(pPort,{reconnect:200},function(r,s,id){
    debug('balancer connected to pylon')
  })
  var bServer = b.listen(bPort,function(){
    debug('balancer started')

    // start app
    app.listen(port,function(){
      debug('app has started')

      appPylon.set('balancer', {routes : [route], port : port})
      appPylon.connect(pPort,{reconnect:10},function(){
        debug('app connected to pylon')
      })

      // start pylon
      p.listen(pPort,function(){
        debug('pylon bound to port')
      })
    })
  })

  p.once('set * * balancer',function(a){
    setTimeout(function(){
      sendRequest(route, bPort, function(res){
        assert.equal(200,res.statusCode)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'hello')
          app.close()
          done()
        })
      })
    },500)
  })
}

ME['start app, start balancer, start pylon'] = function(done) {
  var p = pylon()
  var pPort = ~~(Math.random()*50000)+10000
  var b = pb({defaultTpl:'div default-msg'})
  var bPort = ~~(Math.random()*50000)+10000

  // start app
  var port = ~~(Math.random()*50000)+10000
  var route = port+'.com'
  var weight = 10
  var app = http.createServer(function(req,res){
    res.end('hello')
  }).listen(port,function(){
    debug('app has started')
    var appPylon = pylon()
    appPylon.set('balancer', {routes : [route], port : port})
    appPylon.connect(pPort,{reconnect:10},function(){
      debug('app connected to pylon')
    })

    // start balancer
    var bClient = b.connect({port:pPort,reconnect:20},function(){
      debug('balancer connected to pylon')
    })
    var bServer = b.listen(bPort,function(){
      debug('balancer started')

      // start pylon
      p.listen(pPort)
    })
  })

  p.once('set * * balancer',function(){
    setTimeout(function(){
      sendRequest(route, bPort, function(res){
        assert.equal(200,res.statusCode)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'hello')
          app.close()
          done()
        })
      })
    },200)
  })
}

ME['start pylon, start app, start balancer, stop pylon'
  +', stop app, start pylon'] = function(done) {
  this.timeout(10000)
  var p = pylon()
  var pPort = ~~(Math.random()*50000)+10000

  var b = pb({defaultTpl:'div default-msg'})
  var bPort = ~~(Math.random()*50000)+10000

  var appPylon = new pylon()
  // start pylon
  var pServer = p.listen(pPort)

  var port = ~~(Math.random()*50000)+10000
  var route = port+'.com'

  var app = http.createServer(function(req,res){
    res.end('hello')
  })
  var appPylonClient

  // start balancer
  var bClient = b.connect(pPort,{reconnect:100},function(){
    debug('balancer connected to pylon')
  })
  var bServer = b.listen(bPort,function(){
    debug('balancer started')
  })

  // start app
  app.listen(port,function(){
    debug('app has started')

    appPylon.set('balancer', {routes : [route], port : port})
    appPylonClient = appPylon.connect(pPort,{reconnect:100},function(r,s,id){
      debug('app connected to pylon',id)
    })
  })

  p.once('set * * balancer',function(){
    setTimeout(function(){
      sendRequest(route, bPort, function(res){
        assert.equal(200,res.statusCode)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'hello')
          pServer.close()
          app.close()
          appPylonClient.end()
          debug('stopped pylon and app')
          var p = pylon()
          p.listen(pPort)
          setTimeout(function(){
            sendRequest(route, bPort, function(res){
              assert.equal(res.statusCode,502)
              done()
            })
          },200)
        })
      })
    },200)
  })
}

ME['websockets'] = function(done){
  this.timeout(10000)
  
  var pPort = ~~(Math.random()*50000)+10000
  var bPort = ~~(Math.random()*50000)+10000
  var httpPort = ~~(Math.random()*50000)+10000
  
  var route = httpPort+'.com'
  
  var p = pylon()
  var b = pb()
  var appP = pylon()
  
  p.listen(pPort)
  b.listen(bPort)
  b.connect(pPort)
  appP.connect(pPort,function(){debug('connected to p')})
  
  var httpServer = http.createServer(function(req,res){
    debug('httpServer req')
    res.end('hello')
  }).listen(httpPort,function(){
    b.pylon.once('set balancer-server',function(){
      debug('trying to connect to ws..')
      var wsClient = new ws.client()
      wsClient.on('connect',function(conn){
        debug('wsClient connect')
      })
      wsClient.connect('ws://0.0.0.0:'+bPort,null,null,{Host:route})
    })
    appP.set('balancer', {routes : [route], port : httpPort})
  })
  var wsServer = new ws.server({httpServer:httpServer})
  wsServer.on('request',function(req){
    debug('wsServer req')
    done()
  })
}

function setup() {
  common.p = pylon()
  common.p.onAny(ee2log('P-any'))
  common.pPort = ~~(Math.random()*50000)+10000
  common.pServer = common.p.listen(common.pPort)

  common.pb = pb({defaultTpl:'div default-msg'})
  common.pbPort = ~~(Math.random()*50000)+10000
  common.pbClient = common.pb.connect(common.pPort)
  common.pbServer = common.pb.listen(common.pbPort)

  common.apps = {}
}

function ee2log(name){return function(){
  debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
}}

function startApp(x, port, routes, cb){
  debug('starting app', x, port, routes)
  common.apps[x] = {}
  common.apps[x].server = http.createServer(function(req,res){
    res.end('this is app '+x)
  }).listen(port,function(){
    common.apps[x].pylon = pylon()
    common.apps[x].pylon.set
    ( 'balancer'
    , { routes : routes
      , port   : port
      , host   : '0.0.0.0'
      } )
    common.apps[x].client = common.apps[x].pylon.connect(common.pPort)

    common.p.once('set * * balancer',function(){
      setTimeout(cb,10) // this is kinda lame... but for now it will do...
    })
  })
}

function stopApp(x, cb) {
  debug('stopping app',x)
  if (!common.apps[x]) cb(new Error('app "'+x+'" does not exist'))
  common.apps[x].server.on('close',function(){
    common.apps[x].client.end()
    cb()
  })
  common.apps[x].server.close()
}

function sendRequest(route, port, cb) {
  if (arguments.length < 3) {
    cb = port
    port = common.pbPort
  }
  debug('sending request',route,port)
  var opts =
    { method  : 'GET'
    , host    : '0.0.0.0'
    , headers : {host:route}
    , port    : port
    , path    : '/' }
  var req = http.request(opts, cb)
  req.end()
}

