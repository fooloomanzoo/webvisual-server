function WebvisualClient() {
  this.nodes = new Map();
  this.mobile = this._testMobile();

  this.locationHost = '';
  this.nameSpace = '';
  this.socketRoom = '';

  this.messageId = 0;
  this.messageMap = {};
}

WebvisualClient.prototype = {

  createSocketConnection: function(locationHost, nameSpace) {
    if (locationHost) {

      this.locationHost = locationHost;
      this.nameSpace = nameSpace;

      if (!this.webworker) {
        this.webworker = new Worker('/scripts/worker.js');

        this.webworker.onmessage = function(e) {
          if (e.data) {
            // console.log(e.data);
            if (e.data.messageId) {
              var resolve = this.messageMap[e.data.messageId];
              if (resolve) {
                // this.messageMap.delete(e.data.messageId);
                delete this.messageMap[e.data.messageId];
                // console.log(e);
                resolve(e.data.response);
              }
            } else {
              switch (e.data.type) {
                case 'initial':
                  this.resetNodes();
                  this.updateNodes(e.data.values, e.data.splices);
                  break;
                case 'update':
                  this.updateNodes(e.data.values, e.data.splices);
                  break;
                case 'status':
                  this.updateStatus(e.data.status);
                  break;
                case 'reload':
                  if (this.reloadJob) {
                    clearTimeout(this.reloadJob);
                    this.reloadJob = null;
                  }
                  this.reloadJob = setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                  break;
              }
            }
          }
        }.bind(this)
      }
      this.webworker.postMessage({
        target: 'socket',
        operation: 'connect',
        args: {
          locationHost: this.locationHost,
          nameSpace: this.nameSpace
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
        target: 'socket',
        operation: 'setup',
        args: {
          socketRoom: this.socketRoom,
          mobile: this.mobile
        }
      });
    }
  },

  disconnect: function() {
    if (this.webworker) {
      this.webworker.postMessage({
        target: 'socket',
        operation: 'disconnect'
      });
    }
  },

  assignStatusNotifications: function(connector) {
    this.statusHandler = connector;
  },

  request: function(req, resolve) {
    this.messageId++;
    this.messageMap[this.messageId] = resolve;
    req.args = req.args || {};
    req.args.messageId = this.messageId;
    this.webworker.postMessage(req);
  },

  updateStatus: function(status) {
    if (this.statusHandler && this.statusHandler.socketStatus !== 'sync-disabled') {
      this.statusHandler.set('socketStatus', status);
    }
  },

  assignElement: function(node) {
    var mount = node.item.mount;

    if (!mount)
      return;

    if (!this.nodes.has(mount)) {
      this.nodes.set(mount, new Set());
    }

    this.nodes.get(mount)
        .add(node);
  },

  retractElement: function(node, item) {
    if (!node || !item || !item.mount)
      return;

    var mount = item.mount; // item(.mount) is used, because properties might be already deleted from node

    node._initialized = false;

    if (!this.nodes.has(mount))
      return;

    this.nodes.get(mount)
      .delete(node);
  },

  updateNodes: function(values, splices) {

    // requestAnimationFrame( function() {
      for (var mount in values) {

        if (this.nodes.has(mount)) {
          this.nodes.get(mount).forEach(function(node) {
            node.spliceValues(splices[mount]);
            node.insertValues(values[mount]);
          });
        }

        delete values[mount];
        delete splices[mount];
      }
    // }.bind(this));

    // var nodes = this.nodes;
    //
    // requestAnimationFrame(processMessage);
    //
    // function processMessage(taskStartTime) {
    //   var v, mount, taskFinishTime, nodeList;
    //   do {
    //     mount = Object.keys(message)[0];
    //     v = message[mount];
    //     nodeList = nodes.get(mount);
    //
    //     if (nodeList) {
    //       if (v.values) {
    //         var values = v.values;
    //         nodeList.forEach(function(node) {
    //           node.insertValues(values);
    //         });
    //       }
    //
    //       if (v.splices) {
    //         var splices = v.splices;
    //         nodeList.forEach(function(node) {
    //           node.spliceValues(splices);
    //         });
    //       }
    //     }
    //
    //     nodeList = undefined;
    //     v = undefined;
    //     delete message[mount];
    //     taskFinishTime = window.performance.now();
    //   } while (taskFinishTime - taskStartTime < 3);
    //
    //   if (Object.keys(message).length > 0)
    //     requestAnimationFrame(processMessage);
    // };
  },

  resetNodes: function() {
    // this.nodes.forEach( function(set) {
    //   set.forEach(function(node) {
    //     // node.resetState();
    //   });
    // })
  },

  _testMobile: function() {
    var ua = window.navigator.userAgent;
    return (/[mM]obi/i.test(ua) || /[tT]abvar/i.test(ua) || /[aA]ndroid/i.test(ua));
  }
}

window.Webvisual = new WebvisualClient();
