var _ = require('lodash');
var headers = require('../lib/headers');
var request = require('request');

module.exports = function(account, finish) {
  var request = require('request');
  var async = require('async');

  var remoteSipUri = process.env.DEFAULT_OUTBOUND_SIP;
  if (account.email === process.env.DEMO_USER_EMAIL)
    remoteSipUri = process.env.SA_DEMO_OUTBOUND_SIP;

  var profile = {
    email: account.email,
    record: true,
    recordFormat: 'flac',
    recordFormatSettings: JSON.stringify({'compressionLevel': "5"}),
    remoteSipUri: remoteSipUri,
    domain: process.env.APP_URL
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

  var fillTransferSettings = function(profile, done) {

    const options = {
      server: process.env.GCS_SERVER,
      accessKey: process.env.GCS_KEYS
    };

    putService('gcs', profile.id, options, function(err, response) {
      done(err, profile);
    });
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

  async.waterfall([initProfile, makeProfile, fillTransferSettings, saveVoiceUri], function doFinish(err, account) {
    if (!err) {
      let customVocabulary = 'Voxbone,';

      if (account.company)
        customVocabulary += account.company + ',';

      if (account.first_name)
        customVocabulary += account.first_name + ',';

      if (account.last_name)
        customVocabulary += account.last_name;

      account.analyticSettings.googleSpeech.speechContexts = customVocabulary;
      account.analyticSettings.voiceBase.customVocabulary = customVocabulary;
      account.analyticSettings.voiceBase.keywordSpotting = customVocabulary;

      account.save(function(err) {
        if (err) {
          console.log('Failed to save account:', err);
        }
        finish();
      });
    } else {
      finish(err);
    }
  });
};


function putService(service, profileId, dataObj, callback) {
  var baseUrl = process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId + '/transferSettings';
  dataObj.service = service;

  var options = {
    url: baseUrl + '/' + service,
    method: 'PUT',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
    json: dataObj,
    jsonReplacer: jsonReplacer,
  };

  doJSONRequest(Object.assign({}, options, {method: 'HEAD', json: undefined}), function(err, response) {
    if (!err) {
      doJSONRequest(options, callback);
    } else {
      if (err.statusCode === 404) {
        doJSONRequest(Object.assign({}, options, {method: 'POST', url: baseUrl, expectedStatusCode: 201}), callback);
      } else {
        callback(err);
      }
    }
  });

  function jsonReplacer(key, value) {
    if (key === 'id' || key === 'createdAt' || key === 'profile') {
      return undefined;
    }

    return value;
  }
}


function doJSONRequest(options, callback) {

  var expectStatusCode = options.expectedStatusCode || 200;

  return request(options, function(error, response, body) {
    if (!error && response.statusCode == expectStatusCode) {
      callback(null, JSON.stringify(body));
    } else {
      if (!error) {
        error = new TypeError(response.statusCode + ' - ' + body);
        error.statusCode = (response ? response.statusCode : undefined);
      }
      callback(error);
    }
  });
}
