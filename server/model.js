var config = require('../config/config')()
var mongoose = require('mongoose')
var logger = require('./logger')
var hat = require('hat')

mongoose.Promise = require('bluebird');
mongoose.connect(config.db);

var UserSchema = mongoose.Schema({
    id: { type: String, index: true },
    displayName: String,
    provider: String,
    email: String,
    favorites: Array
}, { strict: true })

UserSchema.static('findOrCreate', function (usr, callback) {
    this.findOne({ id: usr.id }, function (err, found) {
        if (err || found == undefined) {
            var newUser = new User(usr)
            newUser.save(function (err, result) {
                if (err) {
                    logger.error("findOrCreate error saving: " + JSON.stringify(err), usr)
                    return callback(err, false)
                } else {
                    return callback(null, result)
                }
            })
        } else {
            callback(null, found)
        }
    })
})

UserSchema.methods.addFavorite = function (fav) {
    this.favorites.push(fav);
    this.save(function (err, result) {
        if (err) {
            logger.error("addFavorite error saving: " + JSON.stringify(err))
        }
    })
}

UserSchema.methods.removeFavorite = function (fav) {
    this.favorites.pull(fav)
    this.save(function (err, result) {
        if (err) {
            logger.error("removeFavorite error saving: " + JSON.stringify(err))
        }
    })
}

var User = mongoose.model(config.db_prefix + 'User', UserSchema)

var TokenSchema = mongoose.Schema({
    token: { type: String, index: true },
    userId: String
}, { strict: true })

TokenSchema.static('consume', function (token, callback) {
    logger.debug('token.consume finding token ' + token)
    this.findOne({ token: token }, function (err, result) {
        if (err || result == undefined) {
            logger.error("token.consume", err)
            callback(err, null)
        } else {
            logger.debug('token.consume finding user ' + JSON.stringify(result))
            User.findOne({ id: result.userId }, function (err, user) {
                callback(err, user)
            })
        }
    })
})

TokenSchema.static('issue', function (user, done) {
    var token = new Token({ token: hat(), userId: user.id })
    token.save(function (err, result) {
        if (err) { return done(err); }
        return done(null, token.token);
    });
}, { strict: true })

var Token = mongoose.model(config.db_prefix + 'Token', TokenSchema)

var TickerSchema = mongoose.Schema({
    ticker: { type: String, index: true },
    price: Number,
    NETINC: Number,
    SHARESWA: Number,
    DPS: Number,
    datePriceUpdated: Date,
    dateFundamentalsUpdated: Date
}, { stict: true })

TickerSchema.static('findByTicker', function (ticker, done) {
    this.findOne({ ticker: ticker }, function (err, result) {
        if (err) {
            logger.error("ticker.findByTicker " + ticker, err)
            done(err, null)
        } else {
            done(null, result)
        }
    })
})

TickerSchema.static('findByTickerLean', function (ticker, done) {
    this.findOne({ ticker: ticker }).lean().exec(function (err, result) {
        if (err) {
            logger.error("ticker.findByTicker " + ticker, err)
            done(err, null)
        } else {
            done(null, result)
        }
    })
})

var Ticker = mongoose.model('Ticker', TickerSchema)

module.exports = {
    User: User,
    Token: Token,
    Ticker: Ticker
}