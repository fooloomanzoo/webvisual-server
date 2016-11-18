function WebvisualTools() {
  this.sockets = new Map();
  this.cache = new ClientCache();
  this.nodes = new Map();
  this.mobile = this._testMobile();
}

WebvisualTools.prototype = {

  assignElement: function(element) {
    var mount = element.item.mount;

    if (!mount)
      return;

    if (!element._initialized)
      element.insertValues();

    if (!this.nodes.has(mount)) {
      this.nodes.set(mount, new Set());
    }

    this.nodes.get(mount)
      .add(element);

    Object.defineProperty(element, "values", {
      configurable: true,
      enumerable: true,
      get: function() {
        var v = Webvisual.cache.get(mount);
        if (v) {
          return v.values;
        } else {
          return [];
        }
      }
    });
  },

  retractElement: function(element, item) {
    var mount = item.mount; // item(.mount) is used, because properties might be already deleted from element

    if (!mount)
      return;

    delete element.values;

    if (!this.nodes.has(mount))
      return;

    this.nodes.get(mount)
      .delete(element);
  },

  initializeData: function(items) {
    if (items) {
      this.cache.clear();
      this.nodes.clear();
      items.forEach(function(item) {
        this.cache.add(item.mount);
      }.bind(this));
      this._initialized = true;
    }
  },

  updateData: function(message) {
    if (Array.isArray(message)) // if message is an Array
      for (var i = 0; i < message.length; i++) {
      this.updateCache(message[i]);
      this.updateNodes(message[i]);

      // this.updateDatabase(message[i]);
    }
    else { // if message is a single Object
      this.updateCache(message);
      this.updateNodes(message);
      // this.updateDatabase(message);
    }
  },

  updateCache: function(message, noHeap) {
    this.cache.append(message.values, noHeap);
  },

  updateNodes: function(message) {
    if (!message.values) return;

    requestAnimationFrame( function() {
      var splices = []
        , heap = [];

      for (var mount in message.values) {

        if (!this.nodes.has(mount)) {
          // console.warn('no Nodes for Update', mount);
          continue;
        }

        splices = this.cache.get(mount)
          .splices;
        heap = this.cache.get(mount)
          .heap;

        this.nodes.get(mount)
          .forEach(function(element, key) {
            // console.log('update', element.item.id, element.nodeName);
            element.insertValues(heap);
            element.spliceValues(splices);
          });

        splices.length = 0;
        heap.length = 0;
      }
    }.bind(this));

  },

  updateDatabase: function() {

  },

  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return (/[mM]obi/i.test(ua) || /[tT]abvar/i.test(ua) || /[aA]ndroid/i.test(ua));
  }
}

window.Webvisual = new WebvisualTools();
