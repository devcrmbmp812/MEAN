define([
  'controllers/recording.mixin',
  'jquery',
  'bootstrap'
], function(RecordingMixin, $) {

  let DidSetupController = function($scope, $http, $window, $timeout, $controller, $sce) {
    angular.extend(this, $controller(RecordingMixin, { $scope: $scope }));

    $scope.apiAlert = {};
    $scope.inventoryDids = [];
    $scope.languages = $scope.getGoogleLanguages();

    $scope.$watch('initData', function() {
      if ($scope.initData) {
        account = $scope.initData.account;
        $scope.inventoryDids = account.inventoryDids;
      }
    });

    $scope.formatDid = function(did) {
      return did.replace('+', '');
    };

    $scope.changeDid = function() {
      $scope.checkDidText = 'Check!';
      $scope.didInfo = {};
      $scope.apiAlert = {};
    };

    $scope.resetSearch = function() {
      $scope.changeDid();
      $scope.didToCheck = '';
    };

    $scope.addDid = function() {

      $('#AddInventoryDid').modal('hide');

      let didAlreadyAdded = $scope.inventoryDids.find((x) => {
        return x.e164 === $scope.didInfo.e164;
      });

      if (didAlreadyAdded) {

        $scope.apiAlert = {
          message: "DID already added",
          cssType: "info"
        };

        return;
      }

      const req = {
        method: 'POST',
        url: '/inventoryApi/addDid',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {
          didInfo: $scope.didInfo
        }
      };

      $http(req).then(function(response) {

        $scope.inventoryDids = response.data;
        $scope.resetSearch();

        $scope.apiAlert = {
          message: "DID has been successfully added to the list below",
          cssType: "success"
        };

      }, function(error) {

        $scope.apiAlert = {
          message: 'takenMessage',
          cssType: "info"
        };
      });
    };

    $scope.checkDid = function() {

      if ($scope.didToCheck.length === 0) {
        $scope.apiAlert = {
          message: "Enter a valid DID, please retry",
          cssType: "info"
        };

        return;
      }

      $scope.didInfo.valid = false;
      $scope.apiAlert = {
        message: "Checking DID, please wait...",
        cssType: "info"
      };

      var req = {
        method: 'GET',
        url: `/inventoryApi/checkUserDID?numberToQuery=${$scope.didToCheck}`,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      };

      $http(req).then(function(response) {

        if (response.status === 200) {
          $('#AddInventoryDid').modal('show');
          $scope.didInfo = response.data;
          $scope.didToCheck = $scope.didInfo.e164;
          $scope.didInfo.valid = true;
        }

        $timeout(function() {
          $scope.apiAlert = {};
        }, 5000);

      }, function(error) {
        $scope.apiAlert = {
          message: "DID not found. Please check it",
          cssType: "danger"
        };


        $timeout(function() {
          $scope.resetSearch();
        }, 5000);
      });
    };

    $scope.enableAnalyticsWarning = function (didInfo) {
      $("#enableAnalytics").on("hidden.bs.modal", function () {
        $scope.enableAnalytics(didInfo);
      });
      $('#enableAnalytics').modal('show');
    };

    $scope.enableAnalytics = function (didInfo) {
      const req = {
        method: 'PUT',
        url: '/inventoryApi/enableAnalyticsForDid',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {
          didInfo: didInfo
        }
      };

      $http(req).then(function(response) {
        $scope.inventoryDids = response.data;

        $scope.apiAlert = {
          message: "DID has been successfully enabled on Analytics",
          cssType: "success"
        };

      }, function(error) {

        let errMessage;
        if (error.status !== 400)
          errMessage = "Error, please try again";

        $scope.apiAlert = {
          isContactMessage: (error.status === 400),
          message: errMessage,
          cssType: "danger"
        };
      });
    };

    $scope.pauseAnalytics = function (didInfo) {
      const req = {
        method: 'PUT',
        url: '/inventoryApi/pauseAnalyticsForDid',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {
          didInfo: didInfo
        }
      };

      $http(req).then(function(response) {
        $scope.inventoryDids = response.data;

        $scope.apiAlert = {
          message: "DID has been successfully paused from Analytics",
          cssType: "success"
        };

      }, function(error) {

        $scope.apiAlert = {
          message: 'Error!',
          cssType: "danger"
        };
      });
    };

    $scope.removeAnalytics = function (didInfo) {
      const req = {
        method: 'PUT',
        url: '/inventoryApi/removeAnalyticsForDid',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {
          didInfo: didInfo
        }
      };

      $http(req).then(function(response) {
        $scope.inventoryDids = response.data;

        $scope.apiAlert = {
          message: "DID has been successfully removed from Analytics",
          cssType: "success"
        };

      }, function(error) {

        $scope.apiAlert = {
          message: 'Error!',
          cssType: "danger"
        };
      });
    };
  };

  DidSetupController.$inject = ['$scope', '$http', '$window', '$timeout', '$controller', '$sce'];

  return DidSetupController;
});
