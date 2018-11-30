define([
  'controllers/recording.mixin',
  'bootstrap'
  ], function(RecordingMixin) {

  var DemoController = function($scope, $http, $window, $timeout, $cookies, $controller) {
    angular.extend(this, $controller(RecordingMixin, {$scope: $scope}));

    var reqCalls = {
      method: 'GET',
      url: '/api/calls',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Demo-Auth': $cookies.get('demoAuth')
      }
    };

    var reqTransfers = {
      method: 'GET',
      url: '/api/transfers',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Demo-Auth': $cookies.get('demoAuth')
      }
    };

    var reqRecordings = function(callId) {
      var reqs = {
        method: 'GET',
        url: '/api/recordings?callId=' + callId,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Demo-Auth': $cookies.get('demoAuth')
        }
      };
      return reqs;
    };

    $scope.setSelectedCall = function(callid) {
      $scope.selectedCall = $scope.calls.find(call => call.id === callid);
      $http(reqRecordings($scope.selectedCall.id)).then(function successCallback(response) {
        $scope.selectedCall.recordings = JSON.parse(response.data);
      });
    };

    (function tick() {

      if ($scope.selectedCall) {
        $http(reqRecordings($scope.selectedCall.id)).then(function successCallback(response) {
          $scope.selectedCall.recordings = JSON.parse(response.data);
        });
      }

      $scope.update(reqCalls, reqTransfers);
      $timeout(tick, 3000);
    })();
  };

  DemoController.$inject = ['$scope', '$http', '$window', '$timeout', '$cookies', '$controller'];

  return DemoController;
});
