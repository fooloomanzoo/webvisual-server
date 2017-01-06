// Interface for Flatnining Timeseries Data

"use-strict"

const EventEmitter = require('events');


class GenericDatabaseInterface extends EventEmitter {

  constructor(options) {
    this._mergeDefaults(options);
    this._connectClient(this.options, this.client);
  }

  get defaults() {
    return {
      url: '127.0.0.1',
      port: 8000,
      indexKey: 'x',
      uniqueIndex: false,
      relatedKeys: null
    };
  }

  mergeDefaults(options) {
    this.options = options;

    for (let key in this.defaults) {
      if (!this.options.hasOwnProperty(key)) {
        this.options[key] = this.defaults[key];
      }
    }
  }

  _connectClient(url, port) {
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
}

module.exports = GenericDatabaseInterface;
