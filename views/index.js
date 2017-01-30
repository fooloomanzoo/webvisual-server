const del = require('del');
const path = require('path');
const copy = require('ncp').ncp;
const fork = require('child_process').fork;

const buildDir = path.resolve(__dirname, 'build', 'bundled');
const publicDir = path.resolve(__dirname, '../public');
const imageDir = path.resolve(__dirname, '../public/data');
const dataDir = path.resolve(__dirname, '../public/images');

function run() {
  let argv = process.argv.slice(2);
  if (argv.length === 0) {
    argv.push('build')
  }
  let polymerBuild = fork( __dirname + '/node_modules/polymer-cli/bin/polymer.js', argv, { cwd: __dirname } );

  polymerBuild.on('error', (arguments) => {
    console.log('error',arguments);
  })

  polymerBuild.on('close', (arguments) => {
    let clearPaths = [];
    clearPaths.push(publicDir + '/**');
    clearPaths.push('!' + publicDir);
    clearPaths.push('!' + imageDir + '/**');
    clearPaths.push('!' + dataDir + '/**');

    del(clearPaths, {force: true})
      .then(() => {
        console.log('Copying Built Project Files To Public Folder');
        copy(buildDir, publicDir, function (err) {
          if (err) {
            return console.error('Error Copying Project Files', err);
          }
          console.log('Done!');
        });
      })
      .catch((err) => {
        console.log('Error clearing Public Paths', err);
      })
  })
}

run();
