var express = require('express');
var router = express.Router();
var request = require('request');
var requestPromise = require('request-promise-native');
var callingCountries = require('country-data').callingCountries;
var async = require('async');
var utils = require('../lib/utils');
var headers = require('../lib/headers');
var NodeCache = require("node-cache");
var _ = require('underscore');

var Transcript = require('../models/transcript');

var cache = new NodeCache({stdTTL: 3600});

router.get('/getDIDs', utils.isLoggedIn, function(req, res, next) {
  var options = {
    url: process.env.VOXBONE_PROVISIONING_API_URL + '/inventory/did?pageNumber=0&pageSize=900',
    headers: headers.provisioningApiHeaders,
    auth: headers.provisioningApiCredentials
  };

  function callback(error, response, body) {
    var result = [];
    var countries = require("i18n-iso-countries");

    if (!error && response.statusCode == 200) {
      var dids = JSON.parse(body).dids;
      var dist_countries = [];
      var phoneCode;
      /*This gets into result the first Id of each individual country listed
      with its corresponding DID*/
      dids.forEach(function(did) {

        if ((did.voiceUriId === null) && (dist_countries.indexOf(did.countryCodeA3) == -1)){
          dist_countries.push(did.countryCodeA3);

          if (callingCountries[did.countryCodeA3])
            phoneCode = callingCountries[did.countryCodeA3].countryCallingCodes[0];
          else //inum world special case
            phoneCode = '+883';

          result.push({
            "name": (countries.getName(did.countryCodeA3, "en") || 'world') + ' (' + phoneCode + ')',
            "iso2": (countries.alpha3ToAlpha2(did.countryCodeA3) || 'WLD').toLowerCase(),
            "DID": did.e164
          });
        }
      });
    }
    res.json(result);
  }

  request(options, callback);
});

router.post('/linkDIDs', utils.isLoggedIn, function(req, res, next) {

  var account = res.locals.currentUser;
  //Protection if the account already has linked dids
  if(account.dids.length)
    return res.status(400).json("This account already has DIDS assigned to it");

  var voiceUriId = account.voiceUriId;
  var DID1 = req.body[0];
  var DID2 = null;
  if(req.body.length == 2)
    DID2 = req.body[1];

  //gets 2 DID ids
  async.parallel([
      function(callback) {
        getDidInfo(DID1, callback);
      },
      function(callback) {
        getDidInfo(DID2, callback);
      }
    ],
    function(err, didsInfo) {
      var index = didsInfo.indexOf(null);
      if(index != -1)
        didsInfo.splice( index, 1 );

      var didIds = _.map(didsInfo, function(didInfo) {
        return didInfo.id;
      });

      var options = {
        url: process.env.VOXBONE_PROVISIONING_API_URL + '/configuration/configuration',
        method: 'POST',
        headers: headers.provisioningApiHeaders,
        auth: headers.provisioningApiCredentials,
        json: {
          "didIds": didIds,
          "voiceUriId": voiceUriId
        }
      };

      function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
          if (DID1) account.dids.push(DID1);
          if (DID2) account.dids.push(DID2);
          account.save();

          return res.status(200).json();
        } else {
          return res.status(400).json();
        }
      }

      var takenNumbers = [];
      didsInfo.forEach(function(didInfo) {
        if(didInfo.voiceUriId)
          takenNumbers.push(didInfo.e164);
      });

      if(!takenNumbers.length) //the selected dids are all available
        request(options, callback);
      else
        return res.status(400).json(takenNumbers);
    });
});

router.get('/recordings', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  const callId = req.query.callId;

  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/calls/' + callId + '/recordings',
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  function callback(error, response, body) {
    if (!error && body)
      return res.status(200).json(body);
    else {
      console.log(error);
      return res.status(502).json();
    }
  }

  request(options, callback);
});

