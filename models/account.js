const mongoose = require('mongoose');
const moment = require('moment');
const slugid = require('slugid');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt-nodejs');
const createProfile = require('../lib/createProfile');
const utils = require('../lib/utils');

let inventoryDidSchema = new Schema({
  e164: {
    type: String,
    required: true
  },
  didId: {
    type: Number,
    required: true
  },
  originalVoiceUriId: {
    type: Number,
    required: true
  },
  originalSipUri: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'en-US'
  },
  analyticsSipUri: String,
  analyticsVoiceUriId: Number,
  extraSettings: {},
  enabled: {
    type: Boolean,
    default: false
  }
});

let accountSchema = new Schema({
  email: {
    type: String,
    required: true,
    index: {
      unique: true
    }
  },
  temporary_password: String,
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: false
  },
  temporary: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  admin: {
    type: Boolean,
    default: false
  },
  forgotten_pasword: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verifyAccountToken: String,
  verifyAccountExpires: Date,
  password: String,
  created_at: Date,
  updated_at: Date,
  company: String,
  phone: String,
  create_date: String,
  google_id: String,
  google_token: String,
  github_id: String,
  github_token: String,
  windowslive_token: String,
  windowslive_id: String,
  slack_token: String,
  slack_id: String,
  linkedin_token: String,
  linkedin_id: String,
  voxbone_token: String,
  voxbone_id: String,
  referrer: String,
  profileId: String,
  bridgeId: String,
  adminProfileId: String,
  voiceUriId: Number,
  dids: {
    type: [String],
    default: []
  },
  analyticSettings: {
    type: Schema.Types.Mixed,
    default: {
      "ibmWatson": {
        "smartFormatting": false,
        "profanityFilter": true,
        "model": "en-US_BroadbandModel"
      },
      "googleSpeech": {
        "language": "en-US",
        "speechContextsEnabled": true,
        "speechContexts": ""
      },
      "googleSentimentAnalysis": {
        "enabled": true,
      },
      "voiceBase": {
        "customVocabulary": "",
        "customVocabularyEnabled": true,
        "numberRedaction": false,
        "ssnRedaction": false,
        "pciRedaction": false,
        "keywordSpotting": "",
        "keywordSpottingEnabled": true,
        "language": "en-US"
      },
      "services": ["googleSpeech", "ibmWatson", "voiceBase"]
    }
  },
  enableTransferSettings: {
    type: Boolean,
    default: false
  },
  api_username: String,
  api_password: String,
  inventoryDids: [inventoryDidSchema],
  showAllowingTrafficWarning: {
    type: Boolean,
    default: false
  },
});

accountSchema.pre('save', function (next) {
  self = this;
  now = new Date();
  self.updated_at = now;

  if (!self.created_at) {
    self.created_at = now;
    self.create_date = moment().format("DD/MM/YYYY");
  }

  if (!self.profileId && !self.voiceUriId) {
    createProfile(self, next);
  } else {
    next();
  }
});

accountSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

accountSchema.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

accountSchema.methods.getFullName = function () {
  return `${this.first_name} ${this.last_name}`;
};

accountSchema.methods.getFormattedDid = function () {
  return utils.getFormattedDid(this.dids[0]);
};

accountSchema.methods.getSanitizedDid = function () {
  if (this.dids.length === 0)
    return null;

  return this.dids[0].replace(/\D/g,'');
};

accountSchema.methods.showCallButton = function () {
  return this.dids.length > 0;
};

accountSchema.methods.isDemoUser = function () {
  return this.email === process.env.DEMO_USER_EMAIL;
};

accountSchema.methods.isSentimentAnalysisEnabled = function () {
  if (!this.analyticSettings || !this.analyticSettings.googleSentimentAnalysis)
    return false;

  return !!this.analyticSettings.googleSentimentAnalysis.enabled;
};

accountSchema.methods.isVoxboneCustomer = function () {
  return !!(this.voxbone_id && this.voxbone_token);
};

accountSchema.methods.isFirstVisit = function () {
  if (this.isVoxboneCustomer()) {
    return !this.areProvisioningApiCredentialsSet();
  } else {
    return this.dids.length === 0;
  }
};

accountSchema.methods.areProvisioningApiCredentialsSet = function () {
  return (this.api_username && this.api_password);
};

accountSchema.methods.getProvisioningApiCredentials = function () {
  return {
    'user': this.api_username,
    'pass': this.api_password
  };
};

accountSchema.methods.getUserProfileId = function () {
  let result = slugid.encode(this.profileId);
  return result;
};

var Account = mongoose.model('Account', accountSchema);

module.exports = Account;
