
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration
const passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy;

// expose this function to our app using module.exports
module.exports = function() {
    // required for persistent login sessions
    // used to serialize the user for the session

    passport.use('dummy', new LocalStrategy({
          usernameField : 'username',
          passwordField : 'password'
      }, function(username, password, done) {
        if (username) {
          // console.log('Authentification of', username, '(not required)');
          return done(null, {username: username});
        } else {
          return done(null, false);
        }
      }));
};
