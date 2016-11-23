(function() {

	var defaults = {
		size: 5400, // Length of each DataRow (by mount in values)
		is: 'Array', // TODO: +ArrayBuffer
		type: 'Float64', // TODO: TypedArray
		primary: undefined // 'append' or 'prepend'
	};

	function CacheKey(options) {
		// Set Options
		for (var type in options) {
			this[type] = options[type];
		}
		// Merge Defaults
		for (var type in defaults) {
			if (this[type] === undefined)
				this[type] = defaults[type];
		}

		switch (this.is) {
			case 'Array':
				this.setAsArray();
				break;
			case 'ArrayBuffer':
				this.setAsBuffer();
				break;
		}
	}

	CacheKey.prototype = {

		setAsArray: function() {
			this._cache = Array.prototype;
			Object.defineProperty(this, "values", {
				get: function() {
					return this._cache;
				},
				set: function(data) {
					this.append(data);
				},
				enumerable: false,
				configurable: true
			});
			this._splices = Array.prototype;
			Object.defineProperty(this, "splices", {
				get: function() {
					return this._splices.splice(0, this._splices.length);
				},
				enumerable: false,
				configurable: true
			});
			this._heap = Array.prototype;
			Object.defineProperty(this, "heap", {
				get: function() {
					return this._heap.splice(0,this._heap.length);
				},
				enumerable: false,
				configurable: true
			});
		},

		setAsBuffer: function() {
			switch (this.type) {
				case 'Float64':
					break;
			}
		},

		clear: function() {
			this._splices.length = 0; // clear array
			this._heap.length = 0;
			this._cache.length = 0;
		},

		requestLast: function(len) {
			var start = (len >= 0 && len < this._cache.length) ? this._cache.length - len - 1 : 0;
			return this._cache.slice(start);
		},

	  range: function(key) {
	    if (key === undefined)
	      return [this.first, this.last];
	    else
	      return [this.first[key], this.last[key]];
	  },

	  last: function(key) {
	    return this._cache[this._cache.length-1][key];
	  },

	  first: function(key) {
	    return this._cache[0][key];
	  },

	  max: function(key) { // inspired by d3.array
			var i = -1,
		      a,
		      b;
			var n = this._cache.length;

			while (++i < n) if ((b = this._cache[i][key]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = this._cache[i][key]) !== null && a < b) { a = b; }

	    return a;
	  },

	  min: function(key) { // inspired by d3.array
			var i = -1,
		      a,
		      b;
			var n = this._cache.length;

			while (++i < n) if ((b = this._cache[i][key]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = this._cache[i][key]) !== null && a > b) a = b;

	    return a;
	  },

	  compareFn: function(key, order) {
	    order = order || 1;
	    return function (a,b) {
	      return (a[key] < b[key]) ? -1 * order : (a[key] > b[key]) ? 1 * order: 0;
	    }
	  },

		append: function(data, noHeap) {
			var len = data.length;
			if (len > this.size)
				data = data.slice(len - this.size, len);
			if (!noHeap)
				this._heap = this._heap.concat(data);
			if (this._cache.length === 0)
				this._cache = data;
			else
				this._cache = this._cache.concat(data);
			if (this._cache.length > this.size)
				this._splices = this._splices.concat(this._cache.splice(0, this._cache.length - this.size));
	    if (this.primary)
	      this._cache.sort(this.compareFn(this.primary));
		}
	}

	function ClientCache(options) {
		// Set Options
		this.options = options;
		this._cache = new Map();
	}

	ClientCache.prototype = {

		clear: function() {
			this._cache.forEach( function(value, key) {
        value.clear();
				delete this[key];
			}.bind(this))
			this._cache.clear();
		},

		requestLast: function(opt) {
      var mounts = opt.mounts
        , len = opt.length || 1;

			if (mounts === undefined || !Array.isArray(mounts)) {
        var ret = {};
				this._cache.forEach( function(value, key) {
					ret[v] = value.requestLast(len);
				})
        return ret;
			} else if (mounts.length === 1) {
        if (this._cache.has(mounts[0]))
          return this._cache.get(mounts[0])
                            .requestLast(len);
        else return [];
			} else {
        var ret = {};
				for (var i in mounts) {
					if (this._cache.has(mounts[i])) {
						ret[mounts[i]] = this._cache.get(mounts[i])
                                        .requestLast(len);
					}
				}
        return ret;
			}
		},

		has: function(mount) {
			return this._cache.has(mount);
		},

		get: function(mount) {
			return this._cache.get(mount);
		},

		add: function(mount) {
			this._cache.set(mount, new CacheKey(this.options));
		},

		delete: function(mount) {
      if (this[mount])
        delete this[mount];
      if (!this._cache.has(mount))
        return;
			this._cache.get(mount).clear();
			return this._cache.delete(mount);
		},

		_max: function(array) { // inspired by d3.array
			var i = -1,
		      a,
		      b;
			var n = array.length;

			while (++i < n) if ((b = array[i]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = array[i]) !== null && a < b) a = b;

	    return a;
	  },

	  _min: function(array) { // inspired by d3.array
			var i = -1,
		      a,
		      b;
			var n = array.length;

			while (++i < n) if ((b = array[i]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = array[i]) !== null && a > b) a = b;

	    return a;
	  },

	  operation: function(func, compareFn, key, mounts) {
			var ret = [];
	    if (mounts === undefined || !Array.isArray(mounts)) {
				this._cache.forEach(function(v,e) {
					ret.push(e[func](key));
				})
	    } else {
				for (var i in mounts) {
					if (this._cache.has(mounts[i])) {
						ret.push(this._cache.get(mounts[i])[func](key));
					}
				}
			}
	    return compareFn(ret, key);
	  },

	  min: function(mounts, key) {
	    return this.operation('min', this._min, key, mounts);
	  },
	  max: function(mounts, key) {
	    return this.operation('max', this._max, key, mounts);
	  },
	  first: function(mounts, key) {
	    return this.operation('first', this._min, key, mounts);
	  },
	  last: function(mounts, key) {
	    return this.operation('last', this._max, key, mounts);
	  },

	  range: function(mounts) {
	    return [this.first(mounts, 'x'), this.last(mounts, 'x')];
	  },

	  rangedValues: function(mounts, key) {
	    return [this.min(mounts, key), this.max(mounts, key)];
	  },

		append: function(data, noHeap) {
			for (var mount in data) {
				if (!this._cache.has(mount)) {
          // console.log(mount, data[mount].length);
					this._cache.set(mount, new CacheKey(this.options));
				}
				this._cache.get(mount).append(data[mount], noHeap);
			}
		}
	}
  if (self) {
    self.ClientCache = ClientCache;
  } else if (window) {
    window.ClientCache = ClientCache;
  }
})();
