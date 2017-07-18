/**
 * HOW TO USE
 *
 * The DataHandler class. This class is used to handle data connections and the incoming data with ease.
 * @param  {Object} config A configuration object with the following options:
 *     @attr  {Array/Object} connection
 *         A array or object with a list of connections to use. If an array is used, the module will use default
 *         configuration for the connections. Alternatively you can use the object format to add your own custom
 *         configuration for the connection.
 *         In this case the keys represent the connection type while you can add objects as value for further configuration.
 *         Example:
 *         {
 *           db: {
 *             option1: 1,
 *             option2: 2
 *           },
 *           file: {
 *             option1: 'a',
 *             option2: 'b'
 *           }
 *         }
 *     @attr  {Function/Object} listener
 *         The attributes of this object can be used to add listener on the various events of the DataHandler.
 *         Valid listener are:
 *         data
 *             Will be called when new data arrives, the arguments it receives are:
 *                 type - The connection type as string (db, file etc.)
 *                 data - The data as object or array (for multiple data)
 *         error
 *             Will be called when an error occurs. Receives the following arguments:
 *                 type - The connection type as string (db, file etc.)
 *                 error - The error as object or array (for multiple errors)
 */

'use strict';

const
  // Own modules
  udpwatch = require('./udpwatch'),
  filewatch = require('./filewatch/'),
  lineparser = require('./lineparser'),
  path = require('path'),
  // Node modules
  defaultsDeep = require('merge-defaults'),
  // Mailer variables and log in information
  // mail, icsMail = require('./mail.json'),
  // Class
  EventEmitter = require('events').EventEmitter;

// Config & Co
const DEFAULT_CONNECTION_CONFIG = {
  "db": {
    // TODO: Default DB configuration
  },
  "file": {
    // We don't need to make a log of the file
    log: false,
    // The watching mode ('all', 'append', 'prepend', 'json')
    mode: 'all',
    // Default file: Same dir as the "master" script,
    path: 'data.txt',
    // Default log file
    log_path: __dirname + "/../../../logs/",
    // The default parse function from the lineparser module
    parser: null,
    // default parseOptions
    format: {
      dateFormat: "DD.MM.YYYY hh:mm:ss",
      decimalSeparator: ".",
      valueSeparator: ";",
      dimensions: 1
    },
    // ignored first Lines in File
    ignoredFirstLines: 0
  },
  "udp": {
    // We don't need to make a log of the data
    log: false,
    // TODO: use log_file, if logging
    log_path: '/../../../data/udp/',
    // The watching mode ('all', 'append', 'prepend')
    mode: 'append',
    // Default port for receiving the data from the source
    port: 4000,
    // The default parse function from the lineparser module
    parser: null,
    // default parseOptions
    parseOptions: {
      format: ["date", "time"],
      date: ["DD", "MM", "YYYY"],
      dateSeparator: ".",
      time: ["hh", "mm", "ss"],
      timeSeparator: ":",
      decimalSeparator: ".",
      valueSeparator: ";",
      dimensions: 1
    }
  }
};

const CONNECTION_FN = {
  db: {
    // TODO: Add close function
    close: function() {},
    connect: function(config, emitter) {
      return null;
    }
  },
  file: {
    close: function(config, callback) {
      // End the watching
      filewatch.unwatch(config.path, config.remove, callback);
    },

    connect: function(config, emitter) {
      // Add the function which receives the parsed data; calls the emitter
      config.emitter = emitter;

      this.mode = config.mode || 'test';
      if (config.mode === "json") {
        config.parser = JSON;
      } else if (!config.parser) {
        config.parser = new lineparser(config.format);
      }

      // Start watching the file
      if (typeof config.path === 'string') {
        filewatch.watch(config.mode, config.path, config);
      } else if (Array.isArray(config.path)) {
        for (var i = 0; i < config.path.length; i++) {
          filewatch.watch(config.mode, config.path[i], config);
        }
      }

      // Return the necessary data to end the watcher
      return {
        path: config.path,
        remove: config.log
      };
    }
  },
  udp: {
    close: function(config, callback) {
      // Close the connection
      udpwatch.unwatch(config.port, callback);
    },

    connect: function(config, emitter) {
      // Add the function which recieves the parsed data; calls the emitter
      config.emitter = emitter;

      this.mode = config.mode || 'test';
      if (config.mode === "json") {
        config.parser = JSON;
      } else if (!config.parser) {
        config.parser = (new lineparser(config.format)).run;
      }

      // Start watching the port
      udpwatch.watch(config.port, config);

      // Return the necessary data to end the watcher
      return {
        port: config.port,
        remove: config.log
      };
    }
  }
}

const DEFAULT_LISTENERS = {
  listener: {
    error: function(opt, err) {
      //here is the space for reactions on the mistaken data
      throw new Error(MESSAGES.functions.DataErrorMsgFn(opt.type, err));
    },
    data: function(opt, data) {}
  }
}

/**
 * The data handler class. This module returns an instance of this class for possible connections.
 * To handle incoming data listeners can be bound to the 'data' event.
 * It is possible to create a instance for multiple connection-types.
 */
class DataHandler extends EventEmitter {

  constructor(config) {
    super();
    // Use defaults for undefined values
    config = defaultsDeep(config, DEFAULT_LISTENERS);

    this.connections = {};
    this.config = {};

    // Validate and parser the connections
    this.setConnectionConfiguration(config.connection);

    // parser the given listener
    this.addListeners(config.listener);
  }

  addListeners(listeners) {
    // Check if the listener object is actually a function; in this case the function is assumed to be the 'data'-listener
    for (var kind in listeners) {
      this.on(kind, listeners[kind]);
    }
  }

  createEmitter(type, mode) {
    var self = this;
    // Return a function that receives an potential error and the data;
    // emits a fitting event with the given type information
    return function(error, data) {
      if (error) {
        self.emit('error', {
          type: type,
          mode: mode
        }, error);
      } else if (data) {
        self.emit('data', {
          type: type,
          mode: mode
        }, data);
      }
    };
  }

  setConnectionConfiguration(config) {
    this.config = this.config || {};
    for (let type in config) {
      if (DEFAULT_CONNECTION_CONFIG[type]) {
        config[type] = defaultsDeep(config[type], DEFAULT_CONNECTION_CONFIG[type]);
      }
      if (CONNECTION_FN[type]) {
        this.config[type] = config[type];
      } else {
        this.emit('error', `There was not any function set for "${type}". Request will be ignored.`)
      }
    }
  }

  /**
   * Established all connections
   */
  connect() {
    for (let type in this.config) {
      if (CONNECTION_FN[type]) {
        this.connections[type] = CONNECTION_FN[type].connect.call(this,
          this.config[type],
          // Create a suitable emitter function for the type, this ensures that the correct events get emitted on data occurrence
          this.createEmitter(type, this.config[type].mode)
        );
      }
    }
  }

  /**
   * Closes all connections
   */
  close() {
    for (let type in this.connections) {
      this.connections[type] = CONNECTION_FN[type].close.call(this, this.config[type]);
    }
  }
}

module.exports = DataHandler;
