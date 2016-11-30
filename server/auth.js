var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var RememberMeStrategy = require('passport-remember-me').Strategy;
var config = require('../config/config')()
var User = require('./model').User
var Token = require('./model').Token

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (user, done) {
    User.findOne({ id: user }, function (err, result) {
        done(null, result);
    })
});

// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Google profile), and
//   invoke a callback with a user object.
passport.use(new GoogleStrategy({
    clientID: process.env.Google_Client_Id,
    clientSecret: process.env.Google_Client_Secret,
    callbackURL: config.host + "/auth/google/callback"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate(profile, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.Facebook_Client_Id,
    clientSecret: process.env.Facebook_Client_Secret,
    callbackURL: config.host + "/auth/facebook/callback"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate(profile, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new RememberMeStrategy(
    function (token, done) {
        Token.consume(token, function (err, user) {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            return done(null, user);
        });
    },
    Token.issue
));

module.exports = passport;