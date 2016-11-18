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
	isIndicatorLamp: false,
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
		for (let i in userConfigFiles) {
      let facility = userConfigFiles[i].name;

			this.settings[facility] = {};
			this.settings[facility]._name = userConfigFiles[i].name;
			this.settings[facility]._title = userConfigFiles[i].title;

      this.paths[facility] = path.resolve(userConfigFiles[i].path);

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
					this.emit('error', option.item + '\n' + errString);
				}).bind(this),
				data: (function(opt, data, id) {
					this.access(facility, data);
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

			for (let i in data) {

        let system = data[i].name;

        this.settings[facility][system] = {};

        this.settings[facility][system]._name = data[i].name;
        this.settings[facility][system]._title = data[i].title;

        this.settings[facility][system].connection = data[i].connections;
        this.settings[facility][system].clientRequest = data[i].clientRequest;
        this.settings[facility][system].cache = data[i].cache;
        this.settings[facility][system].valueModel = data[i].valueItem || defaults.value;

				dataConfig = this._arrange( facility,
                                    system,
                                    data[i].locals,
                                    data[i].valueItem || defaults.value,
                                    data[i].svg );

        for (let key in dataConfig) {
          this.settings[facility][system][key] = dataConfig[key];
        }

				// deep merge of selectable paths in svg-source
				// for (var path in dataConfig[system].svg) {
				// 	if (!this.settings[facility][system].svg[path])
				// 		this.settings[facility][system].svg[path] = {};
				// 	for (var id in dataConfig[system].svg[path]) {
				// 		this.settings[facility][system].svg[path][id] = dataConfig[system].svg[path][id];
				// 	}
				// }
			}
		// } catch (err) {
		// 	this.emit('error', 'File Configuration: ' + facility + '\n' + JSON.stringify(err));
    //   return;
		// }
		this.emit('changed', facility);
	}

	_arrange(facility, system, locals, valueModel, svg) {
		if (!locals || !locals.items)
			return; // Check the Existence
    let err;

    // try {

  		let items = []
  		  , itemMap = {}
  		  , item
  		  , keys = locals.unnamedItem ? Object.keys(locals.unnamedItem.keys) : [];

  		// all defined items are processed
  		for (let i = 0; i < locals.items.length; i++) {
  			// ignored if set in locals.ignore
  			if (locals.ignore && locals.ignore.indexOf(i) == -1) {
  				item = locals.items[i] || {};
  				// if keys don't exist in locals
  				Object.keys(defaults).forEach(function(key) {
  					if (item[key] === undefined) {
  						item[key] = defaults[key];
  					}
  				})
          item.system = system;
          item.facility = facility;
  				if (!item.keys)
  					item.keys = {};
  				for (var j = 0; j < keys.length; j++) {
  					item.keys[keys[j]] = item.keys[keys[j]] || locals.unnamedItem.keys[keys[j]];
  				}
  				// id has to be different from unnamedItem
  				if (!item.id || item.id === locals.unnamedItem.id)
  					item.id += i;

          item.mount = item.facility + '/' + item.system + '/' + item.id;

  				// exceedable if threshold exists
  				if (item.threshold && (item.threshold.from !== undefined || item.threshold.to  !== undefined))
  					item.exceedable = true;
  				else {
  					item.exceedable = false;
            delete item.threshold
          }
          // svg
          if (item.svg && (!item.svg.path || !item.svg.source)) {
            delete item.svg;
          }
  				// for Element structure
  				itemMap[item.id] = item;
  				// initial Values
  				// item.values = valueModel;
  				items.push(item);
  			}
  		}

  		// GROUPING

  		let needToSet
        , where
        , groupMap = locals.exclusiveGroups
      	, groupingKeys = locals.groupingKeys;

  		let preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

  		for (let id in itemMap) {
  			for (let key of groupingKeys) {
  				if (!groupMap[key])
  					groupMap[key] = {};
  				else if (groupMap[key].items)
  					groupMap[key].items = groupMap[key].items.filter(
              function(el) {
    						el in itemMap
    					});

  				needToSet = true;

          if (!itemMap[id].keys[key]) {
            continue;
          }

          where = itemMap[id].keys[key];

  				for (let subgroup in groupMap[key])
  					if (groupMap[key][subgroup].items && groupMap[key][subgroup].items.indexOf(id) !== -1) {
  						needToSet = false;
  						break;
  					}

  				if (needToSet) {
  					if (!groupMap[key][where])
  						groupMap[key][where] = {};
  					if (!groupMap[key][where].items)
  						groupMap[key][where].items = [];
  					groupMap[key][where].items.push(id);
  				}
  			}
  		}
  		// Setting SVG for Groups
  		let sameSource
        , source
        , selectable
        , groups = []
        , i = 0;

  		for (let group in groupMap) {
        groups.push( {
          'key': group,
          'groups': []
        } );
  			for (let subgroup in groupMap[group]) {
  				if (!groupMap[group][subgroup].items) continue;
  				source = '';
  				sameSource = true;
  				for (let id of groupMap[group][subgroup].items) {
  					if (itemMap[id] && itemMap[id].svg && itemMap[id].svg.source) {
  						if (source && source !== itemMap[id].svg.source) {
  							sameSource = false;
  							break;
  						} else {
  							source = itemMap[id].svg.source;
  						}
  					}
  				}
  				if (sameSource) {
  					groupMap[group][subgroup].svg = {
  						source: source
  					}
  				}
          groups[i].groups.push( {
            'title': subgroup,
            'items': groupMap[group][subgroup].items,
            'svg': groupMap[group][subgroup].svg
          } );
  			}
        i++;
  		}

  		// Setting Global SVG-Selectables
  		for (let id in itemMap) {
  			if (itemMap[id] && itemMap[id].svg && itemMap[id].svg.source) {
  				source = itemMap[id].svg.source
  				if (!svg)
  					svg = {};
  				if (!svg[source])
  					svg[source] = {};
  				if (itemMap[id].svg.path)
  					svg[source][id] = itemMap[id].svg.path;
  			}
  		}

  		return {
  			system: system,
  			items: items,
  			groupMap: groupMap,
  			itemMap: itemMap,
  			groups: groups,
  			groupingKeys: locals.groupingKeys,
  			preferedGroupingKey: preferedGroupingKey,
  			keys: keys,
  			unnamedItem: locals.unnamedItem,
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
