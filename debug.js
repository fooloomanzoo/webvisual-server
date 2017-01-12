// Add NODE_DEBUG to this process's environment variables, which are passed by default to
// the forked node environment.

process.env.NODE_DEBUG = process.argv[2] || 'https';

const cp = require('child_process');
const n = cp.fork('index.js');

// Cached callback functions, in case client can pass in different callbacks.
// Use an object instead of array, to avoid memory leaks.
const cbs = {};
var cbIndexCounter = 0; // To make callback indices unique

// Call appropriate callback with response from child process, and delete cached callback.
n.on('message', (m) => {
  for (var key in m) {
    if (console[key]) {
      console[key](key, m[key]);
    }
  }
});

n.on('error', (err) => {
  console.log('Child node env error: ', err);
});

// Cache the callback; forward event, context, index to child process; and increment index.
exports.myHandler = function(event, context, callback) {
  cbs[cbIndexCounter] = callback;
  n.send({
    event: event,
    context: context,
    cbIndex: cbIndexCounter++
  });
}
