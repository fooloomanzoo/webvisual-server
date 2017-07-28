importScripts('/scripts/cache.js'),importScripts('/scripts/database.js'),self&&!(self.Promise&&self.Promise.all)&&importScripts('/bower_components/es6-promise/es6-promise.auto.min.js'),function(){function c(d,f,g){this.type=d,this.indexKey=f,this.options=g,this._store=new Map}c.prototype={has:function(f){return this._store.has(f)},get:function(f){return this._store.get(f)},add:function(f){this._store.has(f)||this._store.set(f,this._newStoreKey(f))},_newStoreKey:function(f){switch(this.type){case'database':return new ClientDatabase(f,this.indexKey,this.options);case'cache':return new ClientCache(f,this.indexKey,this.options);}},clear:function(){this._store.forEach(function(f){f.clear()}),this._store.clear()},place:function(f){for(var g in f){this.add(g);try{this._store.get(g).set(f[g])}catch(h){console.log(g,h)}}},delete:function(f){for(var g in f){this.add(g);try{this._store.get(g).delete(f[g])}catch(h){console.log(g,h)}}},request:function(f){var g={};return new Promise(function(h){if(f.mounts===void 0||!Array.isArray(f.mounts))this._store.forEach(function(k,l){g[l]=k.get(f.start,f.end,f.length)});else for(var j=0;j<f.mounts.length;j++)g[f.mounts[j]]=[],this._store.has(f.mounts[j])&&(g[f.mounts[j]]=this._store.get(f.mounts[j]).get(f.start,f.end,f.length));h(g)}.bind(this))},min:function(f){return this._operation('min',this._min,f.key,f.mounts)},max:function(f){return this._operation('max',this._max,f.key,f.mounts)},first:function(f){return this._operation('first',this._min,'x',f.mounts)},last:function(f){return this._operation('last',this._max,'x',f.mounts)},range:function(f){return f.key?new Promise(function(g){g([this.min(f),this.max(f)])}.bind(this)):new Promise(function(g){g([this.first(f),this.last(f)])}.bind(this))},_operation:function(f,g,h,j){var k=[];if(Array.isArray(j))for(var l=0;l<j.length;l++)this._store.has(j[l])&&k.push(this._store.get(j[l])[f](h));else this._store.forEach(function(m,o){o[f](h).then(function(p){k.push(p)}).catch(function(p){console.log(p)})});return g(k,h)},_max:function(f){for(var h,j,g=-1,k=f.length;++g<k;)if(null!==(j=f[g])&&j>=j){h=j;break}for(;++g<k;)null!==(j=f[g])&&h<j&&(h=j);return h},_min:function(f){for(var h,j,g=-1,k=f.length;++g<k;)if(null!==(j=f[g])&&j>=j){h=j;break}for(;++g<k;)null!==(j=f[g])&&h>j&&(h=j);return h}},self?self.Store=c:window&&(window.Store=c)}();