const EventEmitter = require('events').EventEmitter,
  express = require('express'),
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  jsonfile = require('jsonfile'),
  // Routing
  xFrameOptions = require('x-frame-options'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  compression = require('compression'),
  session = require('express-session'),
  serveStatic = require('serve-static'),
  useragent = require('express-useragent'),
  passport = require('passport'),
  // multi-form requests (login)
  multer = require('multer'),
  // Server
  spdy = require('spdy'),
  // Session Store
  RedisStore = require('connect-redis')(session),
  // FileStore = require('session-file-store')(session),
  // Development (Reload on change)
  chokidar = require('chokidar');

  const requiredStaticSettings = [
    'groups',
    'groupingKeys',
    'preferedGroupingKey',
    'svgSource',
    'items'
  ]

class Router extends EventEmitter {

  constructor(mode) {
    super()
    this.mode = mode || 'development'

    this.dirDevelopment = path.join(__dirname, 'views')
    this.dirProduction = path.join(__dirname, 'views/build')
    this.dir = {
      locale: path.join(__dirname, 'views/locales'),
      icons: path.join(__dirname, 'views/icons')
    }

    this.passport = passport
    this.settings = {}
    this.configurations = {}

    this.sessionSecret = String(Math.random().toString(16).slice(2))
  }

  setSettings(serverConfig, configfiles, sslSettings) {
    this.setApp(serverConfig, sslSettings)
    this.setConfigurations(configfiles)
  }

  connect() {
    if (this.server)
      this.server.listen(this.settings.server.port || process.env.port || 443)
    else {
      this.setServer(this.settings.ssl, this.app)
      if (this.server)
        this.connect()
    }
  }

  disconnect() {
    if (this.server)
      this.server.close()
  }

  setApp(options, sslSettings) {
    this.settings.server = options
    this.settings.ssl = sslSettings

    this.dirTmp = this.settings.server._tmpDir ? resolvePath(this.settings.server._tmpDir) : path.join(__dirname, 'views')
    this.dirData = resolvePath(this.dirTmp, 'data')
    this.dirImage = resolvePath(this.dirTmp, 'images')

    this.app = express()

    if (options.sessionStore) {
      switch (options.sessionStore.type) {
        case 'redis':
          // session-cookie-db
          this.sessionStore = new RedisStore({
            host: options.sessionStore.host || 'localhost',
            port: options.sessionStore.port || 6379,
            db: options.sessionStore.db || 1
          });
          break;
        // default:
        //   this.sessionStore = new FileStore()
      }
      // session cookie with saving in redis db
      this.sessionMiddleWare = session({
        store: this.sessionStore,
        key: 'connect.sid',
        secret: this.sessionSecret,
        resave: true,
        rolling: true,
        saveUninitialized: false,
        cookie: {
          secure: true,
          maxAge: 7 * 24 * 3600 * 1000
        }
      })
    } else {
      this.sessionMiddleWare = session({
        key: 'connect.sid',
        secret: this.sessionSecret,
        resave: true,
        rolling: true,
        saveUninitialized: false,
        cookie: {
          secure: true,
          maxAge: 7 * 24 * 3600 * 1000
        }
      })
    }

    // user-agent
    this.app.use(useragent.express())
    // Parser
    this.app.use(bodyParser.urlencoded({
      extended: true
    }))
    this.app.use(bodyParser.json())

    this.cookieParser = cookieParser(this.sessionSecret)
    this.app.use(this.cookieParser)

    this.app.use(this.sessionMiddleWare)

    // Prevent Clickjacking
    this.app.use(xFrameOptions())
    // register for authentification
    this.app.use(this.passport.initialize())
    // init session handler
    this.app.use(this.passport.session())
    // compress responses
    this.app.use(compression())

    this.passport.serializeUser(function(user, done) {
      done(null, user)
    })
    this.passport.deserializeUser(function(user, done) {
      done(null, user)
    })

    // Auth Methods
    require('./lib/auth/activedirectory.js')(this.passport, this.settings.server.auth.type) // register custom ldap-passport-stategy
    require('./lib/auth/dummy.js')(this.passport) // register dummy-stategy

    // watch for changes, if in development mode, for auto-reloading
    if (this.mode === 'development') {
        let srcpath = resolvePath(this.dirDevelopment)
        this.watcher = chokidar.watch(srcpath, {
          ignored: /(^|[\/\\])\../,
          persistent: true
        })
        // Add event listeners.
        this.watcher
          .on('change', path => {
            console.log(`${this.mode}: "${path}" changed. Clients reload...`)
            if (this.reloadJob) {
              clearTimeout(this.reloadJob)
              this.reloadJob = null
            }
            this.reloadJob = setTimeout(() => {
              this.io.sockets.emit('reload')
            }, 3000)
          })

        console.info(`Watch for changes in ${srcpath}. Clients reload on change.`)
    }

    // Signin
    // multi-form requests (login)
    this.multer = multer({
      dest: path.join(this.dirTmp, 'tmp'),
      limits: {
        fileSize: 0
      },
      fileFilter: (req, file, cb) => {
        cb(null, false)
      }
    })
    this.app.post('/login', this.multer.fields([]),
      this.settings.server.auth.required ?
      this.passport.authenticate('activedirectory-login') :
      this.passport.authenticate('dummy'),
      (req, res) => {
        res.status(200).send(req.user)
      })

    // Auth Test
    this.app.use('/auth', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired, (req, res) => {
      if (req.session.passport) {
        res.status(200).send(req.session.passport.user)
      } else {
        res.sendStatus(200)
      }
    })

    // Signout
    this.app.use('/logout', (req, res) => {
      if (req.session) {
        req.session.destroy()
      }
      req.logout()
      res.sendStatus(200)
    })

    // Secured Data
    this.app.use('/locale', serveStatic(this.dir.locale, {
      index: false,
      fallthrough: false
    }))
    this.app.use('/icons', serveStatic(this.dir.icons, {
      index: false,
      fallthrough: false
    }))

    // Secured Data
    this.app.use('/data', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired)
    this.app.use('/data', serveStatic(this.dirData, {
      index: false,
      fallthrough: false
    }))

    this.app.use('/images', this.settings.server.auth.required ? ensureLoggedIn.isRequired : ensureLoggedIn.notRequired)
    this.app.use('/images', serveStatic(this.dirImage, {
      index: false,
      fallthrough: false
    }))

    // Delivering App (versions defined by polymer build)
    // not in development mode (build version) and supporting es6 (bundled version)
    this.app.use(
      conditional(this.mode !== 'development',
        conditional(useragent_supports_es6,
          serveStatic( path.join(this.dirProduction, '/bundled'), { index: ['index.html'] })
      )))
    // not in development mode (build version) and not supporting es6 (compiled version)
    this.app.use(
      conditional(this.mode !== 'development',
        conditional(useragent_supports_es6,
          serveStatic( path.join(this.dirProduction, '/compiled')), true
      )))
    // in development mode (unbuild, uncompiled version)
    this.app.use(serveStatic(this.dirDevelopment))

    // Fallback (for in-app-page-routing neccessary)
    this.app.get('*', (req, res) => {
      res.location(req.originalUrl)
      if (this.mode === 'development') {
        res.sendFile(path.join(this.dirDevelopment, 'index.html'))
      } else {
        res.sendFile(path.join(this.dirProduction, (useragent_supports_es6(req) ? '/bundled' : '/compiled'), 'index.html'))
      }
    })

    this.setServer(this.settings.ssl, this.app);

    this.emit('ready');
  }

  setServer(sslSettings, app) {
    this.settings.ssl = sslSettings || this.settings.ssl
    this.settings.ssl.requestCert = true;
    this.settings.ssl.rejectUnauthorized = false;

    app = app || this.app
    if (!this.settings.ssl) {
      console.warn('There are no settings available for SSL. The HTTP-connection will be unencrypted.');
    }
    if (!app) {
      console.error('The Router is not initialized. the HTTP2-Server is not going to be (re-)started.');
      return;
    }
    if (this.server)
        this.server.close()
    this.server = spdy.createServer(this.settings.ssl, app)
    this.server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error( `HTTP2 Server \n Port ${this.settings.server.port} in use. Please check if node.exe is not already running on this port.` )
        this.server.close()
      } else if (err.code === 'EACCES') {
        console.error( `HTTP2 Server \n Network not accessable. Port ${this.settings.server.port} might be in use by another application. Try to switch the port or quit the application, which is using this port` )
      } else {
        console.error( err.stack )
      }
    })
    .once('listening', () => {
      console.info( `HTTP2 Server is listening on port ${this.settings.server.port}` )
    });

    this.io = require('socket.io')(this.server)
    this.io.use((socket, next) => {
      this.cookieParser(socket.handshake, {}, err => {
        if (err) {
          // console.log('error in parsing cookie')
          return next(err)
        }
        if (!socket.handshake.signedCookies) {
          // console.log('no secureCookies|signedCookies found')
          return next(new Error('no secureCookies found'))
        }
        if (!err && socket.handshake.signedCookies) {
          this.sessionStore.get(socket.handshake.signedCookies['connect.sid'], (err, session) => {
            socket.session = session
            // if (!err && !session) {
            //   err = 'Session not found';
            // }
            if (err) {
              console.warn(`Failed connection to socket.io\n ${err.stack}`)
            } else if (session || !this.settings.server.auth.required) {
              // console.log('Successful connection to socket.io', session)
              next()
            }
          })
        } else {
          next(false)
        }
      })
    })
  }

  setConfigurations(configfiles) {
    this.settings.configfiles = configfiles

    // init facilities.json
    mkdirp(this.dirData, err => {
      if (err) {
        console.error(`Failed to create ${this.dirData}\n ${err.stack}`)
        return
      }
      jsonfile.writeFile(path.resolve(this.dirData, 'facilities.json'), [], err => {
        if (err) {
          console.error(`Failed to create facilities.json\n ${err.stack}`)
          return
        }
      })
    })
  }

  setConfiguration(opt, facility) {
    this.configurations[facility] = opt
    mkdirp(this.dirData, err => {
      if (err) {
        console.error(`Failed to create ${this.dirData}\n ${err.stack}`)
        return
      }
      this.createStaticContent()
    })
  }

  createStaticContent() {
    let facilities = [], toCopy = new Set(), promises = []

    // write json
    for (let facility in this.configurations) {

      let opt = this.configurations[facility], tmp = []

      for (let system in opt) {
        if (system === '_name' || system === '_title')
          continue

        tmp.push({
          name:  opt[system]._name,
          title: opt[system]._title,
          view:  opt[system]._view,
        })
        // copy svgContent in staticContentFolder
        let svgDest = resolvePath(this.dirImage, facility, system)

        promises.push( new Promise( (resolve, reject) => {
          mkdirp(svgDest, error => {
            if (error) reject(`SVG-File Destination folder failed to create \n ${error.stack}`)
            resolve()
          })
        }))

        opt[system].itemMap.forEach( (item) => {
          if (item.hasOwnProperty('svg')) {
            if (item.svg.path && item.svg.dir) {
              const origin = path.resolve(item.svg.dir, item.svg.path)
              const dest = path.resolve(svgDest, item.svg.path)
              if (origin && dest && !toCopy.has(dest)) {
                toCopy.add(dest)
                delete item.svg.dir
                promises.push(
                  copy(origin, dest)
                )
              }
            }
          }
        })

        // create required static settings
        for (const key in opt[system]) {
          if (requiredStaticSettings.indexOf(key) === -1)
            continue
          const room = facility + '+' + system
          const pth = path.resolve(this.dirData, room + '+' + key + '.json')
          const data = opt[system][key]
          promises.push( jsonfile.writeFileSync(pth, data) )
        }
      }

      if (tmp && tmp.length > 0) {
        facilities.push({
          name: this.configurations[facility]._name,
          title: this.configurations[facility]._title,
          systems: tmp
        })
      }
    }

    // create facility-structure
    promises.push( jsonfile.writeFileSync(path.resolve(this.dirData, 'facilities.json'), facilities) )

    // write all files
    Promise.all(promises)
      .then(() => {
        // for (var i = 0; i < res.length; i++) {
        //   if (res[i])
        //     console.info(res[i]);
        // }
      })
      .catch(err => {
        console.error(err)
      })
  }
}

