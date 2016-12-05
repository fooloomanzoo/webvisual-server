const dir = {
  dist: '/public',
  data: '/public/data',
  img: '/public/images',
}

const requiredStaticSettings = [
  'groups',
  'groupingKeys',
  'preferedGroupingKey',
  'svgSource'
]

// const svgMinifyOptions = {
//   cleanupNumericValues: {
//     floatPrecision: 4,
//     leadingZero: true,
//     defaultPx: true,
//     convertToPx: true
//   },
//   removeUnknownsAndDefaults: false,
//   cleanupIDs: false,
//   removeEmptyContainers: true,
//   removeUselessDefs: true,
//   removeDesc: true,
//   removeMetadata: true,
//   removeComments: true,
//   removeEmptyAttrs: true
// }

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
    , RedisStore = require('connect-redis')(session)

// Image Minimizing TODO: find alternativ (svg structure too much changed)
    // , SVGO = require('svgo')
    // , svgo = new SVGO(svgMinifyOptions);

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

const staticMiddleware = serveStatic( resolvePath( dir.dist ) )
    , staticDataMiddleware = serveStatic( resolvePath( dir.data ), { index: false })
    , staticImageMiddleware = serveStatic( resolvePath( dir.img ), { index: false });

class Router extends EventEmitter {

  constructor(server) {
    super();
    this.app = server;

    this.passport = require('passport');
    this.settings = {};
    this.configuration = {};

    // this.app.use(morgan('combined'));

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
        res.redirect('/');
        // res.status(200).send('Logged In');

      });

    // Auth Test
    this.app.use('/auth', authNeeded ? ensureLoggedIn.is : ensureLoggedIn.not );
    this.app.use('/auth', (req, res) => {
      res.sendStatus(200);
    } );

    // Signout
    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/');
    } );

    // Secured Data
    this.app.use('/data', authNeeded ? ensureLoggedIn.is : ensureLoggedIn.not );
    this.app.use('/data', staticDataMiddleware );

    this.app.use('/images', authNeeded ? ensureLoggedIn.is : ensureLoggedIn.not );
    this.app.use('/images', staticImageMiddleware );

    // Public Data
    this.app.use(staticMiddleware);

    // Fallback
    this.app.get('*', (req, res) => {
      res.sendFile( resolvePath( dir.dist, 'index.html') );
    });

  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;

    // init facilities.json
    mkdirp(dir.data, (err) => {
      if (err) console.error(`Failed to create ${dir.data}\n ${err}`);
      return;
    });
    fs.writeFileSync( resolvePath ( dir.data, 'facilities.json' ), JSON.stringify([]));
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
          items: opt[system].items,
        } );

        let comb = facility + '+' + system;
        dest = resolvePath( dir.data );

        // create required static settings
        for (let key in opt[system]) {
          if (requiredStaticSettings.indexOf(key) === -1)
            continue;
          pth = path.resolve(dest, comb + '+' + key + '.json')
          fs.writeFile(pth, JSON.stringify(opt[system][key] || {}), (err) => {
            if (err)
              this.emit('error', `Writing Files for static content configuration data (${dir.data}) failed\n ${err}`);
          });
        }

        // copy svgContent in staticContentFolder
        if (opt[system].svgSource && Object.keys(opt[system].svgSource).length) {
          let images = [];

          // path folder
          svgDest = resolvePath(dir.img, facility, system);
          mkdirp(svgDest, (err) => {
            if (err) console.error(`SVG-File Destination folder failed to create \n ${err}`);

            // image origin folder
            dest = path.resolve(opt[system].svgPathOrigin);
            if (!dest || !fs.existsSync(dest)) {
              dest = resolvePath('examples', 'svg');
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
                  fs.writeFile(dpath, data.replace(/\s+/g, ' '), 'utf8', (err) => { // trim all whitespaces for data reduction
                    if (err) {
                      console.error(`Transfer SVG-File failed \n from ${opath} \n ${err}`);
                      return;
                    }
                    console.log(`Transfer SVG-File successful \n from ${opath} \n to ${dpath}`);
                  });
                // });
              }).catch( err => {
                console.error(`Transfer SVG-File successful \n from ${opath} \n ${err}`);
              });
            }

            var promises = [];

            for (var p in opt[system].svgSource) {
              let opath = path.resolve(dest, p);
              let dpath = path.resolve(svgDest, p);
              promises.push(copy(opath, dpath));
            }
            Promise.all(promises)
                  .then( () => {} )
                  .catch( err => { console.error(`Transfer SVG-Files \n from ${dest} \n to ${svgDest} failed \n ${err}`); });
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
    mkdirp(dir.data, (err) => {
      if (err) console.error(`Failed to create ${dir.data}\n ${err}`);
      return;
    });
    dest = resolvePath(dir.data, 'facilities.json');

    fs.writeFileSync( dest, JSON.stringify(facilities) );
  }
}

const ensureLoggedIn = {
  is: function(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.session.returnTo = req.originalUrl || req.url;
      res.status(403).send('Unauthorized');
    } else {
      next();
    }
  },
  not: function(req, res, next) {
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
