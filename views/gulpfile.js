const gulp = require('gulp');
const clean = require('gulp-clean');
const path = require('path');

var buildDir = path.resolve(__dirname, 'build', 'compiled');
var tmpDir = path.resolve(__dirname, 'tmp');

gulp.task('backup_content', (done) => {
  gulp.src([ buildDir + '/images/**/*', buildDir + '/data/**/*'])
      .pipe(gulp.dest(tmpDir))
      .on('end', function() {
        done();
      })
      .on('error', function(err) {
        console.log(err)
        done(err);
      });
});

gulp.task('reload_content',  (done) => {
  gulp.src([ tmpDir + '/images/**/*', tmpDir + '/data/**/*'])
      .pipe(gulp.dest( buildDir ))
      .pipe(clean())
      .on('end', function() {
        done();
      })
      .on('error', function(err) {
        console.log(err)
        done(err);
      });
});
