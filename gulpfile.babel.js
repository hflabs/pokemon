import gulp from 'gulp'
import less from 'gulp-less'
import browserify from 'browserify'
import source from 'vinyl-source-stream'
import browserSync from 'browser-sync'

// gulp.task('default', ['server', 'watch'])
gulp.task('default', ['watch'])

gulp.task('server', () => {
  return browserSync.init([
    'server/static/*.js',
    'server/static/*.css',
    'server/static/index.html'
  ], {
    server: {
      baseDir: 'server/static'
    }
  })
})

gulp.task('watch', () => {
  gulp.watch('client/js/*.js', ['build_js'])
  gulp.watch('client/css/*.less', ['build_css'])
  gulp.watch('client/*.html', ['build_html'])
})

gulp.task('build', ['build_js', 'build_css', 'build_html'])

gulp.task('build_js', () => {
  return browserify('client/js/app.js')
    .transform('babelify')
    .bundle()
    .pipe(source('app.js'))
    .pipe(gulp.dest('server/static'))
})

gulp.task('build_css', () => {
  return gulp.src('client/css/*.less')
    .pipe(less())
    .pipe(gulp.dest('server/static'))
})

gulp.task('build_html', () => {
  return gulp.src(['client/*.html'])
    .pipe(gulp.dest('server/static'))
})
