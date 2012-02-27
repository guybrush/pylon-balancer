module.exports = balancer

var pylon = require('pylon')

function balancer(opts) {
  if (!(this instanceof balancer)) return new balancer(opts)
}

balancer.prototype.connect = function(){
  var p = pylon()
  function onConnect(r,s,id){
    r.on('set * balancer',function(){
      var args = [].slice.call(arguments)
      var split = this.event.split(' ')
      var method = split.shift()
      var id = split.shift()
      switch(method) {
        case 'set':
          console.log('ONSET BALANCER',args)
          break
        default: ;
      }
    })
    r.once('keys',function(keys,regexp){
      r.on('get',onGet)
      function onGet(k,v) {
        console.log('ONGET',k,v)
      }
      keys.forEach(function(x){r.get(x)})
    })
    r.keys('^.* balancer$')
  }
  var args = [].slice.call(arguments)
  args.push(onConnect)
  p.connect.apply(p,args)
}

/* */

var ps = pylon()
ps.listen(3000)
var pb = balancer()
pb.connect(3000)
var pc = pylon()
pc.set('balancer',[{route:'foo.bar.com',host:'',port:3434,weight:10}])
pc.connect(3000)
var port = 3435
setInterval(function(){
  pc.set('balancer',[{route:'foo.bar.com',host:'',port:port++,weight:10}])
},500)
function ee2log(name){return function(){
  console.log((name || '☼')+':',this.event,'→',[].slice.call(arguments))
}}

/* */

