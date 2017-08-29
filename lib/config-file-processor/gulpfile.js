const gulp = require('gulp');
const gulpHelp = require('gulp-help')(gulp);
const mocha = require('gulp-mocha');

gulpHelp.task('mocha', 'run the unit tests using mocha and chai', () => {
	return gulp.src(['tests/**/*.test.js'])
              .pipe(
                mocha({
                  reporter: 'spec'
            	   })
               );
});

gulpHelp.task('test', 'run the unit tests for node', ['clean', 'rollup-node', 'mocha']);

// Default Task
gulpHelp.task('default', ['help']);
