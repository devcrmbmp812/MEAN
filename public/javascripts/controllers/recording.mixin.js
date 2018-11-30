define(['jquery', 'bootstrap', 'simplePagination'], function(jQuery) {

  var RecordingControllerMixin = function($scope, $http, $window, $timeout) {
    $scope.joinButtonText = "Click-to-Call";
    $scope.demoAudio = document.createElement('audio');
    $scope.isWebRTCSupported = true;
    $scope.calls = [];

    var account = {};
    $scope.demoAudio.onended = function() {
      $scope.playingURI = null;
    };

    window.addEventListener('message', function(event) {
      var message = event.data;

      switch (message.action) {

        case 'setCallFailed':
        case 'setCallEnded':
        case 'setCallFailedUserMedia':
          $scope.joinButtonText = "Click-to-Call";
          break;

        case 'setCallCalling':
          $scope.joinButtonText = "Dialing...";
          break;

        case 'setInCall':
          $scope.joinButtonText = "In Call";
          break;
      }
    });

    $scope.isJoinButtonDisabled = function () {
      return $scope.joinButtonText === 'In Call' || $scope.joinButtonText === 'Dialing...';
    };

    $scope.callDID = function(didToCall) {

      if (!didToCall)
        return;

      $scope.joinButtonText = "Waiting Permission";
      let i = setInterval(function() {
        if (voxbone.WebRTC.configuration.ws_servers != []) {
          if (voxbone.WebRTC.isCallOpen()) {
            console.log("a call already in progress");
            window.open(window.location.href.split('?')[0] + "?call=true" + "&did=" + didToCall);
          } else {
            console.log("DID select: " + didToCall);
            infoVoxbone.did = didToCall.replace('+', '');
            $("#launch_call").click();
          }

          voxbone.WebRTC.configuration.post_logs = true;
          now = new Date($.now());

          let call = {
            call: {
              'voxbone.ai_email': account.email,
              'voxbone.ai_did': infoVoxbone.did,
              'voxbone.ai_callTime': now
            }
          };

          voxbone.WebRTC.webrtcLogs += JSON.stringify(call);
          clearInterval(i);
        }
      }, 3000);
    };

    document.addEventListener('click2vox-ready', function(e) {
      $scope.isWebRTCSupported = e.detail.webrtcSupported;
      $scope.$apply();
    }, false);

    $scope.showControls = function (uri) {
      if (!uri) return false;
      return uri === $scope.playingURI || !$scope.playingURI;
    };

    $scope.togglePlay = function (uri) {
      $scope.playingURI = uri;
      if ($scope.demoAudio.paused) {
        $scope.demoAudio.src = uri;
        $scope.demoAudio.play();
      } else {
        $scope.playingURI = null;
        $scope.demoAudio.pause();
      }
    };

    function getReqCalls() {
      let req = {
        method: 'GET',
        url: `/metadataApi/calls`,
        json: true,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      };

      let from = $scope.initData.from;
      let calledDid = $scope.initData.calledDid;
      let endDateTime = $scope.initData.endDateTime;
      let initDateTime = $scope.initData.initDateTime;

      try {
        req.url += `?from=${from || 0}`;
        if (calledDid !== 'undefined') req.url += `&calledDid=${calledDid}`;
        if (endDateTime !== 'undefined') req.url += `&endDateTime=${endDateTime}`;
        if (initDateTime !== 'undefined') req.url += `&initDateTime=${initDateTime}`;
      } catch(e) {}

      return req;
    }

    $scope.getVoiceBaseLanguages = function() {
      return [
        { value: 'en-US', display: 'English, US' },
        { value: 'en-UK', display: 'English, UK' },
        { value: 'en-AU', display: 'English, Australian' },
        { value: 'pt-BR', display: 'Portuguese, Brazil' },
        { value: 'es-LA', display: 'Spanish, Latin America' },
        { value: 'es-ES', display: 'Spanish, Spain' },
        { value: 'nl-NL', display: 'Dutch' },
        { value: 'it-IT', display: 'Italian' },
        { value: 'de-DE', display: 'German' },
        { value: 'fr-FR', display: 'French' }
      ];
    };

    $scope.getIBMWatsonModels = function() {
      return [
        { value: 'en-US_BroadbandModel', display: 'US English broadband model (WebRTC Only)' },
        { value: 'fr-FR_BroadbandModel', display: 'French broadband model (WebRTC Only)' },
        { value: 'pt-BR_BroadbandModel', display: 'Brazilian Portuguese broadband model (WebRTC Only)' },
        { value: 'zh-CN_BroadbandModel', display: 'Mandarin broadband model (WebRTC Only)' },
        { value: 'ja-JP_BroadbandModel', display: 'Japanese broadband model (WebRTC Only)' },
        { value: 'es-ES_BroadbandModel', display: 'Spanish broadband model (WebRTC Only)' },
        { value: 'ar-AR_BroadbandModel', display: 'Modern Standard Arabic broadband model (WebRTC Only)' },
        { value: 'en-UK_BroadbandModel', display: 'UK English broadband model (WebRTC Only)' },
        { value: 'en-US_NarrowbandModel', display: 'US English narrowband model' },
        { value: 'pt-BR_NarrowbandModel', display: 'Brazilian Portuguese narrowband model' },
        { value: 'zh-CN_NarrowbandModel', display: 'Mandarin narrowband model' },
        { value: 'ja-JP_NarrowbandModel', display: 'Japanese narrowband model' },
        { value: 'es-ES_NarrowbandModel', display: 'Spanish narrowband model' },
        { value: 'en-UK_NarrowbandModel', display: 'UK English narrowband model' }
      ];
    };

    $scope.getGoogleLanguages = function() {
      return [
        { display: 'Afrikaans (Suid-Afrika)', value: 'af-ZA' },
        { display: 'Bahasa Indonesia (Indonesia)', value: 'id-ID' },
        { display: 'Bahasa Melayu (Malaysia)', value: 'ms-MY' },
        { display: 'Català (Espanya)', value: 'ca-ES' },
        { display: 'Čeština (Česká republika)', value: 'cs-CZ' },
        { display: 'Dansk (Danmark)', value: 'da-DK' },
        { display: 'Deutsch (Deutschland)', value: 'de-DE' },
        { display: 'English (Australia)', value: 'en-AU' },
        { display: 'English (Canada)', value: 'en-CA' },
        { display: 'English (Great Britain)', value: 'en-GB' },
        { display: 'English (India)', value: 'en-IN' },
        { display: 'English (Ireland)', value: 'en-IE' },
        { display: 'English (New Zealand)', value: 'en-NZ' },
        { display: 'English (Philippines)', value: 'en-PH' },
        { display: 'English (South Africa)', value: 'en-ZA' },
        { display: 'English (United States)', value: 'en-US' },
        { display: 'Español (Argentina)', value: 'es-AR' },
        { display: 'Español (Bolivia)', value: 'es-BO' },
        { display: 'Español (Chile)', value: 'es-CL' },
        { display: 'Español (Colombia)', value: 'es-CO' },
        { display: 'Español (Costa Rica)', value: 'es-CR' },
        { display: 'Español (Ecuador)', value: 'es-EC' },
        { display: 'Español (El Salvador)', value: 'es-SV' },
        { display: 'Español (España)', value: 'es-ES' },
        { display: 'Español (Estados Unidos)', value: 'es-US' },
        { display: 'Español (Guatemala)', value: 'es-GT' },
        { display: 'Español (Honduras)', value: 'es-HN' },
        { display: 'Español (México)', value: 'es-MX' },
        { display: 'Español (Nicaragua)', value: 'es-NI' },
        { display: 'Español (Panamá)', value: 'es-PA' },
        { display: 'Español (Paraguay)', value: 'es-PY' },
        { display: 'Español (Perú)', value: 'es-PE' },
        { display: 'Español (Puerto Rico)', value: 'es-PR' },
        { display: 'Español (República Dominicana)', value: 'es-DO' },
        { display: 'Español (Uruguay)', value: 'es-UY' },
        { display: 'Español (Venezuela)', value: 'es-VE' },
        { display: 'Euskara (Espainia)', value: 'eu-ES' },
        { display: 'Filipino (Pilipinas)', value: 'fil-PH' },
        { display: 'Français (Canada)', value: 'fr-CA' },
        { display: 'Français (France)', value: 'fr-FR' },
        { display: 'Galego (España)', value: 'gl-ES' },
        { display: 'Hrvatski (Hrvatska)', value: 'hr-HR' },
        { display: 'IsiZulu (Ningizimu Afrika)', value: 'zu-ZA' },
        { display: 'Íslenska (Ísland)', value: 'is-IS' },
        { display: 'Italiano (Italia)', value: 'it-IT' },
        { display: 'Lietuvių (Lietuva)', value: 'lt-LT' },
        { display: 'Magyar (Magyarország)', value: 'hu-HU' },
        { display: 'Nederlands (Nederland)', value: 'nl-NL' },
        { display: 'Norsk bokmål (Norge)', value: 'nb-NO' },
        { display: 'Polski (Polska)', value: 'pl-PL' },
        { display: 'Português (Brasil)', value: 'pt-BR' },
        { display: 'Português (Portugal)', value: 'pt-PT' },
        { display: 'Română (România)', value: 'ro-RO' },
        { display: 'Slovenčina (Slovensko)', value: 'sk-SK' },
        { display: 'Slovenščina (Slovenija)', value: 'sl-SI' },
        { display: 'Suomi (Suomi)', value: 'fi-FI' },
        { display: 'Svenska (Sverige)', value: 'sv-SE' },
        { display: 'Tiếng Việt (Việt Nam)', value: 'vi-VN' },
        { display: 'Türkçe (Türkiye)', value: 'tr-TR' },
        { display: 'Ελληνικά (Ελλάδα)', value: 'el-GR' },
        { display: 'Български (България)', value: 'bg-BG' },
        { display: 'Русский (Россия)', value: 'ru-RU' },
        { display: 'Српски (Србија)', value: 'sr-RS' },
        { display: 'Українська (Україна)', value: 'uk-UA' },
        { display: 'עברית (ישראל)', value: 'he-IL' },
        { display: 'العربية (إسرائيل)', value: 'ar-IL' },
        { display: 'العربية (الأردن)', value: 'ar-JO' },
        { display: 'العربية (الإمارات)', value: 'ar-AE' },
        { display: 'العربية (البحرين)', value: 'ar-BH' },
        { display: 'العربية (الجزائر)', value: 'ar-DZ' },
        { display: 'العربية (السعودية)', value: 'ar-SA' },
        { display: 'العربية (العراق)', value: 'ar-IQ' },
        { display: 'العربية (الكويت)', value: 'ar-KW' },
        { display: 'العربية (المغرب)', value: 'ar-MA' },
        { display: 'العربية (تونس)', value: 'ar-TN' },
        { display: 'العربية (عُمان)', value: 'ar-OM' },
        { display: 'العربية (فلسطين)', value: 'ar-PS' },
        { display: 'العربية (قطر)', value: 'ar-QA' },
        { display: 'العربية (لبنان)', value: 'ar-LB' },
        { display: 'العربية (مصر)', value: 'ar-EG' },
        { display: 'فارسی (ایران)', value: 'fa-IR' },
        { display: 'हिन्दी (भारत)', value: 'hi-IN' },
        { display: 'ไทย (ประเทศไทย)', value: 'th-TH' },
        { display: '한국어 (대한민국)', value: 'ko-KR' },
        { display: '國語 (台灣)', value: 'cmn-Hant-TW' },
        { display: '廣東話 (香港)', value: 'yue-Hant-HK' },
        { display: '日本語（日本）', value: 'ja-JP' },
        { display: '普通話 (香港)', value: 'cmn-Hans-HK' },
        { display: '普通话 (中国大陆)', value: 'cmn-Hans-CN' }
      ];
    };

    $scope.update = function() {
      $http(getReqCalls()).then((resp) => {
        try {
          $scope.calls = formatCallObjects(resp.data.calls);
          if (jQuery('.pagination-holder').is(':empty') ) bindPaginationPlugin(resp.data.tabs);
        } catch(e) {
          console.log(e);
        }
      });
    };

    function bindPaginationPlugin(tabs) {
      jQuery('.pagination-holder').pagination({
        pages: tabs,
        cssStyle: 'dark-theme',
        ellipsePageSet: true,
        hrefTextPrefix: '#',
        currentPage: ($scope.initData.from/10) + 1,
        onPageClick: function(pageNumber, event) {
          let queryObj = querystringToObject(window.location.search);
          queryObj.from = (10*parseInt(pageNumber) - 10);
          $window.location.href = "?" + jQuery.param(queryObj);
        }
      });

    }

  };

  RecordingControllerMixin.$inject = ['$scope', '$http', '$window', '$timeout'];

  return RecordingControllerMixin;
});

function querystringToObject(querystring) {
  try {
    let search = querystring.substring(1);
    return JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
  } catch(e) {
    return {};
  }

}

function formatCallObjects(calls) {
  let sa, analytics, recordings;

  calls.forEach((call) => {
    recordings = {};
    sa = [];

    if (call.recordings && (call.recordings.length > 0)) {
      call.recordings.forEach((rec) => {

        if (rec.analytics && (rec.analytics.length > 0)) {
          analytics = {};
          rec.analytics.forEach((analyticsDoc) => {
            analyticsDoc.aggregation = createAnalyticsAggregation(analyticsDoc, rec);
            analytics[analyticsDoc.speechToText.service] = analyticsDoc;

            if (analyticsDoc.sentimentAnalysis) sa.push(analyticsDoc.sentimentAnalysis.score);

          });
          rec.analytics = analytics;
        }

        recordings[rec.participantDescription] = rec;
      });
      const all = generateMergedTranscriptions(recordings);
      call.recordings = Object.assign(recordings, {all});
      call.sentimentAnalysis = sa;
    }

  });

  return calls;
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
