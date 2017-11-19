var express = require('express')
var app = express()
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var listener = server.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port)
})

app.use(express.static('public'))
app.set('view engine', 'pug')

var fs = require('fs')

try {
  var list = require('./db.json')
  console.log(list.length + ' tracks loaded.')
}
catch (e) {
  var list = []
  console.log('Tracks reset: ' + e)
}

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

var itunes = require('request')

app.get('/', function (request, response) {
  response.render('index', { list: list })
})

app.post('/search', function (request, response) {
  var results = { resultCount: 0 }
  var url = 'https://itunes.apple.com/search?media=music&explicit=no&limit=10&term='
  url += encodeURIComponent(request.body.term)
  itunes.get({ url: url, json: true }, (err, res, data) => {
    if (err) {
      console.log('Error:', err)
    } else if (res.statusCode !== 200) {
      console.log('Status:', res.statusCode)
    } else {
      results = data
    }
    response.render('results', { list: results })
  })
})

app.post('/vote', function (request, response) {
  var data = request.body.data
  console.log(data)
  if ( ! list.some(track => track['trackId'] == data.trackId) ) {
    data['votes'] = 1
    list.push(data)
  } else {
    var i = list.findIndex(track => track['trackId'] == data.trackId)
    list[i]['votes']++
  }
  response.sendStatus(200)
})

app.get("/reset", function (request, response) {
  list = []
  console.log("Tracks cleared.");
  response.redirect("/");
});


process.on('SIGTERM', function () {
  fs.writeFile('db.json', JSON.stringify(list), function(err) {
    if (err) {
      console.log(err)
    } else {
      console.log(list.length + ' tracks saved.')
    }
    process.exit(0);
  })
});