const crypto = require('crypto');
const url = require('url');

var _ = require('lodash');
var headers = require('./headers');
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var Haikunator = require('haikunator');
var haikunator = new Haikunator();

// Here it goes only utility methods
var utils = module.exports = {
  getConferencingApiHeaders: function (voxconf_user_api_key) {
    const headers = {
      'Authorization': `Basic ${process.env.VOXCONF_API_BASIC_AUTH}`,
      'Content-Type': 'application/json'
    };

    if (voxconf_user_api_key)
      headers['x-voxbone-id'] = voxconf_user_api_key;

    return headers;
  },

  getFormattedDid: function(did) {

    if (!did)
      return null;

    var parsedDid = phoneUtil.parse(did);
    return phoneUtil.format(parsedDid, PNF.INTERNATIONAL);
  },

  isLoggedIn: function(req, res, next) {
    if (req.isAuthenticated()) {
      if (!res.locals.currentUser.isDemoUser())
        return next();
      else if (req.baseUrl.startsWith('/metadataApi') || req.path.startsWith('/transcriptions'))
        return next();
      else
        return res.redirect('/');

    } else {
      return res.redirect(
          url.format({
            pathname: "/",
            query: req.query
          }
        )
      );
    }
  },

  isDemoAuthorized: function(req, res, next) {
    return require('./demo').isAuthorized(req, res, next);
  },

  redirectIfLoggedIn: function(req, res, next) {
    if (req.isAuthenticated())
      return res.redirect('/landing');
    return next();
  },

  accountLoggedIn: function(req) {
    return req.isAuthenticated();
  },

  getRandom: function(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  },

  userGravatarUrl: function(res) {
    var crypto = require('crypto');
    var md5_email = crypto.createHash('md5').update(res.locals.currentUser.email).digest("hex");
    return "https://www.gravatar.com/avatar/" + md5_email + "/?s=20&d=mm";
  },

  haiku: function() {
    return haikunator.haikunate({ tokenLength: 0 });
  },

  objectNotFound: function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  },

  hmac: function hmac(key, string, encoding) {
    return crypto.createHmac('sha256', key)
      .update(string, 'utf8')
      .digest(encoding);
  },

  hash: function hash(string, encoding) {
    return crypto.createHash('sha256')
      .update(string, 'utf8')
      .digest(encoding);
  },

  uuid4: function() {
    // I leave this approach commented out just for general culture :)
    // 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    //     var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    //     return v.toString(16);
    // });

    function b(a) {
      return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
    }
    return b();
  },

  createBridgeId: function(account) {
    var request = require('request');
    var async = require('async');
    var utils = this;
    var bridgeData = { uniq_id: account.email };

    var createSoundProfile = function(done) {
      var url = process.env.VOXBONE_CONFERENCING_API_URL + '/sounds';
      request.post(url, {
          headers: headers.conferencingApiHeaders
        },
        function(err, response, body) {
          bridgeData.soundProfileId = JSON.parse(body).id;
          done(err, bridgeData);
        }
      );
    };

    var createAdminProfile = function(bridgeData, done) {
      var url = process.env.VOXBONE_CONFERENCING_API_URL + '/admins';
      request.post(url, {
          headers: headers.conferencingApiHeaders
        },
        function(err, response, body) {
          bridgeData.adminProfileId = JSON.parse(body).id;
          done(err, bridgeData);
        }
      );
    };

    var createBridge = function(bridgeData, done) {
      var url = process.env.VOXBONE_CONFERENCING_API_URL + '/bridges';
      request.post(url, {
          headers: headers.conferencingApiHeaders,
          body: JSON.stringify(bridgeData)
        },
        function(err, response, body) {
          bridgeData = JSON.parse(body);
          done(err, bridgeData);
        }
      );
    };

    var saveVoiceUri = function(bridgeData, done) {
      var url = process.env.VOXBONE_PROVISIONING_API_URL + '/configuration/voiceuri';
      var sipUri = bridgeData.id + "@" + process.env.VOXBONE_RECORDING_SERVICE;

      var data = {
        "voiceUri": {
          "voiceUriId": null,
          "backupUriId": null,
          "voiceUriProtocol": "SIP",
          "uri": sipUri,
          "description": "Voice URI for: " + bridgeData.id  + " from " + process.env.APP_URL
        }
      };

      request.put(url, {
          auth: headers.provisioningApiCredentials,
          headers: headers.provisioningApiHeaders,
          body: JSON.stringify(data)
        },
        function(err, response, body) {
          var voiceUriData = JSON.parse(body);

          // TODO: Move everything into "Bridge"
          account.bridgeId = bridgeData.id;
          account.adminProfileId = bridgeData.adminProfileId;
          account.voiceUriId = voiceUriData.voiceUri.voiceUriId;
          account.save(function(err) {
            if (err) throw err;
            return done(null);
          });
          done(err);
        }
      );
    };

    async.waterfall([createSoundProfile, createAdminProfile, createBridge, saveVoiceUri]);
  },

  getVoxRoutes: function() {
    var app = require('../app');
    var routes = [];

    _.each(app._voxPaths, function(used) {
      // On each route of the router
      _.each(used.router.stack, function(stackElement) {
        if (stackElement.route) {
          var base = used.urlBase;
          var path = stackElement.route.path;

          routes.push({
            method: stackElement.route.stack[0].method,
            path: (used.urlBase === '/') ? path : (base + path)
          });
        }
      });
    });

    return routes;
  },

  getUtmTags: function (query) {
    var utm_tags = [];

    if(query.utm_source)
      utm_tags.push(`'utm_source: ${query.utm_source}'`);

    if(query.utm_medium)
      utm_tags.push(`'utm_medium: ${query.utm_medium}'`);

    if(query.utm_campaign)
      utm_tags.push(`'utm_campaign: ${query.utm_campaign}'`);

    if(query.utm_content)
      utm_tags.push(`'utm_content: ${query.utm_content}'`);

    return utm_tags;
  },

  getProfileTags: function (currentUser) {
    var tags = [];

    if(currentUser.profileId)
      tags.push(`'profileId: ${currentUser.profileId}'`);

    if(currentUser.email)
      tags.push(`'email: ${currentUser.email}'`);

    return tags;
  }
};
