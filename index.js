'use strict'

// System Modules
const express = require('express')
    , fs = require('fs')
    , path = require('path')
    , jsonfile = require('jsonfile')

    // processEmiter
    , processEmiter = require('./lib/process-emiter')

    // Processing Modules
    , DataModule = require('./lib/data_module')
    , ConfigFileProcessor = require('./lib/config_file_processor')
    , Router = require('./router');

const PATH_DEFAULT = path.resolve(__dirname, 'defaults/config.json')

let server
  , activeErrorRestartJob
  , defaults
  , mode = process.argv[2] || 'production'

// Defaults
jsonfile.readFile(PATH_DEFAULT, function(err, obj) {
  if (err) {
    console.log(err)
  } else {
    defaults = obj
    var config
    if (!process.send) {
      config = JSON.parse(JSON.stringify(defaults))
    }
    server = new WebvisualServer(config)
  }
})


class WebvisualServer extends processEmiter {

  constructor(config) {
    super(config, 'WebvisualServer')

    process.send('ready');
    this.mode = (config && config.mode) || mode

    process.send( { log: `started in ${this.mode} mode ${process.argv}`} )

    if (config) {
      this.connect(config)
    }
  }

  setConfig(config) {
    this.config = config = config || this.config
    return new Promise((resolve, reject) => {
      if (!defaults) {
        console.error('Could not load defaults')
        reject()
      }
      if (!config) {
        console.error('No settings are given')
        reject()
      }

      if (this.isRunning)
        this.disconnect()

      // ensuring (with defaults) that a ssl encrypting (by self-signed key-pairs)
      // is available for the http2 server
      let sslSettings = JSON.parse(JSON.stringify(defaults.server.ssl)) // defaults
      sslSettings.port = config.server.port || 443

      let filepaths = {
        cert: '',
        key: '',
        passphrase: ''
      }

      let ca = ''

      let p = new Promise( (res, rej) => {
        if ( config.server
          && config.server.ssl
          && config.server.ssl.cert
          && config.server.ssl.key
          && config.server.ssl.passphrase) {

          filepaths.cert = path.resolve(config.server.ssl.cert)
          filepaths.key = path.resolve(config.server.ssl.key)
          filepaths.passphrase = path.resolve(config.server.ssl.passphrase)

          if (config.server.ssl.ca) {
            ca = path.resolve(config.server.ssl.ca)
          }
        } else {
          rej( 'Given Filepaths to certificate-files incomplete' )
        }
        for (let kind in filepaths) {
          fs.open(filepaths[kind], 'r', (err, fd) => {
            if (err) {
              if (err.code === 'ENOENT') {
                rej( `${filepaths[kind]} does not exist` )
                return
              } else {
                rej( `${filepaths[kind]} Error accessing file\n${err}` )
              }
            } else {
              res(ca)
            }
          })
        }
      })

      Promise.resolve(p)
             .then( ca => {
               sslSettings.key = fs.readFileSync(filepaths.key, 'utf8')
               sslSettings.cert = fs.readFileSync(filepaths.cert, 'utf8')
               sslSettings.passphrase = require(filepaths.passphrase).password

               sslSettings.rejectUnauthorized = false
               sslSettings.requestCert = true
               sslSettings.agent = false

               if (ca) {
                 fs.stat(ca, function(err, stats) {
                   if (!err) {
                     try {
                       // Read files for the certification path
                       var cert_chain = []
                       fs.readdirSync(ca).forEach( (filename) => {
                         cert_chain.push( fs.readFileSync( path.resolve(ca, filename), 'utf-8') )
                       })
                       sslSettings.ca = cert_chain
                     } catch (err) {
                       process.send( {
                         warn: err.stack,
                         info: `Cannot open ${ca} to read Certification chain\n${err}`
                       } )
                     }
                   } else {
                     process.send( {
                       warn: err.stack,
                       info: `Cannot open ${ca} to read Certification chain\n${err}`
                     } )
                     sslSettings.ca = null
                   }
                 })
               }
               resolve(sslSettings)
             })
             .catch( err => {
               process.send( {
                 error: err,
                 info: 'Encryption: using default selfsigned certificates.\nPlease ensure, that the certificate-files are valid and exist.\nIf so, restart the server, please.'
               } )
               sslSettings.key = fs.readFileSync(sslSettings.key, 'utf8')
               sslSettings.cert = fs.readFileSync(sslSettings.cert, 'utf8')
               sslSettings.passphrase = require(sslSettings.passphrase).password
               resolve(sslSettings)
             })
    })
  }

  connect(config) {
    // connect the DATA-Module
    if (this.isRunning === false) {
      process.send( { info: 'WEBVISUAL SERVER is starting' } )
      this.setConfig(config)
        .then((sslSettings) => {

          this.dataHandler = new DataModule()
          this.dataHandler.on('error', err => { process.send( { error: err.stack } ) })
          this.dataHandler.on('warn', msg => { process.send( { warn: msg } ) })
          this.dataHandler.on('info', msg => { process.send( { info: msg } ) })
          this.dataHandler.on('event', msg => { process.send( { event: msg } ) })
          this.dataHandler.on('log', msg => { process.send( { log: msg } ) })

          this.router = new Router(this.mode)
          this.router.on('error', err => { process.send( { error: err.stack } ) })
          this.router.on('warn', msg => { process.send( { warn: msg } ) })
          this.router.on('info', msg => { process.send( { info: msg } ) })
          this.router.on('event', msg => { process.send( { event: msg } ) })
          this.router.on('log', msg => { process.send( { log: msg } ) })
          this.router.on('ready', () => {
            this.dataHandler.setServer(this.router.io)
          })
          this.router.setSettings(config, sslSettings)

          this.configFilesHandler = new ConfigFileProcessor()
          this.configFilesHandler.on('change', (config, facility) => {
            this.dataHandler.setConfiguration(config, facility)
            this.router.setConfiguration(config, facility)
          })
          this.configFilesHandler.watch(this.config.configFiles, this.config.database)

        })
        .then( () => {
          this.router.connect()
          this.isRunning = true
          process.send( { event: 'server-start' } )
        })
        .catch( err => {
          process.send( { error: `in Server Configuration \n ${err.stack}` } )
        })
    } else {
      this.toggle(config)
    }
  }

  disconnect() {
    if (activeErrorRestartJob) {
      clearTimeout( activeErrorRestartJob )
      activeErrorRestartJob = null
    }
    if (this.router)
      this.router.disconnect()
    this.configFilesHandler.unwatch()
    this.dataHandler.disconnect()
    this.isRunning = false
    process.send( { event: 'server-stop', info: 'WebvisualServer is closed' } )
  }

  reconnect(config) {
    if (this.isRunning)
      this.disconnect()
    setTimeout(() => {
      this.connect(config)
    }, 2500)
  }

  toggle(config) {
    if (activeErrorRestartJob) {
      clearTimeout( activeErrorRestartJob )
      activeErrorRestartJob = null
      try {
        this.disconnect()
      } catch (err) {
        process.send( { error: `Error in closing Server\n ${err}` } )
      }
    }
    if (this.isRunning)
      this.disconnect()
    else
      this.connect(config)
  }
}
