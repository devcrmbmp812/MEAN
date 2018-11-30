define([
  'controllers/recording.mixin',
  'jquery',
  'bootstrap'
], function(RecordingMixin, $) {

  let AnalyticsSettingsController = function($scope, $http, $window, $timeout, $controller, $sce) {
    angular.extend(this, $controller(RecordingMixin, { $scope: $scope }));

    $scope.voiceBase = {};
    $scope.googleSpeech = {};
    $scope.ibmWatson = {};

    $scope.analyticSettings = {
      googleSpeech: {},
      voiceBase: {},
      ibmWatson: {}
    };

    $scope.$watch('initData', function () {

      if ($scope.initData)
        $scope.account = $scope.initData.account;
      if ($scope.account.analyticSettings)
        $scope.analyticSettings = $scope.account.analyticSettings;

      $scope.analyticSettings.service = $scope.account.analyticSettings.services[0];
      getEnabledServices($scope.account.analyticSettings.services);
      $('[data-toggle="tooltip"]').tooltip();

      $scope.updateServicesDropdown();
    });

    $scope.settingAllowed = function() {
      if ($scope.analyticSettings.voiceBase.language === 'pt-BR' || $scope.analyticSettings.voiceBase.language === 'es-LA') {
        $scope.analyticSettings.voiceBase.pciRedaction = false;
        $scope.analyticSettings.voiceBase.numberRedaction = false;
        $scope.analyticSettings.voiceBase.ssnRedaction = false;
        $scope.analyticSettings.voiceBase.keywordSpotting = false;
        return false;
      } else {
        return true;
      }
    };

    $scope.updateServicesDropdown = function() {
      var allowedServices = [];

      if ($scope.voiceBase.enabled)
        allowedServices.push({value: 'voiceBase', display: 'Voicebase'});
      if ($scope.googleSpeech.enabled)
        allowedServices.push({value: 'googleSpeech', display: 'Google Speech'});
      if ($scope.ibmWatson.enabled)
        allowedServices.push({value: 'ibmWatson', display: 'IBM Watson'});

      $scope.services = allowedServices;
      $scope.analyticSettings.service = allowedServices[0].value;
    };

    $scope.voiceBase.languages = $scope.getVoiceBaseLanguages();

    $scope.ibmWatson.models = $scope.getIBMWatsonModels();

    $scope.googleSpeech.languages = $scope.getGoogleLanguages();

    function validateUserInput() {

      if ($scope.analyticSettings.voiceBase.customVocabulary) {
        $scope.analyticSettings.voiceBase.customVocabulary = $scope.analyticSettings.voiceBase.customVocabulary.replace(/ /g,',');
        $scope.analyticSettings.voiceBase.customVocabulary = removeDuplicates($scope.analyticSettings.voiceBase.customVocabulary);
      }

      if ($scope.analyticSettings.googleSpeech.speechContexts) {
        $scope.analyticSettings.googleSpeech.speechContexts = $scope.analyticSettings.googleSpeech.speechContexts.replace(/ /g,',');
        $scope.analyticSettings.googleSpeech.speechContexts = removeDuplicates($scope.analyticSettings.googleSpeech.speechContexts);
      }

      if ($scope.analyticSettings.voiceBase.keywordSpotting) {
        $scope.analyticSettings.voiceBase.keywordSpotting = $scope.analyticSettings.voiceBase.keywordSpotting.replace(/ /g,',');
        $scope.analyticSettings.voiceBase.keywordSpotting = removeDuplicates($scope.analyticSettings.voiceBase.keywordSpotting);
      }

      if (((/^[\w\,\s]+$/.test($scope.analyticSettings.voiceBase.customVocabulary)) || !$scope.analyticSettings.voiceBase.customVocabulary) &&
        ((/^[\w\,\s]+$/.test($scope.analyticSettings.googleSpeech.speechContexts)) || !$scope.analyticSettings.googleSpeech.speechContexts) &&
        ((/^[\w\,\s]+$/.test($scope.analyticSettings.voiceBase.keywordSpotting)) || !$scope.analyticSettings.voiceBase.keywordSpotting))
        return true;
      else
        return false;

    }

    function getEnabledServices(servicesArray) {
      servicesArray.forEach((service) => {
        $scope[service].enabled = true;
      });
    }

    function removeDuplicates(text) {
      var textArray = text.split(",");
      var uniqueArray = textArray.filter(function(elem, index, self) {
        return index == self.indexOf(elem);
      });
      uniqueArray = uniqueArray.filter(Boolean);
      return uniqueArray.join(',');
    }

    function setEnabledServices() {
      delete $scope.analyticSettings.service;
      $scope.analyticSettings.services = [];
      if ($scope.voiceBase.enabled)
        $scope.analyticSettings.services.push("voiceBase");
      if ($scope.googleSpeech.enabled)
        $scope.analyticSettings.services.push("googleSpeech");
      if ($scope.ibmWatson.enabled)
        $scope.analyticSettings.services.push("ibmWatson");
      if ($scope.analyticSettings.services.length === 0)
        $scope.analyticSettings.services.push("googleSpeech");
    }

    $scope.saveChanges = function() {

      var req = {
        method: 'POST',
        url: '/account/edit',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: {analyticSettings: $scope.analyticSettings}
      };

      if (validateUserInput()) {
        setEnabledServices();
        $http(req).then(
          function successCallback(response) {
            var keywordsReq = {
              url: '/analytics/keywords',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              },
              body: { name: $scope.account.profileId, keywords: [ $scope.voiceBase.keywordSpotting ] }
            };

            // POST new keyword group
            $http(keywordsReq).then(
              function successCallback(response) {
                $scope.savingError = false;
                $scope.savedSuccessfully = true;

                $timeout(function() {
                  $window.location.href = "/transcriptions";
                }, 2000);

              }, function errorCallback(response) {
                $scope.savingError = true;
              }
            );

          }, function errorCallback(response) {
            $scope.savingError = true;
          }
        );
      } else {
        $scope.savingError = true;
      }

    };

  };
  AnalyticsSettingsController.$inject = ['$scope', '$http', '$window', '$timeout', '$controller', '$sce'];

  return AnalyticsSettingsController;
});
