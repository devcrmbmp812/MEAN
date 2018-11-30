var expect = require('chai').expect;
var headers = require('../../../lib/headers');

describe('Headers module', function() {
  describe('#apiCredentials', function() {
    var apiCredentials = headers.provisioningApiCredentials;

    it('should have user and pass attributes both strings', function() {
      expect(apiCredentials).to.have.property('user').to.be.a('string');
      expect(apiCredentials).to.have.property('pass').to.be.a('string');
    });
  });

  describe('#jsonHeaders', function() {
    var jsonHeaders = headers.provisioningApiHeaders;

    it('should have `Content-type` attribute and be equal to `application/json`', function() {
      expect(jsonHeaders).to.have.property('Content-type').to.be.equal('application/json');
    });

    it('should have `Accept` attribute and be equal to `application/json`', function() {
      expect(jsonHeaders).to.have.property('Accept').to.be.equal('application/json');
    });
  });
});
