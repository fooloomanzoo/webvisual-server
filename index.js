'use strict';

// System Modules
const express = require('express'),
  fs = require('fs'),
  path = require('path'),

  // Processing Modules
  DataModule = require('./lib/data_module'),
  ConfigFileProcessor = require('./lib/config_file_processor'),
  Router = require('./routes'),

  // Sessions & Authentification
  xFrameOptions = require('x-frame-options'),
  session = require('express-session'),
  passport = require('passport'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  compression = require('compression'),

  // Server
  spdy = require('spdy'),
  app = express();

// if not called as child_process
process.send = process.send || logger;
var argv = require('minimist')(process.argv.slice(2));
  // if no arguments are send ('_' contains Array of arguments with no option)
if (Object.keys(argv).length <= 1)
  argv = null;

// Defaults
const defaults = require('./defaults/config.json');

// use compression
app.use(compression());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// get cookies from http requests
app.use(cookieParser());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.use(session({
  secret: '&hkG#1dwwh!',
  resave: false,
  saveUninitialized: false
}));

// Prevent Clickjacking
app.use(xFrameOptions());

// compress responses
app.use(compression())

// register for authentification
app.use(passport.initialize());

// init session handler
app.use(passport.session());

// static dir
app.use(express.static(path.join(__dirname, 'public', 'www')));

class WebvisualServer {

  constructor(settings) {
    this.isRunning = false;

    this.config = settings || argv || defaults;

    this.router = new Router(app, passport);
    this.router.on('error', (err) => {
      process.send( { error: err } );
    });

    this.dataHandler = new DataModule();

    this.configFilesHandler = new ConfigFileProcessor();

    this.configFilesHandler.on('changed', (route) => {
      this.dataHandler.setConfiguration(this.configFilesHandler.settings[route], route);
      this.router.setConfiguration(this.configFilesHandler.settings[route], route); // load Settings to Routen them to requests
    });
    this.dataHandler.on('error', (err) => {
      process.send( { error: err } );
    });

    this.connect(this.config);
  }

  createServer(settings, callback) {
    return new Promise((resolve, reject) => {
      if (settings)
        this.config = settings;

      if (this.isRunning)
        this.disconnect();

      this.router.setSettings(settings || this.config);

      let sslOptions = defaults.server.ssl;
      sslOptions.port = this.config.server.port.http2 || 443;

      try {
        // use https & http-redirecting
        if (this.config.server.ssl &&
          this.config.server.ssl.cert &&
          this.config.server.ssl.key &&
          this.config.server.ssl.passphrase) {

          let cert = path.resolve(this.config.server.ssl.cert)
            , key = path.resolve(this.config.server.ssl.key)
            , passphrase = path.resolve(this.config.server.ssl.passphrase);

          fs.access( cert, fs.constants.R_OK, (err) => {
            if (err)
              throw new Error(`File for certification (ssl) not found \n ${err}`);
            else {
              fs.access( key, fs.constants.R_OK, (err) => {
                if (err)
                  throw new Error(`File for public key (ssl) not found \n ${err}`);
                else {
                  fs.access( passphrase, fs.constants.R_OK, (err) => {
                    if (err)
                      throw new Error(`File for passphrase (ssl) not found \n ${err}`);
                    else {
                      // Configure SSL Encryption
                      sslOptions.key = key;
                      sslOptions.cert = cert;
                      sslOptions.passphrase = passphrase;
                    }
                  });
                }
              });
            }
          });
        }
      } catch (err) {
        process.send( { error: err } );
      } finally {
        // read sync ssl encryption
        sslOptions.key = fs.readFileSync(sslOptions.key, 'utf8');
        sslOptions.cert = fs.readFileSync(sslOptions.cert, 'utf8');
        sslOptions.passphrase = require(sslOptions.passphrase).password;
        resolve(sslOptions);
      }
    });
  }

  connect(settings) {
    // connect the DATA-Module
    if (this.isRunning === false) {
      process.send( { log: 'WebvisualServer is starting' } );
      this.createServer(settings)
        .then((sslOptions) => {
          if (this.http2)
            this.http2.close();
          this.http2 = spdy.createServer(sslOptions, app);
          this.http2.on('error', (err) => {
              if (e.code === 'EADDRINUSE') {
                process.send( { error: `HTTP2 Server \n Port ${this.config.server.port.http2} in use. Please check if node.exe is not already running on this port.` } );
                this.http2.close();
              } else if (e.code === 'EACCES') {
                process.send( { error: `HTTP2 Server \n Network not accessable. Port ${this.config.server.port.http2} might be in use by another application. Try to switch the port or quit the application, which is using this port` } );
              } else {
                process.send( { error: err } );
              }
            })
            .once('listening', () => {
              process.send( { log: `HTTP2 Server is listening on port ${this.config.server.port.http2}` } );
            });
          this.dataHandler.setServer(this.http2);
          this.http2.listen(this.config.server.port.https || 443);
          this.configFilesHandler.watch(this.config.userConfigFiles);
          this.isRunning = true;
          process.send( { event: 'server-start' } );
        })
        .catch( (err) => {
          process.send( { error: `in SSL Configuration \n ${err}` } );
        });
    }
  }

  disconnect() {
    process.send( { log: 'WebvisualServer is closing' } );
    if (this.http2)
      this.http2.close();
    this.configFilesHandler.unwatch();
    this.dataHandler.disconnect();
    this.isRunning = false;
    process.send( { event: 'server-stop' } );
  }

  reconnect(settings) {
    if (settings)
      this.config = settings;
    if (this.isRunning)
      this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 2500);
  }

  toggle(settings) {
    if (settings)
      this.config = settings;
    if (this.isRunning)
      this.disconnect();
    else
      this.connect();
  }
};

var server = new WebvisualServer();

// if not started as child_process of GUI, logger is used
function logger(arg) {
  for (var type in arg) {
    switch (type) {
      case 'event':
        console.info( arg[type] );
        break;
      case 'error':
        console.error( arg[type] );
        break;
      case 'log':
      default:
        console.log( arg[type] )
    }
  }
};

// parent-process manages this server-process
process.on("message", (arg) => {
  console.log(arg);
  for (var func in arg) {
    if (server[func]) {
      server[func]( arg[func] );
    }
  }
})

process.on('uncaughtException', (err) => {
  console.log('(uncaughtException)', err);
  // server.reconnect();
});

process.on('ECONNRESET', (err) => {
  console.log('(ECONNRESET)', err);
  // server.reconnect();
});

// process.on('SIGINT', (err) => {
//   console.log('(SIGINT)', err);
//   // server.disconnect();
//   process.exit(0);
// });

process.on('exit', (err) => {
  console.log('(EXIT)', err);
  // server.disconnect();
});
