define(['controllers/bridge.mixin', 'jquery', 'bootstrap'], function(BridgeMixin, $) {

  var LiveTranscriptsController = function($scope, $http, $window, $timeout, $controller) {
    angular.extend(this, $controller(BridgeMixin, {$scope: $scope}));
    $scope.conference = {};
    var colors = {};
    var event = null;
    var lastTimestamp = null;
    var keys = null;

    var colorPalette = ['#001f3f', '#0074D9', '#39CCCC', '#3D9970', '#2ECC40',
      '#FFDC00', '#FF851B', '#FF4136', '#85144b', '#F012BE', '#B10DC9', '#111111'];

    $(function() {
      $("#join-now").click(function(){
        $("#enter-modal").fadeOut("normal");
      });
    });

    var reqHeaders = {
      'Content-Type': 'application/json; charset=utf-8'
    };

    $scope.$watch('initData', function () {
      $scope.bridgeId = $scope.initData.bridgeId;
      $scope.guestName = $scope.initData.guestName;

      var participantId = encodeURIComponent($scope.initData.guestName + $scope.bridgeId);
      $http({
        method: 'GET',
        url: '/bridge/getSelfLocation?participantId=' + participantId,
      });

      var queryString = '?bridgeId=' + $scope.bridgeId;

      var reqParticipants = {
        method: 'GET',
        url: '/bridge/getParticipants' + queryString,
        headers: reqHeaders
      };

      var reqBridge = {
        method: 'GET',
        url: '/bridge/info' + queryString,
        headers: reqHeaders
      };

      (function tick () {
        $scope.update(reqBridge, reqParticipants, false);
        $timeout(tick, 3000);
      })();
    });

    document.addEventListener("participant-event", function(event) {
      var timestamp = event.detail.timestamp;
      var message = `User ${event.detail.callerId} ${event.detail.status} the conference`;
      addNewConferenceEvent(timestamp, 'Info', message, '#ff0000');
    });

    $scope.toggleMenu = function() {
      $(".transcripts-sidebar").toggleClass("active");
    };

    $scope.toggleDidsList = function() {
      $(".tsb-extras-outer").toggleClass("active");
    };

    var source = new EventSource("/analytics/update-stream");

    source.onmessage = function(e) {
      try {
        event = JSON.parse(e.data);

        if (event.event_type === 'transcript') {
          keys = Object.keys($scope.conference);
          lastTimestamp = keys[keys.length-1];

          if (lastTimestamp &&
            $scope.conference[lastTimestamp].participant === event.connection_id &&
            ((event.timestamp_ms - lastTimestamp) < 30000)) {
            $scope.conference[lastTimestamp].transcript += event.pretty_transcript;
          } else {
            addNewConferenceEvent(event.timestamp_ms, event.connection_id, event.pretty_transcript, colors[event.connection_id] || setRandomColor(event.connection_id));
          }

          $scope.$apply();
          var transcription = document.getElementById("transcription");
          transcription.scrollTop = transcription.scrollHeight;
        }
      } catch(error) {}
    };

    function setRandomColor(participant) {
      var color = colorPalette[0];
      colors[participant] = color;
      colorPalette.push(colorPalette.shift());
      return color;
    }

    function addNewConferenceEvent(timestamp, callerId, message, color) {
      var time = new Date();
      var humanTimestamp = null;
      //Avoids overwriting old info if two events have exactly the same timestamp
      while($scope.conference[timestamp]) {
        timestamp += 10;
      }

      if (callerId !== 'Info') {
        time.setTime(timestamp);
        humanTimestamp = time.toISOString().substr(11,8);
      }

      $scope.conference[timestamp] = {
        'timestamp': humanTimestamp,
        'participant': callerId,
        'transcript': message,
        'color': color
      };
    }

  };

  LiveTranscriptsController.$inject = ['$scope', '$http', '$window', '$timeout', '$controller'];
  return LiveTranscriptsController;
});
