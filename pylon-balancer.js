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
  this.defaultTpl = opts.defaultTpl ||
    [ 'html'
    , '  head'
    , '    title #{headers.host}'
    , '  body'
    , '    h1 welcome at #{headers.host}'
    , '    code #{JSON.stringify(locals)}'
    ].join('\n')
  return this
}

balancer.prototype.connect = function() {
  var p = pylon()
  var self = this
  function onConnect(r,s,id){
    r.on('set * balancer',function(){
      var args = [].slice.call(arguments)
      var split = this.event.split(' ')
      var method = split.shift()
      var id = split.shift()
      switch(method) {
        case 'set':
          args.forEach(function(x){self.add(x)})
          break
        default: ;
      }
    })
    r.once('keys',function(keys,regexp){
      r.on('get',onGet)
      function onGet(k,v) {
        debug('ONGET',k,v)
      }
      keys.forEach(function(x){r.get(x)})
    })
    r.keys('^.* balancer$')
  }
  var args = [].slice.call(arguments)
  args.push(onConnect)
  p.connect.apply(p,args)
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
  
  server.listen(opts.port,opts.host,cb)
  return server
}

balancer.prototype.add = function(routeToAdd) {
  debug('add',routeToAdd)     
  var self = this                
  if (routeToAdd.route && routeToAdd.port) {
    var id
    do id = Math.floor(Math.random() * Math.pow(2,32)).toString(16)
    while (self.routes.byId[id])
    
    routeToAdd.host = routeToAdd.host || '0.0.0.0'
    var weight = routeToAdd.weight
    if (!weight || weight < 1) weight = 1
    if (weight > 10) weight = 10
    var currRoute = routeToAdd.route
  
    this.routes.byId[id] = 
      { host   : routeToAdd.host
      , port   : routeToAdd.port
      , route  : currRoute
      , weight : weight
      , id     : id }    
    var currRoutes = this.routes.byRoute[currRoute]
                     ? _.uniq(this.routes.byRoute[currRoute].concat(id))
                     : [id]
    if (currRoutes.length > 2) {
      var newRoutes = []
      for (var i=0;i<10;i++) {
        currRoutes.map(function(x){
          if (i%~~(10/self.routes.byId[x].weight)==0)
            newRoutes.push(x)
        })
      }
      this.routes.byRoute[currRoute] = newRoutes
    }
    else
      this.routes.byRoute[currRoute] = currRoutes
  }
  debug('added',currRoute,this.routes.byRoute[currRoute])
}

balancer.prototype.del = function(id) {
  var curr = this.routes.byId[id]
  this.routes.byRoute[curr.route] = _.without(this.routes.byRoute[curr.route],id)
  if (this.routes.byRoute[curr.route].length == 0)
    delete this.routes.byRoute[curr.route]
  delete this.routes.byId[id]
}

balancer.prototype.handleRequest = function() {
  var self = this
  var renderDefault = jade.compile(self.defaultTpl)
  return function(req,res) {
    debug('handleRquest',req.headers.host)
    // req.buf = httpProxy.buffer(req)
    // res.on('finish', function onFinish() {req.buf.destroy()})
    var host = req.headers.host
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
      debug('proxyRequest',host,currProxy)
      proxy.proxyRequest(req, res, currProxy)
    } else {
      debug('render default')
      res.writeHead(502)
      res.end(renderDefault({headers:req.headers}))
    }
  }
}

balancer.prototype.handleUpgrade = function() {
  var self = this
  return function(req,socket,head){
    req.head = head
    // req.buf = httpProxy.buffer(req)
    // socket.on('close', function onClose() {req.buf.destroy()})
    var host = req.headers.host
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
      proxy.proxyWebSocketRequest(req, res, req.head, currProxy)
    }
  }
}

