/*jshint node:true, unused:true */

'use strict';

/**
 * Node core modules
 */
var http = require('http');
var path = require('path');
var spawn = require('child_process').spawn;


/**
 * npm packaged modules
 */
var _ = require('lodash');
var gulp = require('gulp');
var gutil = require('gulp-util');
// var tap = require('gulp-tap');
var runSequence = require('run-sequence');
var through = require('through2');
var del = require('del');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var livereload = require('gulp-livereload');
var prettyHrtime = require('pretty-hrtime');
var chalk = require('chalk');
var connect = require('connect');
var connectLiveReload = require('connect-livereload');
var serveStatic = require('serve-static');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var watchify = require('watchify');
var reactify = require('reactify');
var browserify = require('browserify');
var rename = require('gulp-rename');
var svgmin = require('gulp-svgmin');
var prettify = require('gulp-prettify');
var replace = require('gulp-replace');
// var Q = require('q');


/**
 * Constants
 */
var LOCAL_PORT = 9001;
var SRC_DIR = './source';
var BUILD_DIR = './build';
var SASS_FILES = path.join(SRC_DIR, 'sass/**/*.scss');
var STATIC_ASSETS = [
  path.join(SRC_DIR, '**/*'),       // everything...
  '!' + path.join(SRC_DIR, 'js/*.js'),
  '!' + path.join(SRC_DIR, 'sass/*.scss')
];


/**
 * sass compiles SCSS source files to CSS
 */
gulp.task('sass', function() {
  var sassErrorReporter = function(err) {
    err = err.match(/([^:]+):(\d+):(\d*)\s*(.*)/);
    err = _.zipObject(['input', 'abspath', 'line', 'char', 'message'], err);
    err.path = path.relative(process.cwd(), err.abspath);
    gutil.log(
      chalk.red('Sass Error:'),
      chalk.magenta(err.path) + ':' +
      chalk.cyan(err.line) + ':' +
      chalk.cyan(err.char),
      err.message
    );
  };

  return gulp.src(SASS_FILES)
    .pipe(sourcemaps.init())
    .pipe(sass({
      outputStyle: 'compressed',
      onError: sassErrorReporter
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(path.join(BUILD_DIR, 'css')))
    .on('data', function(data) {
      gutil.log('Sass: compiled', chalk.magenta(data.relative));
    });
});


/**
 * clean removes the build directory
 */
gulp.task('clean', function(cb) {
  del(BUILD_DIR + '/**/*', cb);
});


/**
 * Clean up illustrator SVGs
 */
gulp.task('svg', function() {
    return gulp.src(['./design_assets/*.svg', '!./design_assets/*.min.svg'])
      .pipe(svgmin({
        plugins: [{cleanupIDs: false}]
      }))
      .pipe(replace(/"_|_"/g, '"'))
      .pipe(prettify({indent_size: 4}))
      .pipe(rename({extname: '.min.svg'}))
      .pipe(gulp.dest('./design_assets'))
      .on('data', function(file) {
        gutil.log('SVG: Cleaned', gutil.colors.magenta(file.relative));
      });
  }
);

/**
 * copies STATIC_ASSETS to BUILD_DIR using relative paths (so things stay nested)
 */
gulp.task('copy', function() {
  gulp.src(STATIC_ASSETS, {base: SRC_DIR}) // base tells gulp to copy with relative paths
    .pipe(gulp.dest(BUILD_DIR));
});


/**
 * build just lumps together other tasks: clean, then php, sass and copy
 */
gulp.task('build', function(cb) {
  runSequence('clean', 'copy', ['browserify', 'sass'], cb);
});


/**
 * Watchify used with watch to re-bundle JS files on change
 * bundle() is called from the task
 * Watchify instances are kept in the bundlers object, keyed to their relative paths
 */
var bundlers = {};  // persistent container for watchify instances

gulp.task('watchify', function() {
  return gulp.src(['source/js/*.js'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      var bundler = watchify(browserify(file.path, watchify.args)) // don't send a stream or the watches will never close
        .transform(reactify)
        .on('update', function(ids) {
          _.forEach(ids, function(id) {
            gutil.log(
              'Watchify:',
              chalk.magenta(path.relative('source', id)),
              'was modified. Rebundling...');
          });
          bundle(file.relative);
        });

      bundlers[file.relative] = bundler;
      bundle(file.relative);
      cb(null, file);
    }));
});


var bundle = function(key) {
  var startTime = process.hrtime();
  bundlers[key].bundle()
    // .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .on('error', function(err) {
      gutil.log(
        'Browserify:', chalk.red('ERROR'),
        '"' + err.message.replace(/'([^']+)'/g, function() {
          return chalk.magenta(arguments[1]);
        }) + '"',
        'in', chalk.magenta(key)
      );
    })

    .pipe(source(key))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(BUILD_DIR));

  gutil.log(
    'Watchify: Bundled',
    chalk.magenta(key),
    'in',
    chalk.magenta(prettyHrtime(process.hrtime(startTime)))
  );
};


