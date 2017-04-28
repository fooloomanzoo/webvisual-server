const authRequired = true;
const port = 8000;

const ldapSettings = {
  "baseDN": "dc=ibn-net,dc=kfa-juelich,dc=de",
  "url": "ldap://ibn-net.kfa-juelich.de"
}

const ensureLoggedIn = {
  isRequired: function(req, res, next) {
    console.log('ensureLoggedIn isRequired', req.user, req.isAuthenticated() );
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.sendStatus(401);
    } else {
      next();
    }
  },
  notRequired: function(req, res, next) {
    next();
  }
}

var app = require('express')()
  , passport = require('passport')
  , xFrameOptions = require('x-frame-options')
  , cookieSession = require('cookie-session')
  , bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , compression = require('compression')
  , session = require('express-session')
  , serveStatic = require('serve-static')
  , multer = require('multer')({ dest: 'uploads/' })
  , http = require('http');

var server = http.createServer(app)
                 .once('listening', () => {
                    console.log( `HTTP Server is listening on port ${port}` );
                  });;

var staticMiddleware = serveStatic( './static' );
var staticDataMiddleware = serveStatic( './static/data', {index: false} );

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser('1234'));

var sessionMiddleWare = session( {
  key: 'connect.sid',
  secret: '1234',
  resave: true,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    secure: true,
    maxAge: 24*3600*1000*180
  }
} );

app.use( sessionMiddleWare );

// Prevent Clickjacking
app.use(xFrameOptions());

// register for authentification
app.use(passport.initialize());

// init session handler
app.use(passport.session());

// compress responses
app.use( compression() );

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

// Auth Methods
require('../activedirectory.js')(passport, ldapSettings); // register custom ldap-passport-stategy
require('../dummy.js')(passport); // register dummy-stategy

// Signin
app.post('/login/ldap', multer.fields([]),
  passport.authenticate('activedirectory-login'),
  (req, res) => {
    res.status(200).send(req.user);
  });
app.post('/login/dummy', multer.fields([]),
  passport.authenticate('dummy'),
  (req, res) => {
    res.status(200).send(req.user);
  });

// Auth Test
app.use('/auth', authRequired ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );

// Signout
app.use('/logout', (req, res) => {
  req.logout();
  res.sendStatus(200);
} );

// Secured Data
app.use('/data', authRequired ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
app.use('/data', staticDataMiddleware );

// Public Data
app.use(staticMiddleware);

// Fallback
// app.get('*', (req, res) => {
//   res.sendFile( './static/index.html' );
// });

server.listen(port);
