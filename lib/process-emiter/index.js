const MergeDefaults = require('merge-options')
const util = require('util');

class processEmiter {
  static get defaults() {
    return {}
  }

  constructor(config, title) {
    this.isRunning = false
    this.title = title || ''
    this.id = this.title + ':' + process.pid
    if (!process.send) { // not constructed as forked process
      this.id += ':' + (new Date()).toISOString()
    }
    if (config) {
      this.setConfig(config)
    }
    this.setEmitter()
  }

  setConfig(config) {
    return new Promise((resolve, reject) => {
      this.config = MergeDefaults(this.defaults, config)
      resolve()
    })
    .catch(err => {
      console.log(err.stack)
    })
  }

  connect() {}

  disconnect() {}

  reconnect() {}

  toggle(config) {
    if (config)
      this.setConfig()
    if (this.restartJob) {
      clearTimeout(this.restartJob)
      this.restartJob = null
      try {
        this.disconnect()
      } catch (e) {
        process.send({
          error: `Error in closing Server\n ${e}`
        })
      }
    } else {
      // process.send( {error: 'No this.restartJob'})
      if (this.isRunning)
        this.disconnect()
      else
        this.connect()
    }
  }

  setEmitter() {
    this.emitter = {
      'event': console.info,
      'error': console.error,
      'info': console.info,
      'log': console.log,
      'warn': console.warn
    }
    // if not started as child_process of GUI
    if (!process.send) {
      process.send = (arg) => {
        for (var type in arg) {
          switch (type) {
            case 'event':
            case 'info':
              this.emitter.info(`${type}: ${arg[type]}`)
              break
            case 'error':
              this.emitter.error(`${type}: ${arg[type]}`)
              break
            case 'warn':
              this.emitter.warn(`${type}: ${arg[type]}`)
              break
            case 'log':
            default:
              this.emitter.log(`${type}: ${arg[type]}`)
          }
        }
      }
      console.log(`${this.id} created as singular process`)
    } else {
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
      console.log(`${this.id} created as forked process`)
    }

    process.on('message', (arg) => {
      for (var func in arg) {
        if (this[func]) {
          this[func](arg[func])
        }
      }
    })

    process.on('uncaughtException', (err) => {
      this.emitter.log(`${this.title}: ${this.id} (uncaughtException)`)
      if (err) {
        this.emitter.error(err.stackTrace || err)
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob)
        this.restartJob = null
      }
      if (err.code !== 'ECONNRESET') {
        this.restartJob = setTimeout(() => {
          this.reconnect() // dont't restart on network connection failures
        }, 10000)
      }
    })

    process.on('ECONNRESET', (err) => {
      this.emitter.log(`${this.title}: ${this.id} ECONNRESET`)
      if (err) {
        this.emitter.error(err.stackTrace || err)
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob)
        this.restartJob = null
      }
    })

    process.on('SIGINT', (err) => {
      this.emitter
        .log(`${this.title}: ${this.id} SIGINT`)
      if (err) {
        this.emitter.error(err.stackTrace || err)
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob)
        this.restartJob = null
      }
      this.disconnect()
      process.exit(0)
    })

    process.on('exit', (err) => {
      this.emitter.log(`${this.title}: ${this.id} EXIT`)
      if (err) {
        this.emitter.error(err.stackTrace || err)
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob)
        this.restartJob = null
      }
      this.disconnect()
    })
  }
}

module.exports = processEmiter
