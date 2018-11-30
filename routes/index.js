var pjson = require('../package.json');
var title = 'Voxbone AI';
var express = require('express');
var router = express.Router();
var utils = require('../lib/utils');
var recaptcha = require('express-recaptcha');
var headers = require('../lib/headers');
var request = require('request');
var Account = require('../models/account');

recaptcha.init(
  process.env.GOOGLE_RECAPTCHA_SITE_KEY,
  process.env.GOOGLE_RECAPTCHA_SECRET_KEY
);

// Redirects if not HTTPS
router.get('*', function (req, res, next) {
  if (process.env.FORCE_HTTPS === 'true' && process.env.APP_URL && req.headers['x-forwarded-proto'] != 'https')
    res.redirect(process.env.APP_URL + req.url);
  else
    next();
});

router.get('/', recaptcha.middleware.render, function (req, res, next) {

  if (res.locals.currentUser && res.locals.currentUser.email === process.env.DEMO_USER_EMAIL) {
    req.logout();
    req.session.destroy();

    if (req.query.register)
      return res.redirect('/#register');
    else
      return res.redirect('/');

  } else {
    return res.render('home',{
      title: title,
      email: req.query.email || '',
      message: req.flash('loginMessage'),
      temp_password: req.query.password,
      captcha: req.recaptcha,
      reference: req.params.ref,
      account: res.locals.currentUser || null,
      isHomePage: true
    });
  }
});

router.get('/ping', function (req, res, next) {
  return res.json({ 'ping': Date.now(), 'version': pjson.version });
});

router.get('/profile', utils.isLoggedIn, function(req, res, next) {
  return res.render('account/edit');
});

router.get('/landing', utils.isLoggedIn, function(req, res, next) {
  const currentUser = res.locals.currentUser;

  if (currentUser.isFirstVisit()) {
    if (currentUser.isVoxboneCustomer())
      return res.render('account/edit');
    else
      return res.render('pick-demo-did');
  } else {
    return res.render('transcriptions', {
      from: req.query.from || 0,
      email: currentUser.email,
      dids: currentUser.dids,
      showCallDemoDidButton: currentUser.areProvisioningApiCredentialsSet()
    });
  }
});

router.get('/show-demo-did', utils.isLoggedIn, function(req, res, next) {
  const currentUser = res.locals.currentUser;
  if (currentUser.dids.length > 0)
    return res.render('show-demo-did', { dids: currentUser.dids });
  else
    return res.render('pick-demo-did');
});

router.get('/add-SIP', utils.isLoggedIn, function (req, res, next) {
  return res.render('add-sip', {
    defaultSip: process.env.DEFAULT_OUTBOUND_SIP,
    sentimentAnalysisSip: process.env.SA_DEMO_OUTBOUND_SIP,
    mediaServerIp: process.env.MEDIA_SERVER_IP,
    signalingServerIp: process.env.SIGNALING_SERVER_IP
  });
});

router.get('/analytic-settings', utils.isLoggedIn, function (req, res, next) {
  return res.render('analytic-settings');
});

router.get('/transfer-settings', utils.isLoggedIn, function (req, res, next) {
  const currentUser = res.locals.currentUser;

  if (currentUser.isVoxboneCustomer() || currentUser.enableTransferSettings) {
    return res.render('transfer-settings', {
      email: currentUser.email
    });
  } else {
    return res.redirect('/');
  }
});

router.get('/transcriptions', utils.isLoggedIn, function(req, res, next) {
  const userDids = res.locals.currentUser.dids;
  const email = res.locals.currentUser.email;

  return res.render('transcriptions', {
    dids: userDids,
    email: email,
    from: req.query.from || 0,
    initDateTime: req.query.initDateTime,
    endDateTime: req.query.endDateTime,
    calledDid: req.query.calledDid,
    showCallDemoDidButton: req.query.demo === 'true'
  });
});

router.get('/dids-setup', utils.isLoggedIn, function(req, res, next) {
  const user = res.locals.currentUser;

  if (user.areProvisioningApiCredentialsSet()) {
    return res.render('dids-setup', {
      mediaServerIp: process.env.MEDIA_SERVER_IP,
      signalingServerIp: process.env.SIGNALING_SERVER_IP
    });
  }

  return res.render('account/edit', {
    title: title,
    user: user
  });
});

router.get('/login-demo', function(req, res, next) {
  Account.findOne({ email: process.env.DEMO_USER_EMAIL }, function (err, demoAccount) {
    req.logIn(demoAccount, function (err) {
      if (err) {
        console.log(err);
        return res.redirect('/');
      } else {
        return res.redirect('/transcriptions?demo=true');
      }
    });
  });
});

router.get('/live-transcripts', function (req, res, next) {
  const demoDids = JSON.parse(process.env.LIVE_TRANSCRIPTIONS_DEMO_BRIDGE_DIDS);

  demoDids.forEach((demoDid) => {
    demoDid.formatted_did = utils.getFormattedDid(demoDid.did_number);
  });

  res.render('live-transcripts', {
    dids: demoDids,
    bridgeId: process.env.VOXCONF_LIVE_TRANSCRIPT_DEMO_BRIDGE_ID,
    guestName: utils.haiku()
  });
});

router.get('/faq', function (req, res, next) {
  res.render('faq');
});

router.get('/partner-opportunity', function (req, res, next) {
  res.render('partner-opportunity');
});

module.exports = router;
