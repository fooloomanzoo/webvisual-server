'use strict';

// Web Sockets
const ioServer = require('socket.io'),
  EventEmitter = require('events')
  .EventEmitter,
  // Cache
  // Cache = require('./cache'),
  // Redis
  RedisClient = require('./database').RedisClient,
  // File Watch Module
  DataFileHandler = require('./filehandler')
  .DataFileHandler,
  mergeData = require('./filehandler')
  .DataMerge;

class DataModule extends EventEmitter {

  constructor(databaseConfig, server, config) {
    super();
    this.io = new ioServer();
    // this.cache = {};
    this.db = {};
    this.dataFiles = {};
    this.settings = {};
    this.databaseConfig = databaseConfig;

    if (server)
      this.setServer(server);

  }

  setServer(server) {
    this.io.listen(server);

    // Handle connections of new clients
    this.dataSocket = this.io.of('/data');
    this.dataSocket.on('connection', (client) => {

      client.on('setup', (config) => {

        const newroom = config.room,
          facility = newroom.split('/')[0],
          system = newroom.split('/')[1];

        if (!newroom || !facility || !system || !this.settings[facility] || !this.settings[facility][system])
          return;

        // attempt to setup same connection, won't be excecuted
        if (client._room && (client._room === config.room)) {
          return;
        } else if (client._room) { // leave oldroom
          client.leave(client._room);
        }

        client._room = newroom;

        const mobile = config.mobile,
          clientRequest = this.settings[facility][system].clientRequest.initial,
          requestlast = mobile ? clientRequest.mobile : clientRequest.stationary;

        // client.compress(true)
        //   .emit('initial', {
        //     facility: facility,
        //     system: system,
        //     values: this.cache[facility][system].request(requestlast)
        //   });

        this.db[facility][system].getAll(null, null, requestlast)
          .then( (res) => {
            client.compress(true)
              .emit('initial', {
                facility: facility,
                system: system,
                values: res
              });
          })
          .catch( (err) => {
            this.emit('error', err);
          })
        client.join(client._room); // client joins room for selected system
      });

      client.on('request', (config) => {
        if (!config.messageId || !config.mount) {
          return;
        }

        const room = config.room,
          facility = room.split('/')[0],
          system = room.split('/')[1];

        if ( !room
          || !facility
          || !system
          || !this.db[facility]
          || !this.db[facility][system]) {
          client.compress(true)
            .emit('request', {
              messageId: config.messageId,
              values: []
            });
        } else {
          this.db[facility][system].range(config.mount, config.from || null, config.to || null, config.limit || null)
            .then( (res) => {
              client.compress(true)
                .emit('request', {
                  messageId: config.messageId,
                  values: res
                });
            })
            .catch( (err) => {
              this.emit('error', err);
            })
        }

      });

      client.on('disconnect', (socket) => {});

      client.on('error', (err) => {});
    });

    this.io.of('/data')
      .clients((err, clients) => {
        if (err) this.emit('error', 'socket.io', err)
      });
  }

  setConfiguration(settings, facility) {
    this.settings[facility] = settings;
    // this.cache[facility] = this.cache[facility] || {};
    this.db[facility] = this.db[facility] || {};
    this.dataFiles[facility] = this.dataFiles[facility] || {};
    this.connect(facility);
  }

  setDatabase(facility, system) {
    this.db[facility] = this.db[facility] || {};
    switch (this.databaseConfig.type) {
      case 'redis':
        this.db[facility][system] = new RedisClient(facility + '/' + system, this.databaseConfig);
        break;
      default:
        this.db[facility][system] = null;
    }
    if (this.db[facility][system]) {
      this.db[facility][system].on('log', (msg) => { this.emit('log', msg )});
      this.db[facility][system].on('info', (msg) => { this.emit('info', msg )});
      this.db[facility][system].on('error', (msg) => { this.emit('error', msg )});
    }
  }

  connect(facility) {
    if (!facility) return;

    // close prexisting connections and io-facilityspace(room)
    for (let system in this.dataFiles[facility]) {
      this.dataFiles[facility][system].close();
      delete this.dataFiles[facility][system];
    }

    // DataFileHandler - established the data connections
    for (let key in this.settings[facility]) {
      if (key === '_name' || key === '_title')
        continue;

      let system = key;
      // create cache
      // this.cache[facility][system] = new Cache();
      this.setDatabase(facility, system);
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
            let mergedData = mergeData(data, facility, system, this.settings[facility][system]);

            // save cache (on stack)
            // this.cache[facility][system].values = mergedData.values;

            if (this.db[facility][system]) {
              this.db[facility][system].place( mergedData.values );
            }

            // serve clients that are connected to certain 'rooms'
            this.dataSocket.to(facility + '/' + system)
              .emit('update', mergedData);

            mergedData = null;
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
        // this.cache[facility][system].clear();
        this.db[facility][system].clear();
        delete this.dataFiles[facility][system];
        // delete this.cache[facility][system];
        delete this.db[facility][system];
      }
      delete this.dataFiles[facility];
      // delete this.cache[facility];
      delete this.db[facility];
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
