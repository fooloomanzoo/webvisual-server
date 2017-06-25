(function() {
  'use strict';

  // findIndex polyfill
  if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
      value: function(predicate) {
        'use strict';
        if (this == null) {
          throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return i;
          }
        }
        return -1;
      },
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  if (!(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)) {

    if (!window.importScripts) {
      window.loadError = function(e) {
        throw new URIError("The script " + e.target.src + " is not accessible.");
      }
      window.importScripts = function(src, callback) {
        var script = document.createElement("script");
        script.type = "text\/javascript";
        script.onerror = loadError;
        if (callback) {
          script.onload = callback;
        }
        document.currentScript.parentNode.insertBefore(script, document.currentScript);
        script.src = src;
      }
    }
  }
  // String.startsWith

  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
      position = position || 0;
      return this.indexOf(searchString, position) === position;
    };
  }

  // Number.isNaN
  Number.isNaN = Number.isNaN || function(value) {
    return typeof value === "number" && isNaN(value);
  }

  // Number.isFinite
  Number.isFinite = Number.isFinite || function(value) {
    return typeof value === "number" && isFinite(value);
  }

})();
