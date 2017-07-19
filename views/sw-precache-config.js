module.exports = {
  stripPrefix: '../views',
  staticFileGlobs: [
    'bower_components/**/*',
    'src/**/*',
    'scripts/**/*',
    'fonts/**/*',
    'icons/**/*',
    'index.html'
  ],
  verbose: true,
  navigateFallback: 'index.html',
  navigateFallbackWhitelist: [/^(?!.*\.html$|\/data\/$|\/images\/$|\/auth\/).*/],
  runtimeCaching: [
  {
    urlPattern: /images\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'image-cache'
      }
    }
  }, {
    urlPattern: /data\/.*/,
    handler: 'fastest',
    options: {
      cache: {
        name: 'data-cache'
      }
    }
  }, {
    urlPattern: /fonts\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'data-cache'
      }
    }
  }, {
    urlPattern: /locales\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'locales-cache'
      }
    }
  }, {
    urlPattern: /icons\/.*/,
    handler: 'cacheFirst',
    options: {
      cache: {
        name: 'icons-cache'
      }
    }
  }, {
    urlPattern: /scripts\/.*/,
    handler: 'fastest',
    options: {
      cache: {
        name: 'scripts-cache'
      }
    }
  }, {
    urlPattern: /socket\.io\/socket\.io\.js/,
    handler: 'fastest',
    options: {
      cache: {
        maxEntries: 2,
        name: 'socket.io'
      }
    }
  }]
};
