function WebvisualClient() {
  this.nodes = new Map();
  this.mobile = this._testMobile();

  this.locationHost = '';
  this.socketName = '';
  this.socketRoom = '';
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

    if (!element._initialized && element.uniqueid)
      element.requestLastValue(mount, element.uniqueid)
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

    if (!this.nodes.has(mount))
      return;

    this.nodes.get(mount)
      .delete(element);
  },

  updateNodes: function(message) {
    if (!message || message.hasOwnProperty('messageId')) return;

    var nodes = this.nodes;

    requestAnimationFrame(processMessage);

    function processMessage(taskStartTime) {
      var v, mount, taskFinishTime, nodeList;
      do {
        mount = Object.keys(message)[0];
        v = message[mount];
        nodeList = nodes.get(mount);

        if (nodeList) {
          if (v.values) {
            var values = v.values;
            nodeList.forEach(function(element) {
              element.insertValues(values);
            });
          }

          if (v.splices) {
            var splices = v.splices;
            nodeList.forEach(function(element) {
              element.spliceValues(splices);
            });
          }
        }

        nodeList = undefined;
        v = undefined;
        delete message[mount];
        taskFinishTime = window.performance.now();
      } while (taskFinishTime - taskStartTime < 12);

      if (Object.keys(message).length > 0)
        requestAnimationFrame(processMessage);

    };

  },

  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return (/[mM]obi/i.test(ua) || /[tT]abvar/i.test(ua) || /[aA]ndroid/i.test(ua));
  }
}

window.Webvisual = new WebvisualClient();
