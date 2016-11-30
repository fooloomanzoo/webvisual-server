module.exports = {
  staticFileGlobs: [
    '/index.html',
    '/bower_components/webcomponentsjs/webcomponents-lite.min.js',
    '/manifest.json',
    '/locales.json',
    '/app.yaml',
    '/scripts/*',
    '/socket.io/*',
    '/icons/favicon.ico',
    '/icons/manifest/*',
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
