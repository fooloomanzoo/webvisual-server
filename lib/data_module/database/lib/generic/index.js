// Interface for Flatnining Timeseries Data

"use-strict"

const EventEmitter = require('events');

class GenericDatabaseInterface extends EventEmitter {

  constructor(options) {
    super();
    this._mergeDefaults(options);
    this._connectClient(this.options)
        .catch( (err) => {
          this.emit('error', err);
        });
  }

  get defaults() {
    return {
      host: '127.0.0.1',
      port: 8000,
      indexKey: 'x',
      uniqueIndex: false,
      relatedKeys: null
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

  _connectClient(options) {
    return new Promise( (resolve, reject) => {
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

  get(range) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  add(value) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  delete(index) {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }

  clear() {
    return new Promise( (resolve, reject) => {
      resolve();
    });
  }
}

module.exports = GenericDatabaseInterface;
