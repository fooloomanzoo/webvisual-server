importScripts('/scripts/cache.js');
importScripts('/scripts/database.js');
if (!self.Promise) {
  importScripts('/polyfills/promise.js');
}


(function() {

  function Store(type, options) {
    // Set Options
    this.options = options;
    this.store = new Map();
    switch (type) {
      case 'database':
        this.StoreKey = Database;
        break;
      case 'database':
        this.StoreKey = Cache;
        break;
    }
  }

  Store.prototype = {

    has: function(mount) {
        return this.store.has(mount);
    },

    get: function(mount) {
        return this.store.get(mount);
    },

    add: function(mount) {
      if (!this.store.has(mount)) {
        this.store.set(mount, new this.StoreKey(this.options));
      }
    },

    delete: function(mount) {
        if (this[mount])
            delete this[mount];
        if (!this.store.has(mount))
            return;
        this.store.get(mount).clear();
        this.store.delete(mount);
    },

    clear: function() {
        this.store.forEach( function(el, key) {
            el.clear();
        })
        this.store.clear();
    },

    place: function(data) {
        for (var mount in data) {
            if (!this.store.has(mount)) {
                // console.log(mount, data[mount].length);
                this.store.set(mount, new this.StoreKey(this.options));
            }
            this.store.get(mount).put(data[mount]);
        }
    },

    request: function(opt) {
        var mounts = opt.mounts,
            start = opt.start,
            end = opt.end,
            len = opt.length,
            ret = {};

        return new Promise( function(resolve, reject) {
            if (mounts === undefined || !Array.isArray(mounts)) {
                this.store.forEach(function(el, key) {
                    ret[v] = el.request(start, end, len);
                })
            } else {
                for (var i in mounts) {
                    if (this.store.has(mounts[i])) {
                        ret[mounts[i]] = this.store.get(mounts[i])
                            .request(start, end, len);
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
        return new Promise( function(resolve, reject) {
            resolve([this.first(opts), this.last(opts)]);
        }.bind(this));
    },

    rangedValues: function(opts) {
        return new Promise( function(resolve, reject) {
            resolve([this.min(opts), this.max(opts)]);
        }.bind(this));
    },

    _operation: function(func, compareFn, key, mounts) {
        var ret = [];
        if (Array.isArray(mounts)) {
          for (var i = 0; i < mounts.length; i++) {
              if (this.store.has(mounts[i])) {
                  ret.push(this.store.get(mounts[i])[func](key));
              }
          }
        } else {
          this.store.forEach( function(v, e) {
              e[func](key).then( function(res) {
                  ret.push(res);
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
