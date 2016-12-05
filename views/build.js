/**
 * @license
 * modification of polyer build example
 */

const path = require('path');
const gulpif = require('gulp-if');
const chokidar = require('chokidar');

let config = {
  polymerJsonPath: path.join(process.cwd(), 'polymer.json'),
  build: {
    keep: '../public/data/',
    rootDirectory: '../public/',
    bundledDirectory: 'bundled',
    unbundledDirectory: '',
    bundleType: 'unbundled'
  },
  // Path to your service worker, relative to the build root directory
  serviceWorkerPath: 'service-worker.js',
  // Service Worker precache options based on
  // https://github.com/GoogleChrome/sw-precache#options-parameter
  swPrecacheConfig: require('./sw-precache-config.js'),
  optimizeOptions: {
    html: {
      removeComments: true
    },
    css: {
      stripWhitespace: true
    },
    js: {
      minify: true
    }
  }
};

// Got problems? Try logging 'em
const logging = require('plylog');
logging.setVerbose();

// Add your own custom gulp tasks to the gulp-tasks directory
// A few sample tasks are provided for you
// A task should return either a WriteableStream or a Promise
const clean = require('./lib/clean')( [
    path.resolve(config.build.rootDirectory) + '/**'
  , '!' + path.resolve(config.build.rootDirectory)
  , '!' + path.resolve(config.build.keep) + '/**' ] );

// const images = require('./lib/images.js');
const projectGenerator = require('./lib/project');
const streamOptimizer = require('./lib/streamoptimizer');
const images = require('./lib/images.js');

var project;

// The source task will split all of your source files into one
// big ReadableStream. Source files are those in src/** as well as anything
// added to the sourceGlobs property of polymer.json.
// Because most HTML Imports contain inline CSS and JS, those inline resources
// will be split out into temporary files. You can use gulpif to filter files
// out of the stream and run them through specific tasks. An example is provided
// which filters all images and runs them through imagemin
function source() {
  return project.splitSource()
    // Add your own build tasks here!
    // .pipe(gulpif(/\.js$/, new streamOptimizer.JSOptimizeStream(config.optimizeOptions.js)))
    .pipe(gulpif(/\.css$/, new streamOptimizer.CSSOptimizeStream(config.optimizeOptions.css)))
    .pipe(gulpif(/\.html$/, new streamOptimizer.HTMLOptimizeStream(config.optimizeOptions.html)))
    .pipe(gulpif('**/*.{png,gif,jpg,svg}', images.minify()))
    .pipe(project.rejoin()); // Call rejoin when you're finished
}

// The dependencies task will split all of your bower_components files into one
// big ReadableStream
// You probably don't need to do anything to your dependencies but it's here in
// case you need it :)
function dependencies() {
  return project.splitDependencies()
    // .pipe(gulpif(/\.js$/, new streamOptimizer.JSOptimizeStream(config.optimizeOptions.js)))
    .pipe(gulpif(/\.css$/, new streamOptimizer.CSSOptimizeStream(config.optimizeOptions.css)))
    .pipe(gulpif(/\.html$/, new streamOptimizer.HTMLOptimizeStream(config.optimizeOptions.html)))
    .pipe(project.rejoin());
}

function runSerial(tasks) {
  var result = Promise.resolve();
  tasks.forEach(task => {
    result = result.then( () => task() )
                   .catch( err => {
                     console.log(task, err);
                   });
  });
  return result;
}

function build() {
  project = new projectGenerator(config);;
  Promise.resolve()
        .then( () => {
          return clean();
        })
        .then( () => {
          return project.merge(source, dependencies);
        })
        .then( () => {
          return project.serviceWorker();
        })
        .then( () => {
          console.log(' ---- BUILD DONE ----');
        })
        .catch( err => {
          console.log(err);
        });
  }

function watch() {
  console.log(' ---- START WATCHING ' + __dirname + ' ----');
  var activeTimeout;
  var watcher = chokidar.watch(__dirname, {
                  ignored: /[\/\\]\./,
                  persistent: true
                });
  watcher.on('change', path => {
    if (activeTimeout)
      clearTimeout(activeTimeout);
    activeTimeout = setTimeout( build, 5000);
  });
}

if (module.parent) {
  exports = build;
}
else {
  build();
}
