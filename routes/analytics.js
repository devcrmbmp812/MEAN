const express = require('express');
const router = express.Router();
const headers = require('../lib/headers');
const request = require('request');
const requestPromise = require('request-promise');
const Account = require('../models/account');
const utils = require('../lib/utils');
const NodeCache = require("node-cache");
const cache = new NodeCache({stdTTL: 7200});
const SSE = require("sse-node");
const SERVICES = ['googleSpeech', 'voiceBase', 'ibmWatson'];

var clients = {};

var enableKeywordSpotting = function (req, res, next) {
  var formData = req.body;
  const result = { message: "Succesfully saved", errors: true };

  Account.findOne({_id: req.user._id}, function (err, theAccount) {
    if (!theAccount) {
      result.message = "Account does not exist";
      return res.status(400).json(result);
    }

    for (var key in formData) {
      if (formData.hasOwnProperty(key))
        theAccount[key] = formData[key];
    }

    const profileId = theAccount.profileId;

    if (theAccount.analyticSettings.voiceBase.keywordSpottingEnabled && theAccount.analyticSettings.voiceBase.keywordSpotting) {
      let keywords = theAccount.analyticSettings.voiceBase.keywordSpotting.replace(/ /g, '').split(",");

      let options = {
        method: 'PUT',
        url: 'https://apis.voicebase.com/v2-beta/definitions/keywords/groups/' + profileId,
        headers: {'content-type': 'application/json', 'Authorization': process.env.VOICEBASE_BEARER_TOKEN},
        body: {name: profileId, keywords: keywords},
        json: true
      };

      request(options, function (error, response, body) {
        if (error) {
          return res.status(404).json();
        } else {
          try {
            return res.status(200).json(result);
          } catch (e) {
            return res.status(404).json();
          }
        }
      });
    } else {
      return res.status(200).json(result);
    }
  });
};

router.post('/keywords', utils.isLoggedIn, enableKeywordSpotting);

router.get('/update-stream', function (req, res, next) {
  const client = SSE(req, res);

  (function(bridgeId) {

    if (!clients[bridgeId]) clients[bridgeId] = {};

    req.id = utils.uuid4();
    clients[bridgeId][req.id] = client;

    client.onClose(() => {
      delete clients[bridgeId][req.id];

      if (Object.keys(clients[bridgeId]).length === 0 && clients[bridgeId].constructor === Object)
        delete clients[bridgeId];

    });
  })(process.env.VOXCONF_LIVE_TRANSCRIPT_DEMO_BRIDGE_ID);
});

router.post('/live', function (req, res, next) {
  const event = req.body;
  console.log(event);

  if (event.event_type === 'transcript') {

    if (event.conference_name && (event.conference_name in clients)) {
      processTranscriptionEvent(event).then((processedEvent) => {
        sendEventToFrontend(processedEvent);
      }).catch((err) => {
        sendEventToFrontend(event);
      });
    }

  }

  res.status(200).json('success');
});

function sendEventToFrontend(event) {
  for (var sessionId in clients[event.conference_name]) {
    clients[event.conference_name][sessionId].send(JSON.stringify(event));
  }
}

function processTranscriptionEvent(event) {
  return new Promise((resolve, reject) => {
    getParticipantId(event.connection_id, function(error, participantId) {

      if (!error) {
        getCallerId(participantId, function(error, callerId) {

          if (!error) {
            event.connection_id = callerId;
            resolve(event);
          } else {
            reject(new Error('Could not fetch caller ID'));
          }

        });
      } else {
        reject(new Error('Could not fetch participant ID'));
      }

    });
  });
}

function getCallerId(participantId, callback) {
  cache.get(participantId, function(err, storedCallerId) {

    if (storedCallerId) {
      callback(null, storedCallerId);
    } else {
      getCallerIdFromApi(participantId, function(error, callerId) {

        if (callerId) {
          cache.set(participantId, callerId);
          callback(null, callerId);
        } else {
          callback(error, null);
        }

      });
    }

  });
}

function getCallRecordings(callId) {
  return requestPromise({
    url: process.env.VOXBONE_RECORDING_API_URL + '/calls/' + callId + '/recordings',
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  }).then(body => JSON.parse(body));
}

function getCallerIdFromApi(participantId, callback) {
  const options = {
    url: `${process.env.VOXCONF_API_URL}/bridges/participants/${participantId}`,
    method: 'GET',
    headers: utils.getConferencingApiHeaders(process.env.VOXCONF_API_USER_KEY)
  };

  request(options, function(error, response, body) {

    if (!error && body) {
      try {
        callback(null, JSON.parse(body).callerId);
      } catch(err) {
        callback(err, null);
      }
    } else {
      callback(error, null);
    }

  });
}

function getParticipantId(connectionId, callback) {
  cache.get(connectionId, function(err, storedParticipantId) {

    if (storedParticipantId) {
      callback(null, storedParticipantId);
    } else {
      getParticipantIdFromApi(connectionId, function(error, participantId) {

        if (participantId) {
          cache.set(connectionId, participantId);
          callback(null, participantId);
        } else {
          callback(error, null);
        }

      });
    }

  });
}

function getParticipantIdFromApi(connectionId, callback) {
  const options = {
    method: 'GET',
    url: `https://folkvangr.gridspace.com/v0/connections/${connectionId}`,
    auth: {
      user: process.env.GRIDSPACE_USERNAME,
      password: process.env.GRIDSPACE_PASSWORD
    }
  };

  request(options, function(error, response, body) {

    if (!error && body) {
      try {
        callback(null, JSON.parse(body).from);
      } catch(err) {
        callback(err, null);
      }
    } else {
      callback(error, null);
    }

  });
}

module.exports = router;
