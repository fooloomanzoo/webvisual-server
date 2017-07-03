importScripts('/scripts/cache.js'),importScripts('/scripts/database.js'),self.Promise&&self.Promise.all||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js'),function(){function c(d,f,g){this.type=d,this.indexKey=f,this.options=g,this._store=new Map}c.prototype={has:function(d){return this._store.has(d)},get:function(d){return this._store.get(d)},add:function(d){if(!this._store.has(d)){this._store.set(d,this._newStoreKey(d))}},_newStoreKey:function(d){switch(this.type){case'database':return new ClientDatabase(d,this.indexKey,this.options);break;case'cache':return new ClientCache(d,this.indexKey,this.options);}},clear:function(){this._store.forEach(function(d){d.clear()}),this._store.clear()},place:function(d){for(var f in d){this.add(f);try{this._store.get(f).set(d[f])}catch(g){console.log(f,g)}}},delete:function(d){for(var f in d){this.add(f);try{this._store.get(f).delete(d[f])}catch(g){console.log(f,g)}}},request:function(d){var f={};return new Promise(function(g){if(d.mounts===void 0||!Array.isArray(d.mounts))this._store.forEach(function(k){f[v]=k.get(d.start,d.end,d.length)});else for(var j=0;j<d.mounts.length;j++)f[d.mounts[j]]=[],this._store.has(d.mounts[j])&&(f[d.mounts[j]]=this._store.get(d.mounts[j]).get(d.start,d.end,d.length));g(f)}.bind(this))},min:function(d){return this._operation('min',this._min,d.key,d.mounts)},max:function(d){return this._operation('max',this._max,d.key,d.mounts)},first:function(d){return this._operation('first',this._min,'x',d.mounts)},last:function(d){return this._operation('last',this._max,'x',d.mounts)},range:function(d){return d.key?new Promise(function(f){f([this.min(d),this.max(d)])}.bind(this)):new Promise(function(f){f([this.first(d),this.last(d)])}.bind(this))},_operation:function(d,f,g,h){var j=[];if(Array.isArray(h))for(var k=0;k<h.length;k++)this._store.has(h[k])&&j.push(this._store.get(h[k])[d](g));else this._store.forEach(function(l,m){m[d](g).then(function(o){j.push(o)}).catch(function(o){console.log(o)})});return f(j,g)},_max:function(d){for(var g,h,f=-1,j=d.length;++f<j;)if(null!==(h=d[f])&&h>=h){g=h;break}for(;++f<j;)null!==(h=d[f])&&g<h&&(g=h);return g},_min:function(d){for(var g,h,f=-1,j=d.length;++f<j;)if(null!==(h=d[f])&&h>=h){g=h;break}for(;++f<j;)null!==(h=d[f])&&g>h&&(g=h);return g}},self?self.Store=c:window&&(window.Store=c)}();