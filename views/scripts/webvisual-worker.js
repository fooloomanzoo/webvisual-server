importScripts('/socket.io/socket.io.js');
importScripts('/scripts/cache.js');
importScripts('/scripts/database-worker.js');

if (!self.Promise) {
  importScripts('/scripts/promise.js');
}

var socket
  , options = {}
  , cache = new ClientCache()
  , db = new Map()
  , mounts= new Set();

// load Recent Data into cache
try {
  var m = localStorage.getItem('mounts');
  m = JSON.parse(m);
  for (var i = 0; i < m.length; i++) {
    mounts.add(m[i]);
  }
  mounts.forEach( function(mount) {
    if (!db.has(mount)) {
      db.set(mount, new IndexedDBHandler(mount, 'x'));
    }
    var idb = db.get(mount);

    idb.keys()
       .then( function(ret) {
         cache.append(ret);
        //  console.log(ret);
       } )
       .catch( function(err) {
        //  console.log(err);
       });
  });
} catch (e) {
  console.log(e);
}

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
}

self.createSocketConnection = function(opt) {
  if (!socket) {
    options.locationHost = opt.locationHost || options.locationHost;
    options.socketName = opt.socketName || options.socketName;

    if (!options.locationHost || !options.socketName) {
      return;
    }
    socket = io.connect(options.locationHost + '/' + options.socketName, {
      multiplex: false
    });

    socket.on('connect', function() {
      console.info('clientSocket connected to: ' + options.locationHost);
      self.postMessage( {
        type: 'status',
        status: 'connected'
      })
    });
    socket.on('disconnect', function() {
      console.warn('clientSocket disconnected to: ' + options.locationHost);
      self.postMessage( {
        type: 'status',
        status: 'disconnected'
      })
    });
    socket.on('reconnect', function() {
      console.info('clientSocket reconnected to: ' + options.locationHost);
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
      // reset cache and clear database on initial data (TODO: improve solution)
      self._clearDatabase();
      self._clearCache();
      // get all mounts and add to mounts-set
      // ....
      // save to localStorage

      self._updateData(message, 'initial');
    });

    socket.on('update', function(message) {
      self._updateData(message, 'update');
    });

    if (opt.socketRoom) {
      options.socketRoom = opt.socketRoom;
      self.setupConnection(options)
    }
    else if (options.socketRoom) {
      self.setupConnection(options)
    }
  }
}

self.setupConnection = function(opt) {
  if (!socket) {
    self.createSocketConnection(opt);
  }
  if (socket && opt.socketRoom) {
    var facility = opt.socketRoom.split('/')[0],
      system = opt.socketRoom.split('/')[1];
    if (!facility || !system) {
      return;
    }

    options.socketRoom = opt.socketRoom;
    options.mobile = opt.mobile || false;

    // Webvisual._initialized = false;
    socket.emit('setup', {
      room: options.socketRoom,
      mobile: options.mobile
    });
  }
}

self.disconnect = function() {
  if (socket && socket.disconnect) {
    socket.disconnect();
    socket = null;
  }
}

self._updateData = function(message, type) {
  if (Array.isArray(message)) // if message is an Array
    for (var i = 0; i < message.length; i++) {
    this._updateCache(message[i]);
    this._updateClient(message[i], type);

    // this._updateDatabase(message[i]);
  }
  else if (message.values) { // if message is a single Object
    this._updateCache(message);
    this._updateClient(message);
    this._updateDatabase(message);
  }
}

self._updateCache = function(message, noHeap) {
  cache.append(message.values, noHeap);
}

self._clearCache = function() {
  cache.clear();
}

self._updateClient = function(message) {
  var ret = { type: 'updateNodes' };

  for (var mount in message.values) {
    ret[mount] = {};
    ret[mount].splices = this.cache.get(mount).splices;
    ret[mount].values = this.cache.get(mount).heap;
    // ret[mount].values = message.values[mount];
  }

  self.postMessage(ret)
}

self._updateDatabase = function(message) {

  for (var mount in message.values) {
    if (!db.has(mount)) {
      db.set(mount, new IndexedDBHandler(mount, 'x'));
    }
    var idb = db.get(mount);

    idb.place('x', message.values[mount])
       .then( function(ret) {
        //  console.log(ret);
       } )
       .catch( function(err) {
        //  console.log(err);
       });
  }
}

self._clearDatabase = function() {
  if (db) {
    db.forEach( function(idb) {
      idb.clear()
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
        console.warn(err);
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
