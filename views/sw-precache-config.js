module.exports = {
  stripPrefix: '..\\public',
  stripPrefix: '../public',
  stripPrefixMulti: {
    '..\\public': '',
    '../public': ''
  },
  staticFileGlobs: [
    '/bower_components/webcomponentsjs/webcomponents-loader.js',
    '/index.html'
  ],
  verbose: true,
  navigateFallback: '/index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/$|\/images\/$|\/auth\/).*/],
  runtimeCaching: [
    {
      urlPattern: /\/bower_components\/webcomponentsjs\/.*.js/,
      handler: 'fastest',
      options: {
        cache: {
          name: 'webcomponentsjs-polyfills-cache'
        }
      }
    },{
    urlPattern: /\/images\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'image-cache'
      }
    }
  }, {
    urlPattern: /\/data\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'data-cache'
      }
    }
  }, {
    urlPattern: /\/socket\.io\/socket\.io\.js/,
    handler: 'cacheFirst',
    options: {
      cache: {
        maxEntries: 2,
        name: 'socket.io'
      }
    }
  }]
};
