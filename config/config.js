var config = {
    debug: {
        host: "http://localhost:3000",
        db: "mongodb://zebfross:HKz1UIzXiyqbJbVji2o76UBd0nhu4jX1TIHSXQ67B772i86FlULGFoYhyX88H2B4ZpWhwXeO26EqZnp7lIVWVQ==@zebfross.documents.azure.com:10250/?ssl=true",
        db_prefix: "test_",
        consoleLog: true
    },
    production: {
        host: "http://stocks.zebfross.com",
        db: "mongodb://zebfross:HKz1UIzXiyqbJbVji2o76UBd0nhu4jX1TIHSXQ67B772i86FlULGFoYhyX88H2B4ZpWhwXeO26EqZnp7lIVWVQ==@zebfross.documents.azure.com:10250/?ssl=true",
        db_prefix: "",
        consoleLog: false
    }
}

module.exports = function () {
    if (process.env.environment == "prod") {
        return config.production
    } else {
        return config.debug
    }
}