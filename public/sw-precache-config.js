module.exports = {
  staticFileGlobs: [
    '/index.html',
    '/manifest.json',
    '/locales.json',
    '/scripts/*',
    '/socket.io/*',
    '/bower_components/webcomponentsjs/webcomponents-lite.min.js',
    '/icons/*',
    '/data/*',
    '/data/**/*',
    '/fonts/*'
  ],
  navigateFallback: '/index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/).*/],
  runtimeCaching: [
    {
      urlPattern: /\/data\/images\/.*/,
      handler: 'cacheFirst',
      options: {
        cache: {
          maxEntries: 200,
          name: 'svg-cache'
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
    }
  ]
};
