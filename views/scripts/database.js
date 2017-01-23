
importScripts('/scripts/idb.js');
if (!self.Promise) {
  importScripts('/polyfills/promise.js');
}

(function() {

	function Database(dbName, storeName, dbOptions) {
		this.dbName = dbName;
		this.storeName = storeName;
		this.dbOptions = dbOptions;
    this.dbPromise = idb.open(dbName, 1, function (upgradeDB) {
      upgradeDB.createObjectStore(this.storeName, this.dbOptions);
    }.bind(this));
	}

  Database.prototype = {
    get: function(key) {
      return this.dbPromise.then( function(db) {
        return db.transaction(storeName)
          .objectStore(this.storeName).get(key);
      }.bind(this));
    },
    set: function(val, key) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(val, key);
        return tx.complete;
      }.bind(this));
    },
    add: function(val) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).add(val);
        return tx.complete;
      }.bind(this));
    },
    place: function(key, values) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName, 'readwrite');

        for (var i = values.length - 1 ; i >=0 ; i--) {
          tx.objectStore(this.storeName).put(values[i], values[i][key]);
        }
        return tx.complete;
      }.bind(this));
    },
    delete: function(values) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName, 'readwrite');
        for (var i = values.length - 1 ; i >=0 ; i--) {
          if (values[i][this.storeName] !== undefined) {
            tx.objectStore(this.storeName).delete(values[i][this.storeName]);
          }
        }
        return tx.complete;
      }.bind(this));
    },
    clear: function() {
      return this.dbPromise.then(  function(db) {
        var tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
        return tx.complete;
      }.bind(this));
    },
    getAll: function(key) {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName);
        var store = tx.objectStore(this.storeName);
        var ret = {};
        ret[this.dbName] = [];
        var values = [];

        store.getAll().then( function(r) {
          values = r;
        })
        return tx.complete.then( function() {
          ret[this.dbName] = values;
          return ret;
        }.bind(this));
      }.bind(this));
    },
    get: function(limit, direction) {
      // direction:
      //   'next'
      //   'nextunique'
      //   'prev'
      //   'prevunique'
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName);
        var values = [];
        var store = tx.objectStore(this.storeName);

        // openKeyCursor isn't supported by Safari, so we fall back
        (store.iterateKeyCursor || store.iterateCursor).call(store, null, direction || 'next', function(cursor) {
          if (!cursor) return;
          values.push(cursor.value);
          if (!limit || values.length < limit) {
            cursor.continue();
          }
        });

        return tx.complete.then( function() {
          var ret = {};
          ret[this.dbName] = keys;
          return ret;
        }.bind(this));
      }.bind(this));
    },
    getAllKeys: function() {
      return this.dbPromise.then( function(db) {
        var tx = db.transaction(this.storeName);
        var keys = [];
        var store = tx.objectStore(this.storeName);

        // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // openKeyCursor isn't supported by Safari, so we fall back
        (store.iterateKeyCursor || store.iterateCursor).call(store, function(cursor) {
          if (!cursor) return;
          keys.push(cursor.key);
          cursor.continue();
        });

        return tx.complete.then( function() {
          var ret = {};
          ret[this.dbName] = keys;
          return ret;
        }.bind(this));
      }.bind(this));
    },
    last: function(count) {
      return this.get(count || 1);
    },
    first: function(count) {
      return this.get(count || 1, 'prev');
    },
    range: function() {
      return new Promise(function(resolve, reject) {
        var ret = [null, null];
        this.first()
            .then( function(f) {
              ret[0] = f;
              this.last()
                  .then( function(l) {
                    ret[1] = l;
                    resolve(ret);
                  })
                  .catch(reject);
              }.bind(this))
            .catch(reject);
      }.bind(this));
    }
  };

  if (self) {
  	self.Database = Database;
  }
})();
