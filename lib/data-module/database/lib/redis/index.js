// REDIS Client

"use-strict"

const DBInterface = require('../_interface/index.js')
const redis = require("redis");
const redisMessagepack = require('redis-messagepack');
const msgpack = require('msgpack5')();

const RELEASE_LENGTH = 400; // Maximum size of collected data, until they are released for processing

[ 'exists', 'auth', 'zcount', 'zcard', 'zremrangebyrank', 'zremrangebyscore', 'info' ].forEach(cmd => {
  redisMessagepack.blacklist.push(cmd)
})

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
      return_buffers : true
    };
  }

  _connectClient() {
    return new Promise( (resolve, reject) => {
      try {
        this.client = redisMessagepack(redis.createClient(this.options), {
          serializer: function(args) {
             // here using just objects, others are commands
            if (typeof args === 'number' || typeof args === 'string') {
              return args;
            }
            return msgpack.encode(args);
          },
          deserializer: function(args) {
            return msgpack.decode(args);
          }
        });
        this.client.on('ready', () => {
          this._cleanUp(this.options.maxCount).then(resolve).catch(reject);
        });

        this.client.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  _cleanUp(maxCount) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        const p = [];
        this.mounts.forEach( (mount) => {
          p.push(this._clean(mount, maxCount));
          Promise.all(p).then(resolve).catch(reject);
        });
      } else {
        resolve();
      }
    });
  }

  _clean(mount, maxCount, addedCount = 0) {
    return new Promise( (resolve) => {
      this.count(mount)
          .then( (count) => {
            if (mount && (count + addedCount > maxCount)) {
              this.deleteByRank(mount, 0, count + addedCount - maxCount - 1)
                  .then( () => {
                    // this.emit('info',  `${mount}: cleaning Database (${this.options.type}) (elements deleted: ${count + addedCount - maxCount - 1}, current elements: ${maxCount})`);
                    resolve();
                  })
                  .catch( (err) => {
                    this.emit('error',  `${mount}: Error cleaning Database (${this.options.type}) (count: ${count}, maxCount: ${maxCount})\n${err}`);
                  });
            } else {
              resolve();
            }
          })
          .catch( (err) => {
            this.emit('error', `${mount}: Error catching length of Database (${this.options.type})\n${err}`);
          });
    });
  }

  _authClient(password) {
    return new Promise( (resolve) => {
      this.client.auth(password);
      resolve();
    });
  }

  _disconnectClient(force) {
    return new Promise( (resolve) => {
      if (force) {
        this.client.end(true);
      } else {
        this.client.quit();
      }
      resolve();
    });
  }

  _reconnectClient() {
    return new Promise( (resolve) => {
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
    return new Promise( (resolve) => {
      if (mounts) {
        const ret = {};
        const p = [];

        mounts.forEach( (mount) => {
          p.push(this.get(mount, start, stop, limit));
        })

        Promise.all(p)
               .then( (result) => {
                 for (let i = 0; i < result.length; i++) {
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
    return new Promise( (resolve) => {
        // start on maximum values, because they are the newest
        if (from && to && from > to) {
          const tmp = from;
          from = to;
          to = tmp;
        }
        this.client.zrevrangebyscore(mount, [to || Number.MAX_SAFE_INTEGER, from || Number.MIN_SAFE_INTEGER, 'withscores', 'limit', 0, limit || Number.MAX_SAFE_INTEGER], (err, result) => {
          if (err) {
            this.emit('error', `${mount}: Error getting Data (GET) (${this.options.type})\n${err}`);
          }
          resolve( {
            values: result.filter( (_, i) => {
              return i % 2 === 0;
            }),
            mount: mount
          } );
        });
    });
  }

  add(mount, values, onlyNew = this.options.onlyNew) {
    return new Promise( (resolve, reject) => {
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

      // filter only new values
      const p = new Promise( (res) => {
        if (onlyNew === true) {
          this.exists(mount)
              .then( (m) => {
                // get last value in sorted list
                this.get(m, null, null, 1)
                    .then( (r) => {
                      if (r && r.values && r.values.length) {
                        const last = r.values[0][this.options.indexKey];
                        values = values.filter( (v) => {
                                   return v[this.options.indexKey] > last;
                                 });
                        if (!values.length) {
                          resolve();
                        }
                      }
                      res();
                    });
              })
              .catch(res)
        } else {
          res();
        }
      });

      Promise.resolve(p)
        .then( () => {
          return new Promise( (res) => {
            // execute operations in chunks
            let args = ['zadd', mount];
            let execs = [];
            const indexKey = this.options.indexKey;

            values.forEach( v => {
              if (v[indexKey] !== undefined) {
                args.push(+v[indexKey]);
                args.push(v);
              }
              if (args.length > RELEASE_LENGTH) {
                execs.push(args);
                args = ['zadd', mount];
              }
            });
            if (args.length > 2) {
              execs.push(args);
            }
            // atomic zadd for chaining atomic operations
            this.client.multi(execs)
                       .exec( (err) => {
                          if (err) {
                            this.emit('error', `${mount}: Error using EXEC on ZADD (${this.options.type})\n${err}`);
                          }
                          res();
                        });
          });
        })
        .then( () => {
          // clean if necessary
          this._clean(mount, this.options.maxCount, values.length)
              .then(resolve);
        })
        .catch(reject);
    });
  }

  place(data, onlyNew) {
    return new Promise( (resolve) => {
      const mounts = Object.keys(data);
      const p = [];

      for (let i = 0; i < mounts.length; i++) {
        p.push( new Promise(() => {
          return this.add(mounts[i], data[mounts[i]], onlyNew);
        }));
      }

      Promise.all(p)
        .then( (res) => {
          data = null;
          resolve(res);
        })
        .catch( err => {
          data = null;
          this.emit('warn', `${this.dbName}: Error placing Data (place)\n${err.stack}`);
          resolve();
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
      return new Promise( (resolve) => {
        this.client.zcount(mount, [min, max], (err, result) => {
          if (err)
            this.emit('error', `${mount}: Error fetching ZCOUNT (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    } else {
      return new Promise( (resolve) => {
        this.client.zcard(mount, (err, result) => {
          if (err)
            this.emit('error', `${mount}: Error fetching ZCARD (${this.options.type})\n${err}`);
          resolve(result || 0);
        })
      });
    }
  }

  delete(mount, min = 0, max = -1) {
    return new Promise( (resolve) => {
      this.client.zremrangebyrank(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in delete using ZREMRANGEBYRANK (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByIndex(mount, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    return new Promise( (resolve) => {
      this.client.zremrangebyscore(mount, [min, max], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in deleteByIndex using ZREMRANGEBYSCORE (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  deleteByRank(mount, start = 0, end = 0) {
    return new Promise( (resolve) => {
      this.client.zremrangebyrank(mount, [start, end], (err, result) => {
        if (err)
          this.emit('error', `${mount}: Error in deleteByRank using ZREMRANGEBYRANK (${this.options.type})\n${err}`);
        resolve(result || 0);
      })
    });
  }

  clear(mount) {
    return new Promise( (resolve) => {
      this.deleteByRank(mount, [0, -1])
          .then( (result) => {
            resolve(result || 0);
          })
          .catch( (err) => {
            this.emit('error', `${mount}: Error in clearing database (${this.options.type})\n${err}`);
          });
    });
  }

  info() {
    return new Promise(function(resolve) {
      this.client.info( (err, result) => {
        if (err)
          this.emit('error', `Error getting request using INFO (${this.options.type})\n${err}`);
        resolve(result || {});
      })
    });
  }
}

module.exports = RedisClientDB;
