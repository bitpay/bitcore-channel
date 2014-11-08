var gulp = require('gulp');
var gulp_mocha = require('gulp-mocha');
var gulp_jshint = require('gulp-jshint');
var _ = require('lodash');

var files = ['lib/**/*.js'];
var tests = ['test/**/*.spec.js'];

var alljs = files.concat(tests);

function ignoreError(err) {
  this.emit('end');
}

gulp.task('test', function() {
  return gulp.src(tests).pipe(new gulp_mocha({reporter: 'spec'})).on('error', ignoreError);
});

gulp.task('watch:test', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test']);
});

gulp.task('lint', function() {
  return gulp.src(alljs) 
    .pipe(gulp_jshint())
    .pipe(gulp_jshint.reporter('default'));
});
