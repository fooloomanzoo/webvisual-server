try{importScripts('/socket.io/socket.io.js'),importScripts('/polyfills/polyfills.js'),importScripts('/scripts/store.js'),self.Promise&&self.Promise.all||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js')}catch(a){console.log(a)}var IOSocket=function(){this.socket=null,this.locationHost='',this.nameSpace='',this.socketRoom='',this.mobile=!1};IOSocket.prototype={connect:function(b){if(!this.socket){if(this.locationHost=b.locationHost||this.locationHost,this.nameSpace=b.nameSpace||this.nameSpace,!this.locationHost)return;this.socket=io.connect(this.locationHost+'/'+this.nameSpace,{multiplex:!1}),this.socket.on('connect',function(){console.info('clientSocket connected to: '+this.locationHost),self.postMessage({type:'status',status:'connected'}),this._connectionLostAt&&this.request({from:this._connectionLostAt})}.bind(this)),this.socket.on('disconnect',function(){console.warn('clientSocket disconnected to: '+this.locationHost),this._connectionLostAt=+new Date,self.postMessage({type:'status',status:'disconnected'})}.bind(this)),this.socket.on('reconnect',function(){console.info('clientSocket reconnected to: '+this.locationHost),self.postMessage({type:'status',status:'connected'})}.bind(this)),this.socket.on('error',function(c){console.error('clientSocket error: ',c),this._connectionLostAt=+new Date,self.postMessage({type:'status',status:'sync-problem'})}.bind(this)),this.socket.on('initial',function(c){this.initialized=!0,self._updateData(c,'initial')}.bind(this)),this.socket.on('update',function(c){self._updateData(c,'update')}),this.socket.on('reset',function(){self._clearCache(),self._clearDatabase()}),this.socket.on('reload',function(){console.info('page reload'),self.postMessage({type:'reload'})}),this.socket.on('request',function(c){c&&c.messageId&&self.postMessage({type:'request',messageId:c.messageId,response:c.values||[]})}),b.socketRoom?(this.socketRoom=b.socketRoom,this.setup(b)):this.socketRoom&&this.setup(b)}},setup:function(b){if(!this.socket)return void this.connect(b);if(this.socket&&b.socketRoom){var c=b.socketRoom.split('/')[0],d=b.socketRoom.split('/')[1];if(!c||!d)return;this.socketRoom=b.socketRoom,this.mobile=b.mobile||!1,this.socket.emit('setup',{room:this.socketRoom,mobile:this.mobile})}},disconnect:function(){this.socket&&this.socket.disconnect&&(this.socket.disconnect(),this.socket=null)},request:function(b){this.socket.emit('request',{room:this.socketRoom,mounts:b.mounts,messageId:b.messageId,from:b.from,to:b.to,limit:b.limit})}};var CacheStore=new Store('cache','x'),DatabaseStore=new Store('database','x'),Socket=new IOSocket;self.ononline=function(){console.log('Your worker is now online')},self.onoffline=function(){console.log('Your worker is now offline')},self.onmessage=function(a){switch(a.data.target){case'socket':Socket[a.data.operation]&&Socket[a.data.operation](a.data.args);break;case'database':DatabaseStore[a.data.operation]?DatabaseStore[a.data.operation](a.data.args).then(function(b){console.log(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:b})}).catch(function(b){b&&console.warn(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}})}):self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}});break;case'cache':CacheStore[a.data.operation]?CacheStore[a.data.operation](a.data.args).then(function(b){self.postMessage({type:'request',messageId:a.data.args.messageId,response:b})}).catch(function(b){b&&console.warn(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}})}):self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}});}},self._updateData=function(a,b){if(Array.isArray(a))for(var c=0;c<a.length;c++)this._updateCache(a[c]),this._updateClient(a[c],b);else a.values&&(this._updateCache(a),this._updateClient(a,b))},self._updateCache=function(a){CacheStore.place(a.values)},self._clearCache=function(){CacheStore.clear()},self._updateClient=function(a,b){var c={type:b||'update',values:{},splices:{}};for(var d in a.values)c.splices[d]=CacheStore.get(d).splices,c.values[d]=CacheStore.get(d).heap;self.postMessage(c)},self._updateDatabase=function(a){a.values&&DatabaseStore.place(a.values),a.splices&&DatabaseStore.delete(a.splices)},self._clearDatabase=function(){DatabaseStore.clear()};