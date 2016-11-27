var winston = require('winston');
var winstonMongodb = require('winston-mongodb').MongoDB;

// Connection URL
var url = "mongodb://zebfross:HKz1UIzXiyqbJbVji2o76UBd0nhu4jX1TIHSXQ67B772i86FlULGFoYhyX88H2B4ZpWhwXeO26EqZnp7lIVWVQ==@zebfross.documents.azure.com:10250/?ssl=true"

var logger = new (winston.Logger)({
    transports: [
        new (winstonMongodb)({ level: 'debug', db: url })
    ],
    exceptionHandlers: [
        new (winston.transports.Console)({ json: false, timestamp: true })
    ],
    exitOnError: false
});


module.exports = logger;