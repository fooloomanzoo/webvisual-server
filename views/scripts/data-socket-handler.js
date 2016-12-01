// globals
var Selector = '[updatable]';
window.maxValues = 5400; // 3/2h for every second update

// SOCKET
function DataSocketHandler(socketName, facility) {
	this.opened = false;
	this.facility = facility;
	this.socketName = socketName;
	this.socket = io.connect(window.location.host + socketName, {
		multiplex: false
	});

	// Connect
	this.socket.on('connect', (function() {
			console.info("client connected to: " + window.location.host);
			this.socket.emit('setup', {
				facility: this.facility
			})
		})
		.bind(this));

	// Init connection
	this.socket.on('init-by-server', (function(settings) {
			if (this.opened === false) {
				window.Groups = settings.groups;
				window.GroupingKeys = settings.groupingKeys;
				window.PreferedGroupingKeys = settings.preferedGroupingKeys;
				window.DatabaseForSocket = {};
				window.DatabaseForElements = {};
				window.SvgSelectables = settings.svg;
				window.Content = window.Content || settings.elements;
				window.Cache = {};
				for (var system in window.Content) {
					window.Cache[system] = new ClientCache(this.facility, system);
					var ids = Object.keys(window.Content[system]);
					window.DatabaseForSocket[system] = {};
					for (var i in ids) {
						// window.Content[system][ids[i]].nodes = [];
						// window.DatabaseForSocket[system][ids[i]] = new DatabaseClient();
					}
				}
			} else {
				this.connect(window.selectedLabels);
			}
		})
		.bind(this));

	// Receive Data
	this.socket.on('initial', (function(message) {
			if (message !== undefined) {
				// Set Window title to selectedLabels
				this.opened = true;
				document.title = ((window.selectedLabels.length > 1) ? window.selectedLabels.join(', ') : window.selectedLabels.toString());
				createMessage('notification', "Connected to <i>" + this.facility + "</i>: " + document.title, 3000);
				this._update(message);

				// select the MainPage
				window.PageSelector = document.querySelector('neon-animated-pages#PageSelector');
				window.PageSelector.select("1");
			} else
				console.info("socket: received empty message");
			return;
		})
		.bind(this));

	// Receive Data
	this.socket.on('update', (function(message) {
			if (message)
				this._update(message);
			else
				console.info("socket: received empty message");
			return;
		})
		.bind(this));

	// Disconnect (Reload if discoonected)
	this.socket.on('disconnect', function() {
		console.warn("client disconnected to: " + window.location.host);
		createMessage('error', "Disconnected to <i>" + this.facility + "</i><br>Reload in 45sec", 3000);
		this.restart = setTimeout( function() {
			window.location.reload();
		}, 45000);
	}.bind(this));

	// Reconnect
	this.socket.on('reconnect', function() {
		console.info("client reconnected to: " + window.location.host);
		clearTimeout(this.restart);
		createMessage('notification', "Client reconnected", 3000);
	}.bind(this));

	// Error
	this.socket.on('connect_error', function() {
		console.warn("error in connection to: " + window.location.host);
		createMessage('error', 'An error occured in the connection to the data server');
	});

	this.socket.on('error', function() {
		console.warn("server error by: " + window.location.host);
		createMessage('error', 'An error occured in the connection to the data server');
	});
}

