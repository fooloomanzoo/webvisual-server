module.exports = {
	staticFileGlobs: [
		'/index.html',
    '/manifest.json',
    '/bower_components/webcomponentsjs/webcomponents-loader.js',
    '/bower_components/es6-promise/es6-promise.auto.min.js',
		'/src/**/*',
		'/scripts/**/*',
		'/fonts/**/*',
		'/icons/**/*',
		'/images/**/*',
		'/data/**/*'
	],
	runtimeCaching: [
		{
			urlPattern: /\/bower_components\/es6-promise\/.*.js/,
			handler: 'fastest',
			options: {
				cache: {
					name: 'es6-polyfills-cache'
				}
			}
		}, {
			urlPattern: /\/bower_components\/webcomponentsjs\/.*.js/,
			handler: 'fastest',
			options: {
				cache: {
					name: 'webcomponentsjs-polyfills-cache'
				}
			}
		}, {
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
					name: 'font-cache'
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
		}
	]
};
