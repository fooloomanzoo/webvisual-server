importScripts('/socket.io/socket.io.js');
importScripts('/scripts/cache.js');

var socket
  , options = {}
  , cache = new ClientCache();

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
      self.updateData(message);
    });
    socket.on('update', function(message) {
      self.updateData(message);
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
  if (opt.socketRoom) {
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

self.updateData = function(message) {
  if (Array.isArray(message)) // if message is an Array
    for (var i = 0; i < message.length; i++) {
    this.updateCache(message[i]);
    this.updateClient(message[i]);

    // this.updateDatabase(message[i]);
  }
  else if (message.values) { // if message is a single Object
    this.updateCache(message);
    this.updateClient(message);
    // this.updateDatabase(message);
  }
}

self.updateCache = function(message, noHeap) {
  if (!cache) {
    cache = new ClientCache();
  }
  cache.append(message.values, noHeap);
}

self.updateClient = function(message) {
  var ret = {};

  for (var mount in message.values) {
    ret[mount] = {};
    ret[mount].splices = this.cache.get(mount).splices;
    ret[mount].values = this.cache.get(mount).heap;
  }

  self.postMessage(ret)
}

self.request = function(opt) {
  var values = []
    , messageId;

  for (var func in opt) {
    if (func === 'messageId')
      continue;
    if (cache[func]) {
      messageId = opt[func].messageId;
      values = cache[func](opt[func]);
      self.postMessage({
        messageId: messageId,
        values: values
      });
    }
  }
}

self.updateDatabase = function() {}
