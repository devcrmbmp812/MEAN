var path = require('path');
var express = require('express');
var router = express.Router();
var request = require('request');
var utils = require('../lib/utils');
var headers = require('../lib/headers');
var s3 = require('../lib/s3');
var demo = require('../lib/demo');
var gcsstorage = require('@google-cloud/storage');
var fs = require('fs');
var requestPromise = require('request-promise-native');

function getTransfer(req, res, service) {
  var profileId = res.locals.currentUser.profileId;
  var recordingId = req.params.recordingId;

  if (!recordingId) {
    return res.status(406).send('Not found');
  }

  var apiPath = '/profiles/' + profileId + '/recordings/' + recordingId + '/transfers/' + service;

  var options = {
    url: process.env.VOXBONE_RECORDING_API_URL + apiPath,
    method: 'GET',
    headers: headers.recordingApiHeaders,
    auth: headers.recordingApiCredentials,
  };

  return requestPromise(options);
}

var handleS3DownloadRequest = function(req, res, next) {
  console.log('GET S3 DOWNLOAD');

  getTransfer(req, res, 's3').then((transfer) => {
    try {
      transfer = JSON.parse(transfer);
    } catch(e) {
      console.log(e);
      return res.status(502).send('Bad Gateway - Failed to process download request, due to malformed API response');
    }

    var reqS3 = {
      bucket: transfer.server,
      accessKey: transfer.accessKey,
      secretKey: transfer.accessSecret,
      region: transfer.region,
      path: transfer.path
    };

    var filename = path.basename(transfer.path);

    s3.get(reqS3).then(
      function(resS3) {
        res.set({
          'Content-Type': resS3['content-type'] || 'audio/wav',
          'Content-Disposition': 'attachment; filename=' + filename,
          'Content-Length': resS3.body.byteLength
        });
        res.status(200).send(resS3.body);
      },
      function(err) {
        console.log(err);
        res.status(502).send('Bad Gateway - ' + err.message);
      }
    );
  }).catch((e) => {
    res.status(502).send('Bad Gateway - ' + e);
  });
};

var handleGcsDownloadRequest = function(req, res, next) {
  console.log('GET GCS DOWNLOAD');

  getTransfer(req, res, 'gcs').then((transfer) => {
    try {
      transfer = JSON.parse(transfer);
      transfer.accessKey = JSON.parse(transfer.accessKey);
    } catch(e) {
      console.log(e);
      return res.status(502).send('Bad Gateway - Failed to process download request, due to malformed API response');
    }

    const gcs = gcsstorage({
      projectId: transfer.accessKey.project_id,
      credentials: transfer.accessKey
    });

    const bucket = gcs.bucket(transfer.server);
    const filename = path.basename(transfer.path);
    const remoteReadStream = bucket.file(transfer.path).createReadStream();

    res.set({
      'Content-Type': transfer.contentType,
      'Content-Disposition': 'attachment; filename=' + filename,
      'Content-Length': transfer.bytes
    });
    remoteReadStream.pipe(res);
  }).catch((e) => {
    res.status(502).send('Bad Gateway - ' + e);
  });
};


var handleRedactedFileDownload = function (req, res, next) {
  const mediaId = req.params.mediaId;
  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media/' + mediaId + '/streams',
    method: 'GET',
    headers: {
      'Authorization': process.env.VOICEBASE_BEARER_TOKEN
    }
  };

  request(options, function(error, response, body) {
    if (error) {
      return res.status(404).json();
    } else {
      try {
        return res.redirect(JSON.parse(body).streams.original);
      } catch(e) {
        return res.status(404).json();
      }
    }

  });
};

router.get('/s3/:recordingId', utils.isLoggedIn, handleS3DownloadRequest);
router.get('/gcs/:recordingId', utils.isLoggedIn, handleGcsDownloadRequest);
router.get('/redacted/:mediaId', utils.isLoggedIn, handleRedactedFileDownload);

module.exports = router;
module.exports.handleS3DownloadRequest = handleS3DownloadRequest;
