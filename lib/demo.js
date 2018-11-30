var utils = require('./utils');
var Account = require('../models/account');

var Demo = module.exports = function(req, res, next) {
  setSession(req, res, function(err) {
    if (!err) {
      isAuthorized(req, res, next);
    } else {
      next(err);
    }
  });
};

var generateAuth = module.exports.generateAuth = function generateAuth(req, res, next, demo) {
  if (!demo) {
    demo = getStatus();
  }

  if (demo.enabled) {
    var demoObj = req.session.demo;

    if (demoObj) {
        // Generate the demoAuth header.
      var demoAuthHeader = JSON.stringify({key: demoObj.key, signature: demoObj.signature});

      // Store the key and signature in a cookie, for the interface to use.
      res.cookie('demoAuth', demoAuthHeader, {maxAge: demo.maxAge, path: demo.path});

      // Save the session.
      req.session.save(function(err) {
        // Once session data is saved

        // Set the demo auth header.
        req.headers['x-demo-auth'] = demoAuthHeader;

        // Continue
        next();
      });
    } else {
      next(new TypeError('Demo session not initialized'));
    }
  } else {
    next(new TypeError('Demo system not enabled'));
  }

}

var generateSession = module.exports.generateSession = function generateSession(req, res, next, demo) {
  // Fetch configs from env variables.
  if (!demo) {
    demo = getStatus();
  }

  if (demo.enabled) {
  // If demo is enabled and a demo user is set up.

    // Generate demo session key, and sign it.
    var created = Date.now();
    var key = utils.hash(created + '.' + utils.getRandom(10000, 99999), 'hex');
    var signature = utils.hash(demo.user + key + demo.secret, 'hex');

    // Create the demo session.
    req.session.demo = {
      user: demo.user,
      created: created,
      key: key,
      signature: signature
    };

    generateAuth(req, res, next, demo);
  } else {
    // Demo not available. Redirect to the main page.
    next(new TypeError('Demo not enabled'));
  }
}

var setSession = module.exports.setSession = function setSession(req, res, next) {
  // Fetch configs from env variables.
  var demo = getStatus();

  if (demo.enabled) {
    // If demo is enabled and a demo user is set up.

    if (!req.session.demo) {
      // Set initial demo session.

      // Generate demo session key, and sign it.
      generateSession(req, res, next, demo);
    } else {
      // Demo session already set up.

      // Regenerate auth
      generateAuth(req, res, next, demo);
    }
  } else {
    // Demo not available. Redirect to the main page.
    res.redirect('/');
  }
};

var isAuthorized = module.exports.isAuthorized = function isAuthorized(req, res, next) {
  // Fetch demo status object.
  var demo = getStatus();
  var header;

  // Only for enabled demo.
  if (demo.enabled) {
    // Demo enabled.

    // Convert JSON from header to object.
    try {
      header = JSON.parse(req.headers['x-demo-auth'] || {});
    } catch(e) {
      // Failed. Invalid header.
      return next(new TypeError('Invalid demo auth header'));
    }

    // Header JSON converted to object. Validate.
    if (header && utils.hash(demo.user + header.key + demo.secret, 'hex') === header.signature) {
      // Header is valid. Set the object.

      setAccount(req, res, next);
    } else {
      // Invalid demo authorization.
      next(new TypeError('Not authorized'));
    }
  } else {
    // Demo is not enabled.
    next(new TypeError('Demo feature not enabled'));
  }
};

var setAccount = module.exports.setAccount = function setAccount(req, res, next) {
  var demo = getStatus();
  if (demo.enabled) {
    Account.findOne({email: demo.user}, function(err, account) {
      if (!err) {
        if (account) {
          var originalLocals = res.locals;

          req.user = res.user = account;
          res.locals = {
            currentUser: account
          };

          res.originalLocals = originalLocals;
          next();
        } else {
          next(new TypeError('Demo account not found'));
        }
      } else {
        next(err);
      }
    });
  } else {
    next(new TypeError('Failed to enable Demo account'));
  }
};

var getStatus = module.exports.getStatus = function getStatus() {
  // Fetch configs from env variables.
  var enabled = process.env.DEMO_ENABLED;
  var user = process.env.DEMO_USER_EMAIL;
  var secret = process.env.DEMO_SECRET;
  var maxAge = process.env.DEMO_MAXAGE || 1000;
  var demoPath = process.env.DEMO_PATH;

  if (enabled && user) {
    return {
      enabled: true,
      user: user,
      secret: secret,
      maxAge: maxAge,
      path: demoPath
    };
  } else {
    return {
      enabled: false
    };
  }
};

/**
 * Allows downloads of recordings from demo user
 * FIX #85 (https://github.com/voxbone-workshop/node-recording-frontend/issues/85)
 */
var enforceDemo = module.exports.enforceDemo = function enforceDemo(req, res, next) {
  setAccount(req, res, next);
};
