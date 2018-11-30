var express = require('express');
var router = express.Router();
var request = require('request');
var callingCountries = require('country-data').callingCountries;
var async = require('async');
var utils = require('../lib/utils');
var headers = require('../lib/headers');
var NodeCache = require("node-cache");
var _ = require('underscore');

var cache = new NodeCache({stdTTL: 3600});

router.post('/list', utils.isLoggedIn, function(req, res, next) {
  var profileId = res.locals.currentUser.profileId;
  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + '/recordings/' + profileId,
    method: 'POST',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
    json: req.body
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      return res.status(200).json(body);
    } else {
      return res.status(400).json();
    }
  }

  request(options, callback);
});

module.exports = router;
