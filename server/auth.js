var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;

var User = function () {
    //TODO: Implement User database
    this.findOrCreate = function (usr, callback) {
        return callback(null, usr)
    }
}

// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Google profile), and
//   invoke a callback with a user object.
passport.use(new GoogleStrategy({
    clientID: process.env.Google_Client_Id,
    clientSecret: process.env.Google_Client_Secret,
    callbackURL: "http://localhost:3000/auth/google/callback"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

module.exports = passport;