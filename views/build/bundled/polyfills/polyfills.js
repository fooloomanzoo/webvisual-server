(function(){'use strict';Array.prototype.findIndex||Object.defineProperty(Array.prototype,'findIndex',{value:function(a){'use strict';if(null==this)throw new TypeError('Array.prototype.findIndex called on null or undefined');if('function'!==typeof a)throw new TypeError('predicate must be a function');for(var f,b=Object(this),c=b.length>>>0,d=arguments[1],g=0;g<c;g++)if(f=b[g],a.call(d,f,g,b))return g;return-1},enumerable:!1,configurable:!1,writable:!1}),'undefined'!==typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope||window.importScripts||(window.loadError=function(a){throw new URIError('The script '+a.target.src+' is not accessible.')},window.importScripts=function(a,b){var c=document.createElement('script');c.type='text/javascript',c.onerror=loadError,b&&(c.onload=b),document.currentScript.parentNode.insertBefore(c,document.currentScript),c.src=a}),String.prototype.startsWith||(String.prototype.startsWith=function(a,b){return b=b||0,this.indexOf(a,b)===b}),Number.isNaN=Number.isNaN||function(a){return'number'===typeof a&&isNaN(a)},Number.isFinite=Number.isFinite||function(a){return'number'===typeof a&&isFinite(a)}})();