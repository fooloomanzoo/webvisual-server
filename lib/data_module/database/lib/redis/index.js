// REDIS Client

"use-strict"

const DBInterface = require('../_interface/index.js')
const redis = require("redis");

Promise.prototype.thenReturn = function(value) {
  return this.then( () => {
      return value;
  });
};

// REDIS
// using zadd for setting a timeseries up

class RedisClientDB extends DBInterface {

  constructor(dbName, options, data) {
    super(dbName, options, data);
  }

  get defaults() {
    return {
      type: 'redis',
      host: '127.0.0.1',
      port: 6379,
      indexKey: 'x',
      cleanInterval: 1000 * 3600,
      maxCount: 3600 * 24 * 3
    };
  }

  _connectClient() {
    return new Promise( (resolve, reject) => {
      try {
        this.client = redis.createClient(this.options);
        this.client.on('ready', () => {
          resolve();
        });

        this.client.on('error', (err) => {
          reject(err);
        });
      } catch (e) {
        reject(err);
      }
    });
  }

  _cleanUp(maxCount) {
    if (this.mounts) {
      this.mounts.forEach( (mount) => {
        this.count(mount)
            .then( (count) => {
              if (mount && count > maxCount) {
                this.deleteByRank(mount, 0, count - maxCount - 1)
                    .then( (res) => {
                      // if(res)
                      //   console.log(res, maxCount, count - maxCount - 1);
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
            this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
          });
    });
  }
  //
  // range(mount, start, stop) {
  //   return new Promise( (resolve, reject) => {
  //     if (this.mounts && this.mounts.has(mount)) {
  //       console.log(stop ? start || 0 : 0, stop || -start || -1);
  //       this.client.zrange(mount, [stop ? -start || 0 : 0, stop || -1], (err, result) => {
  //         if (err) {
  //           this.emit('error', err);
  //           console.log(err);
  //         }
  //         var ret = [];
  //         if (result) {
  //           result.forEach( (r) => {
  //             try {
  //               ret.push( JSON.parse(r) );
  //             } catch (e) {
  //               // this.emit('error', e);
  //             }
  //           })
  //         }
  //         resolve( { values: ret, mount: mount } );
  //       });
  //     } else {
  //       resolve([]);
  //     }
  //   });
  // }

  getAll(start = null, stop = null, limit = null, mounts = this.mounts) {
    return new Promise( (resolve, reject) => {
      if (mounts) {
        let ret = {};
        let p = [];

        mounts.forEach( (mount) => {
          p.push(this.get(mount, start, stop, limit));
        })

        Promise.all(p)
               .then( (result) => {
                 for (var i = 0; i < result.length; i++) {
                   ret[result[i].mount] = result[i].values;
                 }
                 resolve(ret);
               })
               .catch( (err) => {
                 this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
               });
      } else {
        resolve({});
      }
    });
  }

  get(mount, from, to, limit) {
    return new Promise( (resolve, reject) => {
      if (this.mounts && this.mounts.has(mount)) {
        // start on maximum values, because they are the newest
        if (from && to && from > to) {
          var tmp = from;
          from = to;
          to = tmp;
        }
        this.client.zrevrangebyscore(mount, [to || Number.MAX_SAFE_INTEGER, from || Number.MIN_SAFE_INTEGER, 'limit', 0, limit || Number.MAX_SAFE_INTEGER], (err, result) => {
          if (err) {
            this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
          }
          var ret = [];
          if (result) {
            result.forEach( (r) => {
              try {
                ret.unshift( JSON.parse(r) );
              } catch (e) {
                // this.emit('error', e);
              }
            })
          }

          resolve( { values: ret, mount: mount } );
        });
      } else {
        resolve([]);
      }
    });
  }

  add(mount, values) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        if (!this.mounts.has(mount)) {
          this.mounts.add(mount);
        }
        if (!Array.isArray(values)) {
          values = [ values ];
        }

        let args = ['zadd', mount];
        let execs = [];
        let j = 0;
        let indexKey = this.options.indexKey;

        values.forEach( (v) => {
          if (v[indexKey] !== undefined) {
            args.push(v[indexKey]);
            args.push(JSON.stringify(v));
          }
          if (args.length > 150) {
            execs.push(args);
            args = ['zadd', mount];
          }
        });
        if (args.length > 2) {
          execs.push(args);
        }
        args = null;
        // atomic zadd for chaining atomic operations
        this.client.multi(execs)
                   .exec( (err, replies) => {
                      if (err) {
                        this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
                      }
                      execs = null; // clearing for garbage collector
                      resolve(replies || 0);
                    });
      }
    });
  }

  place(values) {
    return new Promise( (resolve, reject) => {
      let len = Object.keys(values).length;
      // The Promise Loop initialization
      Promise.resolve(0).then(function loop(i) {
        // The loop check
        if (i < len) { // The post iteration increment
          var mount = Object.keys(values)[i];
          var v = values[mount].splice(0, 1000);
          if (values[mount].length) {
            return this.add(mount, v).thenReturn(i).then(loop.bind(this));
          } else {
            return this.add(mount, v).thenReturn(i + 1).then(loop.bind(this));
          }
        }
      }.bind(this)).then( (res) => {
        values = null;
        resolve(res);
      }).catch( (e) => {
        values = null;
        this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
        resolve();
      });
    });
  }

  count(mount, min, max) {
    if (min !== undefined && max !== undefined) {
      return new Promise( (resolve, reject) => {
        this.client.zcount(mount, [min, max], (err, result) => {
          if (err)
            this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    } else {
      return new Promise( (resolve, reject) => {
        this.client.zcard(mount, (err, result) => {
          if (err)
            this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    }
  }

  delete(mount, min = 0, max = -1) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyrank(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByIndex(mount, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyscore(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByRank(mount, start = 0, end = 0) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyrank(mount, [start, end], (err, result) => {
        if (err)
          this.emit('error', `${this.dbName}: (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      this.deleteByRank(mount, [0, -1])
          .then( (result) => {
            resolve(result || 0);
          });
    });
  }
}

module.exports = RedisClientDB;
