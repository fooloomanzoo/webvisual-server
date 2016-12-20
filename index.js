'use strict';

// System Modules
const express = require('express')
    , fs = require('fs')
    , path = require('path')
    , util = require('util')

    // Processing Modules
    , DataModule = require('./lib/data_module')
    , ConfigFileProcessor = require('./lib/config_file_processor')
    , Router = require('./router')

    // Server
    , spdy = require('spdy')
    , app = express();

var server;

// Defaults
const defaults = require('./defaults/config.json');

var config;

if (process.env['WEBVISUALSERVER']) {
  config = JSON.parse(process.env['WEBVISUALSERVER']);
}
else {
  config = JSON.parse(JSON.stringify(defaults));
}

class WebvisualServer {

  constructor(settings) {
    this.isRunning = false;

    this.config = settings;

    var mode = process.argv[2] || config.mode;

    if (mode) {
      process.send( { log: `started in ${mode} mode`} );
    }

    this.router = new Router(app, mode);
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
    this.dataHandler.on('log', (msg) => {
      process.send( { log: msg } );
    });

    if (this.config) {
      this.connect(this.config);
    }
  }

  createServerSettings(settings) {
    return new Promise((resolve, reject) => {
      if (this.isRunning)
        this.disconnect();

      this.router.setSettings(settings || this.config);

      // ensuring (with defaults) that a ssl encrypting (by self-signed key-pairs)
      // is available for the http2 server
      let sslSettings = JSON.parse(JSON.stringify(defaults.server.ssl)); // defaults
      sslSettings.port = settings.server.port || 443;

      let filepaths = {
        cert: '',
        key: '',
        passphrase: ''
      }

      let p = new Promise( (res, rej) => {
        if ( this.config.server
          && this.config.server.ssl
          && this.config.server.ssl.cert
          && this.config.server.ssl.key
          && this.config.server.ssl.passphrase) {

          filepaths.cert = path.resolve(this.config.server.ssl.cert);
          filepaths.key = path.resolve(this.config.server.ssl.key);
          filepaths.passphrase = path.resolve(this.config.server.ssl.passphrase);
          console.log(filepaths);
        } else {
          rej( 'Given Filepaths to certificate-files incomplete' );
        }
        for (let kind in filepaths) {
          fs.open(filepaths[kind], 'r', (err, fd) => {
            if (err) {
              if (err.code === "ENOENT") {
                rej( `${filepaths[kind]} does not exist` );
                return;
              } else {
                rej( `${filepaths[kind]} Error accessing file\n${err}` );
              }
            } else {
              res();
            }
          });
        }
      });

      Promise.resolve(p)
             .then( () => {
               sslSettings.key = fs.readFileSync(filepaths.key, 'utf8');
               sslSettings.cert = fs.readFileSync(filepaths.cert, 'utf8');
               sslSettings.passphrase = require(filepaths.passphrase).password;
               resolve(sslSettings);
             })
             .catch( (err) => {
               process.send( {
                 error: err,
                 info: 'Encryption: using default selfsigned certificates.\nPlease ensure, that the certificate-files are valid and exist.\nIf so, restart the server, please.'
               } );
               sslSettings.key = fs.readFileSync(sslSettings.key, 'utf8');
               sslSettings.cert = fs.readFileSync(sslSettings.cert, 'utf8');
               sslSettings.passphrase = require(sslSettings.passphrase).password;
               resolve(sslSettings);
             })
    });
  }

  connect(settings) {
    // connect the DATA-Module
    if (settings)
      this.config = settings;
    if (this.isRunning === false) {
      process.send( { info: 'WEBVISUAL SERVER is starting' } );
      this.createServerSettings(this.config)
        .then((sslSettings) => {
          this.configFilesHandler.watch(this.config.userConfigFiles);
          if (this.http2Server)
            this.http2Server.close();
          this.http2Server = spdy.createServer(sslSettings, app);
          this.http2Server.on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                process.send( { error: `HTTP2 Server \n Port ${this.config.server.port} in use. Please check if node.exe is not already running on this port.` } );
                this.http2Server.close();
              } else if (err.code === 'EACCES') {
                process.send( { error: `HTTP2 Server \n Network not accessable. Port ${this.config.server.port} might be in use by another application. Try to switch the port or quit the application, which is using this port` } );
              } else {
                process.send( { error: err } );
              }
            })
            .once('listening', () => {
              process.send( { log: `HTTP2 Server is listening on port ${this.config.server.port}` } );
            });
          this.dataHandler.setServer(this.http2Server);
          this.http2Server.listen(this.config.server.port || process.env.port || 443);
          this.isRunning = true;
          process.send( { event: 'server-start' } );
        })
        .then( () => {
          this.router.createStaticContent();
        })
        .catch( (err) => {
          process.send( { error: `in SSL Configuration \n ${err}` } );
        });
    }
  }

  disconnect() {
    if (this.http2Server)
      this.http2Server.close();
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
  console.log('Server opened as single process');
  process.send = function(arg) {
    for (var type in arg) {
      switch (type) {
        case 'event':
          console.info( `${type}: ${arg[type]}` );
          break;
        case 'error':
          console.error( `${type}: ${arg[type]}` );
          break;
        case 'warn':
          console.warn( `${type}: ${arg[type]}` );
          break;
        case 'log':
        default:
          console.log( `${type}: ${arg[type]}` )
      }
    }
  }
} else {
  console.log('Server opened as forked process');
  console.log = function() {
    process.send( { log: util.format.apply(null, arguments)} );
  }
  console.info = function() {
    process.send( { info: util.format.apply(null, arguments)} );
  }
  console.error = function() {
    process.send( { error: util.format.apply(null, arguments)} );
  }
  console.warn = function() {
    process.send( { warn: util.format.apply(null, arguments)} );
  }
}

server = new WebvisualServer(config);

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

process.on('uncaughtException', (err) => {
  console.log('WEBVISUAL SERVER (uncaughtException)', err || '');
  setTimeout(() => {
    server.reconnect();
  }, 2000)
});

process.on('ECONNRESET', (err) => {
  console.log('WEBVISUAL SERVER (ECONNRESET)', err || '');
  setTimeout(() => {
    server.reconnect();
  }, 2000)
});

process.on('SIGINT', (err) => {
  console.log('WEBVISUAL SERVER (SIGINT)', err || '');
  server.disconnect();
  process.exit(0);
});

process.on('exit', (err) => {
  console.log('WEBVISUAL SERVER (EXIT)', err || '');
  server.disconnect();
});
