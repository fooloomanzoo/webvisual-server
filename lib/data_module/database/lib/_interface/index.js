// Interface for Flatnining Timeseries Data

"use-strict"

const EventEmitter = require('events');

class DBInterface extends EventEmitter {

  constructor(dbName, options, data) {
    super();
    this.mounts = new Set();
    this.dbName = dbName || 'test';
    this._mergeDefaults(options || {});
    this.init();
    this._connectClient()
        .then( () => {
          if (data) {
            this.place(data);
          }
          this.emit('info', `${this.dbName}: Connection to Database (${this.options.type}) started successfully`);
        })
        .catch( (err) => {
          console.log(err);
          this.emit('error', err);
        });
    if (this.options.cleanInterval && this.options.maxCount) {
      // initial cleanUp
      setTimeout(() => {
        this._cleanUp(this.options.maxCount);
      }, 60000)
      // interval cleanUp
      setInterval( () => {
        this._cleanUp(this.options.maxCount);
      }, this.options.cleanInterval);
    }
  }

  get defaults() {
    return {
      type: 'not_set',
      host: '127.0.0.1',
      port: 6379,
      indexKey: 'x',
      cleanInterval: 1000 * 3600,
      maxCount: 3600 * 24 * 3
    };
  }

  init() {
    this.mounts.forEach( (el) => {
      this.mounts.delete(el);
    });
  }

  _mergeDefaults(options) {
    this.options = options;

    if (this.options.maxCount && typeof this.options.maxCount === 'string') {
      this.options.maxCount = parseInt(this.options.maxCount);
    }

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

  getAll(start, stop, limit, mounts) {
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
