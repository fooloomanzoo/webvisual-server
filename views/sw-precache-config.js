module.exports = {
  stripPrefix: '..\\public',
  stripPrefix: '../public',
  stripPrefixMulti: {
    '..\\public': '',
    '../public': ''
  },
  staticFileGlobs: [
   '/index.html',
   '/bower_components/webcomponentsjs/webcomponents-lite.min.js',
   '/locales.json',
   '/manifest.json',
   '/scripts/*',
   '/socket.io/socket.io.js',
   '/fonts/*.woff2',
   '/icons/*'
  ],
  verbose: true,
  navigateFallback: '/index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/$|\/auth\/).*/],
  runtimeCaching: [
    {
      urlPattern: /\/images\/.*/,
      handler: 'fastest',
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
      urlPattern: /\/socket\.io\/socket\.io\.js/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 1,
          name: 'socket.io'
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