const ensureLoggedIn = {
  isRequired: function(req, res, next) {
    // console.log('ensureLoggedIn isRequired', req.user, req.isAuthenticated() )
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.sendStatus(401)
    } else {
      next()
    }
  },
  notRequired: function(req, res, next) {
    next()
  }
}

function copy(origin, dest) {
  return new Promise( (resolve, reject) => {
    fs.readFile(origin, 'utf8', (err, data) => {
      if (err) reject(`Transfer File failed \nfrom ${origin} \nto ${dest}\n ${err}`)
      fs.writeFile(dest, data, 'utf8', error => {
        if (error) reject(`Transfer File failed \nfrom ${origin} \nto ${dest}\n ${err}`)
        resolve(`Transfer File successful \nfrom ${origin} \nto ${dest}`)
      })
    })
  })
}

function resolvePath() {
  let p = path.resolve(...arguments)
  mkdirp(path.dirname(p), err => {
    if (err) console.error(err)
  })
  return p
}

function conditional(condition, middleware, negate) {
  if (negate === true) {
    if (typeof condition === 'function') {
      return function(req, res, next) {
        if (!condition(req)) return middleware(req, res, next)
          next()
      }
    }
    return function(req, res, next) {
      if (!condition) return middleware(req, res, next)
        next()
    }
  }
  if (typeof condition === 'function') {
    return function(req, res, next) {
      if (condition(req)) return middleware(req, res, next)
        next()
    }
  }
  return function(req, res, next) {
    if (condition) return middleware(req, res, next)
      next()
  }
}

function useragent_supports_es6(req) {
  let ua = req.useragent,
    browser = ua.browser,
    versionSplit = (ua.version || '').split('.'),
    [majorVersion, minorVersion] = versionSplit.map(v => { return v ? parseInt(v, 10) : -1});
  return (browser === 'Chrome' && majorVersion >= 49) ||
    (browser === 'Chromium' && majorVersion >= 49) ||
    (browser === 'Opera' && majorVersion >= 36) ||
    (browser === 'Vivaldi' && majorVersion >= 1) ||
    (browser === 'Safari' && majorVersion >= 10) ||
    (browser === 'Edge' && (majorVersion > 15 || (majorVersion === 15 && minorVersion >= 15063))) ||
    (browser === 'Firefox' && majorVersion >= 51);
}

module.exports = Router
