var express = require('express');
var router = express.Router();
var rp = require('request-promise-native');
var async = require('async');
var utils = require('../lib/utils');
var headers = require('../lib/headers');
let request  = require('request');

function getDidInfo(account, e164Pattern) {
  const sanitizedE164Pattern = e164Pattern.replace(/\D+/g, '');
  const options = {
    method: 'GET',
    url: `${process.env.VOXBONE_PROVISIONING_API_URL}/inventory/did?e164Pattern=${sanitizedE164Pattern}&pageNumber=0&pageSize=1`,
    headers: headers.provisioningApiHeaders,
    auth: account.getProvisioningApiCredentials(),
    json: true
  };

  return rp(options);
}

function getVoiceUriInfo(account, voiceUriId) {

  if (!voiceUriId)
    return null;

  const options = {
    method: 'GET',
    url: `${process.env.VOXBONE_PROVISIONING_API_URL}/configuration/voiceuri/${voiceUriId}?pageNumber=0&pageSize=1`,
    headers: headers.provisioningApiHeaders,
    auth: account.getProvisioningApiCredentials(),
    json: true
  };

  return rp(options);
}

function findOrCreateVoiceUriInfoByUri(account, uri, backupUriId) {
  const options = {
    method: 'GET',
    url: `${process.env.VOXBONE_PROVISIONING_API_URL}/configuration/voiceuri/?uri=${encodeURIComponent(uri)}&pageNumber=0&pageSize=1`,
    headers: headers.provisioningApiHeaders,
    auth: account.getProvisioningApiCredentials(),
    json: true
  };

  return new Promise((resolve, reject) => {
    rp(options).then((responseVoiceUriInfo) => {
      if (responseVoiceUriInfo.resultCount === 0) {
        createVoiceUri(account, uri, backupUriId).then((newVoiceUri) => {
          resolve(JSON.parse(newVoiceUri).voiceUri.voiceUriId);
        });
      } else {
        resolve(responseVoiceUriInfo.voiceUris[0].voiceUriId);
      }
    }).catch((error) => {
      reject(error);
    });
  });
}

function createVoiceUri(account, newAnalyticsSipUri, backupUriId) {

  const data = {
    voiceUri: {
      voiceUriProtocol: 'SIP',
      uri: newAnalyticsSipUri,
      voiceUriId: null,
      backupUriId: backupUriId,
      description: `Analytics URI for: ${account.profileId} from ${process.env.APP_URL}`
    }
  };

  const options = {
    method: 'PUT',
    url: `${process.env.VOXBONE_PROVISIONING_API_URL}/configuration/voiceuri`,
    headers: headers.provisioningApiHeaders,
    auth: account.getProvisioningApiCredentials(),
    body: JSON.stringify(data)
  };

  return rp(options);
}

function provisionDid(account, didId, voiceUriId) {
  const options = {
    method: 'POST',
    url: process.env.VOXBONE_PROVISIONING_API_URL + '/configuration/configuration',
    headers: headers.provisioningApiHeaders,
    auth: account.getProvisioningApiCredentials(),
    json: {
      "didIds": [didId],
      "voiceUriId": voiceUriId
    }
  };

  return rp(options);
}

function enableDidAnalyticsStatus(account, didInfo) {
  return setDidAnalyticsStatus(account, didInfo, true);
}

function disableDidAnalyticsStatus(account, didInfo) {
  return setDidAnalyticsStatus(account, didInfo, false);
}

function setDidAnalyticsStatus(account, didInfo, value) {
  for (let i = 0; i < account.inventoryDids.length; i++) {
    if (account.inventoryDids[i].didId === didInfo.didId) {
      account.inventoryDids[i] = didInfo;
      account.inventoryDids[i].enabled = value;
      account.showAllowingTrafficWarning = true;
    }
  }

  return account.save();
}

function removeDidAnalyticsStatus(account, didInfo) {
  for (let i = 0; i < account.inventoryDids.length; i++) {
    if (account.inventoryDids[i].didId === didInfo.didId) {
      account.inventoryDids.splice(i, 1);
    }
  }

  return account.save();
}

