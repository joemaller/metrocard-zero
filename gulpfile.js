/*jshint node:true, unused:true */

'use strict';

/**
 * Node core modules
 */
var fs = require('fs');
var http = require('http');
var path = require('path');
// var spawn = require('child_process').spawn;


/**
 * npm packaged modules
 */
var _ = require('lodash');
// var debug = require('gulp-debug');
var gulp = require('gulp');
var gutil = require('gulp-util');
var File = require('vinyl');
var bl = require('bl');
var tap = require('gulp-tap');
var runSequence = require('run-sequence');
var through = require('through2');
var del = require('del');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var livereload = require('gulp-livereload');
var prettyHrtime = require('pretty-hrtime');
var chalk = gutil.colors;
var connect = require('connect');
var connectLiveReload = require('connect-livereload');
var serveStatic = require('serve-static');
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
  '!' + path.join(SRC_DIR, 'js/*.jsx'),
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
  // runSequence('clean', 'copy', ['browserify', 'sass'], cb);
  runSequence('clean', 'copy', ['sass'], cb);
});


/**
 * Watchify used with watch to re-bundle JS files on change
 * bundle() is called from the task
 * Watchify instances are kept in the bundlers object, keyed to their relative paths
 */
var bundlers = {};  // persistent container for watchify instances

gulp.task('watchify', function() {
  return gulp.src(['source/js/*.js', 'source/js/*.jsx'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      gutil.log(chalk.bgRed(file.relative, file.path));
      var opts = _.assign({}, watchify.args, {entries: file.path, debug: true, file: file});
      console.log(opts);
      bundlers[file.relative] = watchify(browserify(opts))
        .on('update', function(ids) {
          console.log(chalk.bgBlue(ids));
          // var startTime = process.hrtime();
          // var newContent = '';
          _.forEach(ids, function(id) {
            gutil.log(
              'Watchify:',
              chalk.magenta(path.relative('source', id)),
              'was modified. Rebundling...');
          });
          bundle(bundlers[file.relative], function(data) {
        file.contents = data;
        // cb(null, file);
      })
            // .pipe(rename({extname: '.js'}))
            // .pipe(gulp.dest(BUILD_DIR));

          // bundle(file.relative)
            // .on('data', function(data) {
            //   newContent += data.contents;
            // })
            // .on('end', function() {
            //   gutil.log(
            //     'Watchify: Rebundled', chalk.magenta(file.relative),
            //     'after', chalk.magenta(prettyHrtime(process.hrtime(startTime)))
            //   );
            //   file.contents = new Buffer(newContent);
            //   // cb(null, file);
            //   // startTime = process.hrtime();
            //   newContent = '';

            // })

            // .pipe(rename({extname: '.js'}))
            // .pipe(gulp.dest(BUILD_DIR));

        });
      bundle(bundlers[file.relative], function(data) {
        file.contents = data;
        cb(null, file);
      });


        // .on('error', errorDumper);
      // console.log(file.relative);
      // bundlers[file.relative] = bundler;
      // bundle(file.relative);
      // var startTime = process.hrtime();
      // var newContent = '';
      // bundle(file.relative)
      //   .on('data', function(data) {
      //     newContent += data.contents;
      //   })
      //   .on('end', function() {
      //     gutil.log(
      //       'Watchify: Rebundled', chalk.magenta(file.relative),
      //       'after', chalk.magenta(prettyHrtime(process.hrtime(startTime)))
      //     );
      //     file.contents = new Buffer(newContent);
      //     cb(null, file);
      //   })
      //   .pipe(rename({extname: '.js'}))
      //   .pipe(sourcemaps.init({loadMaps: true}))
      //   // .pipe(uglify())
      //   .pipe(sourcemaps.write('.'))
      //   .pipe(gulp.dest(BUILD_DIR));


      cb(null, file);
    }));
});

/**
 * Bundles a browserify object. Calls callback `cb` with the browserified code
 * in a single buffer as its argument.
 * @param  object  bundler    browserify or watchify-wrapped browserify object
 * @param  {Function} cb      callback function to receive the output buffer
 */
var bundle = function(bundler, cb) {
  var file = bundler._options.file;
  var startTime = process.hrtime();
  bundler
    .transform(babelify)
    .external(['jquery', 'react'])
    .bundle()
    .on('end', function() {
      gutil.log(
        'Browserify: Bundled', chalk.magenta(file.relative),
        'after', chalk.magenta(prettyHrtime(process.hrtime(startTime)))
      );
    })
    .pipe(bl(function(err, data) {
      if (!err) {
        cb(data);
      }
    }));
};


// var errorDumper = function(err) {
//   gutil.log(
//       err.plugin, chalk.magenta(err.fileName) + ':' + chalk.cyan(err.lineNumber),
//       err.message
//       );
//   gutil.log(err.plugin, err.stack);
// };


/**
 * browserify task for one-off bundling of js assets
 */
gulp.task('browserify', function( ) {
  return gulp.src(['source/js/*.js', 'source/js/*.jsx'], {base: 'source'})
    .pipe(through.obj(function(file, enc, cb) {
      var b = browserify({entries: file.path, debug: true, file: file});
      bundle(b, function(data) {
        file.contents = data;
        cb(null, file);
      });
    }))
    .pipe(rename({extname: '.js'}))
    .pipe(gulp.dest(BUILD_DIR))
    .pipe(rename({extname: '.min.js'}))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(BUILD_DIR));
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
      'Local webserver listening on:',
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
