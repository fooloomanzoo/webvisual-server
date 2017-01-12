// Interface for Flatnining Timeseries Data

"use-strict"

const EventEmitter = require('events');

class DBInterface extends EventEmitter {

  constructor(dbName, options) {
    super();
    this.mounts = new Set();
    this.dbName = dbName || 'test';
    this._mergeDefaults(options || {});
    this._connectClient()
        .then( () => {
          this.emit('info', `${this.dbName}: Connection to Database started successfully`);
        })
        .catch( (err) => {
          console.log(err);
          this.emit('error', err);
        });
    if (this.options.cleanInterval && this.options.maxCount) {
      setInterval( () => {
        this._cleanUp(this.options.maxCount);
      }, this.options.cleanInterval);
    }
  }

  get defaults() {
    return {
      host: '127.0.0.1',
      port: 6379,
      indexKey: 'x',
      cleanInterval: 1000 * 60 * 60 * 24,
      maxCount: 10000000
    };
  }

  _mergeDefaults(options) {
    this.options = options;

    for (let key in this.defaults) {
      if (!this.options.hasOwnProperty(key)) {
        this.options[key] = this.defaults[key];
      }
    }
  }

  _connectClient() {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  _cleanUp() {
    return new Promise(function(resolve, reject) {
      resolve();
    });
  }

  _authClient(options) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  _disconnectClient() {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  _reconnectClient() {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  get(mount, start, stop) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  getAll(start, stop, limit) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  range(mount, start, stop, limit) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  add(mount, values) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  place(values) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  count(mount, min, max) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  delete(mount, min, max) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  deleteByIndex(mount, min, max) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }
}

module.exports = DBInterface;
