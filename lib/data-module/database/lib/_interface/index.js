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
    this._connectClient(this.options)
        .then( () => {
          if (data) {
            this.place(data, true)
                .then( () => {
                  data = null;
                })
                .catch( (err) => {
                  this.emit('error', `${this.dbName}: Placing data to Database (${this.options.type}) failed\n${err}`);
                });
          }
          this.emit('info', `${this.dbName}: Connection to Database (${this.options.type}) started successfully`);
        })
        .catch( (err) => {
          this.emit('error', err);
        });
    if (this.options.cleanInterval && this.options.maxCount) {
      setTimeout(() => {
        this._cleanUp(this.options.maxCount);
        // interval cleanUp
        setInterval( () => {
          this._cleanUp(this.options.maxCount);
        }, this.options.cleanInterval);
      }, 60 * 10 * 1000 < this.options.cleanInterval ? 60 * 10 * 1000 : this.options.cleanInterval) // initial cleanUp (10min)
    }
  }

  get defaults() {
    return {};
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

  info() {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

}

module.exports = DBInterface;
