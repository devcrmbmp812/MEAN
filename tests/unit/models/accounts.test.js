const chai = require('chai');
const spies = require('chai-spies');
const expect = chai.expect;

chai.use(spies);

const Account = require('../../../models/account');

describe('Account schema', () => {
  const env = Object.assign({}, process.env);

  after(() => {
    process.env = env;
  });

  describe('#getFullName', () => {
    let account = new Account({
      first_name: 'John',
      last_name: 'Doe'
    });

    let full_name = account.getFullName();

    it('should return both first & last name', () => {
      expect(full_name).to.be.a('String');
      expect(full_name).be.equal('John Doe');
    });
  });

  describe('#isVoxboneCustomer', () => {
    it('should return true if voxbone_id and voxbone_token are not set', () => {
      let account = new Account({
        voxbone_id: '123',
        voxbone_token: 'something'
      });

      expect(account.isVoxboneCustomer()).to.eql(true);
    });

    it('should return false if voxbone_id or voxbone_token are not set', () => {
      let accounts = [
        new Account(),
        new Account({ voxbone_id: '123'}),
        new Account({ voxbone_token: 'something'})
      ];

      accounts.forEach((account) => {
        expect(account.isVoxboneCustomer()).to.eql(false);
      });
    });
  });

  describe('#isFirstVisit', () => {
    let account = new Account();
    const spy = chai.spy.on(account, 'isVoxboneCustomer');

    describe('and is Voxbone Customer', () => {
      beforeEach(() => {
        account.isVoxboneCustomer.reset();
        account.isVoxboneCustomer = chai.spy(() => { return true; });
      });

      afterEach(() => {
        expect(account.isVoxboneCustomer).to.have.been.called.exactly(1);
      });

      it('should return true', () => {
        account.api_username = null;
        account.api_password = null;

        expect(account.isFirstVisit()).to.eql(true);
      });

      it('should return false', () => {
        account.api_username = "abc";
        account.api_password = "def";

        expect(account.isFirstVisit()).to.eql(false);
      });
    });

    describe('and is NOT Voxbone Customer', () => {

      beforeEach(() => {
        account.isVoxboneCustomer.reset();
        account.isVoxboneCustomer = chai.spy(() => { return false; });
      });

      afterEach(() => {
        expect(account.isVoxboneCustomer).to.have.been.called.exactly(1);
      });

      it('should return true if', () => {
        expect(account.isFirstVisit()).to.eql(true);
      });

      it('should return false if dids', () => {
        account.dids = [1];

        expect(account.isFirstVisit()).to.eql(false);
      });
    });
  });

  describe('#isSentimentAnalysisEnabled', () => {
    it('should be enabled by default', () => {
      let account = new Account();

      let isSentimentAnalysisEnabled = account.isSentimentAnalysisEnabled();
      expect(isSentimentAnalysisEnabled).be.equal(true);
    });

    it('should return false if not set', () => {
      let account = new Account({
        analyticSettings: {
          services: ["a", "b", "c"]
        }
      });

      let isSentimentAnalysisEnabled = account.isSentimentAnalysisEnabled();
      expect(isSentimentAnalysisEnabled).be.equal(false);
    });

    it('should return true if set', () => {
      let account = new Account({
        analyticSettingsx: {
          services: ["a", "googleSentimentAnalysis", "c"]
        }
      });

      let isSentimentAnalysisEnabled = account.isSentimentAnalysisEnabled();
      expect(isSentimentAnalysisEnabled).be.equal(true);
    });
  });

  describe('#getProvisioningApiCredentials', () => {
    it('should be enabled by default', () => {
      let account = new Account({
        api_username: "123",
        api_password: "456"
      });

      let expected = {
        'user': "123",
        'pass': "456"
      };

      let actual = account.getProvisioningApiCredentials();
      expect(actual).to.deep.equal(expected);
    });
  });

  describe('#getUserProfileId', () => {
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

    it('should return SlugId', () => {
      var slugid = require('slugid');

      let account = new Account({
        profileId: uuid
      });

      let expected = slugid.encode(uuid);

      let actual = account.getUserProfileId();
      expect(expected).to.eql(actual);
    });
  });

});
