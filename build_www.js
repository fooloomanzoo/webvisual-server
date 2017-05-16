var del = require('del');
var path = require('path');
var copy = require('ncp')
  .ncp;
var mkdirp = require('mkdirp');
var fork = require('child_process')
  .fork;

function resolvePath() {
  var p = '';
  for (var i = 0; i < arguments.length; i++) {
    p = path.join(p, arguments[i]);
  }
  mkdirp(p, (err) => {
    if (err) console.error(err)
  });
  return p;
}

var srcDir = resolvePath(__dirname, 'views');
var imageDir = resolvePath(__dirname, 'views', 'build', 'compiled', 'data');
var dataDir = resolvePath(__dirname, 'views', 'build', 'compiled', 'images');
var tmpImageDir = resolvePath(__dirname, 'views', 'tmp', 'images');
var tmpDataDir = resolvePath(__dirname, 'views', 'tmp', 'data');

function run() {
  let argv = process.argv.slice(2);
  if (argv.length === 0) {
    argv.push('build')
  }
  // backup data and images to tmp Folder
  copy(imageDir, tmpImageDir, function(err) {
    if (err) {
      return console.error('Error Copying Image Files', err);
    }
    console.log('Backup Images Files Done!');
    copy(dataDir, tmpDataDir, function(err) {
      if (err) {
        return console.error('Error Copying Data Files', err);
      }
      console.log('Backup Data Files Done!');
      let polymerBuild = fork(__dirname + '/node_modules/polymer-cli/bin/polymer.js', argv, {
        cwd: srcDir
      });

      polymerBuild.on('error', (arguments) => {
        console.log('error', arguments);
      })

      polymerBuild.on('close', (arguments) => {
        console.log('Building Done!')
        // copy data and images
        copy(tmpImageDir, imageDir, function(err) {
          if (err) {
            return console.error('Error Copying Image Files', err);
          }
          console.log('Copying Image Files Done!');
          copy(tmpDataDir, dataDir, function(err) {
            if (err) {
              return console.error('Error Copying Data Files', err);
            }
            console.log('Copying Data Files Done!');
            del([tmpDataDir, tmpImageDir], {force: true})
              .then(() => {
                console.log('Clearing Temporay Files Done!');
              })
              .catch((err) => {
                console.log('Error Clearing Temporay Files!');
              })
          });
        });
      });
    });
  });
};

run();

module.exports = run;
