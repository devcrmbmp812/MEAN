var CronJob = require('cron').CronJob;
const Transcript = require('../models/transcript');
const SERVICES = ['googleSpeech', 'voiceBase', 'ibmWatson'];
const request = require('request');
const rp = require('request-promise');

module.exports = {
  startTranscriptionsPolling: function(seconds) {
    new CronJob(`*/${seconds} * * * * *`, function() {
    console.log(`${new Date().toLocaleString()}: Running scheduled task`);
    updateUnprocessedTranscriptions().then((updatedTranscriptions) => {
      updateSentimentAnalysis().then((updatedSA) => {
      });
    }).catch((e) =>{
    });
  }, null, true);
  }
};

function updateUnprocessedTranscriptions () {
  let transcriptPromises = [];

  return new Promise((resolve, reject) => {
    const query = Transcript.find({ 'processed': false, 'failureReason': null }).limit(10).sort({created_at: -1});
    query.exec(function (err, transcripts) {

      if (transcripts.length > 0) {
        console.log(`Found ${transcripts.length} unprocessed transcripts`);
        transcripts.forEach((transcript) => {
          var transcriptPromise = fetchTranscript(transcript).catch((e) => {console.log(e)});
          transcriptPromises.push(transcriptPromise);
        });
      }

      Promise.all(transcriptPromises).then((updatedTranscriptions) => {
        resolve(updatedTranscriptions.length);
      }).catch((e) => reject(e));
    });
  });
}

function updateSentimentAnalysis() {
  let sentimentPromises = [];

  return new Promise((resolve, reject) => {
    const query = Transcript.find({ 'processed': true, 'sentimentAnalysis': null, 'failureReason': null }).limit(10).sort({created_at: -1});
    query.exec(function (err, transcripts) {

      if (transcripts.length > 0) {
        console.log(`Found ${transcripts.length} transcripts which lack sentiment analysis`);

        transcripts.forEach((transcript) => {
          var sentimentPromise = fetchSentimentAnalysis(transcript).catch((e) => {console.log(e)});
          sentimentPromises.push(sentimentPromise);
        });
      }

      Promise.all(sentimentPromises).then((updatedSa) => {
        resolve(updatedSa.length);
      }).catch((e) => reject(e));
    });
  });
}

function fetchSentimentAnalysis(theTranscript) {
  const textToAnalyze = theTranscript.getStringifiedTranscription();

  const options = {
    uri: `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${process.env.GOOGLE_SPEECH_API_KEY}`,
    method: 'POST',
    body: {
      "encodingType": "UTF8",
      "document": {
        "type": "PLAIN_TEXT",
        "content": textToAnalyze
      }
    },
    json: true
  };

  return new Promise((resolve, reject) => {
    rp(options).then((results) => {
      theTranscript.sentimentAnalysis = results;

      theTranscript.save(function (err) {
        if (err)
          reject(`There was an error saving the SA: ${err}`);
        else
          resolve(theTranscript);
      });
    })
    .catch((error) => {
      reject(`There was an error retrieving the SA: ${error} - Transcription with media ID: ${theTranscript.mediaId}`);
    });
  });
}

function getVoicebaseTranscript(mediaId, callback) {
  const options = {
    url: 'https://apis.voicebase.com/v2-beta/media/' + mediaId,
    method: 'GET',
    headers: {
      'Authorization': process.env.VOICEBASE_BEARER_TOKEN
    }
  };

  request(options, function(error, response, body) {
    let result;
    try {
      result = JSON.parse(body);
    } catch(e) {
      callback(e, null);
    }

    if (error) {
      callback(error, null);
    } else {
      try {
        if (result.media.status === 'finished') {
          callback(null, analyzeVoicebaseResponse(result));
        } else {
          callback('Processing', null);
        }
      } catch (e) {
        callback(e, null);
      }
    }

  });

}

function getGoogleSpeechTranscript(mediaId, callback) {

  const options = {
    method: 'GET',
    url: 'https://speech.googleapis.com/v1/operations/' + mediaId + '?key=' + process.env.GOOGLE_SPEECH_API_KEY
  };

  request(options, function(error, response, body) {
    let result;
    try {
      result = JSON.parse(body);
    } catch(e) {
      callback(e, null);
    }

    if (error) callback(error, null);
    else if (result.done) callback(null, analyzeGcsResponse(result.response.results));
    else callback('Processing', null);
  });

}


function getIbmWatsonTranscript(mediaId, callback) {

  const options = {
    method: 'GET',
    url: 'https://stream.watsonplatform.net/speech-to-text/api/v1/recognitions/' + mediaId,
    auth: {
      user: process.env.IBM_USERNAME,
      password: process.env.IBM_PASSWORD
    }
  };

  request(options, function(error, response, body) {
    let result;

    try {
      result = JSON.parse(body);
    } catch(e) {
      callback(e, null);
    }

    if (error) callback(error, null);
    else if (result.status === 'completed') callback(null, analyzeIbmWatsonResponse(result.results[0].results));
    else callback('Processing', null);
  });

}

