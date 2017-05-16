module.exports = {
  stripPrefix: '..\\public',
  stripPrefix: '../public',
  stripPrefixMulti: {
    '..\\public': '',
    '../public': ''
  },
  staticFileGlobs: [
    '/index.html',
    '/bower_components/webcomponentsjs/webcomponents-loader.js',
    '/locales.json',
    '/manifest.json',
    '/app.yaml',
    '/scripts/*',
    '/polyfills/*',
    '/fonts/*',
    '/data/*'
  ],
  verbose: true,
  navigateFallback: '/index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/$|\/auth\/).*/],
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
        maxEntries: 100,
        name: 'image-cache'
      }
    }
  }, {
    urlPattern: /\/icons\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        maxEntries: 100,
        name: 'icon-cache'
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
