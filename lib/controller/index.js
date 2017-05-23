'use strict';

const MergeDefaults = require('merge-options');

class Controller {
  static get defaults() {
    return {};
  }

  constructor(config, title) {
    this.isRunning = false;
    this.title = title || '';
    this.id = this.title + ':' + process.pid;
    if (!process.send) { // not constructed as forked process
      this.id += ':' + (new Date()).toISOString();
    }
    this.setConfig(config);
    this.addEmitter();
  }

  setConfig(config) {
    return new Promise((resolve, reject) => {
      this.config = Mergedefaults(this.defaults, config);
      resolve();
    });
  }

  connect() {}

  disconnect() {}

  reconnect() {}

  toggle(config) {
    if (config)
      this.setConfig();
    if (this.restartJob) {
      clearTimeout(this.restartJob);
      this.restartJob = null;
      try {
        this.disconnect();
      } catch (e) {
        process.send({
          error: `Error in closing Server\n ${e}`
        });
      }
    } else {
      // process.send( {error: 'No this.restartJob'});
      if (this.isRunning)
        this.disconnect();
      else
        this.connect();
    }
  }

  addEmitter() {
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
              this.emitter.info(`${type}: ${arg[type]}`);
              break;
            case 'error':
              this.emitter.error(`${type}: ${arg[type]}`);
              break;
            case 'warn':
              this.emitter.warn(`${type}: ${arg[type]}`);
              break;
            case 'log':
            default:
              this.emitter.log(`${type}: ${arg[type]}`)
          }
        }
      }
      console.log(`${this.id} created as singular process`);
    } else {
      console.log = function() {
        process.send(...arguments);
      }
      console.info = function() {
        process.send(...arguments);
      }
      console.error = function() {
        process.send(...arguments);
      }
      console.warn = function() {
        process.send(...arguments);
      }
      console.log(`${this.id} created as forked process`);
    }

    process.on('message', (arg) => {
      for (var func in arg) {
        if (server && server[func]) {
          server[func](arg[func]);
        }
      }
    })

    process.on('uncaughtException', (err) => {
      this.emitter.log(`${this.title}: ${this.id} (uncaughtException)`);
      if (err) {
        this.emitter.error(`${err.stackTrace}`);
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob);
        this.restartJob = null;
      }
      this.restartJob = setTimeout(() => {
        this.reconnect();
      }, 5000)
    });

    process.on('ECONNRESET', (err) => {
      this.emitter.log(`${this.title}: ${this.id} ECONNRESET`);
      if (err) {
        this.emitter.error(`${err.stackTrace}`);
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob);
        this.restartJob = null;
      }
      this.restartJob = setTimeout(() => {
        this.reconnect();
      }, 5000)
    });

    process.on('SIGINT', (err) => {
      this.emitter
        .log(`${this.title}: ${this.id} SIGINT`);
      if (err) {
        this.emitter.error(`${err.stackTrace}`);
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob);
        this.restartJob = null;
      }
      this.disconnect();
      process.exit(0);
    });

    process.on('exit', (err) => {
      this.emitter.log(`${this.title}: ${this.id} EXIT`);
      if (err) {
        this.emitter.error(`${err.stackTrace}`);
      }
      if (this.restartJob) {
        clearTimeout(this.restartJob);
        this.restartJob = null;
      }
      this.disconnect();
    });
  }
};

module.exports = Controller;
