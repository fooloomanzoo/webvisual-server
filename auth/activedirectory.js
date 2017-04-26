// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration

const LocalStrategy = require('passport-local').Strategy
    , ActiveDirectory = require('activedirectory');

// expose this function to our app using module.exports
module.exports = function(passport, config_ldap) {

  if (config_ldap == undefined || config_ldap.url == undefined || config_ldap.baseDN == undefined) {
    console.log("LDAP Auth Error: missing server informations in config");
    return;
  }

  passport.use('activedirectory-login', new LocalStrategy({
      // by default, local strategy uses username and password, we will override with username
      usernameField: 'username',
      passwordField: 'password'
    },
    function(username, password, done) { // callback with username and password from our form
      // creating a request through activedirectory by ldap
      // try to bring user-input in a form which is accepted by the server

      console.log('activedirectory-login', username, password);
      var user = username.split("@")[0] + "@" + config_ldap.url.split('ldap://')[1];

      var cred = {
        url: config_ldap.url,
        baseDN: config_ldap.baseDN,
        username: user,
        password: password
      };

      // console.log(req.connection.remoteAddress);
      var ad = new ActiveDirectory(cred);
      ad.userExists(user, function(err, exists) {
        // console.log(err,exists);
        if (err) {
          // if error, return no user
          // console.log("Authentification Error", err);
          return done(null, false);
        }
        // if user exists, then check, if user can authenticate
        else if (exists) {
          ad.authenticate(user, password, (err, auth) => {
            if (auth) {
              // all is well, return successful user
              // console.log("Authentification success", user);
              return done(null, {username: username});
            } else {
              // if password false, return no user
              // console.log("Authentification Error", err);
              return done(null, false);
            }
          });
        } else {
          // console.log("Authentification Failed", user);
          return done(null, false);
        }
      });
    }));
};
