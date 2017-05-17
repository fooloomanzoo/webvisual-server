var del = require('del');
var fs = require('fs');
var path = require('path');
var copy = require('ncp')
  .ncp;
var mkdirp = require('mkdirp');
var fork = require('child_process')
  .fork;
var rollup = require('rollup');
var nodeResolve = require('rollup-plugin-node-resolve');

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

// run building process
function run() {
  let argv = process.argv.slice(2);
  if (argv.length === 0) {
    argv.push('build')
  }

  // bundle 'd3'-modules with rollup
  rollup.rollup({
      entry: 'views/rollup.d3.js',
      plugins: [
        nodeResolve({jsmain:true, main:true})
      ],
      external: ['d3-selection']
    })
    .then( (prebundle) => {
      var code = prebundle.generate().code
      return new Promise( (resolve, reject) => {
        fs.writeFile("views/rollup.d3.prebuilt.js", code, "utf8", function(error) {
          if (error) return reject(error);
          else resolve();
        });
      });
    })
    .then( () => {
      return new Promise( (resolve, reject) => {
        rollup.rollup({
          entry: 'views/rollup.d3.prebuilt.js',
          plugins: [
            nodeResolve({jsmain:true, main:true})
          ]
        }).then(resolve).catch(reject);
      });
    })
    .then( (bundle) => {
      var result = bundle.generate({
        // output format - 'amd', 'cjs', 'es', 'iife', 'umd'
        moduleName: "d3",
        format: "iife"
      });
      fs.writeFileSync( 'views/scripts/d3.bundle.js', result.code );
      console.log('Generated D3 Bundle');

      // backup data and images to tmp Folder
      copy(imageDir, tmpImageDir, (err) => {
        if (err) {
          return console.error('Error Copying Image Files', err);
        }
        console.log('Backup Images Files Done!');
        copy(dataDir, tmpDataDir, (err) => {
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
    })
    .catch(error => {
      console.log(error);
    });
};


run();

module.exports = run;
