importScripts('/scripts/idb.js'),self.Promise&&self.Promise.all||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js'),function(){function a(b,c,d){this.mount=b,this.indexKey=c,this.options=d,this.dbPromise=idb.open(b,1,function(e){e.createObjectStore(this.indexKey,this.options)}.bind(this))}a.prototype={get:function(b,c,d,e){return this.dbPromise.then(function(g){var h=g.transaction(this.indexKey),j=[],k=h.objectStore(this.indexKey),m=null;return Number.isFinite(b)&&Number.isFinite(c)&&(m=IDBKeyRange.bound(b,c)),k.iterateCursor.call(k,m,e||'next',function(n){!n||j.length>=d||(j.push(n.value),n.continue())}),h.complete.then(function(){var n={};return n[this.mount]=j,n}.bind(this))}.bind(this)).catch(function(g){console.log(g);var h={};return h[this.mount]=[],h})},set:function(b){return this.dbPromise.then(function(c){for(var d=c.transaction(this.indexKey,'readwrite'),e=b.length-1;0<=e;e--)d.objectStore(this.indexKey).put(b[e],b[e][this.indexKey]);return d.complete}.bind(this)).catch(function(c){return console.log(c),{}})},last:function(b,c,d){return this.get(b,c,d||1,'prev')},first:function(b,c,d){return this.get(b,c,d||1)},range:function(){return new Promise(function(b,c){var d=[null,null];this.first(null,null,1).then(function(e){d[0]=e[this.mount][0][this.indexKey],this.last(null,null,1).then(function(g){d[1]=g[this.mount][0][this.indexKey],b(d)}.bind(this)).catch(c)}.bind(this)).catch(c)}.bind(this))},delete:function(b){return this.dbPromise.then(function(c){for(var d=c.transaction(this.indexKey,'readwrite'),e=b.length-1;0<=e;e--)void 0!==b[e][this.indexKey]&&d.objectStore(this.indexKey).delete(b[e][this.indexKey]);return d.complete}.bind(this)).catch(function(c){return console.log(c),{}})},clear:function(){return this.dbPromise.then(function(b){var c=b.transaction(this.indexKey,'readwrite');return c.objectStore(this.indexKey).clear(),c.complete}.bind(this)).catch(function(b){return console.log(b),{}})},getAll:function(){return this.dbPromise.then(function(c){var d=c.transaction(this.indexKey),e=d.objectStore(this.indexKey),g={};g[this.mount]=[];var h=[];return e.getAll().then(function(j){h=j}),d.complete.then(function(){return g[this.mount]=h,g}.bind(this))}.bind(this)).catch(function(c){console.log(c);var d={};return d[this.mount]=[],d})},getAllKeys:function(){return this.dbPromise.then(function(b){var c=b.transaction(this.indexKey),d=[],e=c.objectStore(this.indexKey);return(e.iterateKeyCursor||e.iterateCursor).call(e,function(g){g&&(d.push(g.key),g.continue())}),c.complete.then(function(){var g={};return g[this.mount]=d,g}.bind(this))}.bind(this)).catch(function(b){console.log(b);var c={};return c[this.mount]=[],c})}},self&&(self.ClientDatabase=a)}();