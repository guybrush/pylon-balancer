# pylon-balancer

this is a [pylon]-client which queries/subscribes the pylon-server for keys 
holding arrays containing proxy-informations. these proxy-informations will 
be used to create a proxy-table for [http-proxy].

* apps can report for duty by telling the pylon-server the proxy-informations
* one or more pylon-balancers can connect to the pylon-server and proxy 
  requests according to the proxy-informations                 

## cli

TBA

## api

TBA

## example

balancer-server (pylon-client + http-server):

``` javascript
var pb = require('pylon-balancer')({namespace:'balancer'})
pb.connect(3000) // a pylon-server
pb.listen(80) // balancer-server
```

application (pylon-client):

``` javascript
var p = require('pylon')()
p.connect(3000) // a pylon-server
p.set
( 'balancer'
, [ { route  : 'foo.bar.com'
    , host   : ''
    , port   : 3434
    , weight : 10 
    } 
  ] )
```
    
[pylon]: https://github.com/guybrush/pylon
[http-proxy]: https://github.com/nodejitsu/node-http-proxy

