function WebvisualTools() {
  this.sockets = new Map();
  this.cache = undefined;
  this.nodes = new Map();
  this.mobile = this._testMobile();
}

WebvisualTools.prototype = {
  assignElement: function(element) {
    var id = element.id;

    if (!this.nodes.has(id))
      this.nodes.set(id, new Set());

    this.nodes.get(id).add(element);
  },
  retractElement: function(element) {
    var id = element.id;

    if (!this.nodes.has(id))
      return;

    this.nodes.get(id).delete(element);
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
  updateCache: function(message) {
    this.cache.append(message.values);
  },
  updateNodes: function(message) {
		if (!message.values) return;

		var splices = []
      , heap = [];

		for (var id in message.values) {
      if (!this.nodes.has(id)) {
        console.warn('no Nodes for Update');
        continue;
      }
			splices = this.cache[id].splices;
			heap = this.cache[id].heap;
      this.nodes.get(id).forEach( function(element) {
        element.insertValues(heap);
        element.spliceValues(splices);
      })
			splices.length = 0;
			heap.length = 0;
		}
	},
  updateDatabase: function() {

  },
  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return ( /[mM]obi/i.test(ua) || /[tT]ablet/i.test(ua) || /[aA]ndroid/i.test(ua) );
  }
}

window.Webvisual = new WebvisualTools();
