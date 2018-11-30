define(['jquery'], function (jQuery) {

  var EditController = function ($scope, $http, $window, $timeout) {
    $(window).on('load', function() {
      $('#pathChoice').modal('show');
    });

    $scope.$watch('initData', function () {
      $scope.account = $scope.initData.account;
      $scope.account.api_data_enabled = !!($scope.account.api_username);
    });

    $scope.showAlert = function (el, type, message) {
      jQuery(el)
        .html(message)
        .removeClass('alert-info')
        .removeClass('alert-success')
        .removeClass('alert-danger')
        .addClass('alert-' + type)
        .css('display', 'block');
    };

    $scope.saveProfile = function (account) {
      console.log('Saving profile...');

      let data = account;

      if (!data.api_data_enabled) {
        delete data.api_username;
        delete data.api_password;
      }

      var req = {
        method: 'POST',
        url: '/account/edit',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: data
      };

      $http(req).then(
        function successCallback (response) {
          $scope.showAlert('#alert', 'success', 'Your profile has been saved succesfully. Redirecting...');

          if (data.api_data_enabled)
            $window.location.href = "/dids-setup";
          else
            $window.location.href = "/transcriptions?demo=true";

        }, function errorCallback (response) {
          $scope.showAlert('#alert', 'danger', response.data.message);
        }
      );
    };

    $scope.testApiProfile = function (account) {
      console.log('Testing API profile...');
      var req = {
        method: 'POST',
        url: '/account/testApiEndpoint',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: account
      };

      $http(req).then(
        function successCallback (response) {
          if (response.status === 200) {
            $scope.showAlert('#api_alert', 'success', 'Your API credentials are valid!');
          } else
            $scope.showAlert('#api_alert', 'danger', 'ERROR: Your API are not Valid. Please check them');
        }, function errorCallback (response) {
          $scope.showAlert('#api_alert', 'danger', 'ERROR: Your API are not Valid. Please check them');
        }
      );
    };
  };
  EditController.$inject = ['$scope', '$http', '$window', '$timeout'];

  return EditController;
});
