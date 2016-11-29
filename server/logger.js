var winston = require('winston');
var winstonMongodb = require('winston-mongodb').MongoDB;
var config = require('../config/config')()

// Connection URL

var logger = new (winston.Logger)({
    transports: [
        new (winstonMongodb)({ level: 'debug', db: config.db })
    ],
    exceptionHandlers: [
        new (winston.transports.Console)({ json: false, timestamp: true })
    ],
    exitOnError: false
});


module.exports = logger;