
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration
const passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy;

// expose this function to our app using module.exports
module.exports = function() {
    // required for persistent login sessions
    // used to serialize the user for the session

    passport.use('dummy', new LocalStrategy({
          usernameField : 'name',
          passwordField : 'password'
      }, function(name, password, done) {
        if (name) {
          console.log('Authentification of', name, '(not required)');
          return done(null, {name: name});
        } else {
          return done(null, false);
        }
      }));
};
