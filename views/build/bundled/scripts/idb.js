'use strict';self.Promise||importScripts('/bower_components/es6-promise/es6-promise.auto.min.js'),function(){function a(q){return Array.prototype.slice.call(q)}function b(q){return new Promise(function(r,s){q.onsuccess=function(){r(q.result)},q.onerror=function(){s(q.error)}})}function c(q,r,s){var t,u=new Promise(function(v,w){t=q[r].apply(q,s),b(t).then(v,w)});return u.request=t,u}function d(q,r,s){var t=c(q,r,s);return t.then(function(u){return u?new j(u,t.request):void 0})}function e(q,r,s){s.forEach(function(t){Object.defineProperty(q.prototype,t,{get:function(){return this[r][t]},set:function(u){this[r][t]=u}})})}function f(q,r,s,t){t.forEach(function(u){u in s.prototype&&(q.prototype[u]=function(){return c(this[r],u,arguments)})})}function g(q,r,s,t){t.forEach(function(u){u in s.prototype&&(q.prototype[u]=function(){return this[r][u].apply(this[r],arguments)})})}function h(q,r,s,t){t.forEach(function(u){u in s.prototype&&(q.prototype[u]=function(){return d(this[r],u,arguments)})})}function i(q){this._index=q}function j(q,r){this._cursor=q,this._request=r}function k(q){this._store=q}function l(q){this._tx=q,this.complete=new Promise(function(r,s){q.oncomplete=function(){r()},q.onerror=function(){s(q.error)},q.onabort=function(){s(q.error)}})}function m(q,r,s){this._db=q,this.oldVersion=r,this.transaction=new l(s)}function n(q){this._db=q}e(i,'_index',['name','keyPath','multiEntry','unique']),f(i,'_index',IDBIndex,['get','getKey','getAll','getAllKeys','count']),h(i,'_index',IDBIndex,['openCursor','openKeyCursor']),e(j,'_cursor',['direction','key','primaryKey','value']),f(j,'_cursor',IDBCursor,['update','delete']),['advance','continue','continuePrimaryKey'].forEach(function(q){q in IDBCursor.prototype&&(j.prototype[q]=function(){var r=this,s=arguments;return Promise.resolve().then(function(){return r._cursor[q].apply(r._cursor,s),b(r._request).then(function(t){return t?new j(t,r._request):void 0})})})}),k.prototype.createIndex=function(){return new i(this._store.createIndex.apply(this._store,arguments))},k.prototype.index=function(){return new i(this._store.index.apply(this._store,arguments))},e(k,'_store',['name','keyPath','indexNames','autoIncrement']),f(k,'_store',IDBObjectStore,['put','add','delete','clear','get','getAll','getKey','getAllKeys','count']),h(k,'_store',IDBObjectStore,['openCursor','openKeyCursor']),g(k,'_store',IDBObjectStore,['deleteIndex']),l.prototype.objectStore=function(){return new k(this._tx.objectStore.apply(this._tx,arguments))},e(l,'_tx',['objectStoreNames','mode']),g(l,'_tx',IDBTransaction,['abort']),m.prototype.createObjectStore=function(){return new k(this._db.createObjectStore.apply(this._db,arguments))},e(m,'_db',['name','version','objectStoreNames']),g(m,'_db',IDBDatabase,['deleteObjectStore','close']),n.prototype.transaction=function(){return new l(this._db.transaction.apply(this._db,arguments))},e(n,'_db',['name','version','objectStoreNames']),g(n,'_db',IDBDatabase,['close']),['openCursor','openKeyCursor'].forEach(function(q){[k,i].forEach(function(r){r.prototype[q.replace('open','iterate')]=function(){var s=a(arguments),t=s[s.length-1],u=this._store||this._index,v=u[q].apply(u,s.slice(0,-1));v.onsuccess=function(){t(v.result)}}})}),[i,k].forEach(function(q){q.prototype.getAll||(q.prototype.getAll=function(r,s){var t=this,u=[];return new Promise(function(v){t.iterateCursor(r,function(w){return w?(u.push(w.value),void 0!==s&&u.length==s?void v(u):void w.continue()):void v(u)})})})});var o={open:function(q,r,s){var t=c(indexedDB,'open',[q,r]),u=t.request;return u.onupgradeneeded=function(v){s&&s(new m(u.result,v.oldVersion,u.transaction))},t.then(function(v){return new n(v)})},delete:function(q){return c(indexedDB,'deleteDatabase',[q])}};'undefined'===typeof module?self.idb=o:module.exports=o}();