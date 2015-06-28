'use strict';

/**
 * Node core modules
 */
var os = require('os');
var path = require('path');


/**
 * npm packaged modules
 */
var _ = require('lodash');
var gulp = require('gulp');
var gutil = require('gulp-util');
var runSequence = require('run-sequence');
var through = require('through2');
var del = require('del');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var prettyHrtime = require('pretty-hrtime');
var chalk = gutil.colors;
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var watchify = require('watchify');
var babelify = require('babelify');
var uglify = require('gulp-uglify');
var browserify = require('browserify');
var rename = require('gulp-rename');
var svgmin = require('gulp-svgmin');
var prettify = require('gulp-prettify');
var replace = require('gulp-replace');
var browserSync = require('browser-sync');


/**
 * Constants
 */
var SRC_DIR = './source';
var BUILD_DIR = './build';
var SASS_FILES = path.join(SRC_DIR, 'sass/**/*.scss');
var STATIC_ASSETS = [
  SRC_DIR + '/**/*',       // everything...
  '!' + SRC_DIR + '/js',
  '!' + SRC_DIR + '/js/*.js',
  '!' + SRC_DIR + '/js/*.jsx',
  '!' + SRC_DIR + '/sass',
  '!' + SRC_DIR + '/sass/**/*'
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
    .pipe(browserSync.stream({match: '*.css'}))
    .on('data', function(data) {
      gutil.log('Sass: compiled', chalk.magenta(data.relative));
    });
});


/**
 * clean removes the build directory
 */
gulp.task('clean', function(cb) {
  del(BUILD_DIR + '/*', cb);
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
        gutil.log('SVG: Cleaned', chalk.magenta(file.relative));
      });
  }
);

/**
 * copies STATIC_ASSETS to BUILD_DIR using relative paths (so things stay nested)
 */
gulp.task('copy', function() {
  gulp.src(STATIC_ASSETS, {base: SRC_DIR}) // base tells gulp to copy with relative paths
    .pipe(gulp.dest(BUILD_DIR))
    // .pipe(browserSync.stream());
    .pipe(browserSync.stream({once: true}));
});


/**
 * build just lumps together other tasks: clean, then php, sass and copy
 */
gulp.task('build', function(cb) {
  runSequence('clean', 'copy', ['browserify', 'sass', 'svg'], cb);
});


/**
 * Watchify used with watch to re-bundle JS files on change
 * bundle() is called from the task
 * Watchify instances are kept in the bundlers object, keyed to their relative paths
 */
var bundlers = {};  // persistent container for watchify instances

gulp.task('watchify', ['build'], function() {
  gulp.src(['source/js/*.js', 'source/js/*.jsx'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      var opts = _.assign({}, watchify.args, {entries: file.path, debug: true, file: file});
      bundlers[file.relative] = watchify(browserify(opts))
        .on('update', function(ids) {
          _.forEach(ids, function(id) {
            gutil.log(
              'Watchify:',
              chalk.magenta(path.relative('source', id)),
              'was modified. Rebundling...');
          });
          bundle(bundlers[file.relative]);
        });
      bundle(bundlers[file.relative]);
      cb(null, file);
      // bundle(bundlers[file.relative], function() {
      //   cb(null, file);
      // });
    }));
});

/**
 * Bundles a browserify object. Calls callback `cb` with the browserified code
 * in a single buffer as its argument. [TODO]
 * @param  object  bundler    browserify or watchify-wrapped browserify object
 * @param  {Function} cb      callback function to receive the output buffer [TODO]
 */
var bundle = function(bundler, cb) {
  var file = bundler._options.file;
  var startTime = process.hrtime();
  var uglifyTime;
  var errorReporter = function(err) {
    gutil.log(
      chalk.red('Browserify:'), err.toString().split(':')[0] + ': in',
      chalk.magenta(path.relative('source', err.filename)) + ':' + chalk.cyan(err.loc.line) + ':' + chalk.cyan(err.loc.column),
      '\n' + err.codeFrame
    );
  };
  var bundleReporter = function() {
    gutil.log(
      'Browserify: Bundled', chalk.magenta(file.relative),
      'after', chalk.magenta(prettyHrtime(process.hrtime(startTime)))
    );
    uglifyTime = process.hrtime();
  };
  var totalReporter = function() {
    var newName = file.relative.replace(path.extname(file.relative), '.min.js');
    gutil.log(
      'Uglify: Compressed', chalk.magenta(newName),
      'after', chalk.magenta(prettyHrtime(process.hrtime(uglifyTime)))
    );
    gutil.log('Total bundling time:', chalk.magenta(prettyHrtime(process.hrtime(startTime))));
    browserSync.reload(newName);
  };

  return bundler
    .transform(babelify)
    .bundle()
    .on('error', errorReporter)
    .on('end', bundleReporter)
    .pipe(source(file.relative))
    .pipe(buffer())
    .pipe(rename({extname: '.js'}))
    // .pipe(browserSync.stream())
    .pipe(gulp.dest(BUILD_DIR))
    .pipe(rename({extname: '.min.js'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(BUILD_DIR))
    .on('end', totalReporter)
    .pipe(browserSync.stream({match: '*.js'}))
    .on('data', function() {
      // This no-op seems to be necessary to persist the stream through the BrowserSync pipes
      // without it, the Browsersync task ends early and 'end' events don't seem to fire for
      // additional files.
    });
};


/**
 * browserify task for one-off bundling of js assets
 */
gulp.task('browserify', function( ) {
  return gulp.src(['source/js/*.js', 'source/js/*.jsx'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      var b = browserify({entries: file.path, debug: true, file: file});
      bundle(b)
        .on('end', function() {
          cb(null, file);
        });
    }));
});


/**
 * The main watch task, tracks and responds to changes in source files
 */
gulp.task('watch', ['build', 'watchify'], function() {
  browserSync({
    host: os.hostname().replace(/(\.local)*$/i, '.local'),
    open: false,
    logConnections: true,
    server: './build'
  });

  // Re-compile SCSS on change
  gulp.watch(SASS_FILES, ['sass']);

  // Move static files on change
  gulp.watch(STATIC_ASSETS, ['copy']);

  // Clean up SVGs
  gulp.watch('./design_assets/*.svg', ['svg']);

});
