var express = require('express');
var router = express.Router();
var request = require('request');
var utils = require('../lib/utils');
var NodeCache = require("node-cache");
var _ = require('underscore');

var cache = new NodeCache({ stdTTL: 7200 });

router.get('/info', function(req, res, next) {
  let bridgeId;
  let options = {};

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      if (res.headersSent) return;

      /*Return a mocked bridge object which lacks sensitive information*/
      var bridge = JSON.parse(body);
      return res.status(200).json(JSON.stringify({
        active: bridge.active,
        pinAuth: bridge.pinAuth,
        bridgePasscode: bridge.bridgePasscode,
        participantProfile: bridge.participantProfile
      }));

    } else {
      return res.status(400).json();
    }
  }

  if (req.query.bridgeId) {
    bridgeId = req.query.bridgeId;

    options = {
      url: `${process.env.VOXCONF_API_URL}/bridges/${bridgeId}`,
      method: 'GET',
      headers: utils.getConferencingApiHeaders(process.env.VOXCONF_API_USER_KEY)
    };

    request(options, callback);

  } else {
    return res.status(400).json({message: "Missing bridge Id parameter"});
  }

});


router.get('/getParticipants', function(req, res, next) {
  let bridgeId;
  let options = {};

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      if (res.headersSent) return;

      let participants = JSON.parse(body);
      let extendedParticipants = [];
      participants = processParticipantsForwardingState(participants);

      participants.forEach(function(participant, index) {
        // No need to check if there is no CallerId
        if (!participant.callerId) return;

        cache.get(participant.callerId + bridgeId, function(err, info) {

          if (!err && info) {
            let extended = _.extend(participant, JSON.parse(info));

            if (extended.country_code)
              extended.country_code = extended.country_code.toLowerCase();

            extendedParticipants.push(extended);
          } else {
            getCallerInfo(participant.callerId, bridgeId, function(info) {
              cache.set(participant.callerId + bridgeId, info);
            });
          }

        });
      });

      return res.status(200).json(extendedParticipants);
    } else {
      return res.status(400).json();
    }
  }

  if (req.query.bridgeId) {
    bridgeId = req.query.bridgeId;
    options = {
      url: `${process.env.VOXCONF_API_URL}/bridges/${bridgeId}/participants?sort=createdAt`,
      method: 'GET',
      headers: utils.getConferencingApiHeaders(process.env.VOXCONF_API_USER_KEY)
    };

    request(options, callback);
  } else {
    return res.status(400).json({message: "Missing parameters"});
  }

});

function processParticipantsForwardingState(participants) {
  /*Removes all participants with type "forward" from the array of participants
    and adds a boolean forwarding property to the remaining participant objects*/
  let forwarded = [];

  for(var i = participants.length-1; i >= 0; i--) {
    if( participants[i].channelType === "forward") {
      forwarded.push(participants[i].callerId);
      participants.splice(i, 1);
    }
  }

  participants.forEach((participant) => {
    participant.forwarded = forwarded.indexOf(participant.callerId) > -1;
  });

  return participants;
}

router.get('/getSelfLocation', function(req, res, next) {
  const ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
  const options = {
    url: `http://ip-api.com/json/${ip}`,
    method: 'GET'
  };
  let participantId = req.query.participantId ? req.query.participantId : ip;

  if (!participantId) return res.status(404).json();

  participantId = participantId.replace(/[^a-zA-Z0-9-_]/g, '');

  function callback(error, response, body) {
    if (!error && response.statusCode == 200 && JSON.parse(body).status !== 'fail') {
      let info = JSON.parse(body);
      info.countryCode = info.countryCode.toLowerCase();
      const stringifiedInfo = JSON.stringify(info);
      cache.set(participantId, stringifiedInfo);
      return res.status(200).json(stringifiedInfo);
    } else {
      return res.status(404).json();
    }
  }

  request(options, callback);
});

function getCallerInfo(callerId, bridgeId, callback) {
  var sanitized_phone = callerId.replace('+', '');
  var isPhone = /\d+$/.test(sanitized_phone);
  var options = {
    url: 'http://apilayer.net/api/validate?access_key=' + process.env.NUMVERIFY_ACCESS_KEY + '&number=' + sanitized_phone + '&country_code=&format=1',
    method: 'GET',
  };

  if (isPhone) {
    request(options, function(error, response, body) {
      if (!error)
        callback(body);
      else
        callback('{"NotFoundInfo": "Phone number not found in records"}');
    });
  } else {
    cache.get(callerId + bridgeId, function(err, info) {

      if (!err && info) {
        return callback(info);
      } else {
        callback('{"NotFoundInfo": "Geo Ip location not found"}');
      }

    });
  }
}

module.exports = router;
