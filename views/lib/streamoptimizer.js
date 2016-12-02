/**
 *  Modification from Polymer CLI 
**/

const uglify = require('uglify-js');
const cssSlam = require('css-slam');
const htmlMinifier = require('html-minifier');
const Stream = require('stream');
const logging = require('plylog');
let logger = logging.getLogger('cli.build.optimize-streams');
/**
 * GenericOptimizeStream is a generic optimization stream. It can be extended
 * to create a new kind of specific file-type optimizer, or it can be used
 * directly to create an ad-hoc optimization stream for certain types of files.
 */
class GenericOptimizeStream extends Stream.Transform {
    constructor(validExtension, optimizer, optimizerOptions) {
        super({ objectMode: true });
        this.optimizer = optimizer;
        this.validExtension = validExtension;
        this.optimizerOptions = optimizerOptions || {};
    }
    _transform(file, _encoding, callback) {
        if (file.contents && file.path.endsWith(`${this.validExtension}`)) {
            try {
                let contents = file.contents.toString();
                contents = this.optimizer(contents, this.optimizerOptions);
                file.contents = new Buffer(contents);
            }
            catch (error) {
                logger.warn(`Unable to optimize ${this.validExtension} file ${file.path}`, { err: error });
            }
        }
        callback(null, file);
    }
}
exports.GenericOptimizeStream = GenericOptimizeStream;
/**
 * JSOptimizeStream optimizes JS files that pass through it (via uglify).
 * If a file is not a `.js` file or if uglify throws an exception when run,
 * the file will pass through unaffected.
 */
class JSOptimizeStream extends GenericOptimizeStream {
    constructor(options) {
        // uglify is special, in that it returns an object with a code property
        // instead of just a code string. We create a compliant optimizer here
        // that returns a string instead.
        let uglifyOptimizer = (contents, options) => {
            return uglify.minify(contents, options).code;
        };
        // We automatically add the fromString option because it is required.
        let uglifyOptions = Object.assign({ fromString: true }, options);
        super('.js', uglifyOptimizer, uglifyOptions);
    }
}
exports.JSOptimizeStream = JSOptimizeStream;
/**
 * CSSOptimizeStream optimizes CSS files that pass through it (via css-slam).
 * If a file is not a `.css` file or if css-slam throws an exception when run,
 * the file will pass through unaffected.
 */
class CSSOptimizeStream extends GenericOptimizeStream {
    constructor(options) {
        super('.css', cssSlam.css, options);
    }
    _transform(file, encoding, callback) {
        // css-slam will only be run if the `stripWhitespace` option is true.
        // Because css-slam itself doesn't accept any options, we handle the
        // option here before transforming.
        if (this.optimizerOptions.stripWhitespace) {
            super._transform(file, encoding, callback);
        }
    }
}
exports.CSSOptimizeStream = CSSOptimizeStream;
/**
 * HTMLOptimizeStream optimizes HTML files that pass through it
 * (via html-minifier). If a file is not a `.html` file or if html-minifier
 * throws an exception when run, the file will pass through unaffected.
 */
class HTMLOptimizeStream extends GenericOptimizeStream {
    constructor(options) {
        super('.html', htmlMinifier.minify, options);
    }
}
exports.HTMLOptimizeStream = HTMLOptimizeStream;
