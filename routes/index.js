// Routing
const
  EventEmitter = require('events').EventEmitter,
  express = require('express'),
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),

  xFrameOptions = require('x-frame-options'),
  cookieSession = require('cookie-session'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  compression = require('compression'),
  session = require('express-session'),
  ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

const staticMiddleware = express.static(path.join(process.cwd(), 'public'), {cacheControl: 'no-cache'});

class Router extends EventEmitter {

  constructor(server) {
    super();
    this.app = server;

    this.passport = require('passport');
    this.settings = {};
    this.configuration = {};

    this.app.set("views", path.join(process.cwd(), 'views'));
    this.app.set("view engine", "jade");

    // Parser
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.app.use( session({
      cachControl: 'no-cache',
      secret: 'keyboard cat',
      resave: true,
      saveUninitialized: false,
      cookie: { secure: true }
    }));

    // Prevent Clickjacking
    this.app.use(xFrameOptions());

    // register for authentification
    this.app.use(this.passport.initialize());

    // init session handler
    this.app.use(this.passport.session());

    // compress responses
    this.app.use( compression() );

    this.passport.serializeUser(function(user, done) {
      done(null, user);
    });

    this.passport.deserializeUser(function(user, done) {
      done(null, user);
    });
  }

  setSettings(options) {
    if (options === undefined)
      this.emit("error", "Empty Configuration passed to Router");
    for (let key in options) {
      if (key == 'server')
        this.setServer(options.server);
      else if (key == 'userConfigFiles')
        this.setUserConfig(options.userConfigFiles);
      else {
        this.settings[key] = options[key];
      }
    }
  }

  setServer(opt) {
    this.settings.server = opt;

    require('./authentification_strategies/activedirectory.js')(this.passport, this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./authentification_strategies/dummy.js')(this.passport); // register dummy-stategy

    if (this.settings.server.auth.required === true) {
      this.app.post('/login',
        this.passport.authenticate('activedirectory-login', {
          successRedirect: '/',
          failureRedirect: '/login'
        }),
        function(req, res) {
          res.redirect(req.session.returnTo || '/');
          delete req.session.returnTo;
        }
      );
    } else {
      this.app.post('/login',
        this.passport.authenticate('dummy', {
          successRedirect: '/',
          failureRedirect: '/'
        }),
        function(req, res) {
          res.redirect(req.session.returnTo || '/');
          delete req.session.returnTo;
        }
      );
    }

    this.app.get('/login', (req, res, next) => {
      if (this.settings.server.auth.required === true) {
        res.render('login', {
          user: req.user,
          title: 'Login - Webvisual'
        });
      }
      else {
        res.redirect('/');
      }
    });

    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/login');
    });

    this.app.use('*', ensureLoggedIn('/login'));
    this.app.use(staticMiddleware);
    this.app.get('*', function(req, res) {
      res.sendFile( path.join(process.cwd(), 'public', 'index.html') );
    });
  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;
  }

  setConfiguration(opt, facility) {
    this.configuration[facility] = opt;

    // create server side json files of the regrounded element configurations
      // mkdir
    var dirs = ['/public', 'data', facility];
    var newDir = process.cwd();

    for (var i = 0; i < dirs.length; i++) {
      newDir += dirs[i] + '/';
      if (!fs.exists(newDir)) {
        fs.mkdir(newDir, (err) => {
          this.emit( {error: err} );
        })
      }
    }
      // write json
    var p;
    for (var sys in opt) {
      if (!fs.exists(newDir + '/' + sys)) {
        fs.mkdir(newDir + '/' + sys, (err) => {
          this.emit( {error: err} );
        })
      }
      for (var key in opt[sys]) {
        p = path.resolve(newDir + '/' + sys, key + ".json")
        fs.writeFile (p, JSON.stringify(opt[sys][key]), (err) => {
          if (err) this.emit("error", JSON.stringify(err));
        });
      }
    }
  }
}

module.exports = Router;
