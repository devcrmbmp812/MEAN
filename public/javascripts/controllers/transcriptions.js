define([
  'controllers/recording.mixin',
  'jquery',
  'googlechart',
  'bootstrap',
  'moment',
  'datePicker'
  ], function(RecordingMixin, jQuery) {

  var TranscriptionsController = function($scope, $http, $window, $timeout, $controller, $sce) {
    google.charts.load('current', {
      'packages': ['corechart']
    });

    // $(window).on('load', function() {
    //   $('#warningTranscriptions').modal('show');
    // });

    let initDateTime, endDateTime;

    angular.extend(this, $controller(RecordingMixin, {$scope: $scope}));

    $scope.applyFilter = function() {

      try {
        let params = {
          from: $scope.initData.from
        };

        if (initDateTime && endDateTime) {
          params.initDateTime = initDateTime.trim().replace(/\//g , "-") + '.000Z';
          params.endDateTime = endDateTime.trim().replace(/\//g , "-") + '.000Z';
        }

        if ($scope.calledDid) params.calledDid = $scope.calledDid;

        $window.location.href = '?' + jQuery.param(params);
      } catch(e) {
        return '#';
      }

    };

    $scope.setSelectedCall = function(callId) {
      let call;

      if (!callId) {
        $scope.selectedCall = null;
      } else {
        call = $scope.calls.find(call => call.id === callId);
        $scope.selectedCall = call;
        $scope.setInitialActiveTab();
      }

    };

    $scope.getSentimentAnalysisPerSentence = function (sentences) {
      let result = [];

      if (!sentences)
        return [];

      for (let sentence of sentences) {
        if (sentence && sentence.sentiment)
          result.push(sentence.sentiment.score);
      }

      return result;
    };

    $scope.getSaValue = function(activeTab, partType) {

      try {
        return $scope.selectedCall.recordings[partType].analytics[activeTab].sentimentAnalysis.score;
      } catch(e) {
        return 0;
      }

    };

    $scope.displayAnalytics = function(call) {
      let oneMissing = false;

      try {
        for(let part in call.recordings) {
          if (!call.recordings[part].analytics)
            oneMissing = true;
        }

        return !oneMissing;

      } catch(e) {
        console.log(e);
        return false;
      }

    };

    $scope.setInitialActiveTab = function() {

      try {
        //Sets active tabs as the first existing participant and first existing service
        const recs = $scope.selectedCall.recordings;
        const partic = Object.keys(recs)[0];
        const analytics = $scope.selectedCall.recordings[partic].analytics;
        const service = Object.keys(analytics)[0];

        $scope.activeTab = service;
      } catch(e) {}

    };

    $scope.getSelectedAggregation = function() {

      try {
        return $scope.selectedCall.recordings.all.analytics[$scope.activeTab].aggregation;
      } catch(e) {
        return [];
      }

    };

    $scope.getCallSentimentAnalysisResult = function(sentimentAnalysisArray) {
      if (!sentimentAnalysisArray || sentimentAnalysisArray.length === 0)
        return 'glyphicon-question-sign';

      const average = (sentimentAnalysisArray.reduce((p, c) => p + c, 0) / sentimentAnalysisArray.length) || 0;

      return average >= 0 ? 'glyphicon-thumbs-up' : 'glyphicon-thumbs-down';
    };

    $scope.setActiveTab = function(value) {
      $scope.activeTab = value;
    };

    $scope.getServiceName = function(service) {
      var services = {
        "googleSpeech": "Google Speech",
        "ibmWatson": "IBM Watson",
        "voiceBase": "VoiceBase"
      };

      return services[service];
    };

    function googleChartReadyHandler () {
      $scope.showGoogleCharts = true;
    }

    function drawSentimentAnalysisLinesChart() {
      $scope.showGoogleCharts = false;

      ["googleSpeech", "ibmWatson", "voiceBase"].forEach((service) => {
        const element = document.getElementById(`googleSentimentAnalysisLineChart_${service}`);
        if (!element) return;

        const callerName = 'Caller';
        const calleeName = 'Callee';

        const callerValues = JSON.parse(element.dataset.caller);
        const calleeValues = JSON.parse(element.dataset.callee);

        let dataTable = [['Time', callerName, calleeName]];

        for (i = 0; (i < callerValues.length || i < calleeValues.length); i = i + 1)
          dataTable.push(['', parseFloat(callerValues[i]) || 0, parseFloat(calleeValues[i]) || 0]);

        const options = {
          // title: 'Sentiment Analysis Score',
          // subtitle: 'Measured in between -2 to 2 values',
          curveType: 'function',
          pointSize: 10,
          legend: { position: 'none' },
          series: {
            0: { color: '#ed1c24' },
            1: { color: '#60b3de' }
          },
          width: 600,
          height: 200
        };

        let chart = new google.visualization.LineChart(element);

        google.visualization.events.addListener(chart, 'ready', googleChartReadyHandler);

        chart.draw(google.visualization.arrayToDataTable(dataTable), options);
      });
    }

    $scope.secondsToMinutesAndSeconds = function(secs) {
      if (!secs && secs !== 0) return null;
      const minutes = Math.floor(secs / 60);
      const seconds = (secs % 60).toFixed(0);
      return (seconds == 60 ? (minutes + 1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
    };

    $scope.$watch('initData', function () {
      if ($scope.initData)
        account = $scope.initData.account;

      if ($scope.initData.initDateTime !== 'undefined' && $scope.initData.endDateTime !== 'undefined') {
        initDateTime = $scope.initData.initDateTime.replace(/-/g , "/").replace(".000Z", "");
        endDateTime = $scope.initData.endDateTime.replace(/-/g , "/").replace(".000Z", "");
      }

      if ($scope.initData.calledDid !== 'undefined')
        $scope.calledDid = $scope.initData.calledDid;

      jQuery('input[name="daterange"]').daterangepicker({
        timePicker: true,
          timePickerIncrement: 1,
          startDate: initDateTime,
          endDate: endDateTime,
          locale: {
            format: "YYYY/MM/DDTHH:mm:ss"
          }
      },function(start, end, label) {
        initDateTime = start.format('YYYY/MM/DDTHH:mm:ss');
        endDateTime = end.format('YYYY/MM/DDTHH:mm:ss');
      });

      (function tick() {
        google.charts.setOnLoadCallback(drawSentimentAnalysisLinesChart);
        $scope.update();
        $timeout(tick, 3000);
      })();
    });

  };

  TranscriptionsController.$inject = ['$scope', '$http', '$window', '$timeout', '$controller', '$sce'];

  return TranscriptionsController;
});

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
