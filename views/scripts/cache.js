(function() {

	function ClientCache(mount, indexKey, options) {
		this.mount = mount;
		this.indexKey = indexKey || 'x';
		this.maxCount = options && options.maxCount
			? options.maxCount
			: 30000;
		this.values = [];
		this._splices = [];
		this._heap = [];
		Object.defineProperty(this, "splices", {
			get: function() {
				return this._splices.splice(0, this._splices.length);
			},
			enumerable: false,
			configurable: true
		});
		Object.defineProperty(this, "heap", {
			get: function() {
				return this._heap.splice(0, this._heap.length);
			},
			enumerable: false,
			configurable: true
		});
	}

	ClientCache.prototype = {

		clear: function() {
			this._splices.length = 0; // clear arrays
			this._heap.length = 0;
			this.values.length = 0;
		},

		get: function(start, end, len) {
			if (Number.isFinite(start) && Number.isFinite(end)) {
				let startIndex,
					endIndex;
				for (startIndex = this.values.length - 1; startIndex >= 0; startIndex--) {
					if (this.values[startIndex][this.indexKey] >= start) {
						break;
					}
				}
				for (endIndex = 0; endIndex < this.values.length; endIndex++) {
					if (this.values[endIndex][this.indexKey] <= end) {
						break;
					}
				}
				if (Number.isFinite(len) && endIndex - startIndex > len) {
					startIndex = endIndex - len;
				}
				return this.values.slice(startIndex, endIndex);
			} else {
				const startIndex = (Number.isFinite(len) && len >= 0 && len < this.values.length)
					? this.values.length - len - 1
					: 0;
				return this.values.slice(startIndex);
			}
		},

		set: function(data) {
			data.sort(this.compareFn(this.indexKey));
			if (this.values.length === 0)
				this.values = data;
			else {
				data = data.filter(v => {
					return v[this.indexKey] > this.values[this.values.length - 1][this.indexKey];
				});
				this.values = this.values.concat(data);
			}
			this._heap = this._heap.concat(data);
			if (this.values.length > this.maxCount)
				this._splices = this._splices.concat(this.values.splice(0, this.values.length - this.maxCount));
		},

		range: function(key) {
			return new Promise(function(resolve) {
				if (key === undefined)
					resolve([this.first(), this.last()]);
				else
					resolve([this.min(key), this.max(key)]);
				}
			.bind(this));
		},

		last: function() {
			return this.values[this.values.length - 1][this.indexKey];
		},

		first: function() {
			return this.values[0][this.indexKey];
		},

		max: function(key) { // inspired by d3.array
			let i = -1,
				a,
				b;
			const n = this.values.length;

			while (++i < n)
				if ((b = this.values[i][key]) !== null && b >= b) {
					a = b;
					break;
				}
			while (++i < n)
				if ((b = this.values[i][key]) !== null && a < b) {
					a = b;
				}

			return a;
		},

		min: function(key) { // inspired by d3.array
			let i = -1,
				a,
				b;
			const n = this.values.length;

			while (++i < n)
				if ((b = this.values[i][key]) !== null && b >= b) {
					a = b;
					break;
				}
			while (++i < n)
				if ((b = this.values[i][key]) !== null && a > b)
					a = b;

			return a;
		},

		compareFn: function(key, order) {
			order = order || 1;
			return function(a, b) {
				return (a[key] < b[key])
					? -1 * order
					: (a[key] > b[key])
						? 1 * order
						: 0;
			}
		}
	}
	if (self) {
		self.ClientCache = ClientCache;
	} else if (window) {
    window.ClientCache = ClientCache;
  }
})();
