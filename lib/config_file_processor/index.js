'use strict';

const fs = require('fs')
    , path = require('path')
    , util = require('util')
    , EventEmitter = require('events').EventEmitter
    , DataFileHandler = require('../data_module/filehandler').DataFileHandler;

var defaults = {
	values: [],
	keys: [],
	unit: '',
	color: '',
	exceedable: false,
	isExceeding: false,
	isBoolean: false,
	threshold: {
		from: undefined,
		to: undefined
	}
};

class ConfigFileProcessor extends EventEmitter {

	constructor(userConfigFiles) {
		super();
		this.settings = {};
    this.paths = {};
    this.filehandler = {};
		if (userConfigFiles)
			this.watch(userConfigFiles);
	}

	watch(userConfigFiles) {
		// check User Data and folder
		for (let route in userConfigFiles) {
			this.settings[route] = {};

      this.paths[route] = path.resolve(userConfigFiles[route].path);
      console.log(route, this.paths[route]);

			if (this.filehandler[route]) {
				this.filehandler[route].close();
				delete this.filehandler[route];
			}

			let listener = {
				error: (function(option, err) {
					let errString = '';
					err.forEach(function(msg) {
						errString += 'path: ' + msg.path + '\n' + msg.details + '\n';
					})
					this.emit('error', option.type + '\n' + errString);
				}).bind(this),
				data: (function(type, data, route, path) {
					if (data && route) {
						this.access(route, data);
					}
				}).bind(this)
			}
			let connection = {
				file: {
					'mode': 'json',
					'path': this.paths[route]
				}
			}
			this.filehandler[route] = new DataFileHandler({
				id: route,
				connection: connection,
				listener: listener
			});
			this.filehandler[route].connect();
		}
	}

	unwatch() {
		for (let route in this.filehandler) {
			this.filehandler[route].close();
			this.filehandler[route] = null;
			delete this.filehandler[route];
			this.paths[route] = null;
			delete this.paths[route];
			this.settings[route].configuration = null;
			delete this.settings[route].configuration;
			this.settings[route].dataConfig = null;
			delete this.settings[route].dataConfig;
			this.settings[route].connection = null;
			delete this.settings[route].connection;
			this.settings[route] = null;
			delete this.settings[route];
		}
	}

	access(route, data, callback) {
		let err;
		try {
			let configuration = {
				elementMap: {},
				elementArray: {},
				groupMap: {},
				groupArray: {},
				groupingKeys: {},
				preferedGroupingKeys: {},
				labels: [],
				valueModel: {},
				svg: {}
			};
			let dataConfig = {};
			let connection = {};
			let clientRequest = {};
			let cache = {};

			this.settings[route].configuration = {};
			this.settings[route].dataConfig = {};
			this.settings[route].connection = {};
			this.settings[route].clientRequest = {};
			this.settings[route].cache = {};

			for (let label in data) {
				if (configuration.labels.indexOf(label) === -1)
					configuration.labels.push(label);
				configuration.valueModel[label] = data[label].valueType || defaults.value;

				dataConfig[label] = this._arrange( label, data[label].locals, configuration.valueModel[label], data[label].svg );

				configuration.groupingKeys[label] = dataConfig[label].groupingKeys;
				configuration.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
				configuration.groupMap[label] = dataConfig[label].groupMap;
				configuration.elementMap[label] = dataConfig[label].elementMap;
				configuration.groupArray[label] = dataConfig[label].groupArray;
				configuration.elementArray[label] = dataConfig[label].types;
				configuration.valueModel[label] = dataConfig[label].valueModel;

				// deep merge of selectable paths in svg-source
				for (var path in dataConfig[label].svg) {
					if (!configuration.svg[path])
						configuration.svg[path] = {};
					for (var id in dataConfig[label].svg[path]) {
						configuration.svg[path][id] = dataConfig[label].svg[path][id];
					}
				}

				connection[label] = data[label].connections;
				clientRequest[label] = data[label].clientRequest;
				cache[label] = data[label].cache;
			}
			this.settings[route].configuration = configuration;
			this.settings[route].dataConfig = dataConfig;
			this.settings[route].connection = connection;
			this.settings[route].clientRequest = clientRequest;
			this.settings[route].cache = cache;

		} catch (err) {
			this.emit('error', 'File Configuration: ' + route + '\n' + JSON.stringify(err));
      return;
		}
		this.emit('changed', route);
	}