/**
 * browserify task for one-off bundling of js assets
 */
gulp.task('browserify', function() {
  return gulp.src(['source/js/*.js'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      var startTime = process.hrtime();
      browserify(file.path)
        .transform(reactify)
        .bundle(function(err, stream) {
          if (!err) {
            gutil.log(
              'Browserify: Bundled', chalk.magenta(file.relative),
              'in', chalk.magenta(prettyHrtime(process.hrtime(startTime)))
            );
          }
          cb(err, stream);
        })
        .on('error', function(err) {
          gutil.log(
            'Browserify:', chalk.red('ERROR'),
            '"' + err.message.replace(/'([^']+)'/g, function() {
              return chalk.magenta(arguments[1]);
            }) + '"',
            'in', chalk.magenta(file.relative)
          );
        })
        .pipe(source(file.relative))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(BUILD_DIR));
    }));
  });


/**
 * gulp-reload auto-reloads the gulpfile on change, called from 'watch'
 * This is horribly unstable and will leave an orphaned
 * gulp process running after `gulp watch` exits
 */
gulp.task('gulp-reload', function() {
  spawn('gulp', ['watch'], {stdio: 'inherit'});
  process.exit();
});


/**
 * gulp webserver - start up a livereload-enabled webserver.
 * The connect-livereload middleware injects the livereload snippet
 */
// TODO: if webserver runs build, (which runs clean) watches on the build dir
// fail: This is becauae the watched build dir is removed by clean. It's a race
// and watch is winning and then losing. Watch initiates a watch on BUILD_DIR
// then the clean task removes BUILD_DIR and remakes it. Unfortunately the watch
// doesn't pick up the new BUILD_DIR and never registers any changes.
// gulp.task('webserver', ['build'], function() {
gulp.task('webserver', ['build'], function() {
  var reporter = function() {
    gutil.log(
      "Local webserver listening on:",
      chalk.magenta(LOCAL_PORT),
      '(http://localhost:' + LOCAL_PORT + ')'
    );
  };
  var app = connect()
    .use(connectLiveReload())
    .use(serveStatic(BUILD_DIR));
  http.createServer(app).listen(LOCAL_PORT, null, null, reporter);
});


/**
 * The main watch task, tracks and responds to changes in source files
 */
gulp.task('watch', ['webserver', 'svg', 'watchify'], function() {
  livereload.listen();

  // see the note above the gulp-reload task before enabling this
  // gulp.watch('gulpfile.js', ['gulp-reload']);

  // Re-compile SCSS on change
  gulp.watch(SASS_FILES, ['sass']);

  // Move static files on change
  gulp.watch(STATIC_ASSETS, ['copy']);

  // Clean up SVGs
  gulp.watch('./design_assets/*.svg', ['svg']);

  // trigger livereload whenever files in BUILD_DIR change
  gulp.watch([path.join(BUILD_DIR, '/**/*')])
    .on('change', livereload.changed);
});