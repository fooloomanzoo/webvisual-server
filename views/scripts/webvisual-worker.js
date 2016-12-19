importScripts('/socket.io/socket.io.js');
importScripts('/scripts/cache.js');
importScripts('/scripts/database-worker.js');

var socket
  , options = {}
  , cache = new ClientCache()
  , db = new Map();

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

  if (!socket && opt.locationHost && opt.socketName) {

    options.locationHost = opt.locationHost;
    options.socketName = opt.socketName;

    socket = io.connect(options.locationHost + '/' + options.socketName, {
      multiplex: false
    });

    socket.on('connect', function() {
      console.info('clientSocket connected to: ' + options.locationHost);
    });
    socket.on('disconnect', function() {
      console.warn('clientSocket disconnected to: ' + options.locationHost);
    });
    socket.on('reconnect', function() {
      console.info('clientSocket reconnected to: ' + options.locationHost);
    });
    socket.on('error', function(err) {
      console.error('clientSocket error: ', err);
    });

    socket.on('initial', function(message) {
      self._updateData(message, 'initial');
    });
    socket.on('update', function(message) {
      self._updateData(message, 'update');
    });

    if (opt.socketRoom) {
      options.socketRoom = opt.socketRoom;
      self._setup(options)
    }
    else if (options.socketRoom) {
      self._setup(options)
    }
  }
}

self.setupConnection = function(opt) {
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
  if (!cache) {
    cache = new ClientCache();
  }
  cache.append(message.values, noHeap);
}

self._updateClient = function(message) {
  var ret = {};

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
       .then( ret => {
        //  console.log(ret);
       } )
       .catch( err => {
        //  console.log(err); 
       });
  }
}

self.request = function(opt) {
  if (opt.func && opt.messageId && cache[opt.func]) {
    cache[opt.func](opt.arg)
      .then( (res) => {
        self.postMessage({
          messageId: opt.messageId,
          response: res
        });
      })
      .catch( (err) => {
        console.warn(err);
        self.postMessage({
          messageId: messageId,
          response: {}
        });
      });
  } else { // return, to remove EventListener
    self.postMessage({
      messageId: messageId,
      response: {}
    });
  }
}
