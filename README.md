# pylon-balancer

## cli

TBA

## api

server:

``` javascript
var pb = require('pylon-balancer')({namespace:'balancer'})
pb.connect(3000) // a pylon-server
pb.listen(80) // balancer-server
```

client:

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
    
