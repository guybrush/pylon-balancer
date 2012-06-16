module.exports = balancer

var pylon = require('pylon')
  , httpProxy = require('http-proxy')
  , proxy = new httpProxy.RoutingProxy
  , http = require('http')
  , https = require('https')
  , fs = require('fs')
  , jade = require('jade')
  , debug = require('debug')('pylon-balancer')
  , _ = require('underscore')

function balancer(opts) {
  if (!(this instanceof balancer)) return new balancer(opts)
  this.routes = {byId:{},byRoute:{}}
  this.sumRequests = {}
  this.defaultTpl = opts && opts.defaultTpl
                    ? opts.defaultTpl
                    : fs.readFileSync(__dirname+'/views/default.jade')
  this.pylon = pylon()
  return this
}

balancer.prototype.connect = function() {
  var self = this
  var args = [].slice.call(arguments)
  var cb = typeof args[args.length-1] == 'function'
           ? args.pop()
           : function(){}
  args.push(onConnectPb)
  var client = pylon.prototype.connect.apply(this.pylon,args)
  function onConnectPb(r,s){
    debug('connected to pylon')
    var toDel = Object.keys(self.routes.byId)
    r.on('* * * balancer',function(){
      var args = [].slice.call(arguments)
      var split = this.event.split(' ')
      var method = split.shift()
      var ip = split.shift()
      var id = split.shift()
      debug('data from pylon',method,ip,id,args)
      switch(method) {
        case 'set':
          args.forEach(function(x){
            if (x.host == '127.0.0.1') x.host = ip
            if (x.host == 'localhost') x.host = ip
            if (!x.host) x.host = ip
            self.add(x,id)
          })
          break
        case 'del':
          self.del(id)
          break
        default: ;
      }
    })
    r.once('keys',function(regexp,keys){
      debug('pre-set remote keys',keys)
      var todo = keys.length
      keys.forEach(function(x,i){ 
        r.once('get', function onGet(k,v) {
          var split = k.split(' ')
          var ip = split.shift()
          var id = split.shift()
          if (v.host == '127.0.0.1') x.host = ip
          if (v.host == 'localhost') x.host = ip
          if (!v.host) v.host = ip
          self.add(v,id)
          var delIndex = toDel.indexOf(id)
          if (!!~delIndex) toDel.splice(delIndex,1)
          if (!(--todo)) toDel.forEach(function(y){self.del(y)})
        })
        r.get(x)
      }) 
    })
    r.keys('^.+ .+ balancer$')
    //s.on('error',function(err){debug('socket error',err)})
    cb && cb(r,s)
  }
  return client
}

balancer.prototype.listen = function() {
  var args = [].slice.call(arguments)
  var cb = typeof args[args.length-1] == 'function'
           ? args[args.length-1]
           : function(){}
  var opts = {tls:{}}
  args.forEach(function(x){
    if (typeof x === 'string') opts.host = x
    else if (typeof x === 'number') opts.port = x
    else if (typeof x === 'object') {
      if (x.__proto__ === Object.prototype) {
        Object.keys(x).forEach(function(k){
          switch(k) {
            case 'port'               : opts[k]     = x[k]; break;
            case 'host'               : opts[k]     = x[k]; break;
            case 'key'                : opts.tls[k] = x[k]; break;
            case 'cert'               : opts.tls[k] = x[k]; break;
            case 'ca'                 : opts.tls[k] = x[k]; break;
            case 'passphrase'         : opts.tls[k] = x[k]; break;
            case 'ciphers'            : opts.tls[k] = x[k]; break;
            case 'requestCert'        : opts.tls[k] = x[k]; break;
            case 'rejectUnauthorized' : opts.tls[k] = x[k]; break;
            case 'NPNProtocols'       : opts.tls[k] = x[k]; break;
            case 'SNICallback'        : opts.tls[k] = x[k]; break;
            case 'sessionIdContext'   : opts.tls[k] = x[k]; break;
            default : console.error(new Error('invalid option "'+k+'"'))
          }
        })
      }
    }
  })

  opts.host = opts.host || '0.0.0.0'
  if (!opts.port) throw new Error('no port defined')
    
  var self = this
  var server
  if (opts.tls.key && opts.tls.cert){
    opts.tls.type = 'tls'
    server = https.createServer(opts.tls)
  }
  else
    server = http.createServer()
  
  server.on('request', this.handleRequest())
  server.on('upgrade', this.handleUpgrade())
  server.on('error', function(err){debug('server error',err)})
  server.listen(opts.port,opts.host,cb)
  return server
}

