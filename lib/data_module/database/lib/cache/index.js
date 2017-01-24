// Cache Client

"use-strict"

const DBInterface = require('../_interface/index.js')

class CacheClient extends DBInterface {

  constructor(dbName, options, data) {
    super(dbName, options, data);
  }

  get defaults() {
    return {
      type: 'cache',
      indexKey: 'x',
      cleanInterval: 1000 * 3600,
      maxCount: 3600 * 24
    };
  }

	connectClient(options) {
    return new Promise( (resolve, reject) => {
      this._cache = new Map(); // internal Cache
      resolve();
    });
	}

  _cleanUp(maxCount) {
    if (this.mounts) {
      this.mounts.forEach( (mount) => {
        this.count(mount)
            .then( (count) => {
              if (count > maxCount) {
                this.deleteLast(mount, count - maxCount - 1)
                    .then( (res) => {
                      // if(res)
                      //   console.log(res, maxCount, count - maxCount);
                    })
                    .catch( (err) => {
                      this.emit('error',  `${this.dbName}: (${this.options.type})\n${err}`);
                    });
              }
            })
            .catch( (err) => {
              this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
            });
      });
    }
  }

  getAll(start, stop, limit) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        let ret = {};
        let p = [];

        this.mounts.forEach( (mount) => {
          p.push(this.get(mount, null, null, limit));
        })

        Promise.all(p)
               .then( (result) => {
                 for (var i = 0; i < result.length; i++) {
                   ret[result[i].mount] = result[i].values;
                 }
                 resolve(ret);
               })
               .catch( (e) => {
                 this.emit('error', e);
               });
      } else {
        resolve({});
      }
    });
  }

  get(mount, start, stop, limit = this.options.maxCount) {
    return new Promise( (resolve, reject) => {
      let ret = { mount: mount, values: [] };
      if (this._cache.has(mount)) {
        let values = this._cache.get(mount);

        if (!values) {
          resolve(ret);
        }
        let startIndex, stopIndex;
        start = start || values[values.length - 1][this.options.indexKey];
        stop = stop || values[0][this.options.indexKey];

        for (let i = values.length - 1; i >= 0 ; i--) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] >= start) {
            stopIndex = i;
            break;
          }
        }
        for (let i = 0; i < values.length ; i++) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] <= stop) {
            startIndex = i;
            break;
          }
        }

        if (startIndex === undefined || startIndex >= limit) {
          startIndex = 0;
          stopIndex = -1;
        } else if (!stopIndex || (stopIndex - startIndex) > limit) {
          stopIndex = -1;
        }

  			ret.values = values.slice(startIndex, stopIndex);
      } else {
        this.emit('info', `${this.dbName}: Cache has not requested entry "${mount}"`);
      }
      resolve(ret);
    });
  }

  add(mount, values) {
    return new Promise( (resolve, reject) => {
      if (!this.mounts) {
        this.mounts = new Set()
      }
      if (!this._cache) {
        this._cache = new Map()
      }
      if (!this.mounts.has(mount)) {
        this.mounts.add(mount);
      }
      if (!this._cache.has(mount)) {
        this._cache.set(mount, []);
      }
      if (!Array.isArray(values)) {
        values = [ values ];
      }
      values.sort( (a, b) => {
        if (a && a[this.options.indexKey] !== undefined && b && b[this.options.indexKey] !== undefined)
          return a[this.options.indexKey] - b[this.options.indexKey];
        else
          return 0;
      });
      let len = values.length;
      if (len > this.options.maxCount)
        values = values.slice(len - this.options.maxCount, len);
      if (this._cache.get(mount).length === 0)
        this._cache.set(mount, values)
      else
        for (var i = 0; i < values.length; i++)
          this._cache.get(mount).push(values[i]);
      len = this._cache.get(mount).length;
      if (len > this.options.maxCount)
        this._cache.get(mount).splice(0, len - this.options.maxCount);
      resolve();
    });
  }

  place(values) {
    return new Promise( (resolve, reject) => {
      if (values) {
        let p = [];

        for (var mount in values) {
          p.push(this.add(mount, values[mount]));
        }

        Promise.all(p)
               .then( resolve )
               .catch( (e) => {
                 this.emit('error', e);
               });
      } else {
        resolve();
      }
    });
  }

  count(mount, min, max) {
    return new Promise( (resolve, reject) => {
      let ret;
      if (this._cache.has(mount)) {
        ret = this._cache.get(mount).length;
      }
      resolve(ret);
    });
  }

  delete(mount, min, max) {
    return new Promise( (resolve, reject) => {
      let startIndex, stopIndex;

      if (this._cache.has(mount)) {
        let values = this._cache.get(mount);
        for (let i = values.length - 1; i >= 0 ; i--) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] > min) {
            stopIndex = i;
            break;
          }
        }
        for (let i = 0; i < values.length ; i++) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] < max) {
            startIndex = i;
            break;
          }
        }
      }
      resolve(this.deleteByIndex(mount, startIndex, stopIndex));
    });
  }

  deleteByIndex(mount, pos) {
    return new Promise( (resolve, reject) => {
      if (this._cache.has(mount) && start !== undefined && stop !== undefined) {
        this._cache.get(mount).splice(start, stop);
      }
      resolve();
    });
  }

  deleteLast(mount, pos) {
    return new Promise( (resolve, reject) => {
      if (this._cache.has(mount) && pod !== undefined) {
        this._cache.get(mount).splice(0, pos);
      }
      resolve();
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      if (this._cache.has(mount)) {
        this._cache.set(mount, []);
      }
      resolve();
    });
  }
}

module.exports = CacheClient;
