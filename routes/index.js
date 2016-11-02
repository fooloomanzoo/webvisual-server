// Routing
const
  EventEmitter = require('events').EventEmitter,
  express = require('express'),
  passport = require('passport'),
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp');

class Router extends EventEmitter {

  constructor(app, config) {
    super();
    this.app = app;
    this.settings = {};
    this.configuration = {};

    this.app.get('/', (req, res) => {
      res.set({
        'Cache-Control': 'public, no-cache'
      });
      if (this.settings.server.auth.required === true) {
        res.redirect('/login');
      } else {
        res.redirect('/index');
      }
    });

    this.app.get('/index', this.loggedIn.bind(this), (req, res) => {
      res.set({
        'Cache-Control': 'public, no-cache'
      });
      res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
      res.render('index', {
        user: req.user,
        title: 'Webvisual Index',
        userConfigFiles: this.settings.userConfigFiles,
        renderer: this.settings.renderer,
        mobile: this.isMobile(req)
      });
      res.end();
    });

    this.app.get('/login', (req, res) => {
      res.set({
        'Cache-Control': 'public, no-cache'
      });
      if (this.settings.server.auth.required === true) {
        res.render('login', {
          user: req.user,
          title: 'Webvisual Login',
          mobile: this.isMobile(req),
          server: this.settings.server
        });
      } else {
        res.redirect('/index');
      }
    });

    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/login');
    });
  }

  setSettings(options) {
    if (options === undefined)
      this.emit("error", "Empty Configuration passed to Router");
    for (let key in options) {
      if (key == 'server')
        this.setServer(options.server);
      else if (key == 'userConfigFiles')
        this.setUserConfig(options.userConfigFiles);
      else {
        this.settings[key] = options[key];
      }
    }
  }

  setServer(opt) {
    this.settings.server = opt;

    require('./authentification_strategies/activedirectory.js')(this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./authentification_strategies/dummy.js')(); // register dummy-stategy

    if (this.settings.server.auth.required === true) {
      this.app.post('/login',
        passport.authenticate('activedirectory-login', {
          successRedirect: '/index',
          failureRedirect: '/login'
        }),
        function(req, res) {
          // console.log("auth login");
        }
      );
    } else {
      this.app.post('/login',
        passport.authenticate('dummy', {
          successRedirect: '/index',
          failureRedirect: '/index'
        }),
        function(req, res) {
          // console.log("no-auth login");
        }
      );
    }
  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;

    for (let facility in userConfigFiles) {
      this.app.get('/' + facility, this.loggedIn.bind(this), (req, res) => {
        let facility = req.url.substr(1);

        if (!facility || !this.settings.userConfigFiles[facility] || !this.settings.userConfigFiles[facility].renderer) {
          this.emit("error", "Requested Renderer for '" + facility + "' not found.");
          res.redirect('/index');
          res.end();
          return;
        }
        let rendererName = this.settings.userConfigFiles[facility].renderer;
        let rendererPath = './renderer/' + this.settings.renderer[rendererName].path;

        res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
        res.render(rendererPath, {
          user: req.user,
          title: facility,
          facility: facility,
          config: this.configuration[facility],
          mobile: this.isMobile(req)
        });
        res.end();
      });
    }
    this.app.use(function(req, res) {
      res.redirect('/login');
    });
  }

  setConfiguration(opt, facility) {
    this.configuration[facility] = opt;
    
    // create server side json files of the regrounded element configurations
      // mkdir
    var dirs = ['/public', 'data', facility];
    var newDir = process.cwd();

    for (var i = 0; i < dirs.length; i++) {
      newDir += dirs[i] + '/';
      if (!fs.exists(newDir)) {
        fs.mkdir(newDir, (err) => {
          this.emit( {error: err} );
        })
      }
    }
      // write json
    var p;
    for (var sys in opt) {
      if (!fs.exists(newDir + '/' + sys)) {
        fs.mkdir(newDir + '/' + sys, (err) => {
          this.emit( {error: err} );
        })
      }
      for (var key in opt[sys]) {
        p = path.resolve(newDir + '/' + sys, key + ".json")
        fs.writeFile (p, JSON.stringify(opt[sys][key]), (err) => {
          if (err) this.emit("error", JSON.stringify(err));
        });
      }

    }
    this.app.use(express.static(path.join(__dirname, 'public', 'www'), {'Cache-Control': 'public, no-cache'}));
    // console.log(this.configuration);
  }

  loggedIn(req, res, next) {
    if (this.settings.server.auth.required === false || req.user) {
      next();
    } else {
      res.redirect('/login');
    }
  }

  isMobile(req) {
    var ua = req.header('user-agent');
    // console.log(ua, '\n', /[mM]obi/i.test(ua) || /[tT]ablet/i.test(ua) || /[aA]ndroid/i.test(ua));
    if (/[mM]obi/i.test(ua) || /[tT]ablet/i.test(ua) || /[aA]ndroid/i.test(ua))
      return true;
    else
      return false;
  }
}

module.exports = Router;
