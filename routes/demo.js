var express = require('express');
var router = express.Router();
var utils = require('../lib/utils');
var ensureDemo = require('../lib/demo');
var downloadRoutes = require('./download');

router.get('/', ensureDemo, function(req, res, next) {
  var userDid = res.locals.currentUser.dids[0];
  var email = res.locals.currentUser.email;

  // Reset to original locals, to enable currently logged in users.
  res.locals = res.originalLocals || res.locals;

  // Render the demo page.
  res.render('demo', {
    did: userDid,
    email: email
  });
});

router.get('/download/:service/:recordingId', ensureDemo.enforceDemo, function(req, res, next) {
  downloadRoutes.handleDownloadRequest(req, res, next);
});

module.exports = router;
