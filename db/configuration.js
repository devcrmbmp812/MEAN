var mongoose = require('mongoose');
var dbURI = process.env.MONGODB_URI || 'mongodb://localhost/voxboneAiDB';
var Account = require('../models/account');

mongoose.Promise = global.Promise;
mongoose.debug = true;

var promise = mongoose.connect(dbURI, {
  useMongoClient: true
});

//Check for demo user for testing purposes
Account.findOne({email: process.env.DEMO_USER_EMAIL}, function (err, demoAccount) {
  if (!demoAccount) {
    console.log("Generating demo user...");
    demoAccount = new Account(
      {
        email: process.env.DEMO_USER_EMAIL,
        verified: true,
        first_name: "Demo",
        last_name: "User",
        company: "Voxbone",
        phone: "+5555555",
        referrer: "no-referer",
        temporary: false
      }
    );
    demoAccount.password = demoAccount.generateHash(process.env.DEMO_USER_PASSWORD || "password");
    demoAccount.save(function (err) {
      if(err)
          console.log("Demo user couldnt be generated");
    });
  }
});

module.exports = dbURI;
