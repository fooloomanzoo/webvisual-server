(function(){function c(d,e,f){this.mount=d,this.indexKey=e||"x",this.maxCount=f&&f.maxCount?f.maxCount:3e4,this.values=[],this._splices=[],Object.defineProperty(this,"splices",{get:function(){return this._splices.splice(0,this._splices.length)},enumerable:!1,configurable:!0}),this._heap=[],Object.defineProperty(this,"heap",{get:function(){return this._heap.splice(0,this._heap.length)},enumerable:!1,configurable:!0})}c.prototype={clear:function(){this._splices.length=0,this._heap.length=0,this.values.length=0},get:function(e,f,g){if(Number.isFinite(e)&&Number.isFinite(f)){var h,j;for(h=this.values.length-1;0<=h&&!(this.values[h][this.indexKey]>=e);h--);for(j=0;j<this.values.length&&!(this.values[j][this.indexKey]<=f);j++);return Number.isFinite(g)&&j-h>g&&(h=j-g),this.values.slice(h,j)}var k=Number.isFinite(g)&&0<=g&&g<this.values.length?this.values.length-g-1:0;return this.values.slice(k)},set:function(e){e.length>this.maxCount&&(e=e.slice(e.length-this.maxCount,e.length)),this._heap=this._heap.concat(e),this.values=0===this.values.length?e:this.values.concat(e),this.values.length>this.maxCount&&(this._splices=this._splices.concat(this.values.splice(0,this.values.length-this.maxCount))),this.values.sort(this.compareFn(this.indexKey))},range:function(e){return new Promise(function(f){e===void 0?f([this.first(),this.last()]):f([this.min(e),this.max(e)])}.bind(this))},last:function(){return this.values[this.values.length-1][this.indexKey]},first:function(){return this.values[0][this.indexKey]},max:function(e){for(var g,h,f=-1,j=this.values.length;++f<j;)if(null!==(h=this.values[f][e])&&h>=h){g=h;break}for(;++f<j;)null!==(h=this.values[f][e])&&g<h&&(g=h);return g},min:function(e){for(var g,h,f=-1,j=this.values.length;++f<j;)if(null!==(h=this.values[f][e])&&h>=h){g=h;break}for(;++f<j;)null!==(h=this.values[f][e])&&g>h&&(g=h);return g},compareFn:function(e,f){return f=f||1,function(g,h){return g[e]<h[e]?-1*f:g[e]>h[e]?1*f:0}}},self?self.ClientCache=c:window&&(window.ClientCache=c)})();