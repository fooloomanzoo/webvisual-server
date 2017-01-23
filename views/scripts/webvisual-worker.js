importScripts('/socket.io/socket.io.js');
importScripts('/scripts/cache.js');
importScripts('/scripts/database.js');

if (!self.Promise) {
  importScripts('/polyfills/promise.js');
}

var socket
  , options = {}
  , cache = new ClientCache()
  , dbMap = new Map()
  , mountDB = new IndexedDBHandler('mounts', 'mounts', { autoIncrement : true })
  , mounts = new Set();

// load Recent Data into cache

// if (self.navigator && self.navigator.onLine !== true) {
  mountDB.getAll()
         .then( function(ret) {
           if (!ret || !ret.mounts) {
             return;
           }
           for (var i = 0; i < ret.mounts.length; i++) {
             mounts.add(ret.mounts[i]);
           }
           mounts.forEach( function(mount) {
             if (!dbMap.has(mount)) {
               dbMap.set(mount, new IndexedDBHandler(mount, 'x'));
             }

             dbMap.get(mount)
                .getAll()
                .then( function(ret) {
                  // if (self.navigator && self.navigator.onLine !== true) {
                    self._updateCache( { values: ret } );
                    self._updateClient( { values: ret } );
                  // }
                } )
                .catch( function(err) {
                  if (err)
                    console.log(err);
                });
           });
         })
        .catch( function(e) {
          console.log(e);
        });
// }

self.onconnect = function(e) {
  for (var key in e.data) {
    if (self[key]) {
      self[key](e.data[key]);
    }
  }
}

self.ononline = function() {
  console.log('Your worker is now online');
}

self.onoffline = function() {
  console.log('Your worker is now offline');
}

self.onmessage = function(e) {
  for (var key in e.data) {
    if (self[key]) {
      self[key](e.data[key]);
    }
  }
  switch (e.data.target) {
    case 'socket':

      break;
    case 'database':

      break;
    case 'cache':

      break;
    case 'server':

      break;
    default:

  }
}

self.Socket = function () {
  this.socket = null;
  this.locationHost = '';
  this.socketName = '';
  this.socketRoom = '';
  this.mobile = false;
}

self.Socket.prototype = {

  connect: function(opt) {
    if (!socket) {
      this.locationHost = opt.locationHost || this.locationHost;
      this.socketName = opt.socketName || this.socketName;

      if (!this.locationHost || !this.socketName) {
        return;
      }
      socket = io.connect(this.locationHost + '/' + this.socketName, {
        multiplex: false
      });

      socket.on('connect', function() {
        console.info('clientSocket connected to: ' + this.locationHost);
        self.postMessage( {
          type: 'status',
          status: 'connected'
        })
      });
      socket.on('disconnect', function() {
        console.warn('clientSocket disconnected to: ' + this.locationHost);
        self.postMessage( {
          type: 'status',
          status: 'disconnected'
        })
      });
      socket.on('reconnect', function() {
        console.info('clientSocket reconnected to: ' + this.locationHost);
        self.postMessage( {
          type: 'status',
          status: 'connected'
        })
      });
      socket.on('error', function(err) {
        console.error('clientSocket error: ', err);
        self.postMessage( {
          type: 'status',
          status: 'sync-problem'
        })
      });

      socket.on('initial', function(message) {
        // reset cache and clear database on initial data
        // if (self.navigator && self.navigator.onLine === true) {
        //   self._clearDatabase();
        //   self._clearCache();
        // }

        self._updateData(message, 'initial');
      });

      socket.on('update', function(message) {
        self._updateData(message, 'update');
      });

      socket.on('request', function(message) {
        if (message && message.messageId && message.values) {
          self.postMessage({
            type: 'request',
            messageId: message.messageId,
            response: message.values
          });
        }
      });

      if (opt.socketRoom) {
        this.socketRoom = opt.socketRoom;
        this.setup(options)
      }
      else if (this.socketRoom) {
        this.setup(options)
      }
    }
  },

  setup: function(opt) {
    if (!this.socket) {
      this.connect(opt);
      return;
    }
    if (this.socket && opt.socketRoom) {
      var facility = opt.socketRoom.split('/')[0],
        system = opt.socketRoom.split('/')[1];
      if (!facility || !system) {
        return;
      }

      this.socketRoom = opt.socketRoom;
      this.mobile = opt.mobile || false;

      this.socket.emit('setup', {
        room: this.socketRoom,
        mobile: this.mobile
      });
    }
  },

  disconnect: function() {
    if (this.socket && this.socket.disconnect) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
};


self._updateData = function(message, type) {
  if (Array.isArray(message)) {// if message is an Array
    for (var i = 0; i < message.length; i++) {
      this._updateCache(message[i]);
      this._updateClient(message[i], type);
    }
  } else if (message.values) { // if message is a single Object
    this._updateCache(message);
    this._updateClient(message);
  }
}

self._updateCache = function(message, noHeap) {
  cache.append(message.values, noHeap);
}

self._clearCache = function() {
  cache.clear();
}

self._updateClient = function(message) {
  var ret = { type: 'updateNodes', data: {}};

  for (var mount in message.values) {
    ret.data[mount] = {};
    ret.data[mount].splices = this.cache.get(mount).splices;
    ret.data[mount].values = this.cache.get(mount).heap;
    // ret.data[mount].splices = [];
    // ret.data[mount].values = message.values[mount];
  }

  self.postMessage(ret);
  self._updateDatabase(ret.data);
}

self._updateDatabase = function(message) {

  for (var mount in message) {
    if (!dbMap.has(mount)) {
      dbMap.set(mount, new IndexedDBHandler(mount, 'x'));
      mountDB.set(mount);
    }
    var idbMap = dbMap.get(mount);

    idbMap.delete('x', message[mount].splices)
       .then( function(ret) {
        //  console.log(ret);
       } )
       .catch( function(err) {
        //  console.log(err);
       });
    idbMap.place('x', message[mount].values)
       .then( function(ret) {
        //  console.log(ret);
       } )
       .catch( function(err) {
        //  console.log(err);
       });
  }
}

self._clearDatabase = function() {
  if (mountDB) {
    mountDB.clear();
  }
  if (dbMap) {
    dbMap.forEach( function(idbMap) {
      idbMap.clear()
        .catch( function(err) {
         //  console.log(err);
        });
    })
  }
}

self.request = function(opt) {
  if (opt.func && opt.messageId && cache[opt.func]) {
    cache[opt.func](opt.arg)
      .then( function(res) {
        self.postMessage({
          type: 'request',
          messageId: opt.messageId,
          response: res
        });
      })
      .catch( function(err) {
        if (err) {
          console.warn(err);
        }
        self.postMessage({
          type: 'request',
          messageId: messageId,
          response: {}
        });
      });
  } else { // return, to remove EventListener
    self.postMessage({
      type: 'request',
      messageId: messageId,
      response: {}
    });
  }
}

self.requestToServer = function(opt) {
  socket.emit('request', {
    room: options.socketRoom,
    mount: opt.mount,
    messageId: opt.messageId,
    from: opt.from,
    to: opt.to,
    limit: opt.limit
  });
}