router.get('/redactedUrl', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  const mediaId = req.query.mediaId;

  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media/' + mediaId + '/streams',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI3NmY5ZTZmMy02MmQyLTQ2OGQtOTczOS04MTc3MjMzMTI3MWIiLCJ1c2VySWQiOiJhdXRoMHw1OGU1NDk5MTZiZGYxMTZhOGM3NTM5MTIiLCJvcmdhbml6YXRpb25JZCI6IjkzODQ5ODQ1LTc0M2ItM2QzZS02NDllLTgwYmQxYWU0MDk2MyIsImVwaGVtZXJhbCI6ZmFsc2UsImlhdCI6MTQ5MTUxMDk0ODg3OCwiaXNzIjoiaHR0cDovL3d3dy52b2ljZWJhc2UuY29tIn0.r3tAS2X2D2hSSFFcPvmY6CHpbH1EVqkCWqD_DgrcK30'
    },
    json: true
  };

  function callback(error, response, body) {
    if (!error && body)
      return res.status(200).json(body.streams.original);
    else
      return res.status(400).json();
  }

  request(options, callback);
});

router.get('/calls', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;

  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId + '/calls?sort=-createdAt',
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var calls = [];
      try {
        calls = JSON.parse(body);
        calls = (Array.isArray(calls) ? calls : []);
      } catch(e) {
        console.log(e);
        calls = [];
      }

      calls = calls.map(function(call) {
        var duration;

        if (call.endedAt) {
          // Recording has ended;
          var start = new Date(call.createdAt);
          var end = new Date(call.endedAt);
          duration = (end - start) / 1000;
        } else {
          // Recording is still running.
        }

        call.duration = duration;

        return call;
      });

      let callIds = getCallIds(calls);
      retrieveSAFromDB(callIds, function (err, transcriptsWithSA) {

        /*jshint loopfunc: true */
        for (let callId in transcriptsWithSA) {
          let c = calls.find(call => call.id === callId);
          c.sentimentAnalysis = transcriptsWithSA[callId];
        }

        return res.status(200).json(JSON.stringify(calls));
      });
    } else {
      console.log(error);
      return res.status(502).json();
    }
  }

  request(options, callback);
});

function getCallIds(calls) {
  let callIds = [];

  calls.forEach((call) => {
    callIds.push(call.id);
  });

  return callIds;
}

function retrieveSAFromDB(callIds, callback) {
  Transcript.find({
    'callId': { $in: callIds },
    'sentimentAnalysis': { $exists: true }
  }, function(err, transcripts) {

    let sentimentAnalysisSummarized = {};
    transcripts.forEach((transcript) => {

      if (!sentimentAnalysisSummarized[transcript.callId])
        sentimentAnalysisSummarized[transcript.callId] = [];

      if (transcript.sentimentAnalysis)
        sentimentAnalysisSummarized[transcript.callId].push(transcript.sentimentAnalysis.documentSentiment.score);

    });

    if (!err)
      callback(null, sentimentAnalysisSummarized);
    else {
      console.log(err);
      callback(err, null);
    }
  });
}

router.get('/transfers', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  var options = {
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  if (!req.query.callId || req.query.callId === 'null')
    options.url = process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId + '/transfers';
  else
    options.url = process.env.VOXBONE_RECORDING_API_URL + '/calls/' + req.query.callId + '/transfers';

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var transfers = [];
      try {
        transfers = JSON.parse(body);
        transfers = (Array.isArray(transfers) ? transfers : []);
      } catch(e) {
        console.log(e);
        transfers = [];
      }

      transfers = transfers.map(function(transfer) {

        var recording = transfer.recording;

        if (recording && typeof recording === 'object') {

          if (recording.endedAt) {
            // Recording has ended;
            var start = new Date(recording.startedAt);
            var end = new Date(recording.endedAt);
            duration = (end - start) / 1000;
          } else {
            // Recording is still running.
          }

          recording.duration = duration;

        }

        return transfer;
      });

      return res.status(200).json(JSON.stringify(transfers));
    } else {
      console.log(error);
      return res.status(502).json();
    }
  }

  request(options, callback);
});

