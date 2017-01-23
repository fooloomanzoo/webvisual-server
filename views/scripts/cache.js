(function() {

    var defaults = {
        size: 1800, // Length of each DataRow (by mount in values)
        indexKey: 'x'
    };

    function Cache(options) {
      this.maxCount = options.maxCount || 1800;
      this.indexKey = options.indexKey || 'x';
      this.withHeap = options.withHeap || false;
    }

    Cache.prototype = {

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
                    return this._heap.splice(0, this._heap.length);
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
            return this._cache[this._cache.length - 1][key];
        },

        first: function(key) {
            return this._cache[0][key];
        },

        max: function(key) { // inspired by d3.array
            var i = -1,
                a,
                b;
            var n = this._cache.length;

            while (++i < n)
                if ((b = this._cache[i][key]) !== null && b >= b) {
                    a = b;
                    break;
                }
            while (++i < n)
                if ((b = this._cache[i][key]) !== null && a < b) {
                    a = b;
                }

            return a;
        },

        min: function(key) { // inspired by d3.array
            var i = -1,
                a,
                b;
            var n = this._cache.length;

            while (++i < n)
                if ((b = this._cache[i][key]) !== null && b >= b) {
                    a = b;
                    break;
                }
            while (++i < n)
                if ((b = this._cache[i][key]) !== null && a > b) a = b;

            return a;
        },

        compareFn: function(key, order) {
            order = order || 1;
            return function(a, b) {
                return (a[key] < b[key]) ? -1 * order : (a[key] > b[key]) ? 1 * order : 0;
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
        },

        splices: function() {

        },

        heap: function() {
          
        }
    }

})();
