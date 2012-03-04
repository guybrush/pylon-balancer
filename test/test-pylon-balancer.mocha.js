var pb = require('../pylon-balancer')
var pylon = require('pylon')
var assert = require('assert')
var http = require('http')
var common = {}
var AA = require('async-array')
var debug = require('debug')('test')

function ee2log(name){return function(){
  debug((name || '☼')+':',this.event,'→',[].slice.call(arguments))
}}

module.exports =
{ before: function(done){
    common.p        = pylon()
    common.p.onAny(ee2log('P-any'))
    common.pPort    = ~~(Math.random()*50000)+10000
    common.pServer  = common.p.listen(common.pPort)
    
    common.pb       = pb({defaultTpl:'div default-msg'})
    common.pbPort   = ~~(Math.random()*50000)+10000
    common.pbClient = common.pb.connect(common.pPort)
    common.pbServer = common.pb.listen(common.pbPort,done)
    
    common.apps     = {}
  }
, 'requesting a route which is not set yet': function(done) {
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
, 'requesting a route with one app': function(done) {
    var port = ~~(Math.random()*50000)+10000
    var route = 'a.com'
    var weight = 10
    startApp('a',port,route,weight, function(){
      sendRequest(route, function(res){
        assert.equal(res.statusCode,200)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'this is app a')
          done()
        })
      })
    })
  }
, 'after stopping the app it should display the default-msg': function(done) {
    this.timeout(5000)
    stopApp('a', function(err){
      debug('stopped A')
      sendRequest('a.com', function(res){
        debug('requested A',res.statusCode)
        assert.equal(res.statusCode,502)
        var data = ''
        res.on('data',function(d){data+=d})
        res.on('end',function(){
          assert.equal(data,'<div>default-msg</div>')
          done()
        })
      })
    })
  }
, 'balancer connecting after apps': function(done) {
    var port = ~~(Math.random()*50000)+10000
    var route = 'b.com'
    var weight = 10
    startApp('b',port,route,weight, function(){
      var _pb = pb({defaultTpl:'div default-msg'})
      var _pbPort   = ~~(Math.random()*50000)+10000
      debug('connecting to pylon') 
      var _pbClient = _pb.connect(common.pPort,function(){ 
        debug('starting another pb-server')
        var _pbServer = _pb.listen(_pbPort,function(){
          setTimeout(function(){
            sendRequest(route, _pbPort, function(res){
              assert.equal(res.statusCode,200)
              var data = ''                 
              res.on('data',function(d){data+=d})
              res.on('end',function(){
                assert.equal(data,'this is app b')
                done()
              })
            })
          },50)
        })
      })
    })    
  }
, 'requesting a route with multiple apps': function(done) {
    this.timeout(5000)
    var route = 'foo.bar'
    new AA([['A',2],['B',2],['C',6]])
      .map(function(x,i,next){
        var port = ~~(Math.random()*50000)+10000
        startApp(x[0],port,route,x[1],next)
      })
      .done(function(err,data){
        if (err) return done(err)
        var requestsDone = 0
        common.apps.A.server.on('request',requestDone)
        common.apps.B.server.on('request',requestDone)
        common.apps.C.server.on('request',requestDone)
        function requestDone(){
          if (++requestsDone == 100) {
            assert.ok(common.apps.A.sumReq<=15)
            assert.ok(common.apps.B.sumReq<=15)
            assert.ok(common.apps.C.sumReq>=70)
            done()
          }
        }
        var requestsTodo = []
        for (var i=0;i<100;i++) sendRequest(route)
      })
      .exec()
  }
}

function startApp(x, port, route, weight, cb){  
  debug('starting app', x, port, route)
  common.apps[x] = {}
  common.apps[x].sumReq = 0
  common.apps[x].server = http.createServer(function(req,res){
    common.apps[x].sumReq++
    res.end('this is app '+x)
  }).listen(port,function(){
    common.apps[x].pylon = pylon()
    common.apps[x].pylon.set
    ( 'balancer'
    , { route  : route
      , port   : port
      , host   : '0.0.0.0'
      , weight : weight
      } )
    common.apps[x].client = common.apps[x].pylon.connect(common.pPort)
    
    common.p.once('set * * balancer',function(){
      setTimeout(cb,10) // this is kinda lame... but for now it will do...
    })
  })
}

function stopApp(x, cb) {
  debug('stopping app',x,!!common.apps[x].server)
  if (!common.apps[x]) cb(new Error('app "'+x+'" does not exist'))
  common.apps[x].client.on('close',cb)  
  common.apps[x].server.on('close',function(){
    common.apps[x].client.end()
  })
  common.apps[x].server.close()
}

function sendRequest(route, port, cb) {
  if (arguments.length < 3) {
    cb = port 
    port = common.pbPort
  }
  debug('sending request',route,port,arguments)
  var opts =
    { method  : 'GET'
    , host    : '0.0.0.0'
    , headers : {host:route}
    , port    : port
    , path    : '/' }
  var req = http.request(opts, cb)
  req.end()
}