// MESSAGE HANDLING
DataSocketHandler.prototype = {
	constructor: DataSocketHandler,
	connect: function(systems) {
		// send Config
		if (!systems || systems.length === 0) {
			console.warn("No systems set for connection");
			return;
		}
		this._init()
			.then((function() {
					this.socket.emit('init-by-client', {
							facility: this.facility,
							systems: systems,
							mobile: window.isMobile
						})
				})
				.bind(this));
	},
	disconnect: function() {
		if (socket) {
			this.socket.disconnect();
			this.opened = false;
		}
	},
	_init: function() {
		// grouping updatable window.Content in one Object
		return new Promise(function(resolve, reject) {
			// if (window.Content === undefined)
			//   window.Content = {};
			var updatable = document.querySelectorAll(Selector);
			var system = '',
				id = '',
				pos,
				i = 0;
			while (true) {
				system = updatable[i].getAttribute('data-system');
				id = updatable[i].getAttribute('data-id');
				if (system && id) {
					if (window.Content === undefined)
						window.Content = {};
					if (window.Content[system] === undefined)
						window.Content[system] = {};
					if (window.Content[system][id] === undefined)
						window.Content[system][id] = {
							nodes: [],
							values: []
						};
					if ((pos = window.Content[system][id].nodes.indexOf(updatable[i])) === -1) {
						window.Content[system][id].nodes.push(updatable[i]);
					}
				}
				i++;
				if (i === updatable.length) {
					resolve();
				}
			}
		})
	},
	_update: function(message) {
		if (Array.isArray(message)) // if message is an Array
			for (var i = 0; i < message.length; i++) {
			this._updateCache(message[i]);
			this._updateContent(message[i]);
			// this._updateDatabase(message[i]);
		}
		else { // if message is a single Object
			this._updateCache(message);
			this._updateContent(message);
			// this._updateDatabase(message);
		}
	},

	_updateDatabase: function(message) {
		var system = message.system;
		for (var id in message.values) {
			window.DatabaseForSocket[system][id].transaction(system + "/" + id, id, 'set', {
				value: message.values[id]
			});
		}
	},
	_updateCache: function(message) {
		var system = message.system;
		window.Cache[system].append(message.values);
	},

	_updateContent: function(message) {
		if (!message.values)
			return;

		var system = message.system;
		var len, spliced, start1 = {},
			start2 = {}, splices = [], heap = [];

		for (var id in message.values) {
			if (window.Content[system] === undefined || window.Content[system][id] === undefined) {
				console.warn("no window.Content-Object for", system, id);
				continue;
			}
			len = message.values[id].length;


			// if (len > maxValues)
			// 	message.values[id] = message.values[id].slice(len - maxValues, len);
			// // console.log(len, system, id);
			// // message.values[i].values.forEach(function(d) {
			// //   d.x = Date.parse(d.x); // parse Date in Standard Date Object
			// // });
			//
			// if (window.Content[system][id].values.length === 0)
			// 	window.Content[system][id].values = message.values[id];
			// else
			// 	for (var j = 0; j < message.values[id].length; j++) {
			// 		window.Content[system][id].values.push(message.values[id][j]);
			// 	}
			// if (window.Content[system][id].values.length > maxValues) {
			// 	spliced = window.Content[system][id].values.splice(0, window.Content[system][id].values.length - maxValues);
			// }

			// start1[id] = new Date();
			// window.DatabaseForSocket[system][id].transaction(system+"/"+id, id, 'set', {value: message.values[id]});
			// .then(function(result) {
			// 	console.log("set", system, id, "length:", message.values[id].length, "time:", new Date() - start1[id]);
			// });
			// start2[id] = new Date();
			// window.DatabaseForSocket[system][id].transaction('setBuffer', {
			// 		value: message.buffer[id],
			// 		buffer: [message.buffer[id].x, message.buffer[id].y]
			// 	})
			// 	.then(function(result) {
			// 		console.log("setBuffer", system, id, "length:", message.values[id].length, "time:", new Date() - start2[id]);
			// 		start1[id] = new Date();
			// 		window.DatabaseForSocket[system][id].transaction('get', {key: 'y', range: ['lowerBound',1.569983]})
			// 			.then(function(result) {
			// 				console.log("get", system, id, "time:", new Date() - start1[id]);
			// 				console.log(JSON.stringify(result));
			// 			});
			// 		window.DatabaseForElements[system][id].transaction('first', {key: 'y', count:20})
			// 			.then(function(result) {
			// 				console.log("first", system, id, "time:", new Date() - start1[id]);
			// 				console.log(JSON.stringify(result));
			// 			});
			// 	});
			// setTimeout(function(){
			// 	start1[id] = new Date();
			// 	window.DatabaseForElements[system][id].transaction('last', {count: 10})
			// 		.then(function(result) {
			// 			console.log("last", system, id, "time:", new Date() - start1[id]);
			// 			console.log(result);
			// 		});
			// }, 10000);
			splices = window.Cache[system][id].splices;
			heap = window.Cache[system][id].heap;
			for (var j = 0; j < window.Content[system][id].nodes.length; j++) {
				window.Content[system][id].nodes[j].insertValues(heap);
				window.Content[system][id].nodes[j].spliceValues(splices);
			}
			splices.length = 0;
			heap.length = 0;
		}
	},
	compareFn: function(a, b) {
		if (a.x > b.x) return 1;
		if (a.x < b.x) return -1;
		return 0;
	}
}
