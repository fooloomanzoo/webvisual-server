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
      maxCount: 3600 * 24,
      onlyNew: true
    };
  }

  init() {
    this.mounts.forEach( (el) => {
      this.mounts.delete(el);
    });
    if (!this._cache) {
      this._cache = new Map(); // internal Cache
    } else {
      this._cache.forEach( (el, mount) => {
        this._cache.delete(mount);
      });
    }
  }

	connectClient() {
    return new Promise( (resolve) => {
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

  getAll(start, stop, limit, mounts = this.mounts) {
    return new Promise( (resolve) => {
      if (mounts) {
        let ret = {};
        let p = [];

        mounts.forEach( (mount) => {
          p.push(this.get(mount, null, null, limit));
        })

        Promise.all(p)
               .then( (result) => {
                 for (let i = 0; i < result.length; i++) {
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

  get(mount, from, to, limit = this.options.maxCount) {
    return new Promise( (resolve) => {
      let ret = { mount: mount, values: [] };
      if (this._cache.has(mount)) {
        let values = this._cache.get(mount);

        if (!values) {
          resolve(ret);
        }

        if (from && to && from > to) {
          const tmp = from;
          from = to;
          to = tmp;
        }

        let startIndex, stopIndex;
        from = from || values[values.length - 1][this.options.indexKey];
        to = to || values[0][this.options.indexKey];

        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] >= from) {
            stopIndex = i;
            break;
          }
        }
        for (let i = 0; i < values.length; i++) {
          if (values[i][this.options.indexKey] && values[i][this.options.indexKey] <= to) {
            startIndex = i;
            break;
          }
        }

        if (limit > stopIndex - startIndex) {
          stopIndex = startIndex + limit;
        }

        ret.values = values.slice(startIndex, stopIndex + 1);
      } else {
        this.emit('info', `${this.dbName}: Cache has not requested entry "${mount}"`);
      }
      resolve(ret);
    });
  }

  add(mount, values) {
    return new Promise( (resolve) => {
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
      let indexKey = this.options.indexKey;
      let maxCount = this.options.maxCount;
      values = values.sort( (a, b) => {
        return a[indexKey] < b[indexKey];
      });
      let len = values.length;
      if (len > this.options.maxCount)
        values = values.slice(len - maxCount, len);
      if (this._cache.get(mount).length === 0)
        this._cache.set(mount, values)
      else
        for (let i = 0; i < values.length; i++)
          this._cache.get(mount).push(values[i]);
      len = this._cache.get(mount).length;
      if (len > maxCount)
        this._cache.get(mount).splice(0, len - maxCount);
      resolve();
    });
  }

  place(data, checkRecent) {
    return new Promise( (resolve) => {
      let mounts = Object.keys(data);
      let p = [];
      let indexKey = this.options.indexKey;
      let onlyNew = this.options.onlyNew;
      for (let i = 0; i < mounts.length; i++) {
        if (!this.mounts.has( mounts[i] )) {
          this.mounts.add( mounts[i] );
        }
        p.push( new Promise( (res) => {
          this.exists(mounts[i])
              .then( (m) => {
                if (checkRecent || onlyNew) {
                  this.get(m, null, null, 1)
                      .then( (r) => {
                        if (r && r.values && r.values.length) {
                          let last = r.values[0][indexKey];
                          data[m] =
                            data[m].filter( (v) => {
                                     return v[indexKey] > last;
                                   });
                        }
                        res( this.add(m, data[m]) );
                      });
                } else {
                  res( this.add(m, data[m]) );
                }
              })
              .catch(m => {
                res( this.add(m, data[m]) );
              })
        }));
      }

      Promise.all(p)
             .then( resolve )
             .catch( (e) => {
               this.emit('error', e);
             });
    });
  }

  exists(mount) {
    return new Promise( (resolve, reject) => {
      if (this._cache.has(mount)) {
        resolve(mount);
      } else {
        reject(mount);
      }
    });
  }

  count(mount) {
    return new Promise( (resolve) => {
      let ret;
      if (this._cache.has(mount)) {
        ret = this._cache.get(mount).length - 1;
      }
      resolve(ret);
    });
  }

  delete(mount, min, max) {
    return new Promise( (resolve) => {
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

  deleteByIndex(mount, start, stop) {
    return new Promise( (resolve) => {
      if (this._cache.has(mount) && start !== undefined && stop !== undefined) {
        this._cache.get(mount).splice(start, stop);
      }
      resolve();
    });
  }

  deleteLast(mount, pos) {
    return new Promise( (resolve) => {
      if (this._cache.has(mount) && pos !== undefined) {
        this._cache.get(mount).splice(0, pos);
      }
      resolve();
    });
  }

  clear(mount) {
    return new Promise( (resolve) => {
      if (this._cache.has(mount)) {
        this._cache.set(mount, []);
      }
      resolve();
    });
  }

  info() {
    return new Promise( (resolve) => {
      const keys = this._cache.keys();
      const keyLength = keys.length;
      let totalCount = 0;
      let count = {};
      this._cache.forEach( (array, mount) => {
        count[mount] = array.length;
        totalCount += array.length;
      });
      resolve({
        keys: keys,
        keyLength: keyLength,
        count: count,
        totalCount: totalCount
      });
    });
  }
}

module.exports = CacheClient;
