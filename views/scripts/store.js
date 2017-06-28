importScripts('/scripts/cache.js');
importScripts('/scripts/database.js');
if (!(self.Promise && self.Promise.all)) {
  importScripts('/bower_components/es6-promise/es6-promise.auto.min.js');
}

(function() {

  function Store(type, indexKey, options) {
    // Set Options
    this.type = type;
    this.indexKey = indexKey;
    this.options = options;
    this._store = new Map();
  }

  Store.prototype = {

    has: function(mount) {
        return this._store.has(mount);
    },

    get: function(mount) {
        return this._store.get(mount);
    },

    add: function(mount) {
      if (!this._store.has(mount)) {
        var obj = new Object();
        this._store.set(mount, this._newStoreKey(mount));
      }
    },

    _newStoreKey: function(mount) {
      switch (this.type) {
        case 'database':
          return new ClientDatabase(mount, this.indexKey, this.options);
          break;
        case 'cache':
          return new ClientCache(mount, this.indexKey, this.options);
          break;
      }
    },

    clear: function() {
        this._store.forEach( function(el, key) {
            el.clear();
        })
        this._store.clear();
    },

    place: function(data) {
        for (var mount in data) {
            this.add(mount);
            try {
              this._store.get(mount).set(data[mount]);
            } catch (e) {
              console.log(mount, e);
            }
        }
    },

    delete: function(data) {
        for (var mount in data) {
            this.add(mount);
            try {
              this._store.get(mount).delete(data[mount]);
            } catch (e) {
              console.log(mount, e);
            }
        }
    },

    request: function(args) {
        var ret = {};

        return new Promise( function(resolve, reject) {
            if (args.mounts === undefined || !Array.isArray(args.mounts)) {
                this._store.forEach(function(el, key) {
                    ret[v] = el.get(args.start, args.end, args.length);
                })
            } else {
                for (var i = 0; i < args.mounts.length; i++) {
                    ret[args.mounts[i]] = [];
                    if (this._store.has(args.mounts[i])) {
                        ret[args.mounts[i]] = this._store.get(args.mounts[i])
                            .get(args.start, args.end, args.length);
                    }
                }
            }
            resolve(ret);
        }.bind(this));
    },

    min: function(opts) {
        return this._operation('min', this._min, opts.key, opts.mounts);
    },
    max: function(opts) {
        return this._operation('max', this._max, opts.key, opts.mounts);
    },
    first: function(opts) {
        return this._operation('first', this._min, 'x', opts.mounts);
    },
    last: function(opts) {
        return this._operation('last', this._max, 'x', opts.mounts);
    },

    range: function(opts) {
      if (opts.key) {
          return new Promise( function(resolve, reject) {
              resolve([this.min(opts), this.max(opts)]);
          }.bind(this));
      } else {
          return new Promise( function(resolve, reject) {
              resolve([this.first(opts), this.last(opts)]);
          }.bind(this));
      }
    },

    _operation: function(func, compareFn, key, mounts) {
        var ret = [];
        if (Array.isArray(mounts)) {
          for (var i = 0; i < mounts.length; i++) {
              if (this._store.has(mounts[i])) {
                  ret.push(this._store.get(mounts[i])[func](key));
              }
          }
        } else {
          this._store.forEach( function(v, e) {
              e[func](key).then( function(res) {
                  ret.push(res);
              })
              .catch( function(err) {
                console.log(err);
              });
          })
        }
        return compareFn(ret, key);
    },

    _max: function(array) { // inspired by d3.array
        var i = -1,
            a,
            b;
        var n = array.length;

        while (++i < n)
            if ((b = array[i]) !== null && b >= b) {
                a = b;
                break;
            }
        while (++i < n)
            if ((b = array[i]) !== null && a < b) a = b;

        return a;
    },

    _min: function(array) { // inspired by d3.array
        var i = -1,
            a,
            b;
        var n = array.length;

        while (++i < n)
            if ((b = array[i]) !== null && b >= b) {
                a = b;
                break;
            }
        while (++i < n)
            if ((b = array[i]) !== null && a > b) a = b;

        return a;
    }
  }
  if (self) {
      self.Store = Store;
  } else if (window) {
      window.Store = Store;
  }
})();
