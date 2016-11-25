function WebvisualClient() {
  this.nodes = new Map();
  this.mobile = this._testMobile();

  this.locationHost = '';
  this.socketName = '';
  this.socketRoom = '';

  this.online = false;
  this._lastMessageId = 0;
}

WebvisualClient.prototype = {

  createSocketConnection: function(locationHost, socketName) {
    if (locationHost && socketName) {

      this.locationHost = locationHost;
      this.socketName = socketName;

      if (!this.webworker) {
        this.webworker = new Worker('/scripts/webvisual-worker.js');

        this.webworker.onmessage = function(e) {
          if (e.data && !e.data.messageId) {
            this.updateNodes(e.data);
          }
        }.bind(this)
      }
      this.webworker.postMessage({
        createSocketConnection: {
          locationHost: this.locationHost,
          socketName: this.socketName
        }
      })
    }
  },

  setupConnection: function(socketRoom) {
    if (socketRoom) {
      this.socketRoom = socketRoom;

      if (!this.webworker)
        return;

      this.webworker.postMessage({
        setupConnection: {
          socketRoom: this.socketRoom,
          mobile: this.mobile
        }
      })
    }
  },

  assignElement: function(element) {
    var mount = element.item.mount;

    if (!mount)
      return;

    if (!this.nodes.has(mount)) {
      this.nodes.set(mount, new Set());
    }

    this.nodes.get(mount)
        .add(element);

    if (!element._initialized)
      element.requestLastValue(mount)
             .then( function(values) {
               element.insertValues(values);
             })
             .catch( function() {} );
  },

  retractElement: function(element, item) {
    if (!element || !item || !item.mount)
      return;

    var mount = item.mount; // item(.mount) is used, because properties might be already deleted from element

    element._initialized = false;
    
    delete element.values;

    if (!this.nodes.has(mount))
      return;

    this.nodes.get(mount)
      .delete(element);

  },
  //
  // initializeData: function(items) {
  //   if (items) {
  //     this.cache.clear();
  //     this.nodes.clear();
  //     items.forEach(function(item) {
  //       this.cache.add(item.mount);
  //     }.bind(this));
  //     this._initialized = true;
  //   }
  // },

  updateNodes: function(message) {
    if (!message) return;

    requestAnimationFrame( function() {

      for (var mount in message) {

        if (!this.nodes.has(mount)) {
          // console.warn('no Nodes for Update', mount);
          continue;
        }

        if (message[mount].values) {
          this.nodes.get(mount)
            .forEach(function(element, key) {
              element.insertValues(message[mount].values);
            });
          message[mount].values.length = 0;
        }

        if (message[mount].splices) {
          this.nodes.get(mount)
            .forEach(function(element, key) {
              element.spliceValues(message[mount].splices);
            });
          message[mount].splices.length = 0;
        }
      }

    }.bind(this));

  },

  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return (/[mM]obi/i.test(ua) || /[tT]abvar/i.test(ua) || /[aA]ndroid/i.test(ua));
  }
}

window.Webvisual = new WebvisualClient();