function analyzeIbmWatsonResponse(apiResults) {
  var result = {
    timestamps: [],
    sentences: []
  };

  if (!apiResults) return [];

  try {
    apiResults.forEach(function(phrase) {
      let words = phrase.alternatives[0].timestamps;
      result.sentences.push(phrase.alternatives[0].transcript.trim().replace(/\./g, ''));
      words.forEach(function(word) {
        result.timestamps.push({
          word: word[0].replace(/\./g, ''),
          startTimestamp: word[1] * 1000,
          endTimestamp: word[2] * 1000
        });
      });
    });
  } catch(e) {
    console.log(e);
    return [];
  }

  return {
    transcript: processSentences(result)
  };
}

function analyzeVoicebaseResponse(apiResults) {
  let sentences = '';
  let previousTimestamp = 0;

  var result = {
    timestamps: [],
    sentences: []
  };

  if (!apiResults) return [];

  try {
    const words = apiResults.media.transcripts.latest.words;
    words.forEach(function(word) {

      if (word.w !== '.')
        word.w = word.w.replace(/\./g, '');

      if (word.w !== '.' && (word.s - previousTimestamp > 3000)) {
        sentences = sentences.trim();
        sentences += '. ' + word.w + ' ';
      } else {
        sentences += word.w + ' ';
      }

      previousTimestamp = word.s;

      if (word.w !== '.') {
        /* 1% of the times word.w contains several words, instead of just one so
          we need to loop through them.
        */
        word.w.split(' ').forEach((isolatedWord) => {
          result.timestamps.push({
            word: isolatedWord,
            startTimestamp: word.s,
            endTimestamp: word.e
          });
        });
      }

    });

    if (sentences) {
      let processedArray = [];
      sentences.split(".").forEach(function(sentence) {
        sentence = sentence.trim();

        //Avoids empty sentences
        if (sentence)
          processedArray.push(sentence);

      });
     result.sentences = processedArray;
    }

    const processedKeywords = getVoicebaseResponseKeywords(apiResults);

    return {
      transcript: processSentences(result),
      keywords: processedKeywords
    };

  } catch(e) {
    console.log(e);
    return [];
  }
}

function getVoicebaseResponseKeywords(apiResults) {
  try {
    const keywords = apiResults.media.keywords.latest.groups[0].keywords;
    let keywordsResult = [];

    keywords.forEach(function(word) {
      if (word.name !== '.') {
        keywordsResult.push({
          word: word.name,
          timestamps: word.t.unknown
        });
      }
    });
    return keywordsResult;
  } catch(e) {
    return null;
  }
}

function analyzeGcsResponse(apiResults) {
  var result = {
    timestamps: [],
    sentences: []
  };

  var sentences = [];

  if (!apiResults) return [];

  try {
    apiResults.forEach(function(sentence) {
      let words = sentence.alternatives[0].words;

      words.forEach(function(word) {
        result.timestamps.push({
          word: word.word.replace(/\./g, ''),
          startTimestamp: word.startTime.replace('s', '') * 1000,
          endTimestamp: word.endTime.replace('s', '') * 1000
        });
      });

      result.sentences.push(sentence.alternatives[0].transcript.trim().replace(/\./g, ''));
    });
    return {
      transcript: processSentences(result)
    };
  } catch(e) {
    console.log(e);
    return [];
  }
}

function getServiceTranscriptFunction(service) {

  switch(service) {
    case 'voiceBase':
      return getVoicebaseTranscript;
    case 'googleSpeech':
      return getGoogleSpeechTranscript;
    case 'ibmWatson':
      return getIbmWatsonTranscript;
    default:
      throw new TypeError('Invalid Service');
  }

}

function fetchTranscript(theTranscript) {
  console.log(`Fetching ${theTranscript.service}'s API`);

  if (SERVICES.indexOf(theTranscript.service) < 0)
    return Promise.reject('Service not found');

  return new Promise((resolve, reject) => {
    getServiceTranscriptFunction(theTranscript.service)(theTranscript.mediaId, function(error, response) {

      if (!error) {
        const now = new Date();
        theTranscript.updated_at = now;
        theTranscript.transcript = response.transcript;
        theTranscript.keywords = response.keywords;
        theTranscript.processed = true;

        theTranscript.save(function (err) {
          if (!err) {
            reject(`Transcription results from ${theTranscript.service} with mediaId ${theTranscript.mediaId} saved`);
            resolve(theTranscript);
          }
          else {
            reject(`There was an error saving the transcription: ${err}`);
          }
        });

      } else {
        reject(`Transcription results from ${theTranscript.service} with mediaId ${theTranscript.mediaId} not ready`);
      }

    });
  });
}

function processSentences(transcript) {
  var result = [];

  if ((!transcript.sentences || transcript.sentences.length < 1) && (transcript.timestamps.length > 0))
    return transcript.timestamps;

  if (transcript.timestamps.length < 1 && transcript.sentences.length < 1)
    return [];

  const stringifiedSentences = transcript.sentences.join(" . ");
  const words = stringifiedSentences.split(" ");

  let k = 0;
  let j = 0;

  for (let i = 0; i < words.length; i++) {
    while ((words.length > i) && (words[i].toLowerCase() === transcript.timestamps[j].word.toLowerCase())) {
      if (!result[k]) result[k] = [];
      result[k].push(transcript.timestamps[j]);
      i++; j++;
    }
    k++;
  }

  return result;
}
