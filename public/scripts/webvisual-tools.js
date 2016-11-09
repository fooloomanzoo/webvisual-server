function WebvisualTools() {
  this.sockets = new Map();
  this.cache = new ClientCache();
  this.nodes = new Map();
  this.mobile = this._testMobile();
}

WebvisualTools.prototype = {
  assignElement: function(element) {
    var id = element.item.id
      , system = element.item.system
      , facility = element.item.facility;

    if (!id || !system || !facility)
      return;

    var name = facility + '/' + system + '/' + id;

    if (!this.nodes.has(name)) {
      this.nodes.set(name, new Set());
    }

    this.nodes.get(name).add(element);

    Object.defineProperty(element, "values", {
      configurable: true,
      enumerable: true,
      get: function() {
        return Webvisual.cache.get(name).values;
      }
    });
    // initialize values of element
    if (!this.cache.has(name)) {
      this.cache.add(name);
    } else {
      // element.insertValues();
    }
  },

  retractElement: function(element, item) {

    var id = item.id
      , system = item.system
      , facility = item.facility;

    if (!id || !system || !facility)
      return;

    var name = facility + '/' + system + '/' + id;

    this.cache.delete(name);
    delete element.values;
    Object.defineProperty(element, "values", {
      configurable: true,
      enumerable: false,
      get: function() {
        return [];
      }
    });

    if (!this.nodes.has(name))
      return;

    this.nodes.get(name).delete(element);
  },
  init: function() {
    this.cache.clear();
    this.nodes.clear();
  },
  initializeData: function(message) {
		if (Array.isArray(message)) // if message is an Array
			for (var i = 0; i < message.length; i++) {
  			this.updateCache(message[i], true);
  			// this.updateDatabase(message[i]);
  		}
		else { // if message is a single Object
			this.updateCache(message, true);
			// this.updateDatabase(message);
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
    var activePaint = requestAnimationFrame(
      function() {
    		var splices = []
          , heap = [];

    		for (var name in message.values) {

          if (!this.nodes.has(name)) {
            console.warn('no Nodes for Update');
            continue;
          }

    			splices = this.cache.get(name).splices;
    			heap = this.cache.get(name).heap;
          this.nodes.get(name).forEach( function(element, key) {
            // console.log('update', element.item.id, element.nodeName);
            element.insertValues(heap);
            element.spliceValues(splices);
          })
    			splices.length = 0;
    			heap.length = 0;
    		}

        cancelAnimationFrame(activePaint);
      }.bind(this));
	},
  updateDatabase: function() {

  },
  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return ( /[mM]obi/i.test(ua) || /[tT]abvar/i.test(ua) || /[aA]ndroid/i.test(ua) );
  }
}

window.Webvisual = new WebvisualTools();
