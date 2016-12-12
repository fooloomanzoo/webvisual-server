module.exports = {
  stripPrefix: '..\\public',
  stripPrefixMulti: {
    '..\\public': '',
  },
  importScripts: [
    '/service-worker-add-on.js'
  ],
  staticFileGlobs: [
   '/index.html',
   '/bower_components/webcomponentsjs/webcomponents-lite.min.js',
   '/locales.json',
   '/manifest.json',
   '/fonts/*',
   '/icons/*'
  ],
  verbose: true,
  navigateFallback: '/index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/$|\/auth\/).*/],
  runtimeCaching: [
    {
      urlPattern: /\/images\/.*/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 100,
          name: 'image-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/.*json/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 100,
          name: 'data-cache'
        }
      }
    },
    {
      urlPattern: /\/fonts\/.*/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 10,
          name: 'font-cache'
        }
      }
    },
    {
      urlPattern: /\/icons\/.*/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 20,
          name: 'icon-cache'
        }
      }
    }
  ]
};
