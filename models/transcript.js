var mongoose = require('mongoose');
var moment = require('moment');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

const SERVICES = ['googleSpeech', 'voiceBase', 'ibmWatson'];

var transcriptSchema = new Schema({
  _account: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  created_at: Date,
  updated_at: Date,
  service: { type: String, enum: SERVICES},
  mediaId: String,
  profileId: String,
  callId: String,
  recordingId: String,
  participantId: {type: String, index: true},
  transcript: {
    type: Schema.Types.Mixed,
    default: null
  },
  sentimentAnalysis: {
    type: Schema.Types.Mixed,
    default: null
  },
  keywords: {
    type: Schema.Types.Mixed,
    default: null
  },
  redaction: {
    type: Boolean,
    default: false
  },
  failureReason: {
    type: Schema.Types.Mixed,
    default: null
  },
  processed: {
    type: Boolean,
    default: false
  }
});

transcriptSchema.methods.getStringifiedTranscription = function () {
  let result = "";

  if (!this.transcript || this.transcript.constructor !== Array) return '';

  this.transcript.forEach ((sentence) => {
    if (typeof sentence === 'string') {
      result += `${sentence}. `;
    } else {
      sentence.forEach ((word) => {
        result += `${word.word} `;
      });
    }

    result = `${result.trim()}. `;
  });

  return result;
};

var Transcript = mongoose.model('Transcript', transcriptSchema);

module.exports = Transcript;
