'use strict';

var _ = require('lodash');

var gulp = require('gulp');
var gulp_closureCompiler = require('gulp-closure-compiler');
var gulp_insert = require('gulp-insert');
var gulp_jsdoc = require('gulp-jsdoc');
var gulp_jshint = require('gulp-jshint');
var gulp_mocha = require('gulp-mocha');
var gulp_runSequence = require('run-sequence');
var gulp_shell = require('gulp-shell');

var bump = require('gulp-bump');
var git = require('gulp-git');
var tag_version = require('gulp-tag-version');

var nodeJsExterns = require('nodejs-externs');


var files = ['lib/**/*.js'];
var tests = ['test/**/*.js'];
var alljs = files.concat(tests);
var readme = 'README.md';

function ignoreError(err) {
  this.emit('end');
}

function logError(err) {
  if (err) {
    console.log(err);
    throw err;
  }
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
        // warning_level: 'VERBOSE',
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

/**
 * Release automation
 */

gulp.task('release:install', function() {
  return gulp_shell.task([
    'npm install',
  ]);
});

gulp.task('release:bump', function() {
  return gulp.src(['./bower.json', './package.json'])
    .pipe(bump({
      type: 'patch'
    }))
    .pipe(gulp.dest('./'));
});

gulp.task('release:build-commit', function() {
  var pjson = require('./package.json');
  return gulp.src(['./package.json', './bower.json', './browser/bitcore.js', 'browser/bitcore.min.js'])
    .pipe(git.tag('v' + pjson.version, 'Build: ' + pjson.version));
});

gulp.task('release:undo-commit', function() {
  git.reset('HEAD^', {
    args: '--hard'
  }, logError);
});

gulp.task('release:version-commit', function() {
  var pjson = require('./package.json');
  return gulp.src(['./package.json', './bower.json'])
    .pipe(git.commit('Bump package version to ' + pjson.version));
});

gulp.task('release:push-releases', function() {
  git.push('eordano', 'releases', {
    args: ''
  }, logError);
});

gulp.task('release:push', function() {
  git.push('eordano', 'master', {
    args: ''
  }, logError);
});

gulp.task('release:push-tag', function() {
  var pjson = require('./package.json');
  git.push('eordano', 'v' + pjson.version, {
    args: ''
  }, logError);
});

gulp.task('release:publish', gulp_shell.task([
  'npm publish'
]));

// requires https://hub.github.com/
gulp.task('release', function(cb) {
  gulp_runSequence(
    // Run npm install
    ['release:install'],
    // Build browser bundle
    ['compile'],
    // Update package.json and bower.json
    ['release:bump'],
    // Commit 
    ['release:build-commit'],
    // Run git tag -a $VERSION -m '$VERSION' with the new version number
    ['release:tag'],
    // Run git push bitpay $VERSION
    ['release:push-tag'],
    // Push to releases branch
    ['release:push-releases'],
    // Run npm publish
    ['release:publish'],
    // Checkout back to master
    ['release:undo-commit'],
    // Bump version
    ['release:bump'],
    // Version commit with no binary files to master
    ['release:version-commit'],
    // Push to master
    ['release:push'],
    cb);
});


gulp.task('default', function(callback) {
  return gulp_runSequence(['lint', 'jsdoc', 'compile', 'test'], callback);
});
