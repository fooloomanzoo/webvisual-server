'use strict';

// Web Sockets
const EventEmitter = require('events')
  .EventEmitter,
  // Cache
  CacheClient = require('./database').cache,
  // Redis
  RedisClient = require('./database').redis,
  // File Watch Module
  DataFileHandler = require('./filehandler')
  .DataFileHandler,
  mergeData = require('./filehandler')
  .DataMerge;

class DataModule extends EventEmitter {

  constructor(databaseConfig = {}, io) {
    super();

    // this.cache = {};
    this.db = {};
    this.dataFiles = {};
    this.settings = {};
    this.databaseConfig = databaseConfig;

    if (io)
      this.setServer(io);
  }

  setServer(io) {
    // Handle connections of new clients
    this.dataSocket = io;

    this.dataSocket.on('connection', (client) => {
      client.on('setup', (config) => {

        const room = config.room,
          facility = room.split('/')[0],
          system = room.split('/')[1];

        if (!room || !facility || !system || !this.db || !this.db[facility] || !this.db[facility][system]) {
          client.compress(true)
            .emit('reset');
          return;
        }

        // attempt to setup same connection, won't be excecuted
        if (client._room && (client._room === room)) {
          return;
        }
        client._room = room;

        const mobile = config.mobile,
          clientRequest = this.settings[facility][system].clientRequest.initial,
          requestlast = mobile ? clientRequest.mobile : clientRequest.stationary;

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
        const room = config.room,
          facility = room.split('/')[0],
          system = room.split('/')[1];

        if (!facility || !system || !this.db || !this.db[facility] || !this.db[facility][system]) {
          client.compress(true)
            .emit('reset');
          return;
        }

        this.db[facility][system].getAll(config.from, config.to, config.limit || 30000, config.mounts)
          .then( (res) => {
            client.compress(true)
              .emit('request', {
                messageId: config.messageId,
                values: res
              });
          })
          .catch(err => {
            this.emit('error', err);
            client.compress(true)
              .emit('request', {
                messageId: config.messageId,
                values: []
              });
          })

        if (!client._room || client._room !== room) {
          client._room = room;
          client.join(room);
        }
      });

      client.on('disconnect', () => {});

      client.on('error', (err) => {
        if (err) this.emit('error', 'socket.io', err)
      });
    });
  }

  setConfiguration(settings, facility) {
    this.settings[facility] = settings;
    // this.cache[facility] = this.cache[facility] || {};
    this.db[facility] = this.db[facility] || {};
    this.dataFiles[facility] = this.dataFiles[facility] || {};
    this.connect(facility);
  }

  setDatabase(facility, system, config, data) {
    this.db[facility] = this.db[facility] || {};
    config = config || this.databaseConfig || {};
    if (!config.type) {
      config.type = 'cache'
    }
    switch (config.type.toLowerCase()) {
      case 'redis':
        this.db[facility][system] = new RedisClient(facility + '/' + system, config, data);
        break;
      default:
        this.db[facility][system] = new CacheClient(facility + '/' + system, config, data);
    }
    this.db[facility][system].on('log', (msg) => { this.emit('log', msg )});
    this.db[facility][system].on('info', (msg) => { this.emit('info', msg )});
    this.db[facility][system].on('error', (msg) => { this.emit('error', msg )});
  }

  connect(facility) {
    if (!facility) return;

    // DataFileHandler - established the data connections
    for (let system in this.settings[facility]) {
      if (system === '_name' || system === '_title')
        continue;

      this.dataFiles[facility] = this.dataFiles[facility] || {};
      this.dataFiles[facility][system] = this.dataFiles[facility][system] || [];
      // close prexisting connections and io-facilityspace(room)
      for (let i = 0; i < this.dataFiles[facility][system].length; i++) {
        this.dataFiles[facility][system][i].close();
      }
      this.dataFiles[facility][system].length = 0;
      if (this.db[facility] && this.db[facility][system]) {
        this.db[facility][system].init();
      }

      for (let i = 0; i < this.settings[facility][system].locals.length; i++) {
        // create file watcher object
        this.dataFiles[facility][system].push(new DataFileHandler({
          connection: this.settings[facility][system].locals[i].connections,
          listener: {
            error: function(option, err) {
              err.forEach(function(msg) {
                console.error(msg.details + '\n' + 'in file: ' + msg.path + '\n' + 'in line: '+ msg.line);
              })
            },
            data: function(itemProperties, dbOptions, option, data) {
              if (!data)
                return; // Don't handle empty data
              // temporary save data

              // process data
              let mergedData;
              while (data.length) {
                mergedData = mergeData(data.splice(0, 1000), facility, system, itemProperties);

                if (this.dataSocket) {
                  this.dataSocket.to(facility + '/' + system)
                    .emit('update', mergedData);
                } else {
                  this.emit('request_server_settings')
                }

                if (this.db[facility] && this.db[facility][system]) {
                  this.db[facility][system].place( mergedData.values );
                } else {
                  this.setDatabase(facility, system, dbOptions, mergedData.values);
                }
              }
            }.bind(this, this.settings[facility][system].locals[i], this.settings[facility][system].database)
          }
        }));
      }
      // connect watcher
      for (let i = 0; i < this.dataFiles[facility][system].length; i++) {
        this.dataFiles[facility][system][i].connect();
      }
    }
  }

  disconnect() {
    // disconnect watchers
    for (let facility in this.dataFiles) {
      for (let system in this.dataFiles[facility]) {
        // console.log(facility, system, this.dataFiles[facility][system])
        for (let i = 0; i < this.dataFiles[facility][system].length; i++) {
          this.dataFiles[facility][system][i].close();
        }
        // this.cache[facility][system].clear();
        // this.db[facility][system].clear();
        delete this.dataFiles[facility][system];
        // delete this.cache[facility][system];
        delete this.db[facility][system];
      }
      delete this.dataFiles[facility];
      // delete this.cache[facility];
      delete this.db[facility];
    }

    // disconnect clients on sockets
    // if (this.dataSocket) {
    //   var sockets = this.dataSocket.connected;
    //   for (var id in sockets) {
    //     sockets[id].client.disconnect();
    //   };
    //
    //   // remove all listeners on watchers and sockets of the event emitters
    //   this.dataSocket.removeAllListeners();
    //   delete this.dataSocket;
    // }
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
