var _ = require('lodash');
var headers = require('../lib/headers');

// Here it goes only utility methods
module.exports = {
  createProfile: function(account, finish) {
    var request = require('request');
    var async = require('async');
    var profile = {
      email: account.email,
      record: true
    };

    var initProfile = function(done) {
      done(null, profile);
    };

    var makeProfile = function(profile, done) {
      var url = process.env.VOXBONE_RECORDING_API_URL + '/profiles';
      request.post(url, {
          headers: headers.recordingApiHeaders,
          auth: headers.recordingApiCredentials,
          body: JSON.stringify(profile)
        },
        function(err, response, body) {
          profile = JSON.parse(body);
          done(err, profile);
        }
      );
    };

    var saveVoiceUriDummy = function(profile, done) {
      profile.voiceUriId = 'erm';

      // TODO: Move everything into "Bridge"
      account.profileId = profile.id;
      account.adminProfileId = profile.adminProfileId;
      account.voiceUriId = profile.voiceUriId;

      done(null, account);
    };

    let saveVoiceUri = function(profile, done) {
      let url = process.env.VOXBONE_PROVISIONING_API_URL + '/configuration/voiceuri';
      let sipUri = process.env.VOXBONE_RECORDING_URI_PREFIX + profile.id + "@" + process.env.VOXBONE_RECORDING_SERVICE;

      let data = {
        "voiceUri": {
          "voiceUriId": null,
          "backupUriId": null,
          "voiceUriProtocol": "SIP",
          "uri": sipUri,
          "description": "Recording URI for: " + profile.id  + " from " + process.env.APP_URL
        }
      };

      request.put(url, {
          auth: headers.provisioningApiCredentials,
          headers: headers.provisioningApiHeaders,
          body: JSON.stringify(data)
        },
        function(err, response, body) {
          let voiceUriData = JSON.parse(body);

          // TODO: Move everything into "Bridge"
          account.profileId = profile.id;
          account.adminProfileId = profile.adminProfileId;
          account.voiceUriId = voiceUriData.voiceUri.voiceUriId;

          done(err, account);
        }
      );
    };

    async.waterfall([initProfile, makeProfile, saveVoiceUri], function doFinish(err, account) {
      if (!err) {
        account.save(function(err) {
          console.log('Failed to save account:', err);
          finish();
        });
      } else {
        finish(err);
      }
    });
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
  }
};
