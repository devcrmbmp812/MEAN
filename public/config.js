require.config({
  baseUrl: '/javascripts/',
  shim: {
    bootstrap: {
      deps: ['jquery']
    },
    angular: {
      exports: 'angular'
    },
    moment: {
      exports: 'moment'
    },
    'angular-cookies': {
      deps: ['angular'], init: function () {
        return 'ngCookies';
      }
    },
    'angular-recaptcha': {
      deps: ['angular'], init: function () {
        return 'vcRecaptcha';
      }
    },
    'angular-sanitize': {
      deps: ['angular'], init: function () {
        return 'ngSanitize';
      }
    },
    'angular-moment': {
      deps: ['angular', 'moment'], init: function () {
        return 'angularMoment';
      }
    },
  },
  paths: {
    angular: [
      '//ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular.min',
      '/lib/angular/angular.min'
    ],
    'angular-cookies': [
      '//ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular-cookies.min',
      '/lib/angular-cookies/angular-cookies.min'
    ],
    'angular-recaptcha': [
      '//cdnjs.cloudflare.com/ajax/libs/angular-recaptcha/3.0.4/angular-recaptcha.min',
      '/lib/angular-recaptcha/release/angular-recaptcha.min'
    ],
    'angular-sanitize': [
      '//ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular-sanitize.min',
      '/lib/angular-sanitize/angular-sanitize.min'
    ],
    'angular-moment': [
      '/lib/angular-moment/angular-moment.min'
    ],
    moment: [
      '/lib/moment/min/moment.min'
    ],
    bootstrap: [
      '//maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min',
      '/lib/bootstrap/dist/js/bootstrap.min'
    ],
    click2vox: 'https://cdn.voxbone.com/click2vox/click2vox-3.min',
    jquery: '/lib/jquery/dist/jquery.min',
    'jquery.qtip': [
      '//cdn.jsdelivr.net/qtip2/2.2.1/jquery.qtip.min',
      '/lib/qtip2/basic/jquery.qtip.min'
    ],
    datePicker: '//cdn.jsdelivr.net/bootstrap.daterangepicker/2/daterangepicker',
    googlechart: '//www.gstatic.com/charts/loader',
    countrySelect: '/lib/country-select-js/build/js/countrySelect.min',
    underscore: '/lib/underscore/underscore-min',
    domReady: '/lib/domReady/domReady',
    requirejs: '/lib/requirejs/require',
    simplePagination: [
      '/lib/simplePagination.js/jquery.simplePagination'
    ],
  },
  packages: [
    "controllers",
    "directives"
  ]
});

// this is just to "preload" stuff
require(['angular', 'jquery']);
