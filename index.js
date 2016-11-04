'use strict';

// System Modules
const express = require('express'),
  fs = require('fs'),
  path = require('path'),
  util = require('util'),

  // Processing Modules
  DataModule = require('./lib/data_module'),
  ConfigFileProcessor = require('./lib/config_file_processor'),
  Router = require('./routes'),

  // Sessions & Authentification
  xFrameOptions = require('x-frame-options'),
  cookieSession = require('cookie-session'),
  passport = require('passport'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  compression = require('compression'),

  // Server
  spdy = require('spdy'),
  app = express();

let server;

// Defaults
const defaults = require('./defaults/config.json');

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// get cookies from http requests
// app.use(cookieParser());
// app.use(bodyParser.urlencoded({
//   extended: true
// }));
// app.use(bodyParser.json());

// app.use( cookieSession( {
//   maxAge: 3600000*24*180
// }));

// Prevent Clickjacking
app.use(xFrameOptions());

// register for authentification
app.use(passport.initialize());

// init session handler
app.use(passport.session());

// compress responses
app.use( compression() );

// static dir
app.use(express.static(path.join(__dirname, 'public'), {'Cache-Control': 'public, no-cache'}));

class WebvisualServer {

  constructor(settings) {
    this.isRunning = false;

    this.config = settings;

    this.router = new Router(app, passport);
    this.router.on('error', (err) => {
      process.send( { error: err } );
    });

    this.dataHandler = new DataModule();

    this.configFilesHandler = new ConfigFileProcessor();

    this.configFilesHandler.on('changed', (facility) => {
      this.dataHandler.setConfiguration(this.configFilesHandler.settings[facility], facility);
      this.router.setConfiguration(this.configFilesHandler.settings[facility], facility); // load Settings to Routen them to requests
    });
    this.dataHandler.on('error', (err) => {
      process.send( { error: err } );
    });

    // this.connect(this.config);
  }

  createServerSettings(settings) {
    return new Promise((resolve, reject) => {
      if (this.isRunning)
        this.disconnect();

      this.router.setSettings(settings || this.config);

      var sslSettings = JSON.parse(JSON.stringify(defaults.server.ssl));
      sslSettings.port = settings.server.port.http2 || 443;

      try {
        // use https & http-redirecting
        if (settings.server.ssl &&
          settings.server.ssl.cert &&
          settings.server.ssl.key &&
          settings.server.ssl.passphrase) {

          var cert = path.resolve(this.config.server.ssl.cert)
            , key = path.resolve(this.config.server.ssl.key)
            , passphrase = path.resolve(this.config.server.ssl.passphrase);

          fs.access( cert, fs.constants.R_OK, (err) => {
            if (err)
              process.send( { error: `File for certification (ssl) not found \n ${err}`} );
            else {
              fs.access( key, fs.constants.R_OK, (err) => {
                if (err)
                  process.send( { error: `File for public key (ssl) not found \n ${err}`} );
                else {
                  fs.access( passphrase, fs.constants.R_OK, (err) => {
                    if (err)
                      process.send( { error: `File for passphrase (ssl) not found \n ${err}`} );
                    else {
                      // Configure SSL Encryption
                      sslSettings.key = key;
                      sslSettings.cert = cert;
                      sslSettings.passphrase = passphrase;
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
        sslSettings.key = fs.readFileSync(sslSettings.key, 'utf8');
        sslSettings.cert = fs.readFileSync(sslSettings.cert, 'utf8');
        sslSettings.passphrase = require(sslSettings.passphrase).password;
        resolve(sslSettings);
      }
    });
  }

  connect(settings) {
    // connect the DATA-Module
    if (settings)
      this.config = settings;
    if (this.isRunning === false) {
      process.send( { info: 'WebvisualServer is starting' } );
      this.createServerSettings(this.config)
        .then((sslSettings) => {
          if (this.http2)
            this.http2.close();
          this.http2 = spdy.createServer(sslSettings, app);
          this.http2.on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                process.send( { error: `HTTP2 Server \n Port ${this.config.server.port.http2} in use. Please check if node.exe is not already running on this port.` } );
                this.http2.close();
              } else if (err.code === 'EACCES') {
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
    if (this.http2)
      this.http2.close();
    this.configFilesHandler.unwatch();
    this.dataHandler.disconnect();
    this.isRunning = false;
    process.send( { event: 'server-stop', info: 'WebvisualServer is closed' } );
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

// if not started as child_process of GUI
if (!process.send) {
  process.send = function(arg) {
    for (var type in arg) {
      switch (type) {
        case 'event':
          console.info( arg[type] );
          break;
        case 'error':
          console.error( arg[type] );
          break;
        case 'warn':
          console.warn( arg[type] );
          break;
        case 'log':
        default:
          console.log( arg[type] )
      }
    }
  }
  server = new WebvisualServer(defaults);

} else {

  // console.log = function() {
  //   process.send( { log: util.format.apply(null, arguments)} );
  // }
  // console.info = function() {
  //   process.send( { info: util.format.apply(null, arguments)} );
  // }
  // console.error = function() {
  //   process.send( { error: util.format.apply(null, arguments)} );
  // }
  // console.warn = function() {
  //   process.send( { warn: util.format.apply(null, arguments)} );
  // }

  if (process.env['WEBVISUALSERVER'])
    server = new WebvisualServer(process.env['WEBVISUALSERVER']);

  process.on("message", (arg) => {
    if (arg.init === true && arg.config)
      server = new WebvisualServer(arg.config);
    else {
      for (var func in arg) {
        if (server && server[func]) {
          server[func]( arg[func] );
        }
      }
    }
  })
}

process.on('uncaughtException', (err) => {
  console.log('(uncaughtException)', err);
  // server.reconnect();
});

process.on('ECONNRESET', (err) => {
  console.log('(ECONNRESET)', err);
  // server.reconnect();
});

process.on('SIGINT', (err) => {
  console.log('(SIGINT)', err);
  server.disconnect();
  process.exit(0);
});

process.on('exit', (err) => {
  console.log('(EXIT)', err);
  server.disconnect();
});