const getParams = query => {
  if (!query) {
    return {};
  }

  return (/^[?#]/.test(query) ? query.slice(1) : query)
    .split(';')
    .reduce((params, param) => {
      let [key, value] = param.split('=');
      params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
      return params;
    }, {});
};
/* jshint ignore:start */
async function getDidAggregation(account, numberToQuery) {
  let resultDidInfo = {};
  let resultVoiceUriInfo;

  try {
    resultDidInfo = await getDidInfo(account, numberToQuery);
  } catch (err) {
    // console.log(err);
  }

  try {
    resultVoiceUriInfo = await getVoiceUriInfo(account, resultDidInfo.dids[0].voiceUriId);
  } catch (err) {
    // console.log(err);
  }

  let result = resultDidInfo.dids[0];

  try {
    result.uri = resultVoiceUriInfo.voiceUris[0].uri;

    const rtpRecDomain = `@${process.env.VOXBONE_RECORDING_SERVICE}`;
    const posOfRtpRecDomain = result.uri.indexOf(rtpRecDomain);

    if (posOfRtpRecDomain > -1) {
      result.conflict = true;
      const oldUri = decodeURIComponent(result.uri.substring(posOfRtpRecDomain + rtpRecDomain.length + 1));

      result.uri = getParams(oldUri).dst;

    } else {
      result.conflict = false;
    }

  } catch (err) {
    // console.log(err);
  }

  return result;
}
/* jshint ignore:end */

router.get('/checkUserDID', utils.isLoggedIn, function(req, res, next) {
  const account = res.locals.currentUser;

  if (!account.api_username || !account.api_password)
    return res.status(400).json("User did not provide his api credentials");

  getDidAggregation(account, req.query.numberToQuery).then((didAggregation) => {
    return res.status(200).json(didAggregation);
  }).catch((err) => {
    return res.status(404).json();
  });
});

router.post('/addDID', utils.isLoggedIn, function(req, res, next) {
  const account = res.locals.currentUser;

  if (!account.api_username || !account.api_password)
    return res.status(400).json("User did not provide his api credentials");

  const e164 = req.body.didInfo.e164;
  getDidAggregation(account, e164).then((didAggregation) => {
    let inventoryDid = {
      e164: didAggregation.e164,
      didId: didAggregation.didId,
      originalVoiceUriId: didAggregation.voiceUriId,
      originalSipUri: didAggregation.uri,
      language: 'en-US',
      analyticsSipUri: null,
      analyticsVoiceUriId: null,
      extraSettings: {},
      enabled: false
    };

    if (!account.inventoryDids)
      account.inventoryDids = [];
    account.inventoryDids.push(inventoryDid);

    account.save().then(() => {
      return res.status(200).json(account.inventoryDids);
    });

  }).catch((err) => {
    return res.status(400).json();
  });
});

router.put('/enableAnalyticsForDid', utils.isLoggedIn, function(req, res, next) {
  const account = res.locals.currentUser;
  let didInfo = req.body.didInfo;

  let encodedDst;
  if (didInfo.originalSipUri.indexOf('{E164}') > -1){
    encodedDst = `{E164}${encodeURIComponent(didInfo.originalSipUri.substr(didInfo.originalSipUri.indexOf('@')))}`;
  } else {
    encodedDst = encodeURIComponent(didInfo.originalSipUri);
  }

  const uriPrefix = process.env.VOXBONE_RECORDING_URI_PREFIX;
  const sipLimitLength = parseInt(process.env.SIP_LIMIT_LENGTH) || 96;

  didInfo.analyticsSipUri = `${uriPrefix}${account.getUserProfileId()}@${process.env.VOXBONE_RECORDING_SERVICE};dst=${encodedDst};lang=${didInfo.language}`;

  if (didInfo.analyticsSipUri.length > sipLimitLength) {
    sendAddressNotification(account, didInfo);
    return res.status(400).json(`SIP URI longer than ${sipLimitLength}`);
  }

  findOrCreateVoiceUriInfoByUri(account, didInfo.analyticsSipUri, didInfo.originalVoiceUriId).then((newVoiceUriId) => {

    didInfo.analyticsVoiceUriId = newVoiceUriId;

    provisionDid(account, didInfo.didId, didInfo.analyticsVoiceUriId).then((responseProvisionedDid) => {
      enableDidAnalyticsStatus(account, didInfo).then((updatedAccount) => {
        return res.status(200).json(updatedAccount.inventoryDids);
      });
    });

  }).catch((err) => {
    console.log(err);
    return res.status(500).json();
  });
});

function sendAddressNotification(account, didInfo) {
  if(!process.env.SLACK_ADDRESS_HOOK)
    return;

  let message = `<!here|here> (96-char issue)\n \`profileId:\` ${account.getUserProfileId()}\n \`email:\` ${account.email}\n \`api_username:\` ${account.api_username}\n \`e164:\` ${didInfo.e164}\n \`originalSipUri:\` ${didInfo.originalSipUri}\n \`analyticsSipUri:\` ${didInfo.analyticsSipUri}\n \`language:\` ${didInfo.language}`;

  request.post(process.env.SLACK_ADDRESS_HOOK, {
    body: JSON.stringify({
      text: message,
      username: 'voxbone-ai',
      icon_emoji: ':phone:',
      link_names: true
    }),
    'content-type': 'application/json'
  }, function(error, response, body) {
    if(error) {
      return console.error('Slack Error', error);
    }
  });
}

router.put('/pauseAnalyticsForDid', utils.isLoggedIn, function(req, res, next) {
  const account = res.locals.currentUser;
  let didInfo = req.body.didInfo;

  provisionDid(account, didInfo.didId, didInfo.originalVoiceUriId).then((responseProvisionedDid) => {
    disableDidAnalyticsStatus(account, didInfo).then((updatedAccount) => {
      return res.status(200).json(updatedAccount.inventoryDids);
    });
  }).catch((err) => {
    console.log(err);
    return res.status(400).json();
  });
});

router.put('/removeAnalyticsForDid', utils.isLoggedIn, function(req, res, next) {
  const account = res.locals.currentUser;
  let didInfo = req.body.didInfo;

  provisionDid(account, didInfo.didId, didInfo.originalVoiceUriId).then((responseProvisionedDid) => {
    removeDidAnalyticsStatus(account, didInfo).then((updatedAccount) => {
      return res.status(200).json(updatedAccount.inventoryDids);
    });
  }).catch((err) => {
    console.log(err);
    return res.status(400).json();
  });
});

module.exports = router;
