// Load from and save to file

var fs = require('fs')
try {
  var list = require('./db.json')
  console.log(list.length + ' tracks loaded.')
} catch(e) {
  var list = []
  console.log('Tracks reset: ' + e)
}

process.on('SIGTERM', function() {
  fs.writeFile('db.json', JSON.stringify(list), function(err) {
    if (err) {
      console.log(err)
    } else {
      console.log(list.length + ' tracks saved.')
    }
    process.exit(0)
  })
})

// Authentication

var passport = require('passport')
var GoogleStrategy = require('passport-google-oauth20').Strategy;

function extractProfile(profile) {
  let imageUrl = ''
  if (profile.photos && profile.photos.length) {
    imageUrl = profile.photos[0].value
  }
  return {
    id: profile.id,
    displayName: profile.displayName,
    image: imageUrl
  }
}

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT,
  clientSecret: process.env.SECRET,
  callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/google/return',
  scope: 'profile'
}, (token, tokenSecret, profile, cb) => {
  return cb(null, extractProfile(profile))
}))

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((obj, done) => {
  done(null, obj)
})

// Init server

var express = require('express')
var app = express()
var expressSession = require('express-session')

app.use(express.static('public'))
app.set('view engine', 'pug')
app.locals.pretty = true;
app.set('json spaces', 2);

var itunes = require('request')

var sessionMiddleware = expressSession({
  secret: process.env.SESSION,
  resave: false,
  saveUninitialized: false })

app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

// Routes

app.get('/login', passport.authenticate('google'))

app.get('/login/google/return', 
  passport.authenticate('google', 
    { successRedirect: '/', failureRedirect: '/' }
  )
)

app.get('/logout',
  function(req, res) {
    res.clearCookie('connect.sid')
    res.redirect('/')
  }
)

app.get('/', function(request, response) {
  response.render('index', { profile: request.user } )
})

app.get('/reset', function(request, response) {
  list = []
  console.log('Tracks cleared.')
  response.redirect('/')
});

app.get('/json', function (request, response) {
  response.json(list)
})

// Listen for requests

var server = require('http').createServer(app)
var listener = server.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port)
})

// Socket.io

var io = require('socket.io')(server)

  .use(function(socket, next){
    // Wrap the express middleware
    sessionMiddleware(socket.handshake, {}, next)
  })

io.on('connection', function(socket) {
  
  socket.user = ''
  
  if (socket.handshake.session.passport) {
    socket.user = socket.handshake.session.passport.user.id
    socket.name = socket.handshake.session.passport.user.displayName
    console.log('Logged in user:', socket.name)
  } else {
    console.log('Logged out user')
  }

  var rlist = JSON.parse(JSON.stringify(list))
  for (var i = 0; i < rlist.length; i++) {
    rlist[i].voted = (rlist[i].voted.indexOf(socket.user) >= 0 || socket.user == '') ? true : false
  }
  socket.emit('refresh', rlist)
  
  socket.on('search', function(term, fn) {
    console.log('Search for:', term)
    var results = { resultCount: 0, results: [] }
    var url = 'https://itunes.apple.com/search?media=music&explicit=no&limit=10&term='
    url += encodeURIComponent(term)
    itunes.get({ url: url, json: true  }, (err, res, data) => {
      if (err) {
        console.log('Error:', err)
      } else if (res.statusCode !== 200) {
        console.log('Status:', res.statusCode)
      } else {
        results = data
      }
      fn(results)
    })
  })
  
  socket.on('add', function(trackId) {
    if ( ! socket.user ) {
      return
    }
    var i = list.findIndex(track => track['trackId'] == trackId)
    if ( i < 0 ) {
      var url = 'https://itunes.apple.com/lookup?id=' + trackId
      itunes.get({ url: url, json: true }, (err, res, data) => {
        if (err) {
          console.log('Error:', err)
        } else if (res.statusCode !== 200) {
          console.log('Status:', res.statusCode)
        } else {
          var song = data.results[0]
          var results = { trackId: song.trackId,
                          artistName: song.artistName,
                          trackName: song.trackName,
                          artworkUrl100: song.artworkUrl100,
                          previewUrl: song.previewUrl,
                          voted: [socket.user],
                          votes: 1 }
          list.push(results)
          console.log(socket.name, 'added:', song.trackName)
          var rsong = JSON.parse(JSON.stringify(results))
          for (var i in io.connected) {
            var s = io.connected[i]
            if (socket.id === s.id || ! s.user) {
              rsong.voted = true
              io.to(s.id).emit('added', { song: [rsong], name: socket.name })
            } else {
              rsong.voted = false
              io.to(s.id).emit('added', { song: [rsong], name: socket.name })
            }
          }
        }
      })
    } else {
      vote(trackId, socket, true)
    }
  })

  socket.on('upvote', function(trackId) {
    vote(trackId, socket, true)
  })

  socket.on('downvote', function(trackId) {
    vote(trackId, socket, false)
  })
})

function vote(trackId, socket, up) {
  if ( ! socket.user ) {
    return
  }
  var i = list.findIndex(track => track['trackId'] == trackId)
  if ( list[i].voted.indexOf(socket.user) < 0 ) {
    up ? list[i].votes++ : list[i].votes--
    list[i].voted.push(socket.user)
    io.emit('voted', { trackId: trackId, votes: list[i]['votes'], name: socket.name, up: up })
    console.log(socket.name, (up ? 'up' : 'down') + 'voted:', list[i]['trackName'])
  } else {
    console.log(socket.name, 'already voted:', list[i]['trackName'])
  }
}