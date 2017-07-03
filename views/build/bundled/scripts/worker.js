try{importScripts('/socket.io/socket.io.js'),importScripts('/polyfills/polyfills.js'),importScripts('/scripts/store.js'),self.Promise&&self.Promise.all||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js')}catch(a){console.log(a)}self.IOSocket=function(){this.socket=null,this.locationHost='',this.nameSpace='',this.socketRoom='',this.mobile=!1},self.IOSocket.prototype={connect:function(a){if(!this.socket){if(this.locationHost=a.locationHost||this.locationHost,this.nameSpace=a.nameSpace||this.nameSpace,!this.locationHost)return;this.socket=io.connect(this.locationHost+'/'+this.nameSpace,{multiplex:!1}),this.socket.on('connect',function(){console.info('clientSocket connected to: '+this.locationHost),self.postMessage({type:'status',status:'connected'}),this._connectionLostAt&&this.request({from:this._connectionLostAt})}.bind(this)),this.socket.on('disconnect',function(){console.warn('clientSocket disconnected to: '+this.locationHost),this._connectionLostAt=+new Date,self.postMessage({type:'status',status:'disconnected'})}.bind(this)),this.socket.on('reconnect',function(){console.info('clientSocket reconnected to: '+this.locationHost),self.postMessage({type:'status',status:'connected'})}.bind(this)),this.socket.on('error',function(b){console.error('clientSocket error: ',b),this._connectionLostAt=+new Date,self.postMessage({type:'status',status:'sync-problem'})}.bind(this)),this.socket.on('initial',function(b){this.initialized=!0,self._updateData(b,'initial')}.bind(this)),this.socket.on('update',function(b){self._updateData(b,'update')}),this.socket.on('reset',function(){self._clearCache(),self._clearDatabase()}),this.socket.on('reload',function(){console.info('page reload'),self.postMessage({type:'reload'})}),this.socket.on('request',function(b){b&&b.messageId&&self.postMessage({type:'request',messageId:b.messageId,response:b.values||[]})}),a.socketRoom?(this.socketRoom=a.socketRoom,this.setup(a)):this.socketRoom&&this.setup(a)}},setup:function(a){if(!this.socket)return void this.connect(a);if(this.socket&&a.socketRoom){var b=a.socketRoom.split('/')[0],c=a.socketRoom.split('/')[1];if(!b||!c)return;this.socketRoom=a.socketRoom,this.mobile=a.mobile||!1,this.socket.emit('setup',{room:this.socketRoom,mobile:this.mobile})}},disconnect:function(){this.socket&&this.socket.disconnect&&(this.socket.disconnect(),this.socket=null)},request:function(a){this.socket.emit('request',{room:this.socketRoom,mounts:a.mounts,messageId:a.messageId,from:a.from,to:a.to,limit:a.limit})}};var CacheStore=new Store('cache','x'),DatabaseStore=new Store('database','x'),mountDB=new ClientDatabase('mounts','mounts',{autoIncrement:!0}),Socket=new IOSocket;mountDB.getAll().then(function(a){a&&a.mounts&&a.mounts.forEach(function(b){DatabaseStore.add(b)})}).catch(function(a){console.log(a)}),self.ononline=function(){console.log('Your worker is now online')},self.onoffline=function(){console.log('Your worker is now offline')},self.onmessage=function(a){switch(a.data.target){case'socket':Socket[a.data.operation]&&Socket[a.data.operation](a.data.args);break;case'database':DatabaseStore[a.data.operation]?DatabaseStore[a.data.operation](a.data.args).then(function(b){console.log(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:b})}).catch(function(b){b&&console.warn(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}})}):self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}});break;case'cache':CacheStore[a.data.operation]?CacheStore[a.data.operation](a.data.args).then(function(b){self.postMessage({type:'request',messageId:a.data.args.messageId,response:b})}).catch(function(b){b&&console.warn(b),self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}})}):self.postMessage({type:'request',messageId:a.data.args.messageId,response:{}});}},self._updateData=function(a,b){if(Array.isArray(a))for(var c=0;c<a.length;c++)this._updateCache(a[c]),this._updateClient(a[c],b);else a.values&&(this._updateCache(a),this._updateClient(a,b))},self._updateCache=function(a){CacheStore.place(a.values)},self._clearCache=function(){CacheStore.clear()},self._updateClient=function(a,b){var c={type:b||'update',values:{},splices:{}};for(var d in a.values)c.splices[d]=CacheStore.get(d).splices,c.values[d]=CacheStore.get(d).heap;self.postMessage(c),self._updateDatabase(c)},self._updateDatabase=function(a){a.values&&DatabaseStore.place(a.values),a.splices&&DatabaseStore.delete(a.splices)},self._clearDatabase=function(){DatabaseStore.clear()};