// Routing
const EventEmitter = require('events').EventEmitter
    , express = require('express')
    , fs = require('fs')
    , path = require('path')
    , mkdirp = require('mkdirp')

    , xFrameOptions = require('x-frame-options')
    , cookieSession = require('cookie-session')
    , bodyParser = require('body-parser')
    , cookieParser = require('cookie-parser')
    , compression = require('compression')
    , session = require('express-session')
    , serveStatic = require('serve-static')

    //, morgan = require('morgan')
    , RedisStore = require('connect-redis')(session);

const requiredStaticSettings = [
  'groups',
  'groupingKeys',
  'svgSource'
]

const staticMiddleware = serveStatic(path.join(process.cwd(), 'public'))
    , staticDataMiddleware = serveStatic(path.join(process.cwd(), 'public', 'data'), { index: false });

class Router extends EventEmitter {

  constructor(server) {
    super();
    this.app = server;

    this.passport = require('passport');
    this.settings = {};
    this.configuration = {};

    // this.app.use(morgan('combined'));

    // this.app.set('views', path.join(process.cwd(), 'views'));
    // this.app.set('view engine', 'jade');

    // Parser
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));


    this.app.use( session( {
      store: new RedisStore( {
        host: 'localhost',
        port: 6379
      } ),
      maxAge: 24*3600*365,
      secret: 'String(Math.random().toString(16).slice(2)',
      cachControl: 'no-cache',
      resave: true,
      saveUninitialized: false,
      cookie: { secure: true }
    } ));

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
      this.emit('error', 'Empty Configuration passed to Router');
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
        this.passport.authenticate('activedirectory-login'),
        (req, res) => {
          // console.log('returnTo', path.resolve(process.cwd(), 'public', req.session.returnTo));
          console.log(req.user, req.isAuthenticated(), req.session.returnTo, req.originalUrl, req.url);
          res.redirect('/');
          // res.status(200).send('Logged In');

        });
    } else {
      this.app.post('/login',
        this.passport.authenticate('dummy'),
        (req, res) => {
          console.log(req.user, req.isAuthenticated(), req.session.returnTo, req.originalUrl, req.url);
          res.redirect('/');
        });
    }

    this.app.use('/auth', this.ensureLoggedIn() );
    this.app.use('/auth', function(req, res) {
      console.log('is logged IN ?', req.user, req.path);
      res.sendStatus(200);
    } );

    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/');
    });

    this.app.use('/data', this.ensureLoggedIn() );
    this.app.use('/data', staticDataMiddleware );

    this.app.use(staticMiddleware);
    this.app.get('*', function(req, res) {
      console.log(req.path, req.user, req.isAuthenticated());
      res.sendFile( path.join(process.cwd(), 'public', 'index.html') );
    });
  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;

    // init facilities.json
    fs.writeFileSync(path.resolve(process.cwd(), 'public', 'data', 'facilities.json'), JSON.stringify([]));
  }

  setConfiguration(opt, facility) {
    this.configuration[facility] = opt;

    // workaround, to catch all emidiate changes
    if (this._activeWriteJob)
      clearTimeout( this._activeWriteJob );
    this._activeWriteJob = setTimeout(() => {
      this.createStaticContent();
    }, 250);
  }

  createStaticContent() {
    let dir = path.resolve(process.cwd(), 'public', 'data')
      , facilities = []
      , tmp
      , p;

    // write json
    for (let facility in this.configuration) {

      let opt = this.configuration[facility];
      tmp = [];

      for (let ke in opt) {
        if (ke === '_name' || ke === '_title')
          continue;

        let system = ke;

        tmp.push( {
          name: opt[system]._name,
          title: opt[system]._title,
          items: opt[system].items,
        } );

        let comb = facility + '+' + system;

        // create required static settings
        for (let key in opt[system]) {
          if (requiredStaticSettings.indexOf(key) === -1)
            continue;
          p = path.resolve(dir, comb + '+' + key + '.json')
          fs.writeFile(p, JSON.stringify(opt[system][key] || {}), (err) => {
            if (err)
              this.emit('error', 'Writing Files for static content configuration (../public/data/) failed\n' + err);
          });
        }
      }

      facilities.push( {
        name: this.configuration[facility]._name,
        title: this.configuration[facility]._title,
        systems: tmp
      });
    }

    // create required main overview
    dir = path.resolve(dir, 'facilities.json');

    fs.writeFileSync( dir, JSON.stringify(facilities) );
  }

  ensureLoggedIn() {
    return function(req, res, next) {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        console.log('ensureLoggedIn', req.user, req.isAuthenticated(), req.url, req.path);
        req.session.returnTo = req.originalUrl || req.url;
        console.log(403);
        res.status(403).send('Unauthorized');
      } else {
        console.log('ensureLoggedIn', req.user, req.isAuthenticated(), req.url, req.path);
        next();
      }
    }
  }
}

module.exports = Router;
