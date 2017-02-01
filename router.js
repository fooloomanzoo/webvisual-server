const dir = {
  dist: '/public',
  data: '/public/data',
  img: '/public/images',
};

const devDir = {
  dist: '/views',
  data: '/views/data',
  img: '/views/images',
};

const requiredStaticSettings = [
  'groups',
  'groupingKeys',
  'preferedGroupingKey',
  'svgSource'
];

const EventEmitter = require('events').EventEmitter
    , express = require('express')
    , fs = require('fs')
    , path = require('path')
    , mkdirp = require('mkdirp')

// Routing
    , xFrameOptions = require('x-frame-options')
    , cookieSession = require('cookie-session')
    , bodyParser = require('body-parser')
    , cookieParser = require('cookie-parser')
    , compression = require('compression')
    , session = require('express-session')
    , serveStatic = require('serve-static')

// Session Store
    , RedisStore = require('connect-redis')(session);

function resolvePath() {
  let p = process.cwd();
  for (var i = 0; i < arguments.length; i++) {
    p = path.join(p, arguments[i]);
  }
  mkdirp(path.dirname(p), (err) => {
      if (err) console.error(err)
  });
  return p;
}

class Router extends EventEmitter {

  constructor(server, mode) {
    super();

    switch (mode) {
      case 'development':
        this.dir = devDir;
        break;
      default:
        this.dir = dir;
    }

    this.staticMiddleware = serveStatic( resolvePath( this.dir.dist ) );
    this.staticDataMiddleware = serveStatic( resolvePath( this.dir.data ), { index: false });
    this.staticImageMiddleware = serveStatic( resolvePath( this.dir.img ), { index: false });

    this.app = server;

    this.passport = require('passport');
    this.settings = {};
    this.configuration = {};

    // TODO: use session manager to auth socket.io client
    // http://mono.software/2014/08/25/Sharing-sessions-between-SocketIO-and-Express-using-Redis/
    // http://stackoverflow.com/questions/25532692/how-to-share-sessions-with-socket-io-1-x-and-express-4-x

    // Parser
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.sessionMiddleWare = session( {
      store: new RedisStore( {
        host: 'localhost',
        port: 6379
      } ),
      secret: 'String(Math.random().toString(16).slice(2)',
      resave: true,
      rolling: true,
      saveUninitialized: true,
      cookie: {
        secure: true,
        maxAge: 24*3600*1000*180
      }
    } );

    this.app.use( this.sessionMiddleWare );

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

    // Auth Methods
    require('./auth/activedirectory.js')(this.passport, this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./auth/dummy.js')(this.passport); // register dummy-stategy

    // Optional Auth
    let authNeeded = this.settings.server.auth.required;

    // Signin
    this.app.post('/login',
      authNeeded
        ? this.passport.authenticate('activedirectory-login')
        : this.passport.authenticate('dummy'),
      (req, res) => {
        // console.log('returnTo', path.resolve(process.cwd(), 'public', req.session.returnTo));
        res.redirect(req.session.returnTo || '/');
        // res.status(200).send('Logged In');

      });

    // Auth Test
    this.app.use('/auth', authNeeded ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
    this.app.use('/auth', (req, res) => {
      res.sendStatus(200);
    } );

    // Signout
    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/');
    } );

    // Secured Data
    this.app.use('/data', authNeeded ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
    this.app.use('/data', this.staticDataMiddleware );

    this.app.use('/images', authNeeded ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
    this.app.use('/images', this.staticImageMiddleware );

    // Public Data
    this.app.use(this.staticMiddleware);

    // Fallback
    this.app.get('*', (req, res) => {
      res.sendFile( resolvePath( this.dir.dist, 'index.html') );
    });

  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;

    // init facilities.json
    mkdirp(this.dir.data, (err) => {
      if (err) console.error(`Failed to create ${this.dir.data}\n ${err}`);
      return;
    });
    fs.writeFileSync( resolvePath ( this.dir.data, 'facilities.json' ), JSON.stringify([]));
  }

  setConfiguration(opt, facility) {
    this.configuration[facility] = opt;

    // workaround, to catch all emidiate changes
    if (this._activeWriteJob)
      clearTimeout( this._activeWriteJob );
    this._activeWriteJob = setTimeout(() => {
      this.createStaticContent();
      // setTimeout(() => {
      //   this.createWebApp();
      // }, 250)
    }, 250);
  }

  // createWebApp() {
  //   const result = gulp.task('build')()
  // }

  createStaticContent() {
    let facilities = []
      , tmp
      , pth
      , dest
      , svgDest;

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
          view: opt[system]._view,
          items: opt[system].items,
        } );

        let comb = facility + '+' + system;
        dest = resolvePath( this.dir.data );

        // create required static settings
        for (let key in opt[system]) {
          if (requiredStaticSettings.indexOf(key) === -1)
            continue;
          pth = path.resolve(dest, comb + '+' + key + '.json')
          fs.writeFile(pth, JSON.stringify(opt[system][key] || {}), (err) => {
            if (err)
              this.emit('error', `Writing Files for static content configuration data (${this.dir.data}) failed\n ${err}`);
          });
        }

        // copy svgContent in staticContentFolder
        if (opt[system].svgSource && opt[system].svgSource.paths &&  Object.keys(opt[system].svgSource.paths).length) {

          let svgDest = resolvePath(this.dir.img, facility, system);

          mkdirp(svgDest, (err) => {
            if (err) console.error(`SVG-File Destination folder failed to create \n ${err}`);

            let origin = '';
            dest = svgDest;

            // image origin folder
            if (opt[system].svgSource.origin) {
              origin = path.resolve(opt[system].svgSource.origin);
            }
            if (!origin || !fs.existsSync(origin)) {
              origin = resolvePath('examples', 'svg');
            }

            // Optimize SVGs
            function copy(opath, dpath) {
              return new Promise( (resolve, reject) => {
                fs.readFile(opath, 'utf8', (err, data) => {
                if (err) reject(err);
                resolve(data);
                });
              }).then( data => {
                // svgo.optimize(data, result => {
                  fs.writeFile(dpath, data, 'utf8', (err) => { // .replace(/\s+/g, ' ') trim all whitespaces for data reduction
                    if (err) {
                      console.error(`Transfer SVG-File failed \n from ${opath} \n ${err}`);
                      return;
                    }
                    console.log(`Transfer SVG-File successful \n from ${opath} \n to ${dpath}`);
                  });
                // });
              }).catch( err => {
                console.error(`Transfer SVG-File failed \n from ${opath} \n ${err}`);
              });
            }

            var promises = [];

            for (var p in opt[system].svgSource.paths) {
              let opath = path.resolve(origin, p);
              let dpath = path.resolve(dest, p);
              promises.push(copy(opath, dpath));
            }
            Promise.all(promises)
                  .then( () => {} )
                  .catch( err => { console.error(`Transfer SVG-Files failed \n ${err}`); });
          });
        }
      }

      if (tmp && tmp.length > 0) {
        facilities.push( {
          name: this.configuration[facility]._name,
          title: this.configuration[facility]._title,
          systems: tmp
        });
      }
    }

    // create required main overview
    mkdirp(this.dir.data, (err) => {
      if (err) console.error(`Failed to create ${this.dir.data}\n ${err}`);
      return;
    });
    dest = resolvePath(this.dir.data, 'facilities.json');

    fs.writeFileSync( dest, JSON.stringify(facilities) );
  }
}

const ensureLoggedIn = {
  isRequired: function(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.session = req.session || {};
      if (req.originalUrl && !req.originalUrl.match(/.*\..*/) && !req.originalUrl.match(/.*auth.*/)) {
        req.session.returnTo = req.originalUrl;
      }
      res.status(403).send('Unauthorized');
    } else {
      next();
    }
  },
  notRequired: function(req, res, next) {
    next();
  }
}

// Returns a WriteableStream to process images
function minify() {
  return imagemin({
    progressive: true,
    interlaced: true
  });
}

module.exports = Router;
