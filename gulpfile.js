var _ = require('lodash');

var gulp = require('gulp');
var gulp_closureCompiler = require('gulp-closure-compiler');
var gulp_insert = require('gulp-insert');
var gulp_jsdoc = require('gulp-jsdoc');
var gulp_jshint = require('gulp-jshint');
var gulp_mocha = require('gulp-mocha');
var gulp_runSequence = require('run-sequence');
var gulp_shell = require('gulp-shell');

var nodeJsExterns = require('nodejs-externs');


var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);
var readme = 'README.md';

function ignoreError(err) {
  this.emit('end');
}

function testAllFiles() {
  return gulp.src(tests).pipe(new gulp_mocha({reporter: 'spec'}));
}

gulp.task('test', testAllFiles);

gulp.task('test-nofail', function() {
  return testAllFiles().on('error', ignoreError);
});

gulp.task('watch:test', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['lint', 'test-nofail']);
});

gulp.task('jsdoc', function() {
  return gulp.src(files.concat([readme]))
    .pipe(gulp_jsdoc.parser())
    .pipe(gulp_jsdoc.generator('./docs', {
      path: 'ink-docstrap',
      theme: 'flatly',
    }))
});

gulp.task('lint', function() {
  return gulp.src(alljs)
    .pipe(gulp_jshint())
    .pipe(gulp_jshint.reporter('default'));
});

gulp.task('compile', function() {
  return gulp.src(files)
    .pipe(gulp_insert.append('})();'))
    .pipe(gulp_insert.prepend('(function() {'))
    .pipe(gulp_closureCompiler({
      fileName: 'bitcore-channel.js',
      compilerFlags: {
        language_in: 'ECMASCRIPT5_STRICT',
        warning_level: 'VERBOSE',
        externs: [
          'externs/underscore-1.5.1.js',
          'externs/bitcore-0.1.39.js',
          'externs/preconditions-1.0.8.js'
        ]
          .concat(nodeJsExterns.getExternsAsListOfResolvedPaths()),
        jscomp_off: ['nonStandardJsDocs']
      }
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', function(callback) {
  return gulp_runSequence(['lint', 'jsdoc', 'compile', 'test'], callback);
});
