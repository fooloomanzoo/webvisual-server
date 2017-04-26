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
      // by default, local strategy uses name and password, we will override with name
      usernameField: 'user',
      passwordField: 'password',
      passReqToCallback: true
    },
    function(req, user, password, done) { // callback with name and password from our form
      // creating a request through activedirectory by ldap
      // try to bring user-input in a form which is accepted by the server

      var userEmail = user.split("@")[0] + "@" + config_ldap.url.split('ldap://')[1];
      // console.log('activedirectory-login', user, password, userEmail);
      var cred = {
        url: config_ldap.url,
        baseDN: config_ldap.baseDN,
        username: userEmail,
        password: password
      };

      // console.log(req.connection.remoteAddress);
      var ad = new ActiveDirectory(cred);
      ad.userExists(userEmail, function(err, exists) {
        // console.log(err,exists);
        if (err) {
          // if error, return no user
          console.log("Authentification Error", err);
          return done(null, false);
        }
        // if user exists, then check, if user can authenticate
        else if (exists) {
          ad.authenticate(userEmail, password, (err, auth) => {
            if (auth) {
              // all is well, return successful user
              console.log("Authentification success", userEmail);
              return done(null, {
                user:    req.body.user,
                name:    req.body.name,
                iconURL: req.body.iconURL || '/icons/app-icon-48.png'
              });
            } else {
              // if password false, return no user
              console.log("Authentification Not Possible", err);
              return done(null, false);
            }
          });
        } else {
          console.log("Authentification Failed", user);
          return done(null, false);
        }
      });
    }));
};
