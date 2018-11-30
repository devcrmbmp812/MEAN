define(['jquery'], function (jQuery) {

  var ForgotController = function ($scope, $http, $window, $timeout) {
    jQuery('#errormsg, #tokenError, #successmsg').hide();

    $scope.processForm = function () {
      $scope.submitting = true;

      var req = {
        method: 'POST',
        url: '/account/forgot',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {
          email: $scope.forgot.uemail.toLowerCase()
        }
      };
      $http(req)
        .then(function successCallback(response) {
          jQuery('#successmsg').html("An email has been sent with a link to reset your password. Please check your inbox for an email from no-reply@voxbone.com.").show();
          jQuery('#errormsg, #tokenError').hide();
          $scope.submitting = false;
        }, function errorCallback(response) {
          jQuery("#errormsg").html("No account found associated to that email address.").show();
          jQuery('#successmsg, #tokenError').hide();
          $scope.submitting = false;
        });
    };
  };

  ForgotController.$inject = ['$scope', '$http', '$window', '$timeout'];

  return ForgotController;
});
