# pylon-balancer

this is a [pylon]-client which queries/subscribes the pylon-server for keys
holding arrays containing proxy-informations. these proxy-informations will
be used to create a proxy-table for [http-proxy].

* apps can report for duty by telling the pylon-server the proxy-informations
* one or more pylon-balancers can connect to the pylon-server and proxy
  requests according to the proxy-informations
* pylon-balancer implements sticky-sessions per ip (idea shamelessly stolen
  from https://github.com/indutny/sticky-session)

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
, [ { routes : ['foo.bar.com']  // routes which should be proxied to the app
    , port   : 3434             // the port on which the app is listening
    , host   : ''               // optional, per default it will use the
                                // ip-prefix of the pylon-key
    }
  ] )
```

[pylon]: https://github.com/guybrush/pylon
[http-proxy]: https://github.com/nodejitsu/node-http-proxy

