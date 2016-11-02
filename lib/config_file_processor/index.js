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
		for (let facility in userConfigFiles) {
			this.settings[facility] = {};

      this.paths[facility] = path.resolve(userConfigFiles[facility].path);
      console.log(facility, this.paths[facility]);

			if (this.filehandler[facility]) {
				this.filehandler[facility].close();
				delete this.filehandler[facility];
			}

			let listener = {
				error: (function(option, err) {
					let errString = '';
					err.forEach(function(msg) {
						errString += 'path: ' + msg.path + '\n' + msg.details + '\n';
					})
					this.emit('error', option.type + '\n' + errString);
				}).bind(this),
				data: (function(type, data, facility, path) {
					if (data && facility) {
						this.access(facility, data);
					}
				}).bind(this)
			}
			let connection = {
				file: {
					'mode': 'json',
					'path': this.paths[facility]
				}
			}
			this.filehandler[facility] = new DataFileHandler({
				id: facility,
				connection: connection,
				listener: listener
			});
			this.filehandler[facility].connect();
		}
	}

	unwatch() {
		for (let facility in this.filehandler) {
			this.filehandler[facility].close();
			this.filehandler[facility] = null;
			delete this.filehandler[facility];
			this.paths[facility] = null;
			delete this.paths[facility];
			this.settings[facility].configuration = null;
			delete this.settings[facility].configuration;
			this.settings[facility].dataConfig = null;
			delete this.settings[facility].dataConfig;
			this.settings[facility].connection = null;
			delete this.settings[facility].connection;
			this.settings[facility] = null;
			delete this.settings[facility];
		}
	}

	access(facility, data, callback) {
		let err;
		// try {
			let dataConfig = {};

			for (let system in data) {
        this.settings[facility][system] = {};

        this.settings[facility][system].connection = data[system].connections;
        this.settings[facility][system].clientRequest = data[system].clientRequest;
        this.settings[facility][system].cache = data[system].cache;
        this.settings[facility][system].valueModel = data[system].valueType || defaults.value;

				dataConfig = this._arrange( system,
                                            data[system].locals,
                                            data[system].valueType || defaults.value,
                                            data[system].svg );

        for (let key in dataConfig) {
          this.settings[facility][system][key] = dataConfig[key];
        }

				// deep merge of selectable paths in svg-source
				// for (var path in dataConfig[system].svg) {
				// 	if (!this.settings[facility][system].svg[path])
				// 		this.settings[facility][system].svg[path] = {};
				// 	for (var indent in dataConfig[system].svg[path]) {
				// 		this.settings[facility][system].svg[path][indent] = dataConfig[system].svg[path][indent];
				// 	}
				// }
			}
		// } catch (err) {
		// 	this.emit('error', 'File Configuration: ' + facility + '\n' + JSON.stringify(err));
    //   return;
		// }
		this.emit('changed', facility);
	}

	_arrange(system, locals, valueModel, svg) {
		if (!locals || !locals.units)
			return; // Check the Existence
    let err;

    // try {

  		let units = []
  		  , indents = []
  		  , elementMap = {}
  		  , type
  		  , keys = locals.unnamedType ? Object.keys(locals.unnamedType.keys) : [];

  		// all defined units are processed
  		for (let i = 0; i < locals.units.length; i++) {
  			// ignored if set in locals.ignore
  			if (locals.ignore && locals.ignore.indexOf(i) == -1) {
  				type = locals.units[i] || {};
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
  				// indent has to be different from unnamedType
  				if (!type.indent || type.indent === locals.unnamedType.indent)
  					type.indent += i;
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
  				elementMap[type.indent] = type;
  				// initial Values
  				// type.values = valueModel;
  				units.push(type);
  				indents.push(type.indent);
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

  		for (let indent in elementMap) {
  			for (let key of groupingKeys) {
  				if (!groupMap[key])
  					groupMap[key] = {};
  				else if (groupMap[key].indents)
  					groupMap[key].indents = groupMap[key].indents.filter(
              function(el) {
    						el in indents
    					});

  				needToSet = true;
  				where = (key === '*' ? '*' : elementMap[indent].keys[key] || '');

  				for (let subgroup in groupMap[key])
  					if (groupMap[key][subgroup].indents && groupMap[key][subgroup].indents.indexOf(indent) !== -1) {
  						needToSet = false;
  						break;
  					}

  				if (needToSet) {
  					if (!groupMap[key][where])
  						groupMap[key][where] = {};
  					if (!groupMap[key][where].indents)
  						groupMap[key][where].indents = [];
  					groupMap[key][where].indents.push(indent);
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
  				if (!groupMap[group][subgroup].indents) continue;
  				source = '';
  				sameSource = true;
  				for (let indent of groupMap[group][subgroup].indents) {
  					if (elementMap[indent] && elementMap[indent].svg && elementMap[indent].svg.source) {
  						if (source && source !== elementMap[indent].svg.source) {
  							sameSource = false;
  							break;
  						} else {
  							source = elementMap[indent].svg.source;
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
            'indents': groupMap[group][subgroup].indents,
            'svg': groupMap[group][subgroup].svg
          } );
  			}
        i++;
  		}

  		// Setting Global SVG-Selectables
  		for (let indent in elementMap) {
  			if (elementMap[indent] && elementMap[indent].svg && elementMap[indent].svg.source) {
  				source = elementMap[indent].svg.source
  				if (!svg)
  					svg = {};
  				if (!svg[source])
  					svg[source] = {};
  				if (elementMap[indent].svg.path)
  					svg[source][indent] = elementMap[indent].svg.path;
  			}
  		}

  		return {
  			system: system,
  			units: units,
  			indents: indents,
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

    // } catch (err) {
    //   this.emit('error', 'File Configuration Preparation: ' + JSON.stringify(err));
    //   return;
    // }
	};

	_test(filepath) {};

};

module.exports = ConfigFileProcessor;
