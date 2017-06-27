
importScripts('/scripts/idb.js');
if (!(self.Promise && self.Promise.all)) {
  importScripts('/bower_components/es6-promise/es6-promise.auto.min.js');
}

(function() {

	function ClientDatabase(mount, indexKey, options) {
		this.mount = mount;
		this.indexKey = indexKey;
		this.options = options;
    this.dbPromise = idb.open(mount, 1, function (upgradeDB) {
      upgradeDB.createObjectStore(this.indexKey, this.options);
    }.bind(this));
	}

  ClientDatabase.prototype = {

    get: function(start, end, limit, direction) {
      // direction:
      //   'next'
      //   'nextunique'
      //   'prev'
      //   'prevunique'
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.indexKey);
        var values = [];
        var store = tx.objectStore(this.indexKey);
        var keyRange = null;
        if (Number.isFinite(start) && Number.isFinite(end)) {
          keyRange = IDBKeyRange.bound(start, end);
        }

        // openKeyCursor isn't supported by Safari, so we fall back
        store.iterateCursor.call(store, keyRange, direction || 'next', function(cursor) {
          if (!cursor || values.length >= limit)
            return;

          values.push(cursor.value);

          cursor.continue();
        });

        return tx.complete.then( function() {
          var ret = {};
          ret[this.mount] = values;
          return ret;
        }.bind(this));
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        var ret = {};
        ret[this.mount] = [];
        return ret;
      });
    },

    set: function(data) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.indexKey, 'readwrite');

        for (var i = data.length - 1 ; i >=0 ; i--) {
          tx.objectStore(this.indexKey).put(data[i], data[i][this.indexKey]);
        }
        return tx.complete;
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        return {};
      });
    },

    last: function(start, stop, count) {
      return this.get(start, stop, count || 1, 'prev');
    },

    first: function(start, stop, count) {
      return this.get(start, stop, count || 1);
    },

    range: function() {
      return new Promise(function(resolve, reject) {
        var ret = [null, null];
        this.first(null, null, 1)
            .then( function(f) {
              ret[0] = f[this.mount][0][this.indexKey];
              this.last(null, null, 1)
                  .then( function(l) {
                    ret[1] = l[this.mount][0][this.indexKey];
                    resolve(ret);
                  }.bind(this))
                  .catch(reject);
              }.bind(this))
            .catch(reject);
      }.bind(this));
    },

    delete: function(data) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.indexKey, 'readwrite');
        for (var i = data.length - 1 ; i >=0 ; i--) {
          if (data[i][this.indexKey] !== undefined) {
            tx.objectStore(this.indexKey).delete(data[i][this.indexKey]);
          }
        }
        return tx.complete;
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        return {};
      });
    },

    clear: function() {
      return this.dbPromise.then(  function(db) {
        var tx = db.transaction(this.indexKey, 'readwrite');
        tx.objectStore(this.indexKey).clear();
        return tx.complete;
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        return {};
      });
    },

    getAll: function(key) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.indexKey);
        var store = tx.objectStore(this.indexKey);
        var ret = {};
        ret[this.mount] = [];
        var values = [];

        store.getAll().then( function(r) {
          values = r;
        })
        return tx.complete.then( function() {
          ret[this.mount] = values;
          return ret;
        }.bind(this));
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        var ret = {};
        ret[this.mount] = [];
        return ret;
      });
    },

    getAllKeys: function() {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.indexKey);
        var keys = [];
        var store = tx.objectStore(this.indexKey);

        // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // openKeyCursor isn't supported by Safari, so we fall back
        (store.iterateKeyCursor || store.iterateCursor).call(store, function(cursor) {
          if (!cursor) return;
          keys.push(cursor.key);
          cursor.continue();
        });

        return tx.complete.then( function() {
          var ret = {};
          ret[this.mount] = keys;
          return ret;
        }.bind(this));
      }.bind(this))
      .catch( function(err) {
        console.log(err);
        var ret = {};
        ret[this.mount] = [];
        return ret;
      });
    }
  };

  if (self) {
  	self.ClientDatabase = ClientDatabase;
  }
})();
