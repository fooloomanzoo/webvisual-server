// Interface for Flatnining Timeseries Data

"use-strict"

const Generic = require('../generic/index.js')
const redis = require("redis");

var mounts = new Set();

// REDIS Interface
// using zadd for setting a timeseries up

class RedisInterface extends Generic {

  constructor(options) {
    super(options);
  }

  get defaults() {
    return {
      host: '127.0.0.1',
      port: 8000,
      password: '',
      indexKey: 'x',
      uniqueIndex: false,
      relatedKeys: null
    };
  }

  _connectClient(options) {
    return new Promise( (resolve, reject) => {
        this.client = redis.createClient(options);

        this.client.on('ready', () => {
          resolve();
        })

        client.on('error', (err) => {
          this.emit('error', err);
          setTimeout(() => {
            this._connectClient(this.options);
          }, 2000)
        })
    });
  }

  _authClient(options) {
    return new Promise( (resolve, reject) => {
      this.client.auth();
      resolve();
    });
  }

  _disconnectClient(force) {
    return new Promise( (resolve, reject) => {
      if (force) {
        this.client.end(true);
      } else {
        this.client.quit();
      }
      resolve();
    });
  }

  _reconnectClient() {
    return new Promise( (resolve, reject) => {
      this._disconnectClient()
          .then( () => {
            this._connectClient(this.options);
            resolve();
          })
          .catch( (err) => {
            this.emit('error', err);
          });
    });
  }

  get(mount, start, stop) {
    return new Promise( (resolve, reject) => {
      if (this.mounts && this.mounts.has(mount)) {
        this.client.zrange(mount, start || Number.MIN_SAFE_INTEGER, stop || Number.MAX_SAFE_INTEGER, (err, result) => {
          if (err)
            this.emit('error', err);
          resolve(result || []);
        });
      } else {
        resolve([]);
      }
    });
  }

  add(mount, key, value) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        if (!this.mounts.has(mount)) {
          this.mounts.add(mount);
        }
        if (!Array.isArray(value)) {
          value = [ value ];
        }

        let args = [];
        let indexKey = this.options.indexKey;

        value.forEach( (v) => {
          if (v[indexKey] !== undefined && v[key] !== undefined) {
            args.push(v[indexKey] + ' ' + v[key]);
          }
        });

        this.client.zadd(mount, args)
      }
      resolve();
    });
  }

  count(mount, min, max) {
    return new Promise( (resolve, reject) => {
      this.client.zcount(mount, min || Number.MIN_SAFE_INTEGER, max || Number.MAX_SAFE_INTEGER, (err, result) => {
        if (err)
          this.emit('error', err);
        resolve(result || 0);
      })
    });
  }

  delete(mount, min, max) {
    return new Promise( (resolve, reject) => {
      this.client.ZREMRANGEBYSCORE(mount, min || Number.MIN_SAFE_INTEGER, max || Number.MAX_SAFE_INTEGER, (err, result) => {
        if (err)
          this.emit('error', err);
        resolve(result || 0);
      })
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      this.delete(mount, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
          .then( (result) => {
            resolve(result || 0);
          });
    });
  }

}

module.exports = RedisInterface;
