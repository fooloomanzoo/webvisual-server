'use strict';

	// Web Sockets
const ioServer = require('socket.io'),
	EventEmitter = require('events').EventEmitter,
	// Cache
	Cache = require('./cache'),
	// File Watch Module
	DataFileHandler = require('./filehandler').DataFileHandler,
	mergeData = require('./filehandler').DataMerge;

class DataModule extends EventEmitter {

	constructor(server, config) {
		super();
		this.io = new ioServer();
		this.cache = {};
		this.dataFiles = {};
    this.settings = {};

		if (server)
			this.setServer(server);

		if (config)
			this.setConfiguration(config);
	}

	setServer(server) {
		this.io.listen(server);

		// Handle connections of new clients
		this.dataSocket = this.io.of('/data');
		this.dataSocket.on('connection', (client) => {

			client.on('setup', (settings) => {
				var facility = settings.facility;
				if (settings) {
					client.compress(true).emit('init-by-server', this.settings[facility]);
				}
			});

			client.on('init-by-client', (config) => {
				// const facility = config.facility
				// 		, mobile = config.mobile
				// 		, settings = this.settings[facility];
				// let requestlast;
        //
				// for (let system of config.systems) {
        //
				// 	if (settings && settings.clientRequest[system] &&
				// 			settings.clientRequest[system].initial) {
				// 		if (mobile && settings.clientRequest[system].initial.mobile)
				// 			requestlast = settings.clientRequest[system].initial.mobile;
				// 		else if (!mobile && settings.clientRequest[system].initial.stationary)
				// 			requestlast = settings.clientRequest[system].initial.stationary;
				// 	}
        //
				// 	client.compress(true).emit('initial', {system: system, values: this.cache[facility][system].request(requestlast)});
        //
				// 	client.join(facility + '__' + system); // client joins room for selected system
				// }
			});

			client.on('disconnect', (socket) => { });

			client.on('error', (err) => { });
		});

		this.io.of('/data').clients((err, clients) => {
			if (err) this.emit('error', 'socket.io', err)
		});
	}

	setConfiguration (settings, facility) {
		this.settings[facility] = settings;
		this.cache[facility] = this.cache[facility] || {};
		this.dataFiles[facility] = this.dataFiles[facility] || {};
		this.connect(facility);
	}

	connect (facility) {
		if (!facility) return;

		// close prexisting connections and io-facilityspace(room)
		for (let system in this.dataFiles[facility]) {
			this.dataFiles[facility][system].close();
			delete this.dataFiles[facility][system];
		}

		// DataFileHandler - established the data connections
		for (let system in this.settings[facility]) {
			// create cache
			this.cache[facility][system] = new Cache();
			// create callbacks for listeners of changes on files
			let listeners = {
				error: (option, err) => {
					let errString = '';
					err.forEach(function(msg) {
						errString += 'path: ' + msg.path + '\n' + msg.details + '\n';
					})
					this.emit('error', option.type + '\n' + errString);
				},
				data: (option, data, system) => {
					if (!data || data.length == 0)
						return; // Don't handle empty data
					// temporary save data
					if (this.settings[facility] && this.settings[facility][system]) {
						// process data
						let mergedData = mergeData(data, facility, this.settings[facility][system]);

						// save cache (on stack)
						this.cache[facility][system].values = mergedData.values;

						// serve clients that are connected to certain 'rooms'
						this.dataSocket.to(facility + '__' + system).emit('update', mergedData);
					}
				}
			};
			// create file watcher object
			this.dataFiles[facility][system] = new DataFileHandler({
				id: system,
				connection: this.settings[facility][system].connection,
				listener: listeners
			});
			// connect watcher
			this.dataFiles[facility][system].connect();
		}
	}

	disconnect() {
		// disconnect watchers
		for (var facility in this.dataFiles) {
			for (var system in this.dataFiles[facility]) {
				this.dataFiles[facility][system].close();
				this.cache[facility][system].clear();
				delete this.dataFiles[facility][system];
				delete this.cache[facility][system];
			}
			delete this.dataFiles[facility];
			delete this.cache[facility];
		}

		// disconnect clients on sockets
		if (this.dataSocket) {
      var sockets = this.dataSocket.connected;
      for (var id in sockets) {
        sockets[id].client.disconnect();
      };

      // remove all listeners on watchers and sockets of the event emitters
      this.dataSocket.removeAllListeners();
      delete this.dataSocket;
      delete this.io.nsps['/data'];
    }
	}

	// function initMailer(config) {
	//   /*
	//    * Init mailer
	//    */
	//   mailer.init({
	//     from: config.from, // sender address
	//     to: config.to, // list of receivers
	//     subject: config.subject
	//   });
	//   mailer.setType('html');
	//   mailer.setDelay(1000);
	// }
}

// Module exports
module.exports = DataModule;