router.get('/recordingSettings', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;

  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId,
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var profile = null;
      try {
        profile = JSON.parse(body);
      } catch(e) {
      }
      return res.status(200).json(JSON.stringify(profile));
    } else {
      return res.status(400).json();
    }
  }

  request(options, callback);
});

router.put('/recordingSettings', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  updateProfile(req.body, profileId).then((profile) => {
    return res.status(200).json(profile);
  }).catch((e) => {
    return res.status(400).json(e);
  });
});

router.get('/transferSettings', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;

  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId + '/transferSettings',
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var settings = null;
      try {
        settings = JSON.parse(body);
      } catch(e) {
      }
      return res.status(200).json(JSON.stringify(settings));
    } else {
      return res.status(400).json();
    }
  }

  request(options, callback);
});

router.put('/transferSettings', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  const storageServicePromises = [];
  const enabledServices = ['gcs', 's3'];

  enabledServices.forEach((service) => {
    if (req.body[service]) {
      let storageServicePromise = new Promise((resolve, reject) => {
        putService(service, req.body[service], function(err, response) {
          if (!err) {
            resolve(response);
          } else {
            reject(new Error(err));
          }
        });
      });
      storageServicePromises.push(storageServicePromise);
    }
  });

  Promise.all(storageServicePromises).then(transferSettings => {
    updateRecordingLimit(transferSettings, profileId).then((profile) => {
      res.status(200).json(transferSettings);
    }).catch((err) => {
      res.status(400).json(err);
    });
    res.status(200).json(transferSettings);
  }).catch((err)=>{
    res.status(400).json(err);
  });

  function putService(service, dataObj, callback) {
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
  }

  function jsonReplacer(key, value) {
    if (key === 'id' || key === 'createdAt' || key === 'profile') {
      return undefined;
    }

    return value;
  }
});

function getPhoneInfo(phone, callback) {
  var sanitized_phone = phone.replace('+', '');
  var isNum = /\d+$/.test(sanitized_phone);

  var options = {
    url: 'http://apilayer.net/api/validate?access_key=' + process.env.NUMVERIFY_ACCESS_KEY + '&number=' + sanitized_phone + '&country_code=&format=1',
    method: 'GET',
  };

  if(isNum) {
    request(options, function(error, response, body){
      if(!error)
        callback(body);
      else
        callback('{"NotFoundInfo": "Phone number not found in records"}');
    });
  } else {
    callback('{"NotFoundInfo": "Call not coming from a phone number"}');
  }

}

function getDidInfo(DID, async_callback) {
  var filteredDID = '';

  if(DID)
    filteredDID = DID.replace(/\D/g, '');

  var options = {
    url: process.env.VOXBONE_PROVISIONING_API_URL + "/inventory/did?e164Pattern=%25" + filteredDID + "&pageNumber=0&pageSize=1",
    headers: headers.provisioningApiHeaders,
    auth: headers.provisioningApiCredentials
  };

  function callback(error, response, body) {
    var info = JSON.parse(body);
    async_callback(null, {
      id : info.dids[0].didId,
      voiceUriId : info.dids[0].voiceUriId,
      e164: info.dids[0].e164
    });
  }

  if(DID)
    request(options, callback);
  else
    async_callback(null, null);
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

function updateRecordingLimit(transferSettings, profileId) {
  transferSettings = JSON.parse(transferSettings);
  let maxDuration = transferSettings.enabled ? process.env.RECORDING_MAX_DURATION_MINS : process.env.RECORDING_MIN_DURATION_MINS;
  return updateProfile({recordMaxDuration: maxDuration}, profileId);
}

function updateProfile(reqBody, profileId) {
  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/profiles/' + profileId,
    method: 'PUT',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
    json: reqBody,
    jsonReplacer: jsonReplacer,
  };

  return requestPromise(options);

  function jsonReplacer(key, value) {
    if (key === 'id' || key === 'createdAt') {
      return undefined;
    }

    return value;
  }
}

module.exports = router;
