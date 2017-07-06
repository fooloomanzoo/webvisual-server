(function(a,b){'object'===typeof exports&&'undefined'!==typeof module?module.exports=b():'function'===typeof define&&define.amd?define(b):a.ES6Promise=b()})(this,function(){'use strict';function a(pa){return'function'===typeof pa||'object'===typeof pa&&null!==pa}function b(pa){return'function'===typeof pa}function h(){return'undefined'===typeof Z?l():function(){Z(m)}}function l(){var pa=setTimeout;return function(){return pa(m,1)}}function m(){for(var pa=0;pa<Y;pa+=2){var qa=ga[pa],ra=ga[pa+1];qa(ra),ga[pa]=void 0,ga[pa+1]=void 0}Y=0}function o(pa,qa){var ra=arguments,sa=this,ta=new this.constructor(q);void 0===ta[ia]&&L(ta);var ua=sa._state;return ua?function(){var va=ra[ua-1];aa(function(){return I(ua,ta,va,sa._result)})}():E(sa,ta,pa,qa),ta}function p(pa){var qa=this;if(pa&&'object'===typeof pa&&pa.constructor===qa)return pa;var ra=new qa(q);return A(ra,pa),ra}function q(){}function s(){return new TypeError('You cannot resolve a promise with itself')}function t(){return new TypeError('A promises callback cannot return that same promise.')}function u(pa){try{return pa.then}catch(qa){return ma.error=qa,ma}}function v(pa,qa,ra,sa){try{pa.call(qa,ra,sa)}catch(ta){return ta}}function w(pa,qa,ra){aa(function(sa){var ta=!1,ua=v(ra,qa,function(va){ta||(ta=!0,qa===va?C(sa,va):A(sa,va))},function(va){ta||(ta=!0,D(sa,va))},'Settle: '+(sa._label||' unknown promise'));!ta&&ua&&(ta=!0,D(sa,ua))},pa)}function y(pa,qa){qa._state===ka?C(pa,qa._result):qa._state===la?D(pa,qa._result):E(qa,void 0,function(ra){return A(pa,ra)},function(ra){return D(pa,ra)})}function z(pa,qa,ra){qa.constructor===pa.constructor&&ra===o&&qa.constructor.resolve===p?y(pa,qa):ra===ma?D(pa,ma.error):void 0===ra?C(pa,qa):b(ra)?w(pa,qa,ra):C(pa,qa)}function A(pa,qa){pa===qa?D(pa,s()):a(qa)?z(pa,qa,u(qa)):C(pa,qa)}function B(pa){pa._onerror&&pa._onerror(pa._result),F(pa)}function C(pa,qa){pa._state!==ja||(pa._result=qa,pa._state=ka,0!==pa._subscribers.length&&aa(F,pa))}function D(pa,qa){pa._state!==ja||(pa._state=la,pa._result=qa,aa(B,pa))}function E(pa,qa,ra,sa){var ta=pa._subscribers,ua=ta.length;pa._onerror=null,ta[ua]=qa,ta[ua+ka]=ra,ta[ua+la]=sa,0===ua&&pa._state&&aa(F,pa)}function F(pa){var qa=pa._subscribers,ra=pa._state;if(0!==qa.length){for(var sa=void 0,ta=void 0,ua=pa._result,va=0;va<qa.length;va+=3)sa=qa[va],ta=qa[va+ra],sa?I(ra,sa,ta,ua):ta(ua);pa._subscribers.length=0}}function G(){this.error=null}function H(pa,qa){try{return pa(qa)}catch(ra){return na.error=ra,na}}function I(pa,qa,ra,sa){var ua,va,wa,xa,ta=b(ra);if(!ta)ua=sa,wa=!0;else if(ua=H(ra,sa),ua===na?(xa=!0,va=ua.error,ua=null):wa=!0,qa===ua)return void D(qa,t());qa._state!==ja||(ta&&wa?A(qa,ua):xa?D(qa,va):pa===ka?C(qa,ua):pa===la&&D(qa,ua))}function J(pa,qa){try{qa(function(sa){A(pa,sa)},function(sa){D(pa,sa)})}catch(ra){D(pa,ra)}}function K(){return oa++}function L(pa){pa[ia]=oa++,pa._state=void 0,pa._result=void 0,pa._subscribers=[]}function M(pa,qa){this._instanceConstructor=pa,this.promise=new pa(q),this.promise[ia]||L(this.promise),X(qa)?(this._input=qa,this.length=qa.length,this._remaining=qa.length,this._result=Array(this.length),0===this.length?C(this.promise,this._result):(this.length=this.length||0,this._enumerate(),0===this._remaining&&C(this.promise,this._result))):D(this.promise,N())}function N(){return new Error('Array Methods must be provided an Array')}function S(){throw new TypeError('You must pass a resolver function as the first argument to the promise constructor')}function T(){throw new TypeError('Failed to construct \'Promise\': Please use the \'new\' operator, this object constructor cannot be called as a function.')}function U(pa){this[ia]=K(),this._result=this._state=void 0,this._subscribers=[],q!==pa&&('function'!==typeof pa&&S(),this instanceof U?J(this,pa):T())}var W=Array.isArray?Array.isArray:function(pa){return'[object Array]'===Object.prototype.toString.call(pa)};var Z,$,ha,X=W,Y=0,aa=function(qa,ra){ga[Y]=qa,ga[Y+1]=ra,Y+=2,2===Y&&($?$(m):ha())},ba='undefined'===typeof window?void 0:window,ca=ba||{},da=ca.MutationObserver||ca.WebKitMutationObserver,ea='undefined'===typeof self&&'undefined'!==typeof process&&'[object process]'==={}.toString.call(process),fa='undefined'!==typeof Uint8ClampedArray&&'undefined'!==typeof importScripts&&'undefined'!==typeof MessageChannel,ga=Array(1e3);ha=ea?function(){return function(){return process.nextTick(m)}}():da?function(){var pa=0,qa=new da(m),ra=document.createTextNode('');return qa.observe(ra,{characterData:!0}),function(){ra.data=pa=++pa%2}}():fa?function(){var pa=new MessageChannel;return pa.port1.onmessage=m,function(){return pa.port2.postMessage(0)}}():void 0===ba&&'function'===typeof require?function(){try{var pa=require,qa=pa('vertx');return Z=qa.runOnLoop||qa.runOnContext,h()}catch(ra){return l()}}():l();var ja,ia=Math.random().toString(36).substring(16),ka=1,la=2,ma=new G,na=new G,oa=0;return M.prototype._enumerate=function(){for(var pa=this.length,qa=this._input,ra=0;this._state===ja&&ra<pa;ra++)this._eachEntry(qa[ra],ra)},M.prototype._eachEntry=function(pa,qa){var ra=this._instanceConstructor,sa=ra.resolve;if(sa===p){var ta=u(pa);if(ta===o&&pa._state!==ja)this._settledAt(pa._state,qa,pa._result);else if('function'!==typeof ta)this._remaining--,this._result[qa]=pa;else if(ra===U){var ua=new ra(q);z(ua,pa,ta),this._willSettleAt(ua,qa)}else this._willSettleAt(new ra(function(va){return va(pa)}),qa)}else this._willSettleAt(sa(pa),qa)},M.prototype._settledAt=function(pa,qa,ra){var sa=this.promise;sa._state===ja&&(this._remaining--,pa===la?D(sa,ra):this._result[qa]=ra),0===this._remaining&&C(sa,this._result)},M.prototype._willSettleAt=function(pa,qa){var ra=this;E(pa,void 0,function(sa){return ra._settledAt(ka,qa,sa)},function(sa){return ra._settledAt(la,qa,sa)})},U.all=function(pa){return new M(this,pa).promise},U.race=function(pa){var qa=this;return X(pa)?new qa(function(ra,sa){for(var ta=pa.length,ua=0;ua<ta;ua++)qa.resolve(pa[ua]).then(ra,sa)}):new qa(function(ra,sa){return sa(new TypeError('You must pass an array to race.'))})},U.resolve=p,U.reject=function(pa){var qa=this,ra=new qa(q);return D(ra,pa),ra},U._setScheduler=function(pa){$=pa},U._setAsap=function(pa){aa=pa},U._asap=aa,U.prototype={constructor:U,then:o,catch:function(qa){return this.then(null,qa)}},U.polyfill=function(){var pa;if('undefined'!==typeof global)pa=global;else if('undefined'!==typeof self)pa=self;else try{pa=Function('return this')()}catch(sa){throw new Error('polyfill failed because global object is unavailable in this environment')}var qa=pa.Promise;if(qa){var ra=null;try{ra=Object.prototype.toString.call(qa.resolve())}catch(sa){}if('[object Promise]'===ra&&!qa.cast)return}pa.Promise=U},U.Promise=U,U}),ES6Promise.polyfill();