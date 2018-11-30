const express = require('express');
const router = express.Router();
const rp = require('request-promise-native');
const utils = require('../lib/utils');
const headers = require('../lib/headers');
const json2csv = require('json2csv');

router.get('/call/:callId', utils.isLoggedIn, function(req, res, next) {
  const profileId = res.locals.currentUser.profileId;
  if (!req.params.callId) return res.status(404).json('Missing call Id');

  const options = {
    url: process.env.VOXBONE_METADATA_API_URL + '/cdrs/' + req.params.callId,
    method: 'GET',
    headers: headers.metadataApiHeaders,
    auth: headers.metadataApiCredentials,
    json: true
  };

  rp(options).then((resp) => {

    if (!resp.data._source)
      return res.status(404).json('Not found');

    let call = resp.data._source;

    try {
      if (resp.data._source.recordings[0].recordingProfileId !== profileId || resp.data._source.recordings[1].recordingProfileId !== profileId)
        return res.status(403).json();
    } catch(e) {
      return res.status(404).json('At least one recording is missing for this call');
    }

    return res.status(200).json(resp, null, 2);
  }).catch((e) => {
    return res.status(500).json(e);
  });

});

router.get('/calls', utils.isLoggedIn, function(req, res, next) {
  const profileId = res.locals.currentUser.profileId;
  const from = req.query.from || 0;
  const size = req.query.size || 10;
  let recordingFilters = [];

  recordingFilters.push({
    "constant_score" : {
      "filter" : {
        "term" : {
          "recordings.recordingProfileId" : profileId
        }
      }
    }
  });

  if (req.query.initDateTime && req.query.endDateTime) {
    recordingFilters.push({
      "range" : {
        "recordings.createdAt" : {
          "gte" : req.query.initDateTime,
          "lt" :  req.query.endDateTime
        }
      }
    });
  }

  let query = {
    "sort" :{
      "startTime" : {"order" : "desc"}
    },
    "from" : from,
    "size" : size,
    "query": {
        "bool": {
          "must": [
            {
              "nested": {
                "path": "recordings",
                "query": {
                  "bool": {
                    "must": recordingFilters
                  }
                }
              }
            }
          ]
        }
    }
  };

  if (req.query.calledDid) {
    query.query.bool.must.push({
      "match": {
        "calledNumber": req.query.calledDid
      }
    });
  }

  const options = {
    url: process.env.VOXBONE_METADATA_API_URL + '/cdrs/search',
    method: 'POST',
    json: query,
    auth: headers.metadataApiCredentials,
    headers: headers.metadataApiHeaders
  };

  rp(options).then((resp) => {
    let calls = [];

    if (resp.data.hits.constructor !== Array) {
      calls.push(resp.data.hits._source);
    } else {
      resp.data.hits.forEach((call) => {
        calls.push(Object.assign(call._source, {id: call._id}));
      });
    }

    return res.status(200).json({
      calls: calls,
      tabs: Math.ceil(resp.data.total/10)
    });
  }).catch((e) => {
    //console.log(e);
  });

});


