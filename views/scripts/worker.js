try {
  importScripts('/socket.io/socket.io.js');
  importScripts('/polyfills/polyfills.js');
  importScripts('/scripts/store.js');
  if (!self.Promise) {
    importScripts('/polyfills/promise.js');
  }
} catch (e) {
  console.log(e);
}

self.IOSocket = function () {
  this.socket = null;
  this.locationHost = '';
  this.nameSpace = '';
  this.socketRoom = '';
  this.mobile = false;
}

self.IOSocket.prototype = {

  connect: function(opt) {
    if (!this.socket) {
      this.locationHost = opt.locationHost || this.locationHost;
      this.nameSpace = opt.nameSpace || this.nameSpace;

      if (!this.locationHost) {
        return;
      }
      this.socket = io.connect(this.locationHost + '/' + this.nameSpace, {
        multiplex: false
      });

      this.socket.on('connect', function() {
        console.info('clientSocket connected to: ' + this.locationHost);
        self.postMessage( {
          type: 'status',
          status: 'connected'
        })
        if (this._connectionLostAt) {
          this.request({from: this._connectionLostAt});
        }
      }.bind(this));
      this.socket.on('disconnect', function() {
        console.warn('clientSocket disconnected to: ' + this.locationHost);
        this._connectionLostAt = +(new Date());
        self.postMessage( {
          type: 'status',
          status: 'disconnected'
        })
      }.bind(this));
      this.socket.on('reconnect', function() {
        console.info('clientSocket reconnected to: ' + this.locationHost);
        self.postMessage( {
          type: 'status',
          status: 'connected'
        })
      }.bind(this));
      this.socket.on('error', function(err) {
        console.error('clientSocket error: ', err);
        this._connectionLostAt = +(new Date());
        self.postMessage( {
          type: 'status',
          status: 'sync-problem'
        })
      }.bind(this));

      this.socket.on('initial', function(message) {
        this.initialized = true;
        self._updateData(message, 'initial');
      }.bind(this));

      this.socket.on('update', function(message) {
        self._updateData(message, 'update');
      });

      this.socket.on('reset', function() {
        self._clearCache();
        self._clearDatabase();
      });

      this.socket.on('reload', function() {
        console.info('page reload');
        self.postMessage({
          type: 'reload'
        });
      });

      this.socket.on('request', function(message) {
        if (message && message.messageId) {
          self.postMessage({
            type: 'request',
            messageId: message.messageId,
            response: message.values || []
          });
        }
      });

      if (opt.socketRoom) {
        this.socketRoom = opt.socketRoom;
        this.setup(opt)
      }
      else if (this.socketRoom) {
        this.setup(opt)
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
  },

  request: function(args) {
    this.socket.emit('request', {
      room: this.socketRoom,
      mounts: args.mounts,
      messageId: args.messageId,
      from: args.from,
      to: args.to,
      limit: args.limit
    });
  }
};


var CacheStore = new Store('cache', 'x')
  , DatabaseStore = new Store('database', 'x')
  , mountDB = new ClientDatabase('mounts', 'mounts', { autoIncrement : true })
  , Socket = new IOSocket();

// load Recent Data into cache

mountDB.getAll()
       .then( function(ret) {
         if (!ret || !ret.mounts) {
           return;
         }
         ret.mounts.forEach( function(mount) {
           DatabaseStore.add(mount);

          //  DatabaseStore.get(mount)
          //     .getAll()
          //     .then( function(ret) {
          //       if (Socket && !Socket.initialized) {
          //         self._updateCache( { values: ret } );
          //         self._updateClient( { values: ret } );
          //       }
          //     } )
          //     .catch( function(err) {
          //       if (err)
          //         console.log(err);
          //     });
         });
       })
      .catch( function(e) {
        console.log(e);
      });

self.ononline = function() {
  console.log('Your worker is now online');
}

self.onoffline = function() {
  console.log('Your worker is now offline');
}

self.onmessage = function(e) {
  switch (e.data.target) {
    case 'socket':
      if (Socket[e.data.operation]) {
        Socket[e.data.operation](e.data.args);
      }
      break;
    case 'database':
      if (DatabaseStore[e.data.operation]) {
        DatabaseStore[e.data.operation](e.data.args)
          .then( function(res) {
            console.log(res);
            self.postMessage({
              type: 'request',
              messageId: e.data.args.messageId,
              response: res
            });
          })
          .catch( function(err) {
            if (err) {
              console.warn(err);
            }
            self.postMessage({
              type: 'request',
              messageId: e.data.args.messageId,
              response: {}
            });
          });
      } else { // return, to remove EventListener
        self.postMessage({
          type: 'request',
          messageId: e.data.args.messageId,
          response: {}
        });
      }
      break;
    case 'cache':
      if (CacheStore[e.data.operation]) {
        CacheStore[e.data.operation](e.data.args)
          .then( function(res) {
            self.postMessage({
              type: 'request',
              messageId: e.data.args.messageId,
              response: res
            });
          })
          .catch( function(err) {
            if (err) {
              console.warn(err);
            }
            self.postMessage({
              type: 'request',
              messageId: e.data.args.messageId,
              response: {}
            });
          });
      } else { // return, to remove EventListener
        self.postMessage({
          type: 'request',
          messageId: e.data.args.messageId,
          response: {}
        });
      }
      break;
  }
}

self._updateData = function(message, type) {
  if (Array.isArray(message)) {// if message is an Array
    for (var i = 0; i < message.length; i++) {
      this._updateCache(message[i]);
      this._updateClient(message[i], type);
    }
  } else if (message.values) { // if message is a single Object
    this._updateCache(message);
    this._updateClient(message, type);
  }
}

self._updateCache = function(message) {
  CacheStore.place(message.values);
}

self._clearCache = function() {
  CacheStore.clear();
}

self._updateClient = function(message, type) {
  var ret = { type: type || 'update', values: {}, splices: {}};

  for (var mount in message.values) {
    ret.splices[mount] = CacheStore.get(mount).splices;
    ret.values[mount] = CacheStore.get(mount).heap;
    // ret.data[mount].splices = [];
    // ret.data[mount].values = message.values[mount];
  }

  self.postMessage(ret);
  self._updateDatabase(ret);
}

self._updateDatabase = function(data) {
  if (data.values) {
    DatabaseStore.place(data.values);
  }
  if (data.splices) {
    DatabaseStore.delete(data.splices);
  }
}

self._clearDatabase = function() {
  DatabaseStore.clear();
}
