'use strict';

const path = require('path'),
  EventEmitter = require('events').EventEmitter,
  DataFileHandler = require('../data-module/filehandler').DataFileHandler;

const defaults = {
  id: '',
  keys: [],
  unit: '',
  color: '',
  exceedable: false,
  isSignal: false,
  threshold: {
    from: undefined,
    to: undefined
  }
};

class ConfigFileProcessor extends EventEmitter {

  constructor(configfiles, databaseConfig) {
    super();
    this.config = {};
    this.paths = {};
    this.filehandler = {};
    this.databaseConfig = databaseConfig || {};
    if (configfiles)
      this.watch(configfiles);
  }

  watch(configfiles, databaseConfig) {
    if (!configfiles) {
      console.error('No configfiles are given')
      return
    }
    if (databaseConfig)
      this.databaseConfig = databaseConfig || {};
    // check User Data and folder
    for (let i in configfiles) {
      let facility = configfiles[i].name;

      this.config[facility] = {};
      this.config[facility]._name = configfiles[i].name;
      this.config[facility]._title = configfiles[i].title;

      this.paths[facility] = path.resolve(configfiles[i].path);

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
        data: (function(opt, data) {
          if (!data)
            return;
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
      this.config[facility].configuration = null;
      delete this.config[facility].configuration;
      this.config[facility].connection = null;
      delete this.config[facility].connection;
      this.config[facility] = null;
      delete this.config[facility];
    }
  }

  access(facility, data) {

    let views = ['list', 'groups', 'detail'],
      items;
    try {

      for (let i = 0; i < data.length; i++) {

        let system = data[i].name;
        this.config[facility][system] = {};

        this.config[facility][system]._name = data[i].name;
        this.config[facility][system]._title = data[i].title;
        this.config[facility][system]._view = (data[i].view && data[i].view.initial && views.indexOf(data[i].view.initial) !== -1) ? data[i].view.initial : 'list';
        this.config[facility][system].clientRequest = data[i].clientRequest;
        this.config[facility][system].locals = [];

        if (this.config[facility][system].database) {
          if (this.databaseConfig) {
            for (let key in this.databaseConfig) {
              if (this.config[facility][system].database[key] === undefined) {
                this.config[facility][system].database[key] = this.databaseConfig[key];
              }
            }
          }
        } else if (this.databaseConfig) {
          this.config[facility][system].database = this.databaseConfig;
        }

        // setting item propertires
        for (let j = 0; j < data[i].locals.length; j++) {
          this.config[facility][system].locals.push(this._arrange(facility, system, data[i].locals[j]));
        }

        this.config[facility][system].groups = [];
        this.config[facility][system].groupingKeys = [];
        this.config[facility][system].svgSource;
        this.config[facility][system].groupMap;
        this.config[facility][system].itemMap = new Map();
        this.config[facility][system].items = [];
        // combining properties
        for (let j = 0; j < this.config[facility][system].locals.length; j++) {
          this.config[facility][system].itemMap = new Map([...this.config[facility][system].itemMap, ...this.config[facility][system].locals[j].itemMap]);
          this.config[facility][system].groupingKeys = [...new Set([...this.config[facility][system].groupingKeys, ...this.config[facility][system].locals[j].groupingKeys])];
          this.config[facility][system].preferedGroupingKey = this.config[facility][system].locals[j].preferedGroupingKey;
          if (!this.config[facility][system].svgSource) {
            this.config[facility][system].svgSource = this.config[facility][system].locals[j].svgSource;
          } else {
            for (let p in this.config[facility][system].locals[j].svgSource) {
              if (this.config[facility][system].svgSource[p]) {
                items = new Set([...this.config[facility][system].svgSource[p].items, ...this.config[facility][system].locals[j].svgSource[p].items]);
                this.config[facility][system].svgSource[p].items = [...items];
              } else {
                this.config[facility][system].svgSource[p] = this.config[facility][system].locals[j].svgSource[p];
              }
            }
          }
          if (!this.config[facility][system].groupMap) {
            this.config[facility][system].groupMap = this.config[facility][system].locals[j].groupMap;
          } else {
            for (let key in this.config[facility][system].locals[j].groupMap) {
              if (this.config[facility][system].groupMap[key]) {
                for (let subgroup in this.config[facility][system].locals[j].groupMap[key]) {
                  if (this.config[facility][system].groupMap[key][subgroup]) {
                    items = new Set([...this.config[facility][system].groupMap[key][subgroup].items, ...this.config[facility][system].locals[j].groupMap[key][subgroup].items]);
                    this.config[facility][system].groupMap[key][subgroup].items = [...items];
                    if (this.config[facility][system].groupMap[key][subgroup].svg !== this.config[facility][system].locals[j].groupMap[key][subgroup].svg) {
                      this.config[facility][system].groupMap[key][subgroup].svg = '';
                    }
                  } else {
                    this.config[facility][system].groupMap[key][subgroup] = this.config[facility][system].locals[j].groupMap[key][subgroup];
                  }
                }
              } else {
                this.config[facility][system].groupMap[key] = this.config[facility][system].locals[j].groupMap[key];
              }
            }
          }
        }

        this.config[facility][system].itemMap.forEach( item => {
          this.config[facility][system].items.push(item);
        })

        let k = 0
        for (let key in this.config[facility][system].groupMap) {
          this.config[facility][system].groups.push({
            'key': key,
            'groups': []
          });
          for (let subgroup in this.config[facility][system].groupMap[key]) {
            this.config[facility][system].groups[k].groups.push({
              'title': subgroup,
              'items': this.config[facility][system].groupMap[key][subgroup].items,
              'svg': this.config[facility][system].groupMap[key][subgroup].svg
            });
          }
          k++;
        }
        this.config[facility][system].preferedGroupingKey = this.config[facility][system]._view === 'detail' ? '' : this.config[facility][system].preferedGroupingKey;
      }
    } catch (err) {
      this.emit('error', `File Configuration: ${facility} \n ${err.stack}`);
      return;
    }
    this.emit('change', this.config[facility], facility);
  }

  _arrange(facility, system, locals) {

    if (!locals || !locals.items) return; // Check the Existence
    // try {
    const items = [],
      groupingKeysByKeys = !(locals.groupingKeys && locals.groupingKeys.length),
      itemMap = new Map(),
      groupMap = {},
      groupingKeys = new Set(locals.groupingKeys || []),
      svgSource = locals.svgSource || {},
      defaultItem = locals.defaultItem || defaults;

    for (let key in defaults) {
      if (defaultItem[key] === undefined) {
        defaultItem[key] = defaults[key];
      }
    }

    const keys = defaultItem && defaultItem.keys ? Object.keys(defaultItem.keys) : [];

    // Setting Global SVG-Selectables
    for (let p in svgSource) {
      let base = path.basename(p);
      if (p !== base) {
        svgSource[base] = svgSource[p];
        delete svgSource[p];
      }
    }

    // all defined items are processed
    for (let i = 0; i < locals.items.length; i++) {
      // ignored if set in locals.ignore
      if (locals.ignore && locals.ignore.indexOf(i) == -1) {
        let item = locals.items[i] || {};
        // if keys don't exist in locals
        Object.keys(defaultItem).forEach(function(key) {
          if (item[key] === undefined) {
            item[key] = defaultItem[key];
          }
        })
        item.system = system;
        item.facility = facility;

        // id has to be different from defaultItem
        if (!item.id || item.id === locals.defaultItem.id)
          item.id += '' + i;

        // setting 'mount' for requesting data for the item
        //   <-- 'mount' as the global identifier
        item.mount = item.facility + '/' + item.system + '/' + item.id;

        if (!item.keys)
          item.keys = {};
        if (!item.keys.name)
          item.keys.name = item.id;

        for (let j = 0; j < keys.length; j++) {
          item.keys[keys[j]] = item.keys[keys[j]] !== undefined ? item.keys[keys[j]] : defaultItem.keys[keys[j]];
          if (groupingKeysByKeys) {
            groupingKeys.set(keys[j]);
          }
        }

        // exceedable if threshold exists
        if (item.threshold && (item.threshold.from !== undefined || item.threshold.to !== undefined))
          item.exceedable = true;
        else {
          item.exceedable = false;
          delete item.threshold
        }
        // svg
        if (item.svg && item.svg.path) {
          let svgPath = path.parse(item.svg.path);
          if (!(item.svg.selector && svgPath.base && svgPath.dir)) {
            console.log(item.svg.selector && svgPath.base && svgPath.dir);
            delete item.svg;
          } else {
            item.svg.path = svgPath.base;
            item.svg.dir = svgPath.dir;
            if (!svgSource[svgPath.base])
              svgSource[svgPath.base] = {
                items: {}
              };
            if (!svgSource[svgPath.base].items)
              svgSource[svgPath.base].items = {};
            svgSource[svgPath.base].items[item.id] = item.svg.selector;
          }
        }
        // for Element structure
        itemMap.set(item.id, item);
        // initial Values
        items.push(item);
      }
    }

    // GROUPING

    let where, preferedGroupingKey = locals.preferedGroupingKey || (locals.groupingKeys && locals.groupingKeys[0]) || '';

    for (let key in locals.exclusiveGroups) {
      for (let subgroup in locals.exclusiveGroups[key]) {
        if (Array.isArray(locals.exclusiveGroups[key][subgroup].items)) {
          locals.exclusiveGroups[key][subgroup].items = [...new Set(locals.exclusiveGroups[key][subgroup].items)];
        } else {
          locals.exclusiveGroups[key][subgroup].items = [];
        }
      }
      groupMap[key] = locals.exclusiveGroups[key];
    }

    itemMap.forEach((item, id) => {
      groupingKeys.forEach(key => {
        if (!groupMap[key])
          groupMap[key] = {};
        else if (groupMap[key].items)
          groupMap[key].items = groupMap[key].items.filter(
            function(el) {
              el in itemMap
            });

        let needToSet = true;

        if (item.keys[key]) {
          where = item.keys[key];

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
      })
    })

    groupingKeys.forEach(key => {
      groupMap[key][''] = {
        items: [...itemMap.keys()]
      }
    })

    // Setting SVG for Groups
    for (let key in groupMap) {
      for (let subgroup in groupMap[key]) {
        if (!groupMap[key][subgroup].items) continue;
        let p = '';
        let dir = '';
        let sameSource = true;
        for (let id of groupMap[key][subgroup].items) {
          if (itemMap.get(id) && itemMap.get(id).svg && itemMap.get(id).svg.path && itemMap.get(id).svg.dir) {
            if (p && p !== itemMap.get(id).svg.path && dir && dir !== itemMap.get(id).svg.dir) {
              sameSource = false;
              break;
            } else {
              p = itemMap.get(id).svg.path;
            }
          }
        }
        if (sameSource) {
          groupMap[key][subgroup].svg = p
        }
      }
    }

    return {
      system: system,
      items: items,
      groupMap: groupMap,
      itemMap: itemMap,
      groupingKeys: groupingKeys,
      preferedGroupingKey: preferedGroupingKey,
      keys: keys,
      defaultItem: locals.defaultItem,
      ignore: locals.ignore,
      svgSource: svgSource,
      database: locals.database,
      connections: locals.connections
    }

    // } catch (err) {
    //   this.emit('error', 'File Configuration Preparation: ' + JSON.stringify(err));
    //   return;
    // }
  }

}

module.exports = ConfigFileProcessor;