router.get('/getSpreadsheet', utils.isLoggedIn, function(req, res, next) {
  const profileId = res.locals.currentUser.profileId;
  let serviceName;
  let language;
  let rows = [];
  const query = {
    "sort" :{
      "startTime" : {"order" : "desc"}
    },
    "from" : 0,
    "size" : 1000,
    "query": {
      "nested": {
        "path": "recordings",
        "query": {
          "constant_score" : {
            "filter" : {
              "term" : {
                "recordings.recordingProfileId" : profileId
              }
            }
          }
        }
      }
    }
  };

  const fields = ['started', 'ended', 'called-DID', 'duration',
  'call-ID', 'inbound-call-id', 'caller-id', 'codec', 'language',
  'full-transcript', 'callee-transcript', 'caller-transcript', 'caller-sentiment', 'callee-sentiment', 'caller-talk-time',
  'callee-talk-time', 'caller-overtalk', 'callee-overtalk', 'caller-media',
  'callee-media', 'keywords'];

  const options = {
    url: process.env.VOXBONE_METADATA_API_URL + '/cdrs/search',
    method: 'POST',
    json: query,
    auth: headers.metadataApiCredentials,
    headers: headers.metadataApiHeaders
  };

  rp(options).then((resp) => {
    resp.data.hits.forEach((call) => {
      let formatedCall = formatCallObject(call._source);

      let row = {
        'started': formatedCall.startTime,
        'ended': formatedCall.endTime,
        'called-DID': formatedCall.calledNumber,
        'duration': formatedCall.duration,
        'inbound-call-id': formatedCall.relatedVoxboneCallId,
        'caller-id': formatedCall.calledNumber
      };

      try {
        const recordingData = {
          'call-ID': formatedCall.recordings.caller.callId,
          'codec': formatedCall.recordings.caller.codec,
          'caller-media': formatedCall.recordings.caller.downloadLink,
          'callee-media': formatedCall.recordings.callee.downloadLink
        };
        row = Object.assign(row, recordingData);
      } catch(e) {}

      try {
        if (Object.getOwnPropertyNames(formatedCall.recordings.caller.analytics).indexOf('googleSpeech') > -1 && Object.getOwnPropertyNames(formatedCall.recordings.callee.analytics).indexOf('googleSpeech') > -1) {
          serviceName = 'googleSpeech';
        } else if (Object.getOwnPropertyNames(formatedCall.recordings.caller.analytics).indexOf('voiceBase') > -1 && Object.getOwnPropertyNames(formatedCall.recordings.callee.analytics).indexOf('voiceBase') > -1) {
          serviceName = 'voiceBase';
        } else if (Object.getOwnPropertyNames(formatedCall.recordings.caller.analytics).indexOf('ibmWatson') > -1 && Object.getOwnPropertyNames(formatedCall.recordings.callee.analytics).indexOf('ibmWatson') > -1) {
          serviceName = 'ibmWatson';
          language = formatedCall.recordings.caller.analytics.ibmWatson.analyticSettings.ibmWatson.model;
        }

        if (serviceName !== 'ibmWatson') {
          if (formatedCall.recordings.caller.analytics[serviceName].speechToText.lang || formatedCall.recordings.callee.analytics[serviceName].speechToText.lang)
            language = formatedCall.recordings.caller.analytics[serviceName].speechToText.lang || formatedCall.recordings.callee.analytics[serviceName].speechToText.lang;
          else
            language = formatedCall.recordings.caller.analytics[serviceName].analyticSettings[serviceName].language;
        }

        const analyticsData = {
          'language': language || formatedCall.recordings.caller.analytics[serviceName].sentimentAnalysis.language,
          'full-transcript': formatTranscription(formatedCall.recordings.all.analytics[serviceName].aggregation),
          'callee-transcript': formatTranscription(formatedCall.recordings.callee.analytics[serviceName].aggregation),
          'caller-transcript': formatTranscription(formatedCall.recordings.caller.analytics[serviceName].aggregation),
          'caller-talk-time': formatedCall.recordings.caller.analytics[serviceName].talkTimeAnalysis.talkTime,
          'callee-talk-time': formatedCall.recordings.callee.analytics[serviceName].talkTimeAnalysis.talkTime,
          'caller-overtalk': formatedCall.recordings.caller.analytics[serviceName].talkTimeAnalysis.overTalk,
          'callee-overtalk': formatedCall.recordings.callee.analytics[serviceName].talkTimeAnalysis.overTalk
        };

        try {
          analyticsData['caller-sentiment'] = formatedCall.recordings.caller.analytics[serviceName].sentimentAnalysis.score;
          analyticsData['callee-sentiment'] = formatedCall.recordings.callee.analytics[serviceName].sentimentAnalysis.score;
        } catch(e) {
          analyticsData['caller-sentiment'] = 'Not available';
          analyticsData['callee-sentiment'] = 'Not available';
        }

        row = Object.assign(row,analyticsData);

      } catch(e) {}

      rows.push(row);
    });

    const csv = json2csv({ data: rows, fields: fields, preserveNewLinesInValues: true});
    let contentDisp;

    try {
      contentDisp = 'attachment; filename=' + rows[0].started + '.csv';
    } catch(e) {
      contentDisp = 'attachment; filename=no-calls.csv';
    }

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': contentDisp
    });
    res.send(csv);

  }).catch((e) => {});
});

