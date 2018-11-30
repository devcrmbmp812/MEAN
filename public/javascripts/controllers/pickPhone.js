define([
  'jquery',
  'countrySelect',
  'underscore'
], function(jQuery, countrySelect, _) {

  var PickPhoneController = function($scope, $http, $window, $timeout) {
    getCountries();
    var availableCountries;
    $scope.apiAlert = {};
    $scope.unavailableSecondDid = true;

    jQuery(".countrySelector").on("blur change", function() {
      $scope.updateSelectors();
      $scope.$apply();
    });

    $scope.linkDIDs = function() {
      $scope.apiAlert = {
        message: "Provisioning DIDs, please wait...",
        cssType: "info"
      };

      var dids = [];
      dids.push($scope.DID1);
      if ($scope.showOptionalDid)
        dids.push($scope.DID2);

      var req = {
        method: 'POST',
        url: '/api/linkDIDs',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: dids
      };

      $http(req).then(function() {
        $scope.apiAlert = {
          message: "This DID has been successfully linked to your Voxbone.ai profile, redirecting...",
          cssType: "success"
        };

        $timeout(function() {
          $window.location.href = "/add-sip";
        }, 500);

      }, function(response) {
        var rejectedDids = response.data;
        var takenMessage = '';
        if (rejectedDids.length == 1)
          takenMessage = "Please Select another set of DIDs, the DID " + rejectedDids[0] + " has already been taken.";
        if (rejectedDids.length == 2)
          takenMessage = "Please Select another set of DIDs, both DIDS you chose have already been taken (" + rejectedDids[0] + ", " + rejectedDids[1] + ")";

        $scope.apiAlert = {
          message: takenMessage,
          cssType: "info"
        };
      });
    };

    $scope.updateSelectors = function() {
      var iso2_cnt1, iso2_cnt2 = null;
      iso2_cnt1 = jQuery("#country1").countrySelect("getSelectedCountryData").iso2;
      if ($scope.showOptionalDid) {
        iso2_cnt2 = jQuery("#country2").countrySelect("getSelectedCountryData").iso2;
      }
      updateSelection(iso2_cnt1, iso2_cnt2);
    };

    function getCountries() {
      $scope.didRetrieveMessage = 'Retrieving Voxbone.ai available DIDs...';
      $http({
        method: 'GET',
        url: '/api/getDIDs'
      }).then(function successCallback(response) {
        //sets global plugin data
        jQuery.fn.countrySelect.setCountryData(response.data);
        availableCountries = getAvailableISO2Codes(response.data);

        if (availableCountries.length)
          initSelectors();
        else {
          $scope.showCountryPickers = false;
          $scope.didRetrieveMessage = '';
          $scope.apiAlert = {
            message: "All the DIDS have been taken, please come back later",
            cssType: "danger"
          };
        }

      }, function errorCallback(response) {
        $scope.didRetrieveMessage = '';
        $scope.showCountryPickers = false;
        $scope.apiAlert = {
          message: "We couldn't retrieve the DIDs. Please try again later",
          cssType: "danger"
        };
      });
    }

    function initSelectors() {
      //init plugin on each selector
      jQuery("#country1").countrySelect({
        preferredCountries: [],
        onlyCountries: availableCountries
      });

      if (availableCountries.length > 1) {
        jQuery("#country2").countrySelect({
          preferredCountries: [],
          onlyCountries: availableCountries
        });
        $scope.unavailableSecondDid = false;
      }

      $http({
        method: 'GET',
        url: '//freegeoip.net/json/'
      }).then(function successCallback(response) {
        console.log(response.data.country_code);
        setInitialCountry(response.data.country_code.toLowerCase());
      }, function errorCallback(response) {
        setInitialCountry('us');
        $scope.apiAlert = {
          message: "We couldn't retrieve your location. Setting default country.",
          cssType: "warning"
        };
      });
    }

    function setInitialCountry(userLocationIso2) {
      var countryData = jQuery.fn.countrySelect.getCountryData();
      var present = _.findWhere(countryData, { iso2: userLocationIso2 });

      if (present) //The user is in a listed country
        jQuery("#country1").countrySelect("selectCountry", userLocationIso2);
      else if (_.findWhere(countryData, { iso2: "us" })) //if us is available, pick it
        jQuery("#country1").countrySelect("selectCountry", "us");
      else //in other case, pick random
        jQuery("#country1").countrySelect("selectCountry", _.sample(availableCountries));

      //for country 2 always pick a random country
      var selected_cnt1 = jQuery("#country1").countrySelect("getSelectedCountryData").iso2;
      var availableCountries2 = _.without(availableCountries, selected_cnt1);
      jQuery("#country2").countrySelect("selectCountry", _.sample(availableCountries2));

      $scope.updateSelectors();
      $scope.showCountryPickers = true;
    }

    function updateSelection(selected_cnt1, selected_cnt2) {

      var availableCountries1, availableCountries2;

      availableCountries1 = availableCountries;
      availableCountries2 = _.without(availableCountries, selected_cnt1);

      if (selected_cnt2) {
        availableCountries1 = _.without(availableCountries, selected_cnt2);
        jQuery("#country2").countrySelect("destroy");
        jQuery("#country2").countrySelect({
          preferredCountries: [],
          onlyCountries: availableCountries2
        });

        if (selected_cnt1 !== selected_cnt2)
          jQuery("#country2").countrySelect("selectCountry", selected_cnt2);
        else
          jQuery("#country2").countrySelect("selectCountry", _.sample(availableCountries2));

        $scope.DID2 = jQuery("#country2").countrySelect("getSelectedCountryData").DID;
      }

      jQuery("#country1").countrySelect("destroy");
      jQuery("#country1").countrySelect({
        preferredCountries: [],
        onlyCountries: availableCountries1
      });
      jQuery("#country1").countrySelect("selectCountry", selected_cnt1);

      $scope.DID1 = jQuery("#country1").countrySelect("getSelectedCountryData").DID;

    }

    function getAvailableISO2Codes(data) {
      var availableISO2Codes = [];
      for (var i in data) {
        availableISO2Codes.push(data[i].iso2);
      }
      return availableISO2Codes;
    }
  };

  PickPhoneController.$inject = ['$scope', '$http', '$window', '$timeout'];

  return PickPhoneController;
});