balancer.prototype.add = function(routesToAdd,id) {
  debug('adding routes')     
  var self = this                
  if ( routesToAdd.routes 
       && Array.isArray(routesToAdd.routes) 
       && routesToAdd.port) {
    routesToAdd.host = routesToAdd.host || '0.0.0.0'
    var weight = routesToAdd.weight
    if (!weight || weight < 1) weight = 1
    if (weight > 10) weight = 10
  
    self.routes.byId[id] = 
      { host   : routesToAdd.host
      , port   : routesToAdd.port
      , routes : routesToAdd.routes
      , weight : weight
      , id     : id }    
    routesToAdd.routes.forEach(function(x){
      var currRoutes = self.routes.byRoute[x]
                       ? _.uniq(self.routes.byRoute[x].concat(id))
                       : [id]
      if (currRoutes.length > 2) {
        var newRoutes = []
        for (var i=0;i<10;i++) {
          currRoutes.map(function(y){
            if (i%~~(10/self.routes.byId[y].weight)==0)
              newRoutes.push(y)
          })
        }
        self.routes.byRoute[x] = newRoutes
      }
      else
        self.routes.byRoute[x] = currRoutes
    })
  }
  self.pylon.set('balancer-server',self.routes)
  debug('added routes',{id:id,routes:routesToAdd})
}

balancer.prototype.del = function(id) {
  debug('deleting',id)
  var self = this
  var curr = self.routes.byId[id]
  if (!curr) return
  curr.routes.forEach(function(x){
    self.routes.byRoute[x] = _.without(self.routes.byRoute[x],id)
    if (self.routes.byRoute[x].length == 0)
      delete self.routes.byRoute[x]
  })
  delete self.routes.byId[id]
  self.pylon.set('balancer-server',self.routes)
}

balancer.prototype.handleRequest = function() {
  var self = this
  var renderDefault = jade.compile(self.defaultTpl)
  return function(req,res) {
    debug('handleRquest', req.headers.host)
    // req.buf = httpProxy.buffer(req)
    // res.on('finish', function onFinish() {req.buf.destroy()})
    var host = req.headers.host
    if (!host) {
      debug('render default')
      res.writeHead(502)
      res.end(renderDefault({req:req}))
      return
    }
    if (~~host.indexOf(':')) 
      host = host.split(':')[0]
    if (self.routes.byRoute[host]) {
      self.sumRequests[host] = self.sumRequests[host] || 0
      var len = self.routes.byRoute[host].length
      var id = self.routes.byRoute[host][self.sumRequests[host]%len]
      self.sumRequests[host]++
      var currProxy = { port : self.routes.byId[id].port
                      , host : self.routes.byId[id].host 
                      // , buffer : req.buf
                      }
      debug('proxyRequest',{host:host,proxy:currProxy})
      proxy.proxyRequest(req, res, currProxy)
    } else {
      debug('render default')
      res.writeHead(502)
      res.end(renderDefault({req:req}))
    }
  }
}

balancer.prototype.handleUpgrade = function() {
  var self = this
  return function(req, socket, head){
    debug('handleUpgrade', req.headers.host)
    req.head = head
    // req.buf = httpProxy.buffer(req)
    // socket.on('close', function onClose() {req.buf.destroy()})
    var host = req.headers.host
    if (!host) return
    if (~~host.indexOf(':')) 
      host = host.split(':')[0]
    if (routes.byRoute[host]) {
      sumRequests[host] = sumRequests[host] || 0
      var len = routes.byRoute[host].length
      var id = routes.byRoute[host][sumRequests[host]%len]
      sumRequests[host]++
      var id = routes.byRoute[host][0]
      var currProxy = { port : routes.byId[id].port
                      , host : routes.byId[id].host 
                      // , buffer : req.buf
                      }
      proxy.proxyWebSocketRequest(req, socket, req.head, currProxy)
    }
  }
}

