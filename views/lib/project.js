/**
 * @license
 * modification of polyer build example
 */

'use strict';

const path = require('path');
const vfs = require('vinyl-fs');
const mergeStream = require('merge-stream');
const polymer = require('polymer-build');

class projectGenerator {

  constructor(config) {
    this.config = config;

    this.polymerJSON = require(this.config.polymerJsonPath);
    this.project = new polymer.PolymerProject(this.polymerJSON);
    this.bundledPath = path.join(this.config.build.rootDirectory, this.config.build.bundledDirectory);
    this.unbundledPath = path.join(this.config.build.rootDirectory, this.config.build.unbundledDirectory);
  }

  // This is the heart of polymer-build, and exposes much of the
  // work that Polymer CLI usually does for you
  // There are tasks to split the source files and dependency files into
  // streams, and tasks to rejoin them and output service workers
  // You should not need to modify anything in this file
  // If you find that you can't accomplish something because of the way
  // this module is structured please file an issue
  // https://github.com/PolymerElements/generator-polymer-init-custom-build/issues

  // Returns a ReadableStream of all the source files
  // Source files are those in src/** as well as anything
  // added to the sourceGlobs property of polymer.json
  splitSource() {
    return this.project.sources().pipe(this.project.splitHtml());
  }

  // Returns a ReadableStream of all the dependency files
  // Dependency files are those in bower_components/**
  splitDependencies() {
    return this.project.dependencies().pipe(this.project.splitHtml());
  }

  // Returns a WriteableStream to rejoin all split files
  rejoin() {
    return this.project.rejoinHtml();
  }

  // Returns a function which accepts refernces to functions that generate
  // ReadableStreams. These ReadableStreams will then be merged, and used to
  // generate the bundled and unbundled versions of the site.
  // Takes an argument for the user to specify the kind of output they want
  // either bundled or unbundled. If this argument is omitted it will output both
  merge(source, dependencies) {
    // return function output() {
      const mergedFiles = mergeStream(source(), dependencies())
        // .pipe(this.project.analyzer);
      const bundleType = this.config.build.bundleType;
      let outputs = [];

      if (bundleType === 'both' || bundleType === 'bundled') {
        outputs.push(this.writeBundledOutput(polymer.forkStream(mergedFiles), this.bundledPath));
      }
      if (bundleType === 'both' || bundleType === 'unbundled') {
        outputs.push(this.writeUnbundledOutput(polymer.forkStream(mergedFiles), this.unbundledPath));
      }

      return Promise.all(outputs);
    // }.bind(this);
  }

  // Run the files through a bundling step which will vulcanize/shard them
  // then output to the dest dir
  writeBundledOutput(stream, bundledPath) {
    return new Promise(resolve => {
      stream.pipe(this.project.bundler)
        .pipe(vfs.dest(bundledPath))
        .on('end', resolve);
    });
  }

  // Just output files to the dest dir without bundling. This is for projects that
  // use HTTP/2 server push
  writeUnbundledOutput(stream, unbundledPath) {
    return new Promise(resolve => {
      stream.pipe(vfs.dest(unbundledPath))
        .on('end', resolve);
    });
  }

  // Returns a function which takes an argument for the user to specify the kind
  // of bundle they're outputting (either bundled or unbundled) and generates a
  // service worker for that bundle.
  // If this argument is omitted it will create service workers for both bundled
  // and unbundled output
  serviceWorker() {
    const bundleType = this.config.build.bundleType;
    let workers = [];

    if (bundleType === 'both' || bundleType === 'bundled') {
      workers.push(this.writeBundledServiceWorker());
    }
    if (bundleType === 'both' || bundleType === 'unbundled') {
      workers.push(this.writeUnbundledServiceWorker());
    }
    console.log('workers', workers);

    // return workers;
    return Promise.all(workers);
  }

  // Returns a Promise to generate a service worker for bundled output
  writeBundledServiceWorker() {
    return polymer.addServiceWorker({
      project: this.project,
      buildRoot: this.bundledPath,
      swPrecacheConfig: this.config.swPrecacheConfig,
      path: this.config.serviceWorkerPath,
      bundled: true
    });
  }

  // Returns a Promise to generate a service worker for unbundled output
  writeUnbundledServiceWorker() {
    return polymer.addServiceWorker({
      project: this.project,
      buildRoot: this.unbundledPath,
      swPrecacheConfig: this.config.swPrecacheConfig,
      path: this.config.serviceWorkerPath
    });
  }
}

module.exports = projectGenerator;
