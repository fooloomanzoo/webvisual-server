// REDIS Client

"use-strict"

const DBInterface = require('../_interface/index.js')
const redis = require("redis");
const msgpack = require('tiny-msgpack');

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
      maxCount: 3600 * 24,
      onlyNew: true,
      encoder: (value) => {
        // console.log(String.fromCharCode.apply(null, msgpack.encode(value)).length, JSON.stringify(value).length);
        return String.fromCharCode.apply(null, msgpack.encode(value));
      },
      decoder: (str) => {
        if (typeof str === 'string') {
          const typed_array = new Uint8Array(str.length);
          for (let i = 0; i < str.length; i++) {
              typed_array[i] = str.charCodeAt(i);
          }
          return msgpack.decode(typed_array);
        }
        return {};
      }
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
                      this.emit('error',  `${mount}: Error cleaning Database (${this.options.type}) (count: ${count}, maxCount: ${maxCount})\n${err}`);
                    });
              }
            })
            .catch( (err) => {
              this.emit('error', `${mount}: Error catching length of Database (${this.options.type})\n${err}`);
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
            this.emit('error', `${this.dbName}: Error reconnection Client\n${err.stack}`);
          });
    });
  }

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
                 this.emit('error', `${this.dbName}: Error getting multible Data (getAll)\n${err.stack}`);
               });
      } else {
        resolve({});
      }
    });
  }

  get(mount, from, to, limit) {
    return new Promise( (resolve, reject) => {
        // start on maximum values, because they are the newest
        if (from && to && from > to) {
          var tmp = from;
          from = to;
          to = tmp;
        }
        this.client.zrevrangebyscore(mount, [to || Number.MAX_SAFE_INTEGER, from || Number.MIN_SAFE_INTEGER, 'withscores', 'limit', 0, limit || Number.MAX_SAFE_INTEGER], (err, result) => {
          if (err) {
            this.emit('error', `${mount}: Error getting single Data (get) (${this.options.type})\n${err}`);
          }
          var ret = [];
          for (var i = 0; i < result.length; i+=2) {
            ret.unshift( this.options.decoder(result[i]) );
          }
          resolve( { values: ret, mount: mount } );
        });
    });
  }

  add(mount, values) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        if (!this.mounts.has(mount)) {
          this.mounts.add(mount);
        }
        if (!values) {
          reject();
        }
        if (!Array.isArray(values)) {
          if (Object.keys(values).length === 0) {
            reject();
          }
          values = [ values ];
        }

        let args = ['zadd', mount];
        let execs = [];
        let indexKey = this.options.indexKey;

        values.forEach( v => {
          if (v[indexKey] !== undefined) {
            args.push(v[indexKey]);
            args.push(this.options.encoder(v));
          }
          if (args.length > 200) {
            execs.push(args);
            args = ['zadd', mount];
          }
        });
        if (args.length > 2) {
          execs.push(args);
        }
        args = null;
        values = null;
        // atomic zadd for chaining atomic operations
        this.client.multi(execs)
                   .exec( (err) => {
                      if (err) {
                        this.emit('error', `${mount}: Error using EXEC on ZADD (${this.options.type})\n${err}`);
                        console.log(err);
                      }
                      execs = null; // clearing for garbage collector
                      resolve();
                    });
      }
    });
  }

  place(data, checkRecent) {
    return new Promise( (resolve, reject) => {
      let mounts = Object.keys(data);
      let p = [];
      let indexKey = this.options.indexKey;
      let maxCount = this.options.maxCount;
      let onlyNew = this.options.onlyNew;
      for (var i = 0; i < mounts.length; i++) {
        if (!this.mounts.has( mounts[i] )) {
          this.mounts.add( mounts[i] );
        }
        p.push( new Promise( (res, rej) => {
          this.exists(mounts[i])
              .then( (m) => {
                if ( checkRecent || onlyNew ) {
                  this.get(m, null, null, 1)
                      .then( (r) => {
                        if (r && r.values && r.values.length) {
                          let last = r.values[0][indexKey];
                          data[m] =
                            data[m].filter( (v) => {
                                     return v[indexKey] > last;
                                   });
                        }
                        data[m] =
                          data[m].sort( (a, b) => {
                                    return a[indexKey] > b[indexKey];
                                 });
                        res();
                      });
                } else {
                  data[m] =
                    data[m].sort( (a, b) => {
                              return a[indexKey] > b[indexKey];
                           });
                  res();
                }
              })
              .catch(m => {
                data[m] =
                  data[m].sort( (a, b) => {
                            return a[indexKey] > b[indexKey];
                         });
                res();
              })
        }));
      }
      Promise.all(p)
             .then( () => {
               Promise.resolve( mounts[0] )
                 .then(function loop(m) {
                    // The loop check
                    if (data[m]) { // The post iteration increment
                      var v = data[m].splice(0, 5000);
                      if (v.length) {
                        return this.add(m, v)
                                   .thenReturn(m)
                                   .then(loop.bind(this));
                      } else {
                        delete data[m];
                        if (Object.keys(data).length) {
                          return loop.call(this, Object.keys(data)[0]);
                        } else {
                          return;
                        }
                      }
                    } else {
                      return;
                    }
                  }.bind(this))
                .then( (res) => {
                  // console.log('redis transaction finish');
                  data = null;
                  resolve(res);
                })
                .catch( err => {
                  data = null;
                  console.log( `${this.dbName}: Error placing Data (place)\n${err.stack}`);
                  // this.emit('error', `${this.dbName}: Error placing Data (place)\n${err.stack}`);
                  resolve();
                });
              });
    });
  }

  exists(mount) {
    return new Promise( (resolve, reject) => {
      this.client.exists( mount, (err, result) => {
        if (err) {
          this.emit('error', `${this.dbName}: Error check Existence\n${err.stack}`);
        }
        if (result === 1) {
          resolve(mount);
        } else {
          reject(mount);
        }
      })
    });
  }

  count(mount, min, max) {
    if (min !== undefined && max !== undefined) {
      return new Promise( (resolve, reject) => {
        this.client.zcount(mount, [min, max], (err, result) => {
          if (err)
            this.emit('error', `${mount}: Error fetching ZCOUNT (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    } else {
      return new Promise( (resolve, reject) => {
        this.client.zcard(mount, (err, result) => {
          if (err)
            this.emit('error', `${mount}: Error fetching ZCARD (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    }
  }

  delete(mount, min = 0, max = -1) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyrank(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in delete using ZREMRANGEBYRANK (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByIndex(mount, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyscore(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in deleteByIndex using ZREMRANGEBYSCORE (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByRank(mount, start = 0, end = 0) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyrank(mount, [start, end], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in deleteByRank using ZREMRANGEBYRANK (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      this.deleteByRank(mount, [0, -1])
          .then( (result) => {
            resolve(result || 0);
          })
          .catch( (err) => {
            this.emit('error', `${mount}: Error in clearing database (${this.options.type})\n${err}`);
          });
    });
  }
}

module.exports = RedisClientDB;
