var config = require('../config/config')()
var mongoose = require('mongoose')
var logger = require('./logger')

mongoose.Promise = require('bluebird');
mongoose.connect(config.db);

var UserSchema = mongoose.Schema({
    id: String,
    displayName: String,
    provider: String,
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
    var index = this.favorites.indexOf(fav)
    if (index >= 0) {
        this.favorites.splice(index, 1)
        this.save(function (err, result) {
            if (err) {
                logger.error("removeFavorite error saving: " + JSON.stringify(err))
            }
        })
    }
}

var User = mongoose.model(config.db_prefix + 'User', UserSchema)

module.exports = {
    User: User
}