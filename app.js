var express = require('express');
var serveStatic = require('serve-static');

var app = express()

app.use(serveStatic('build'));

app.get('/', function(req, res) {
  res.send('hello from express');
});

var server = app.listen(31410, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('EXample app listening at http://%s:%s', host, port);

});

