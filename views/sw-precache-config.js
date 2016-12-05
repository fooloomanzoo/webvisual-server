module.exports = {
  cacheId: 'webvisual-cache',
  importScripts: [
    '/service-worker-add-on.js'
  ],
  staticFileGlobs: [
   '/index.html',
   '/bower_components/webcomponentsjs/webcomponents-lite.min.js',
   '/manifest.json',
   '/locales.json',
   '/app.yaml',
   '/scripts/*',
   '/socket.io/*',
   '/icons/favicon.ico',
   '/fonts/**/*'
  ],
  navigateFallback: 'index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/).*|\/auth\/).*/],
  runtimeCaching: [
    {
      urlPattern: /\/data\/images\/.*/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 100,
          name: 'svg-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/.*json/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 100,
          name: 'data-cache'
        }
      }
    },
    {
      urlPattern: /\/fonts\/.*/,
      handler: 'cacheOnly',
      options: {
        cache: {
          maxEntries: 12,
          name: 'font-cache'
        }
      }
    }
  ]
};
