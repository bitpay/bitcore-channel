/**
 * @file gulpfile.js
 *
 * Defines tasks that can be run on gulp.
 *
 * Summary: <ul>
 * <li> `test` - runs all the tests on node and the browser (mocha and karma)
 * <ul>
 * <li> `test:node`
 * <li> `test:node:nofail` - internally used for watching (due to bug on gulp-mocha)
 * <li> `test:browser`
 * </ul>`
 * <li> `watch:test` - watch for file changes and run tests
 * <ul>
 * <li> `watch:test:node`
 * <li> `watch:test:browser`
 * </ul>`
 * <li> `browser` - generate files needed for browser (browserify)
 * <ul>
 * <li> `browser:uncompressed` - build `bitcore-channel.js`
 * <li> `browser:compressed` - build `bitcore-channel.min.js`
 * <li> `browser:maketests` - build `tests.js`, needed for testing without karma
 * </ul>`
 * <li> `errors` - autogenerate the `./lib/errors/index.js` file with error definitions
 * <li> `lint` - run `jshint`
 * <li> `coverage` - run `istanbul` with mocha to generate a report of test coverage
 * <li> `coveralls` - updates coveralls info
 * <li> `release` - automates release process (only for bitcore maintainers)
 * </ul>
 */
'use strict';

var gulp = require('gulp');

var closureCompiler = require('gulp-closure-compiler');
var coveralls = require('gulp-coveralls');
var gutil = require('gulp-util');
var insert = require('gulp-insert');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var nodeJsExterns = require('nodejs-externs');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');
var uglify = require('gulp-uglify');

var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);

function ignoreError() {
  /* jshint ignore:start */ // using `this` in this context is weird 
  this.emit('end');
  /* jshint ignore:end */
}

var testMocha = function() {
  return gulp.src(tests).pipe(new mocha({
    reporter: 'spec'
  }));
};

var testKarma = shell.task([
  './node_modules/karma/bin/karma start --single-run --browsers Firefox'
]);

/**
 * Testing
 */

gulp.task('test:node', ['errors'], testMocha);

gulp.task('test:node:nofail', ['errors'], function() {
  return testMocha().on('error', ignoreError);
});

gulp.task('test:browser', ['browser:uncompressed', 'browser:maketests'], testKarma);

gulp.task('test', function(callback) {
  runSequence(['test:node'], ['test:browser'], callback);
});

/**
 * File generation
 */

gulp.task('browser:uncompressed', ['browser:makefolder', 'errors'], shell.task([
  './node_modules/.bin/browserify index.js --insert-global-vars=true --standalone=bitcore-channel -o bitcore-channel.js'
]));

gulp.task('browser:compressed', ['browser:uncompressed'], function() {
  return gulp.src('bitcore-channel.js')
    .pipe(uglify({
      mangle: true,
      compress: true
    }))
    .pipe(rename('bitcore-channel.min.js'))
    .pipe(gulp.dest('.'))
    .on('error', gutil.log);
});

gulp.task('browser:maketests', ['browser:makefolder'], shell.task([
  'find test/ -type f -name "*.js" | xargs ./node_modules/.bin/browserify -t brfs -o tests.js'
]));

gulp.task('browser', function(callback) {
  runSequence(['browser:compressed'], ['browser:maketests'], callback);
});

gulp.task('errors', shell.task([
  'node ./lib/errors/build.js'
]));


/**
 * Code quality and documentation
 */

gulp.task('lint', function() {
  return gulp.src(alljs)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('plato', shell.task(['plato -d report -r -l .jshintrc -t bitcore lib']));

gulp.task('coverage', shell.task(['node_modules/.bin/./istanbul cover node_modules/.bin/_mocha -- --recursive']));

gulp.task('coveralls', ['coverage'], function() {
  gulp.src('coverage/lcov.info').pipe(coveralls());
});

/**
 * Watch tasks
 */

gulp.task('watch:test', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test']);
});

gulp.task('watch:test:node', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test:node']);
});

gulp.task('watch:test:browser', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['test:browser']);
});

gulp.task('watch:jsdoc', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['jsdoc']);
});

gulp.task('watch:coverage', function() {
  // TODO: Only run tests that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['coverage']);
});

gulp.task('watch:lint', function() {
  // TODO: Only lint files that are linked to file changes by doing
  // something smart like reading through the require statements
  return gulp.watch(alljs, ['lint']);
});

gulp.task('watch:browser', function() {
  return gulp.watch(alljs, ['browser']);
});

gulp.task('compile', function() {
  return gulp.src(files)
    .pipe(insert.append('})();'))
    .pipe(insert.prepend('(function() {'))
    .pipe(closureCompiler({
      fileName: 'build.js',
      compilerFlags: {
        language_in: 'ECMASCRIPT5_STRICT',
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

/* Default task */
gulp.task('default', function(callback) {
  return runSequence(['lint'], ['browser:uncompressed', 'test'], ['coverage', 'browser:compressed'],
    callback);
});

