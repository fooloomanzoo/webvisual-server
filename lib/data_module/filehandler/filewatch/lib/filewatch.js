/*
  FileWatch (modification of copywatch on base of chokidar)
  *********************************************************
  'mode' - mode influences the log/parse mechanism which is used, when the file was updated:
    'append' - log the last bytes of the file (the difference between prevStat.size and currStat.size)
    'prepend' - log the first few bytes of the file (the difference between prevStat.size and currStat.size)
    'all' - log the whole file
  'file' - the file which should be watched
  {options}
    log - a boolean which states if filewatch should make a log
      true - the default, filewatch makes a log
      false - the file won't be copied.
        You will have to give filewatch a emitter-function (a process-function is optional);
        the emitter-function will recieve the file-data on change, so you can work with it.
        If there is not emitter-function than filewatch will throw an error, since there is
        no point in watching a file and doing nothing on change.
    firstLog - a boolean which states if a first log of the file should be made, before the watching starts
    watch_error - a function that gets called, when an error occured during watching
    process - a function which processes each line which is read from the file when a change occures.
      The processed data will be saved as JSON in an array with every line, so it's easier to reread it from the file.
      It need to take the following argument: 'string' (the current line), 'callback' (optional - a function
      that recieves the processed line. Otherwise it will be assumed, that the function returns the data.)
    emitter - a function that recieves the whole emitter of the file, either parsed (if a process function was given) or in raw form,
      every time a change happens.
      Arguments are err (an potential array of errors) and data (an array of the (processed) lines).
*/

