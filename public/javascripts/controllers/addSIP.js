define(['jquery', 'bootstrap'], function(jQuery) {

  var AddSIPController = function($scope, $http, $window, $timeout) {
    var initialSipUri = null;
    var retrieved = false;
    $scope.saveIsVisible = true;

    $scope.reset = function() {
      this.onSubmitting = false;
      this.errorMessage = '';
      this.successMessage = '';
      this.skipText = 'Skip for now';
    };

    $scope.init = function() {
      this.wirePlugins();
      this.reset();
    };

    $scope.wirePlugins = function() {
      jQuery('[data-toggle="tooltip"]').tooltip();
    };

    $scope.skipURI = function(redirect_to) {
      $window.location.href = redirect_to;
    };

    $scope.sanitizeSipURI = function sanitizeSipURI(sip_uri) {
      var i = sip_uri.indexOf(':');
      return 'sip:' + sip_uri.substring(i + 1).trim();
    };

    $scope.updateSIPURI = function(sip_uri) {
      $scope.profile.remoteSipUri = sip_uri;
    };

    function updateSipUri(sipUri) {
      var req = {
        method: 'PUT',
        url: '/api/recordingSettings',
        headers: reqHeaders,
        data: {
          "remoteSipUri": sipUri
        }
      };

      $http(req)
        .then(function successCallback(response) {
          $scope.successMessage = 'SIP URI Updated. Redirecting...';
          $window.location.href = "/analytic-settings";
        }, function errorCallback(response) {
          $scope.errorMessage = 'Unexpected error linking your SIP URI. Please try again.';
        });
    }

    $scope.removeSipUri = function () {
      this.reset();
      this.successMessage = 'Removing SIP URI...';
      this.onSubmitting = true;
      $scope.profile.remoteSipUri = null;
      updateSipUri(null);
    };

    var reqHeaders = {
      'Content-Type': 'application/json; charset=utf-8'
    };

    var reqBridge = {
      method: 'GET',
      url: '/api/recordingSettings',
      headers: reqHeaders
    };

    $scope.getSubmitText = function() {

      if (!initialSipUri && !retrieved) {
        return 'Retrieving...';
      } else if (!initialSipUri && retrieved) {
        $scope.saveIsVisible = true;
        return 'Save SIP URI';
      } else if (initialSipUri !== $scope.profile.remoteSipUri) {
        $scope.saveIsVisible = true;
        return 'Apply Changes';
      } else {
        $scope.saveIsVisible = false;
        return 'Next Step';
      }

    };

    $scope.saveSipURI = function(form) {
      this.reset();
      this.successMessage = 'Provisioning SIP URI...';
      this.onSubmitting = true;
      this.submitText = 'Provisioning...';

      if (form.$valid) {
        var req = {
          method: 'PUT',
          url: '/api/recordingSettings',
          headers: reqHeaders,
          data: {
            "remoteSipUri": $scope.sanitizeSipURI($scope.profile.remoteSipUri)
          }
        };

        $http(req)
          .then(function successCallback(response) {
            $scope.successMessage = 'SIP URI provisioned. Redirecting...';
            $window.location.href = "/analytic-settings";
          }, function errorCallback(response) {
            $scope.errorMessage = 'Unexpected error linking your SIP URI. Please try again.';
          });
      }
    };

    $http(reqBridge)
      .then(function successCallback(response) {
        $scope.profile = JSON.parse(response.data);
        initialSipUri = $scope.profile.remoteSipUri;
        retrieved = true;

      }, function errorCallback(response) {
      });
  };

  AddSIPController.$inject = ['$scope', '$http', '$window', '$timeout'];

  return AddSIPController;
});