function millisToMinutesAndSeconds(millis) {
  if (!millis && millis !== 0) return null;
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return (seconds == 60 ? (minutes + 1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
}

function formatCallObject(call) {
  try {
    let recordings = {};
    call.recordings.forEach((rec) => {
      let analytics = {};

      rec.analytics.forEach((analyticsDoc) => {
        analyticsDoc.aggregation = createAnalyticsAggregation(analyticsDoc, rec);
        analytics[analyticsDoc.speechToText.service] = analyticsDoc;
      });
      rec.analytics = analytics;
      recordings[rec.participantDescription] = rec;
    });

    const all = generateMergedTranscriptions(recordings);
    call.recordings = Object.assign(recordings, {all});
  } catch(e) {}

  return call;
}

function createAnalyticsAggregation(analyticsDoc, rec) {
  let transcript = analyticsDoc.speechToText.transcript;
  let stringifiedSentence = '';
  let result = [];

  if (!transcript) transcript = [];

  var sentenceOrder = 0;
  transcript.forEach(function(sentence) {

    sentence.forEach(function(word) {
      stringifiedSentence += word.word + ' ';
    });
    stringifiedSentence = stringifiedSentence.trim() + ".";

    // Get Sentiment Analysis score
    let saScore;
    let saClass = "glyphicon-info-sign"; // Default

    try {
      if (sentenceOrder < analyticsDoc.sentimentAnalysis.sentences.length) {
        saScore = analyticsDoc.sentimentAnalysis.sentences[sentenceOrder].sentiment.score;
        if (saScore >= 0)
          saClass = "glyphicon-thumbs-up custom-modal-sentiment-analysis-positive";
        else
          saClass = "glyphicon-thumbs-down custom-modal-sentiment-analysis-negative";
      }
    } catch(e) {}

    result.push({
      text: stringifiedSentence,
      humanStartTimestamp: millisToMinutesAndSeconds(sentence[0].startTimestamp),
      startTimestamp: sentence[0].startTimestamp,
      participantType: rec.participantDescription,
      sentimentAnalysis: saScore,
      sentimentAnalysisGlyphiconClass: saClass
    });

    stringifiedSentence = '';
    sentenceOrder ++;
  });

  return result;
}

function generateMergedTranscriptions(recordings) {

  try {
    let result = {};
    const services = ['googleSpeech', 'ibmWatson', 'voiceBase'];
    services.forEach((service) => {

      if (recordings.caller.analytics.hasOwnProperty(service) && recordings.callee.analytics.hasOwnProperty(service)) {
        let callerAggregation = recordings.caller.analytics[service].aggregation;
        let calleeAggregation = recordings.callee.analytics[service].aggregation;
        var mergedAggregation = callerAggregation.concat(calleeAggregation);

        mergedAggregation = mergedAggregation.sort(function(a, b) {

          if ((!a.startTimestamp || !b.startTimestamp) && (a.startTimestamp !== 0) && (b.startTimestamp !== 0))
            allTimestampsPresent = false;

          return a.startTimestamp - b.startTimestamp;
        });

        result[service] = {};
        result[service].aggregation = mergedAggregation;

      }

    });

    return {
      analytics: result,
      participantDescription: 'all'
    };
  } catch(e) {
    return {
      analytics: {},
      participantDescription: 'all'
    };
  }

}

function millisToMinutesAndSeconds(millis) {
  if (!millis && millis !== 0) return null;
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return (seconds == 60 ? (minutes + 1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
}


function formatTranscription(aggregation) {
  let text = '';

  try {
    aggregation.forEach((sentence) => {
      text += sentence.participantType + ' - ';
      text += '(' + sentence.humanStartTimestamp + '): ';
      text += sentence.text;
      text += '\n';
    });
  } catch(e) {}

  return text;
}

module.exports = router;
