const express   = require('express');
const _         = require('lodash');
const request   = require('request-promise');
const utils     = require('../lib/utils');
const headers   = require('../lib/headers');

const router = express.Router();

const SERVICES = ['googleSpeech', 'voiceBase', 'ibmWatson'];

router.post('/talktime', utils.isLoggedIn, function (req, res) {

  const data = req.query;
  if (!data.service || !data.callId)
    return res.status(422).json('Missing parameters in request');

  if (SERVICES.indexOf(data.service) < 0)
    return res.status(404).json('The specified service is not available');

  var callStats = null;

  fetchCallStats(data.callId).then(stats => {
    if(_.isEmpty(stats)) {
      return getCallRecordings(data.callId).then(recordings => {
        const participants = {};
        _.each(recordings, rec => {
          if(rec.participantId) {
            participants[rec.participant.id] = rec.participant.type;
          }
        });
        callStats = new CallStats();
        callStats.callId = data.callId;
        callStats.participants = participants;
        callStats.save();
      });
    } else {
      callStats = stats[0];
    }
  }).then(() => {
    return callStats.talkTimeForService(data.service).then(serviceStats => {
      res.json({
        participants: callStats.participants,
        stats: serviceStats
      });
    });
  }).catch(error => {
    console.error(error);
    res.status(500).json('Internal server error');
  });
});

function fetchCallStats(callId) {
  return CallStats.find({callId: callId});
}

function getCallRecordings(callId) {
  return request({
    url: process.env.VOXBONE_RECORDING_API_URL + '/calls/' + callId + '/recordings',
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  }).then(body => JSON.parse(body));
}

module.exports = router;