	_arrange(label, locals, valueModel, svg) {
		if (!locals || !locals.types)
			return; // Check the Existence
    let err;

    try {

  		let types = []
  		  , ids = []
  		  , elementMap = {}
  		  , type
  		  , keys = locals.unnamedType ? Object.keys(locals.unnamedType.keys) : [];

  		// all defined types are processed
  		for (let i = 0; i < locals.types.length; i++) {
  			// ignored if set in locals.ignore
  			if (locals.ignore && locals.ignore.indexOf(i) == -1) {
  				type = locals.types[i] || {};
  				// if keys don't exist in locals
  				Object.keys(defaults).forEach(function(key) {
  					if (type[key] === undefined) {
  						type[key] = defaults[key];
  					}
  				})
  				if (!type.keys)
  					type.keys = {};
  				for (var j = 0; j < keys.length; j++) {
  					type.keys[keys[j]] = type.keys[keys[j]] || locals.unnamedType.keys[keys[j]];
  				}
  				// id has to be different from unnamedType
  				if (!type.id || type.id === locals.unnamedType.id)
  					type.id += i;
  				// exceedable if threshold exists
  				if (type.threshold && (type.threshold.from !== undefined || type.threshold.to  !== undefined))
  					type.exceedable = true;
  				else {
  					type.exceedable = false;
            delete type.threshold
          }
          // svg
          if (type.svg && (!type.svg.path || !type.svg.source)) {
            delete type.svg;
          }
  				// for Element structure
  				elementMap[type.id] = type;
  				// initial Values
  				// type.values = valueModel;
  				types.push(type);
  				ids.push(type.id);
  			}
  		}

  		// GROUPING

  		let needToSet
        , where
        , groupMap = locals.exclusiveGroups
      	, groupingKeys = locals.groupingKeys;

  		if (groupingKeys.indexOf('*') == -1) {
  			groupingKeys.push('*'); // all elementMap
  		}
  		let preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

  		for (let id in elementMap) {
  			for (let key of groupingKeys) {
  				if (!groupMap[key])
  					groupMap[key] = {};
  				else if (groupMap[key].ids)
  					groupMap[key].ids = groupMap[key].ids.filter(
              function(el) {
    						el in ids
    					});

  				needToSet = true;
  				where = (key === '*' ? '*' : elementMap[id].keys[key] || '');

  				for (let subgroup in groupMap[key])
  					if (groupMap[key][subgroup].ids.indexOf(id) !== -1) {
  						needToSet = false;
  						break;
  					}

  				if (needToSet) {
  					if (!groupMap[key][where])
  						groupMap[key][where] = {};
  					if (!groupMap[key][where].ids)
  						groupMap[key][where].ids = [];
  					groupMap[key][where].ids.push(id);
  				}
  			}
  		}
  		// Setting SVG for Groups
  		let sameSource
        , source
        , selectable
        , groupArray = []
        , i = 0;

  		for (let group in groupMap) {
        groupArray.push( {
          'key': group,
          'groups': []
        } );
  			for (let subgroup in groupMap[group]) {
  				if (!groupMap[group][subgroup].ids) continue;
  				source = '';
  				sameSource = true;
  				for (let id of groupMap[group][subgroup].ids) {
  					if (elementMap[id] && elementMap[id].svg && elementMap[id].svg.source) {
  						if (source && source !== elementMap[id].svg.source) {
  							sameSource = false;
  							break;
  						} else {
  							source = elementMap[id].svg.source;
  						}
  					}
  				}
  				if (sameSource) {
  					groupMap[group][subgroup].svg = {
  						source: source
  					}
  				}
          groupArray[i].groups.push( {
            'title': subgroup,
            'ids': groupMap[group][subgroup].ids,
            'svg': groupMap[group][subgroup].svg
          } );
  			}
        i++;
  		}

  		// Setting Global SVG-Selectables
  		for (let id in elementMap) {
  			if (elementMap[id] && elementMap[id].svg && elementMap[id].svg.source) {
  				source = elementMap[id].svg.source
  				if (!svg)
  					svg = {};
  				if (!svg[source])
  					svg[source] = {};
  				if (elementMap[id].svg.path)
  					svg[source][id] = elementMap[id].svg.path;
  			}
  		}

  		return {
  			label: label,
  			types: types,
  			ids: ids,
  			groupMap: groupMap,
  			elementMap: elementMap,
  			groupArray: groupArray,
  			groupingKeys: locals.groupingKeys,
  			preferedGroupingKey: preferedGroupingKey,
  			keys: keys,
  			unnamedType: locals.unnamedType,
  			timeFormat: locals.timeFormat,
  			ignore: locals.ignore,
  			svg: svg
  		};

    } catch (err) {
      this.emit('error', 'File Configuration Preparation: ' + JSON.stringify(err));
      return;
    }
	};

	_test(filepath) {};

};

module.exports = ConfigFileProcessor;
