define(['jquery', 'bootstrap'], function(jQuery) {

  var TransferSettingsController = function($scope, $http, $window, $timout) {
    $scope.savedSuccessfully = false;
    $scope.savingError = '';
    $scope.saveButtonText = 'Save Changes';
    $scope.keyFileMsg = '';

    $scope.s3 = {
      regions: [
        {value: 'us-east-1', display: 'US East (N. Virginia) - [us-east-1]'},
        {value: 'us-east-2', display: 'US East (Ohio) - [us-east-2]'},
        {value: 'us-west-1', display: 'US West (N. California) - [us-west-1]'},
        {value: 'us-west-2', display: 'US West (Oregon) - [us-west-2]'},
        {value: 'ca-central-1', display: 'Canada (Central) - [ca-central-1]'},
        {value: 'ap-south-1', display: 'Asia Pacific (Mumbai) - [ap-south-1]'},
        {value: 'ap-northeast-1', display: 'Asia Pacific (Tokyo) - [ap-northeast-1]'},
        {value: 'ap-northeast-2', display: 'Asia Pacific (Seoul) - [ap-northeast-2]'},
        {value: 'ap-southeast-1', display: 'Asia Pacific (Singapore) - [ap-southeast-1]'},
        {value: 'ap-southeast-2', display: 'Asia Pacific (Sydney) - [ap-southeast-2]'},
        {value: 'eu-central-1', display: 'EU (Frankfurt) - [eu-central-1]'},
        {value: 'eu-west-1', display: 'EU (Ireland) - [eu-west-1]'},
        {value: 'eu-west-2', display: 'EU (London) - [eu-west-2]'},
        {value: 'sa-east-1', display: 'South America (São Paulo) - [sa-east-1]'}
      ]
    };

    $scope.wirePlugins = function() {
      jQuery('[data-toggle="tooltip"]').tooltip();
    };

    var reqHeaders = {
      'Content-Type': 'application/json; charset=utf-8'
    };

    var req = {
      method: 'GET',
      url: '/api/transferSettings',
      headers: reqHeaders
    };

    $http(req)
      .then(function successCallback(response) {
        var arrTransferSettings = JSON.parse(response.data);

        arrTransferSettings.forEach(function (transferServiceSettings) {
          delete transferServiceSettings.profile;
          if (!$scope.transferSettings) $scope.transferSettings = {};
          $scope.transferSettings[transferServiceSettings.service] = transferServiceSettings;
        });

        try {
          if ($scope.transferSettings.gcs.accessKey) {
            $scope.keyFileMsg = 'Valid Keyfile detected';
            $scope.keyFileMsgClass = 'alert-success';
          }
        } catch(e){}

      }, function errorCallback(response) {

      });

    var reqSaveTransferSettings = function(transferSettings) {
      return {
        method: 'PUT',
        url: '/api/transferSettings',
        headers: reqHeaders,
        data: transferSettings
      };
    };

    $scope.isSaveEnabled = function() {
      if (!$scope.transferSettings) return true;

      if ($scope.transferSettings.gcs && $scope.transferSettings.gcs.enabled &&
        (!$scope.transferSettings.gcs.server ||
         !$scope.transferSettings.gcs.accessKey))
          return false;
      else if ($scope.transferSettings.s3 && $scope.transferSettings.s3.enabled &&
        (!$scope.transferSettings.s3.server ||
         !$scope.transferSettings.s3.accessKey ||
         !$scope.transferSettings.s3.accessSecret ||
         !$scope.transferSettings.s3.region))
          return false;
      else return true;

    };

    $scope.validateKeyfile = function($fileContent){

      $scope.transferSettings.gcs.accessKey = '';

      try {
        var msg = '';
        var file = JSON.parse($fileContent);

        var properties = [
          "type",
          "project_id",
          "private_key_id",
          "private_key",
          "client_email",
          "client_id",
          "auth_uri",
          "token_uri",
          "auth_provider_x509_cert_url",
          "client_x509_cert_url"
        ];

        properties.map((x) => {

          if (!(x in file) || !file[x])
            msg += x + ", ";

        });

        msg = msg.slice(0, msg.lastIndexOf(","));

        if (msg) {
          $scope.keyFileMsg = 'Missing properties in Keyfile: ' + msg + '.';
          $scope.keyFileMsgClass = 'alert-info';
        } else {
          $scope.keyFileMsg = 'Valid Keyfile';
          $scope.keyFileMsgClass = 'alert-success';
          $scope.transferSettings.gcs.accessKey = JSON.stringify(file);
        }

      } catch (e) {
        $scope.keyFileMsg = 'Invalid Keyfile' + '.';
        $scope.keyFileMsgClass = 'alert-danger';
      }

    };

    $scope.saveChanges = function() {
      $scope.savedSuccessfully = false;
      $scope.savingError = '';
      $scope.saveButtonText = 'Saving...';

      $http(reqSaveTransferSettings($scope.transferSettings))
        .then(function successCallback(response) {
          $scope.saveButtonText = 'Save Changes';
          $scope.savedSuccessfully = true;
        }, function errorCallback(response) {
          $scope.saveButtonText = 'Save Changes';
          $scope.savingError = true;
        });
    };
  };
  TransferSettingsController.$inject = ['$scope', '$http', '$window', '$timeout'];

  return TransferSettingsController;
});