(function() {
  'use strict';

  // Require
  const fs = require('fs'),
    chokidar = require('chokidar'),

    // 'Global' variables
    DEFAULT = {
      firstLog: false,
      parser: {
        parse: function(string, callback) {
          callback(null, string);
        }
      },
      work_function: _process_read,
      watch_error: _error_handler,
      watch_settings: {
        persistent: true,
        ignoreInitial: false,
        ignored: [],
        followSymlinks: true,
        useFsEvents: false,
        // usePolling: true,
        // interval: 100,
        // binaryInterval: 300,
        // awaitWriteFinish: {
        // 	stabilityThreshold: 200,
        // 	pollInterval: 100
        // }
        alwaysStat: true,
        ignorePermissionErrors: true,
        atomic: 100
      },
      ignoredFirstLines: 0,
      restartInterval: 10000
    },
    _watchers = new Map(),
    _extension = '.log',
    NEW_LINE = /\r\n|\n\r|\n|\v/, // Every possible NEW_LINE character
    GLOB_PATTERN = /\*|\[|\]|\!|\?/, // characters, containing if a glob pattern
    VALID_MODES = ['append', 'prepend', 'all', 'json', 'once']

    var restartJob = null;
  // Functions

  /*
    Default error_handler
  */
  function _error_handler(err) {
    if (err) {
      if (Array.isArray(err) && err.length === 0) {
        return;
      }
      console.error('An error occured: ', err);
    }
  }

  /*
    Checks if the given mode is valid.
    Returns a boolean.
  */
  function _check_mode(mode) {
    // Is it a string?
    if (typeof mode === 'string') {
      // Make it lowercase
      mode = mode.toLowerCase();

      // and check if it's a valid mode
      if (VALID_MODES.indexOf(mode) === -1) {
        return new Error(mode + ' - Not a valid mode.');
      }
    } else {
      return new TypeError("mode needs to be from type string" +
        " but it's from type " + (typeof mode) + ".");
    }

    // There is no error
    return null;
  }

  /*
    Check if it's a valid file and not something else. Returns an error or null.
  */
  function _check_file(path) {
    var return_error = null;

    if (typeof path !== 'string') {
      return_error = new Error('File path must be a String, '+(typeof path));
    }

    return return_error;
  }

  /*
    Create read/write options
  */
  function _file_options(start, end) {
    var options = {
      readOptions: {},
      writeOptions: {}
    };

    // Create the options for reading and writing
    if (start !== undefined) {
      // Read
      options.readOptions.start = start;
      // Write
      options.writeOptions.start = start;
      options.writeOptions.flags = 'a';
    }
    if (end !== undefined) {
      // old(correct?): Read; the -1 are necessary because the file starts at 0 and otherwise it would read 1 byte too mutch
      options.readOptions.end = end;
    }

    return options;
  }

  /*
    Log
    Copies a file. Simple and plain.
  */
  function _log(path, start, end, parser, emitter, log_path) {
    var options = _file_options(start, end);
    // Copies the file
    fs.createReadStream(log_path, options.readOptions).pipe(fs.createWriteStream(log_path + _extension, options.writeOptions));
  }

  /*
    Process log
    Copies a file and processes it, if a process function is given.
  */
  function _process_log(path, start, end, ignoredFirstLines, parser, callback, finish, log_path) {
    // Define Variables
    // Create the read/write options
    var options = _file_options(start, end).writeOptions,
      write;

    // Set the encoding
    options.encoding = 'utf8';

    function write(errorData, processedData) {
      // Data is the data while arrFn the array function for appending/prepending is
      var data = _watchers.get(path).data || [],
        arrFn;

      // Check for the mode
      if ((start !== undefined) && (end !== undefined)) {
        // Prepend mode
        arrFn = 'unshift';
      } else if (start !== undefined) {
        // Append mode
        arrFn = 'push';
      } else {
        // All mode
        data = [];
        arrFn = 'push';
      }

      // Append/Prepend the new data
      for (var i = 0; i < processedData.length; ++i) {
        data[arrFn](processedData[i]);
      } // Save the datas
      _watchers.get(path).data = data;

      // Init the write stream
      write = fs.createWriteStream(log_path + _extension, options);

      // Write the data and close the stream
      write.end(JSON.stringify(data));

      // Make the callback
      if (callback) callback(errorData, processedData);
    }

    _process_read(path, start, end, ignoredFirstLines, parser, write, finish);
  }

  // Read Process
  function _process_read(path, start, end, ignoredFirstLines, parser, callback, finish) {
    // Define variables
    var processedData = [],
      rawData = [],
      errorData = [],
      readOptions = _file_options(start, end).readOptions,
      read;

    // Set the encoding
    // readOptions.encoding = 'utf8';

    // Create the readstream
    try {
      read = fs.createReadStream(path, readOptions);

      read.on('error', function(err) {
        console.error(err)
        errorData.push({
          path: path,
          details: err + ''
        });
      });

      // We don't want to create functions in loops
      function pushData(err, data, raw) {
        if (err) {
          if (!errorData) {
            errorData = [];
          }
          console.error(err)
          errorData.push({
            path: path,
            details: err + ''
          });
        } else {
          processedData.push(data);
          if (raw) {
            rawData.push(raw);
          }
          if (callback && processedData.length > 1000) {
            // clear stashed data from memory by releasing
            if (errorData.length === 0) errorData = null;
            callback(errorData, processedData, rawData);
            processedData = [];
            rawData = [];
            errorData = [];
          }
        }
      }

      // Reading the stream
      var tmpBuffer = '';

      read.on('readable', function() {
        var data = '',
          chunk;

        // Read the data in the buffer
        while (null !== (chunk = read.read())) {
          data += chunk;
        }

        // There is no data? Well, wtf but we can't work with no data
        if (data === '') return;

        // Split the data
        var tokens = data.split(NEW_LINE);
        // No multiple lines? Then we just read a partial line, add it to the buffer and return.
        if (tokens.length === 1) {
          tmpBuffer += tokens[0];
          return;
        }

        // It is possible, that the last 'line' of the data isn't complete. So we have to store it and wait for the next readable event
        // Complete the first tokens element with the stored data ...
        tokens[0] = tmpBuffer + tokens[0];
        // ... and saves the last element for the next time
        tmpBuffer = tokens.pop();

        // Process every line on their own
        for (var i = ignoredFirstLines; i < tokens.length; ++i) {
          // Skip empty lines
          if (/\S/.test(tokens[i])) {
            // string is not empty and not just whitespace
            parser.run(tokens[i], pushData);
          }
        }
      });

      // End the stream
      read.on('end', function(chunk) {
        // We still need to add the last stored line in tmpBuffer, if there is one
        if (tmpBuffer !== '') {
          parser.run(tmpBuffer, pushData);
        }
        // Are there any errors?
        if (errorData.length === 0) errorData = null;

        if (callback) callback(errorData, processedData);
      });

    } catch (err) {
      console.error(err)
      errorData.push({
        path: path,
        details: err + ''
      });
      if (callback) callback(errorData, processedData);
      if (finish) finish();
    }
  }

  // Read a json file
  function _process_read_json_file(path, start, end, ignoredFirstLines, parser, callback, finish) {
    var processedData = {},
      errorData = [];

    fs.readFile(path, (err, data) => {
      if (err) {
        console.error(err)
        errorData.push({
          path: path,
          details: err + ''
        });
      }
      try {
        processedData = JSON.parse(data);
      } catch (err) {
        console.error(err)
        console.warn('Invalid Format in file ' + path + '.\n' + err);
        errorData.push({
          path: path,
          details: err + ''
        });
      } finally {
        if (errorData.length === 0) errorData = null;
        if (callback) callback(errorData, processedData);
        if (finish) finish();
      }
    });
  }

  /*
    Handle the watch options
  */
  function _create_watch_options(mode, filepath, options) {
    var nOptions = {
      mode: mode,
      firstLog: ((options.firstLog !== undefined) ? options.firstLog : DEFAULT.firstLog),
      watch_error: options.emitter || DEFAULT.watch_error,
      work_function: DEFAULT.work_function,
      parser: options.parser || DEFAULT.parser,
      emitter: options.emitter,
      watch_settings: options.watch_settings || DEFAULT.watch_settings,
      ignoredFirstLines: options.ignoredFirstLines || DEFAULT.ignoredFirstLines,
      restartInterval: options.restartInterval || DEFAULT.restartInterval
    };

    // Helpfunction
    function isFunction(fn) {
      return (typeof fn === 'function');
    }

    // Check if parser/emitter are valid
    if (options.parser && options.parser.run && !isFunction(options.parser.run)) {
      return new TypeError('The parser.run needs to be an function.');
    }
    if (options.emitter && !isFunction(options.emitter)) {
      return new TypeError('The emitter-function needs to be an function.');
    }

    if (mode === 'append' || mode === 'prepend')
      nOptions.watch_settings.alwaysStat = true;

    if (mode === 'once') {
      nOptions.watch_settings.ignoreInitial = false;
    }

    // It was already checked if emitter is a valid function
    if (options.emitter) {
      // Just process the file and give the data to the specified callback
      if (mode === 'json')
      // read option, if you like to watch a json file
        nOptions.work_function = _process_read_json_file;
      else
        nOptions.work_function = _process_read;
    } else {
      /*  There is no point in doing nothing on a change.  This probably
      wasn't the users intention and failing quitly would just confuse. */
      return new Error('Configuration error.\n' +
        'The options specify that filewatch should do something on change are missing-.');
    }

    return nOptions;
  }

  /*
    Handles a valid change event.
  */
  function _handle_change(event, watchpath, path, currStat, prevStat, options) {
    // console.log(event, path, currStat, prevStat);
    if (options.mode === 'append') {
      if (currStat < prevStat) {
        if (options.emitter) {
          options.emitter([{
            path: path,
            details: 'new file size is smaller then previous'
          }]);
        }
        return;
      }
      else {
        if (event === 'add')
          options.work_function(path, prevStat, currStat, options.ignoredFirstLines, options.parser, options.emitter, null, options.log_path);
        else
          options.work_function(path, prevStat, currStat, 0, options.parser, options.emitter, null, options.log_path);
      }
    } else if (options.mode === 'prepend') {
      if (currStat < prevStat) {
        if (options.emitter) {
          options.emitter([{
            path: path,
            details: 'new file size is smaller then previous'
          }]);
        }
        return;
      }
      else {
        if (event === 'add')
          options.work_function(path, 0, (currStat - prevStat), options.ignoredFirstLines, options.parser, options.emitter, null, options.log_path);
        else
          options.work_function(path, 0, (currStat - prevStat), 0, options.parser, options.emitter, null, options.log_path);
      }
    } else {
      // 'once', 'all', 'json'
      var finish;
      if (options.mode === 'once') {
        if (!watchpath.match(GLOB_PATTERN)) {
          finish = unwatch(watchpath, null, options.emitter);
        } else {
          var watcher = _watchers.get(watchpath);
          if (watcher._prevStats) {
            watcher._prevStats.delete(path);
          }
        }
      }
      options.work_function(path, undefined, undefined, options.ignoredFirstLines, options.parser, options.emitter, finish, options.log_path);
    }
  }

  // PUBLIC

  /*
    Unwatch a file
      path - path to the file
      remove - bool value: delete the version, or leave it?
  */
  function unwatch(path, remove, callback) {
    // Make the path an absolute path
    var watcher;
    if (_watchers.has(path)) {
      console.log('Stoped watching file:' + path);
      watcher = _watchers.get(path);
      watcher.close();
      watcher.removeAllListeners();

      _watchers.delete(path);
      watcher = null;

      if (remove) {
        return fs.unlink(path, (callback || _error_handler));
      } if (callback) return callback();
    } else {
      if (callback) {
        return callback(new Error('No such file is watched.'));
      }
    }
  }

  /*
    Unwatch for every watcher, when all _watchers are closed the callback is called with a array of potential errors
      remove - bool value: delete the log versions, or leave them?
      callback - callback function, gets an array of potential errors
  */
  function clear(remove, callback) {
    var errors = [],
      path, handler;

    // We don't want to define functions in loops
    handler = function(err) {
      if (err) errors.push(err);

      /*  When all _watchers are destroyed, call the callback.
        If there is no callback, call the default handler.
        If there are no errors and no callback, do nothing. */
      if (_watchers.size === 0) {
        return (callback || _error_handler)(errors.length > 0 ? errors : undefined);
      }
    };

    // Was there a single call? ...
    var called = false;
    _watchers.forEach(function(watcher, path) {
      called = true;
      unwatch(path, remove, handler);
    })

    _watchers.clear();

    // ... if not, make at least the callback
    if (!called && callback) callback();
  }

  function watch(mode, watchpath, options, callback) {
    // Define variables
    let listenersObj, nextObj,
      // Other stuff
      maybeError;

    // Check if the given mode is a valid one; if not throw an error
    maybeError = _check_mode(mode);
    if (maybeError) throw maybeError;

    // Check if it's a valid filepath
    maybeError = _check_file(watchpath);
    if (maybeError) throw maybeError;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    // Process the options; use default values if necessary
    options = _create_watch_options(mode, watchpath, options || {});

    if (callback == undefined) callback = options.watch_error;

    // Did we recieve an error? If yes, then call the next function with this error
    if (options instanceof Error) {
      return callback(options);
    }

    // watch the file
    if (_watchers.has(watchpath)) {
      unwatch(watchpath, null, callback);
    }
    let watcher =
    _watchers.set(watchpath, new chokidar.watch(watchpath, options.watch_settings)
      .on('add', (_path, stats) => {
        if (mode !== 'once') {
          console.log(`File ${_path} is being added to watch`);
        } else {
          console.log(`File ${_path} is being processed once`);
        }
        _handle_change('add', watchpath, _path, stats.size, 0, options);
        if (!watcher._prevStats) watcher._prevStats = new Map();
        watcher._prevStats.set(_path, stats.size);
      })
      .on('change', (_path, stats) => {
        if (mode !== 'once') {
          // if (stats)
          //   console.log(`File ${_path} changed size from ${watcher._prevStats.get(_path)} to ${stats.size}`);
          if (!watcher._prevStats) watcher._prevStats = new Map();
          _handle_change('change', watchpath, _path, stats.size, watcher._prevStats.get(_path), options);
          watcher._prevStats.set(_path, stats.size);
        }
      })
      .on('unlink', _path => {
        if (options.mode !== 'once') {
          console.log(`File ${_path} has been removed or is not present. Waiting for creating`)
        }
      })
      .on('error', error => {
        console.log(`File Error (module: filewatch.js, chokidar): ${error}`);
        if (!restartJob) {
          restartJob = setTimeout(() => {
            watch(mode, watchpath, options, callback);
            clearTimeout(restartJob);
            restartJob = null;
          }, this.options.restartInterval)
        }
      }));
    callback();
  }

  /*
   * Get all paths of watched files
   */
  function keys() {
    let paths = _watchers.keys();
    console.info(`All watched paths are: ${paths}`);
    return paths;
  }

  /*
   * Get all watch instances
   */
  function get() {
    return _watchers;
  }

  // Exported functions
  module.exports = {
    // Private variables
    _watcher: _watchers,
    DEFAULT: DEFAULT,
    // Private functions
    _error_handler: _error_handler,
    _check_mode: _check_mode,
    _check_file: _check_file,
    _file_options: _file_options,
    _log: _log,
    _process_log: _process_log,
    _process_read: _process_read,
    _create_watch_options: _create_watch_options,
    _handle_change: _handle_change,
    // Public
    watch: watch,
    unwatch: unwatch,
    clear: clear,
    keys: keys,
    get: get
  };
})();
