// Interface for Flatnining Timeseries Data

"use-strict"

const Generic = require('../generic/index.js')
const redis = require("redis");

Promise.prototype.thenReturn = function(value) {
  return this.then( () => {
      return value;
  });
};

// REDIS Interface
// using zadd for setting a timeseries up

class RedisInterface extends Generic {

  constructor(options) {
    super(options);
  }

  get defaults() {
    return {
      host: '127.0.0.1',
      port: 6379,
      indexKey: 'x',
      cleanInterval: 1000 * 60 * 60 * 24,
      maxCount: 10000000
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
              this.delete(mount, 0, count - maxCount)
                  .then( (res) => { if(res) console.log(res); })
                  .catch( (err) => {
                    this.emit('error', err);
                  });
            })
            .catch( (err) => {
              this.emit('error', err);
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
            this.emit('error', err);
          });
    });
  }

  get(mount, start, stop) {
    return new Promise( (resolve, reject) => {
      if (this.mounts && this.mounts.has(mount)) {
        this.client.zrange(mount, stop ? start : 0, stop || -start || -1, (err, result) => {
          if (err)
            this.emit('error', err);
          var ret = [];
          if (result) {
            result.forEach( (r) => {
              try {
                ret.push( JSON.parse(r) );
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

  getAll(start, stop, limit) {
    return new Promise( (resolve, reject) => {
      if (this.mounts) {
        let ret = {};
        let p = [];

        this.mounts.forEach( (mount) => {
          p.push(this.range(mount, start, stop, limit));
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

  range(mount, start, stop, limit) {
    return new Promise( (resolve, reject) => {
      if (this.mounts && this.mounts.has(mount)) {
        this.client.zrevrangebyscore(mount, stop || Number.MAX_SAFE_INTEGER, start || Number.MIN_SAFE_INTEGER, (err, result) => {
          if (err)
            this.emit('error', err);
          result.splice(limit, result.length - limit);
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
                        this.emit('error', `Database REDIS Error ${mount}\n${err}`);
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
          let mount = Object.keys(values)[i];
          return this.add(mount, values[mount]).thenReturn(i + 1).then(loop.bind(this));
        }
      }.bind(this)).then( (res) => {
        values = null;
        resolve(res);
      }).catch( (e) => {
        values = null;
        this.emit('error', `Database REDIS Error\n${e}`);
        resolve();
      });
    });
  }

  count(mount, min, max) {
    return new Promise( (resolve, reject) => {
      this.client.zcount(mount, min || 0, max || -1, (err, result) => {
        if (err)
          this.emit('error', err);
        resolve(result || 0);
      })
    });
  }

  delete(mount, min, max) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyrank(mount, min || 0, max || -1, (err, result) => {
        if (err)
          this.emit('error', err);
        resolve(result || 0);
      })
    });
  }

  deleteByIndex(mount, min, max) {
    return new Promise( (resolve, reject) => {
      this.client.zremrangebyscore(mount, min || Number.MIN_SAFE_INTEGER, max || Number.MAX_SAFE_INTEGER, (err, result) => {
        if (err)
          this.emit('error', err);
        resolve(result || 0);
      })
    });
  }

  clear(mount) {
    return new Promise( (resolve, reject) => {
      this.delete(mount, 0, -1)
          .then( (result) => {
            resolve(result || 0);
          });
    });
  }

}

module.exports = RedisInterface;
