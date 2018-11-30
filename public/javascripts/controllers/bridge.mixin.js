define([
  'jquery',
  'bootstrap'
  ], function (jQuery) {

  var BridgeControllerMixin = function ($scope, $http, $window, $timeout, $controller) {
    $scope.bridge = {
      active: false
    };
    $scope.joinButtonText = 'Join Now';
    $scope.participants = [];
    $scope.isWebRTCSupported = true;

    document.addEventListener('click2vox-ready', function(e) {
      $scope.isWebRTCSupported = e.detail.webrtcSupported;
      $scope.$apply();
    }, false);

    window.addEventListener('message', function(event) {
      var message = event.data;

      switch (message.action) {

        case 'setCallFailed':
        case 'setCallEnded':
        case 'setCallFailedUserMedia':
          $scope.joinButtonText = "Join Now";
          break;

        case 'setCallCalling':
          $scope.joinButtonText = "Joining...";
          break;

        case 'setInCall':
          $scope.joinButtonText = "In Conference";
          break;

      }
    });

    $scope.isJoinButtonDisabled = function () {
      return $scope.joinButtonText === 'In Conference' || $scope.joinButtonText === 'Joining...';
    };

    $scope.callDID = function (didToCall) {
      $scope.joinButtonText = "Joining...";
      var i = setInterval(function() {
        if (voxbone.WebRTC.configuration.ws_servers != []) {
          if (voxbone.WebRTC.isCallOpen()) {
            console.log("a call already in progress");
            window.open(window.location.href.split('?')[0] + "?call=true" + "&did=" + didToCall);
          } else {
            console.log("DID select: " + didToCall);
            infoVoxbone.did = didToCall.replace('+', '');
            $("#launch_call").click();
          }
          clearInterval(i);
        }
      }, 3000);
    };

    $scope.update = function (reqBridge, reqParticipants, isAdmin) {
      $http(reqBridge)
        .then(function successCallback (response) {
          $scope.bridge = JSON.parse(response.data);
        }, function errorCallback (response) {});

        if ($scope.bridge.active) {
          $http(reqParticipants)
            .then(function successCallback (response) {
              updateParticipants(response.data);
            }, function errorCallback (response) {});
        } else {
          $scope.participants = [];
        }

    };

    /* Check if participant id key is present in any of the objects in the array of participants*/
    function idExists(updatedParticipants, participantId) {
      return updatedParticipants.some( function(updatedParticipant) {
        return updatedParticipant.id === participantId;
      });
    }

    function updateParticipants (updatedParticipants) {
      for(var i = $scope.participants.length - 1; i >= 0; i--) {
        if (!idExists(updatedParticipants, $scope.participants[i].id)){
          emitStatusEvent('left', $scope.participants[i].callerId);
          $scope.participants.splice(i, 1);
        }
      }

      for(var j = updatedParticipants.length - 1; j >= 0; j--) {
        if (!idExists($scope.participants, updatedParticipants[j].id))
          emitStatusEvent('joined', updatedParticipants[j].callerId);
      }

      jQuery.extend(true, $scope.participants, updatedParticipants);
    }

    function emitStatusEvent(status, callerId) {
      var time = new Date();
      var event = new CustomEvent(
        "participant-event",
        {
          "detail": {
            "status": status,
            "callerId": callerId,
            "timestamp": time.valueOf()
          }
        });
      document.dispatchEvent(event);
    }
  };
  BridgeControllerMixin.$inject = ['$scope', '$http', '$window', '$timeout', '$controller'];

  return BridgeControllerMixin;
});
