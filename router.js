const dir = {
  dist: '/views/build/compiled',
  data: '/views/build/compiled/data',
  img: '/views/build/compiled/images',
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
    , multer = require('multer')({ dest: 'uploads/' })

    // Session Store
    , RedisStore = require('connect-redis')(session)

    // Development (Reload on change)
    , chokidar = require('chokidar');

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

  constructor(app, mode) {
    super();

    switch (mode) {
      case 'develop':
      case 'development':
        this.dir = devDir;
        break;
      default:
        this.dir = dir;
    }

    this.mode = mode;

    this.staticMiddleware = serveStatic( resolvePath( this.dir.dist ) );
    this.staticDataMiddleware = serveStatic( resolvePath( this.dir.data ), { index: false });
    this.staticImageMiddleware = serveStatic( resolvePath( this.dir.img ), { index: false });

    this.app = app;

    this.passport = require('passport');
    this.settings = {};
    this.configuration = {};

    this.sessionSecret = this.settings.sessionSecret || 'String(Math.random().toString(16).slice(2)';

    // TODO: use session manager to auth socket.io client
    // http://mono.software/2014/08/25/Sharing-sessions-between-SocketIO-and-Express-using-Redis/
    // http://stackoverflow.com/questions/25532692/how-to-share-sessions-with-socket-io-1-x-and-express-4-x

    // Parser
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    this.cookieParser = require('cookie-parser')(this.sessionSecret);
    this.app.use(this.cookieParser);

    this.sessionStore = new RedisStore( {
      host: 'localhost',
      port: 6379,
      db: 1
    } );

    this.sessionMiddleWare = session( {
      store: this.sessionStore,
      key: 'connect.sid',
      secret: this.sessionSecret,
      resave: true,
      rolling: true,
      saveUninitialized: false,
      cookie: {
        secure: true,
        maxAge: 7*24*3600*1000
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

  setSettings(options, server) {
    if (options === undefined)
      this.emit('error', 'Empty Configuration passed to Router');
    for (let key in options) {
      if (key == 'server' && server)
        this.setServer(options.server, server);
      else if (key == 'userConfigFiles')
        this.setUserConfig(options.userConfigFiles);
      else {
        this.settings[key] = options[key];
      }
    }
  }

  setServer(opt, server) {
    this.settings.server = opt;

    // Auth Methods
    require('./lib/auth/activedirectory.js')(this.passport, this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./lib/auth/dummy.js')(this.passport); // register dummy-stategy

    this.io = require('socket.io')(server);

    this.io.use( (socket, next) => {
      this.cookieParser(socket.handshake, {}, (err) => {
        // if (err) {
        //   console.log('error in parsing cookie');
        //   return next(err);
        // }
        // if (!socket.handshake.signedCookies) {
        //   console.log('no secureCookies|signedCookies found');
        //   return next(new Error('no secureCookies found'));
        // }
        if (!err && socket.handshake.signedCookies) {
          this.sessionStore.get(socket.handshake.signedCookies['connect.sid'], (err, session) => {
            socket.session = session;
            // if (!err && !session) {
            //   err = new Error('Session not found');
            // }
            // if (err) {
            //   console.log('Failed connection to socket.io:', err);
            // }
            if (session || !this.settings.server.auth.required) {
              // console.log('Successful connection to socket.io', session);
              next();
            }
          });
        } else {
          next(false);
        }
      });
    });

    switch (this.mode) {
      case 'develop':
      case 'development':
        let srcpath = resolvePath( this.dir.dist );
        this.watcher = chokidar.watch( srcpath, {
          ignored: /(^|[\/\\])\../,
          persistent: true
        });
        // Add event listeners.
        this.watcher
          .on('change', path => {
            this.emit('log', `${this.mode}: "${path}" changed`);
            if (this.reloadJob) {
              clearTimeout(this.reloadJob);
              this.reloadJob = null;
            }
            this.reloadJob = setTimeout(() => {
              this.io.sockets.emit('reload');
            }, 1500);
          });

        this.emit('info', `Watch for changes in ${srcpath}. Clients reload on change.`);
        break;
    }

    // Signin
    this.app.post('/login', multer.fields([]),
      this.settings.server.auth.required ?
        this.passport.authenticate('activedirectory-login') :
          this.passport.authenticate('dummy'),
      (req, res) => {
          res.status(200).send(req.user);
      });

    // Auth Test
    this.app.use('/auth', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired, (req, res) => {
      if (req.session.passport) {
        res.status(200).send(req.session.passport.user);
      } else {
        res.sendStatus(200);
      }
    });

    // Signout
    this.app.use('/logout', (req, res) => {
      req.logout();
      req.session.destroy();
      res.sendStatus(200);
    } );

    // Secured Data
    this.app.use('/data', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
    this.app.use('/data', this.staticDataMiddleware );

    this.app.use('/images', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired );
    this.app.use('/images', this.staticImageMiddleware );

    // Public Data
    this.app.use(this.staticMiddleware);

    // Fallback (for in-app-page-routing neccessary)
    this.app.get('*', (req, res) => {
      res.location(req.originalUrl);
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
    // if (this._activeWriteJob)
    //   clearTimeout( this._activeWriteJob );
    // this._activeWriteJob = setTimeout(() => {
      this.createStaticContent();
      // setTimeout(() => {
      //   this.createWebApp();
      // }, 250)
    // }, 250);
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
                  fs.writeFile(dpath, data, 'utf8', (err) => {
                    if (err) {
                      console.error(`Transfer SVG-File failed \n from ${opath} \n ${err}`);
                      return;
                    }
                    console.log(`Transfer SVG-File successful \n from ${opath} \n to ${dpath}`);
                  });
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
    // console.log('ensureLoggedIn isRequired', req.user, req.isAuthenticated() );
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

// Returns a WriteableStream to process images
function minify() {
  return imagemin({
    progressive: true,
    interlaced: true
  });
}

module.exports = Router;
