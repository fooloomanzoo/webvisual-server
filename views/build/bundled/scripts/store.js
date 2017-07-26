importScripts('/scripts/cache.js'),importScripts('/scripts/database.js'),self.Promise&&self.Promise.all||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js'),function(){function c(d,f,g){this.type=d,this.indexKey=f,this.options=g,this._store=new Map}c.prototype={has:function(d){return this._store.has(d)},get:function(d){return this._store.get(d)},add:function(d){this._store.has(d)||this._store.set(d,this._newStoreKey(d))},_newStoreKey:function(d){switch(this.type){case'database':return new ClientDatabase(d,this.indexKey,this.options);case'cache':return new ClientCache(d,this.indexKey,this.options);}},clear:function(){this._store.forEach(function(d){d.clear()}),this._store.clear()},place:function(d){for(let f in d){this.add(f);try{this._store.get(f).set(d[f])}catch(g){console.log(f,g)}}},delete:function(d){for(let f in d){this.add(f);try{this._store.get(f).delete(d[f])}catch(g){console.log(f,g)}}},request:function(d){const f={};return new Promise(function(g){if(d.mounts===void 0||!Array.isArray(d.mounts))this._store.forEach(function(h,j){f[j]=h.get(d.start,d.end,d.length)});else for(let h=0;h<d.mounts.length;h++)f[d.mounts[h]]=[],this._store.has(d.mounts[h])&&(f[d.mounts[h]]=this._store.get(d.mounts[h]).get(d.start,d.end,d.length));g(f)}.bind(this))},min:function(d){return this._operation('min',this._min,d.key,d.mounts)},max:function(d){return this._operation('max',this._max,d.key,d.mounts)},first:function(d){return this._operation('first',this._min,'x',d.mounts)},last:function(d){return this._operation('last',this._max,'x',d.mounts)},range:function(d){return d.key?new Promise(function(f){f([this.min(d),this.max(d)])}.bind(this)):new Promise(function(f){f([this.first(d),this.last(d)])}.bind(this))},_operation:function(d,f,g,h){const j=[];if(Array.isArray(h))for(let k=0;k<h.length;k++)this._store.has(h[k])&&j.push(this._store.get(h[k])[d](g));else this._store.forEach(function(k,l){l[d](g).then(function(m){j.push(m)}).catch(function(m){console.log(m)})});return f(j,g)},_max:function(d){let g,h,f=-1;const j=d.length;for(;++f<j;)if(null!==(h=d[f])&&h>=h){g=h;break}for(;++f<j;)null!==(h=d[f])&&g<h&&(g=h);return g},_min:function(d){let g,h,f=-1;const j=d.length;for(;++f<j;)if(null!==(h=d[f])&&h>=h){g=h;break}for(;++f<j;)null!==(h=d[f])&&g>h&&(g=h);return g}},self?self.Store=c:window&&(window.Store=c)}();