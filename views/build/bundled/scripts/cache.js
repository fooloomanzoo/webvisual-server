(function(){function c(d,e,f){this.mount=d,this.indexKey=e||"x",this.maxCount=f&&f.maxCount?f.maxCount:1800,this.values=[],this._splices=[],Object.defineProperty(this,"splices",{get:function(){return this._splices.splice(0,this._splices.length)},enumerable:!1,configurable:!0}),this._heap=[],Object.defineProperty(this,"heap",{get:function(){return this._heap.splice(0,this._heap.length)},enumerable:!1,configurable:!0})}c.prototype={clear:function(){this._splices.length=0,this._heap.length=0,this.values.length=0},get:function(d,e,f){if(Number.isFinite(d)&&Number.isFinite(e)){for(var g=this.values.length-1;0<=g&&!(this.values[g][this.indexKey]>=d);g--);for(var h=0;h<this.values.length&&!(this.values[h][this.indexKey]<=e);h++);return Number.isFinite(f)&&h-g>f&&(g=h-f),this.values.slice(g,h)}var g=Number.isFinite(f)&&0<=f&&f<this.values.length?this.values.length-f-1:0;return this.values.slice(g)},set:function(d){d.length>this.maxCount&&(d=d.slice(d.length-this.maxCount,d.length)),this._heap=this._heap.concat(d),this.values=0===this.values.length?d:this.values.concat(d),this.values.length>this.maxCount&&(this._splices=this._splices.concat(this.values.splice(0,this.values.length-this.maxCount))),this.values.sort(this.compareFn(this.indexKey))},range:function(d){return new Promise(function(e){d===void 0?e([this.first(),this.last()]):e([this.min(d),this.max(d)])}.bind(this))},last:function(){return this.values[this.values.length-1][this.indexKey]},first:function(){return this.values[0][this.indexKey]},max:function(d){for(var f,g,e=-1,h=this.values.length;++e<h;)if(null!==(g=this.values[e][d])&&g>=g){f=g;break}for(;++e<h;)null!==(g=this.values[e][d])&&f<g&&(f=g);return f},min:function(d){for(var f,g,e=-1,h=this.values.length;++e<h;)if(null!==(g=this.values[e][d])&&g>=g){f=g;break}for(;++e<h;)null!==(g=this.values[e][d])&&f>g&&(f=g);return f},compareFn:function(d,e){return e=e||1,function(f,g){return f[d]<g[d]?-1*e:f[d]>g[d]?1*e:0}}},self&&(self.ClientCache=c)})();