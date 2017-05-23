'use strict';

// System Modules
const express = require('express')
    , fs = require('fs')
    , path = require('path')

    // Process Controller
    , Controller = require('./lib/controller')

    // Processing Modules
    , DataModule = require('./lib/data_module')
    , ConfigFileProcessor = require('./lib/config_file_processor')
    , Router = require('./router')

    // Server
    , spdy = require('spdy')
    , app = express();

let server
  , config
  , activeErrorRestartJob;

// Defaults
const defaults = require('./defaults/config.json');

class WebvisualServer extends Controller {

  constructor(config) {
    super(config, 'WebvisualServer');

    this.mode = process.argv[2] || config.mode;

    if (this.mode) {
      process.send( { log: `started in ${this.mode} mode`} );
    }

    if (this.config) {
      this.connect(this.config);
    }
  }

  setConfig(config) {
    this.config = config = config || this.config;
    return new Promise((resolve, reject) => {
      if (this.isRunning)
        this.disconnect();

      // ensuring (with defaults) that a ssl encrypting (by self-signed key-pairs)
      // is available for the http2 server
      let sslSettings = JSON.parse(JSON.stringify(defaults.server.ssl)); // defaults
      sslSettings.port = config.server.port || 443;

      let filepaths = {
        cert: '',
        key: '',
        passphrase: ''
      }

      let ca = '';

      let p = new Promise( (res, rej) => {
        if ( config.server
          && config.server.ssl
          && config.server.ssl.cert
          && config.server.ssl.key
          && config.server.ssl.passphrase) {

          filepaths.cert = path.resolve(config.server.ssl.cert);
          filepaths.key = path.resolve(config.server.ssl.key);
          filepaths.passphrase = path.resolve(config.server.ssl.passphrase);

          if (config.server.ssl.ca) {
            ca = path.resolve(config.server.ssl.ca);
          }
        } else {
          rej( 'Given Filepaths to certificate-files incomplete' );
        }
        for (let kind in filepaths) {
          fs.open(filepaths[kind], 'r', (err, fd) => {
            if (err) {
              if (err.code === 'ENOENT') {
                rej( `${filepaths[kind]} does not exist` );
                return;
              } else {
                rej( `${filepaths[kind]} Error accessing file\n${err}` );
              }
            } else {
              res(ca);
            }
          });
        }
      });

      Promise.resolve(p)
             .then( (ca) => {
               sslSettings.key = fs.readFileSync(filepaths.key, 'utf8');
               sslSettings.cert = fs.readFileSync(filepaths.cert, 'utf8');
               sslSettings.passphrase = require(filepaths.passphrase).password;

               sslSettings.rejectUnauthorized = false;
               sslSettings.requestCert = true;
               sslSettings.agent = false;

               fs.stat(ca, function(err, stats) {
                 if (!err) {
                   try {
                     // Read files for the certification path
                     var cert_chain = [];
                     fs.readdirSync(ca).forEach( (filename) => {
                       cert_chain.push( fs.readFileSync( path.resolve(ca, filename), 'utf-8') );
                     });
                     sslSettings.ca = cert_chain;
                   } catch (err) {
                     process.send( {
                       error: err,
                       info: `Cannot open ${ca} to read Certification chain\n${err}`
                     } );
                   }
                 } else {
                   process.send( {
                     error: err,
                     info: `Cannot open ${ca} to read Certification chain\n${err}`
                   } );
                   sslSettings.ca = null;
                 }
               });
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

  connect(config) {
    // connect the DATA-Module
    if (this.isRunning === false) {
      process.send( { info: 'WEBVISUAL SERVER is starting' } );
      this.setConfig(config)
        .then((sslSettings) => {
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

          this.router = new Router(app, this.mode);
          this.router.on('error', (err) => {
            process.send( { error: err } );
          });
          this.router.setSettings(config, this.http2Server);

          this.dataHandler = new DataModule();
          this.dataHandler.on('error', (err) => {
            process.send( { error: err } );
          });
          this.dataHandler.on('info', (msg) => { process.send( { info: msg } ); });
          this.dataHandler.on('log', (msg) => { process.send( { log: msg } ); });

          this.configFilesHandler = new ConfigFileProcessor();
          this.configFilesHandler.on('change', (config, facility) => {
            this.dataHandler.setConfiguration(config, facility);
            this.router.setConfiguration(config, facility); // load Settings to Routen them to requests
          });
          this.configFilesHandler.watch(this.config.userConfigFiles, this.config.database);

          this.dataHandler.setServer(this.router.io);
          this.http2Server.listen(this.config.server.port || process.env.port || 443);
          this.isRunning = true;
          process.send( { event: 'server-start' } );
        })
        .then( () => {
          this.router.createStaticContent();
        })
        .catch( (err) => {
          process.send( { error: `in Server Configuration \n ${err}` } );
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

  reconnect(config) {
    if (this.isRunning)
      this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 2500);
  }

  toggle(config) {
    if (activeErrorRestartJob) {
      clearTimeout( activeErrorRestartJob );
      activeErrorRestartJob = null;
      try {
        this.disconnect();
      } catch (e) {
        process.send( { error: `Error in closing Server\n ${e}` } );
      }
    } else {
      // process.send( {error: 'No activeErrorRestartJob'});
      if (this.isRunning)
        this.disconnect();
      else
        this.connect();
    }
  }
};

if (process.env['WEBVISUALSERVER']) {
  config = JSON.parse(process.env['WEBVISUALSERVER']);
}
else {
  config = JSON.parse(JSON.stringify(defaults));
}

server = new WebvisualServer(config);
