module.exports = {
  provisioningApiCredentials: {
    'user': process.env.VOXBONE_API_USERNAME,
    'pass': process.env.VOXBONE_API_PASSWORD
  },

  provisioningApiHeaders: {
    'Accept': 'application/json',
    'Content-type': 'application/json',
    'User-Agent': 'request'
  },

  recordingApiHeaders: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'request'
  },

  recordingApiCredentials: {
    'user': process.env.VOXBONE_RECORDING_API_USERNAME,
    'pass': process.env.VOXBONE_RECORDING_API_PASSWORD
  },

  conferencingApiHeaders: {
    'Authorization': 'Basic ' + process.env.VOXBONE_CONFERENCING_API_BASIC_AUTH,
    'Content-Type': 'application/json'
  },

  metadataApiHeaders: {
    'Content-Type': 'application/json'
  },

  metadataApiCredentials: {
    'user': process.env.VOXBONE_METADATA_API_USER,
    'pass': process.env.VOXBONE_METADATA_API_PASSWORD
  }
};
