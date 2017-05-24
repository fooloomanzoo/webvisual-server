module.exports = {
  stripPrefix: '..\\public',
  stripPrefix: '../public',
  stripPrefixMulti: {
    '..\\public': '',
    '../public': ''
  },
  staticFileGlobs: [
    '/bower_components/webcomponentsjs/webcomponents-loader.js',
    '/index.html',
    '/locales.json',
    '/manifest.json',
    '/app.yaml',
    '/scripts/*',
    '/polyfills/*',
    '/data/**/*',
    '/images/**/*'
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
    urlPattern: /\/fonts\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        maxEntries: 2,
        name: 'font-cache'
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
