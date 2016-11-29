var express = require('express')
var session = require('express-session')
var app = express()
var request = require('request');
var async = require('async');
var tickers = require('./tickers.json');
var logger = require('./server/logger')
var passport = require('./server/auth');
var Model = require('./server/model')
var mustacheExpress = require('mustache-express');

var cache = {}
var expireCacheInMs = 24*60*60*1000
var apiKey = "sWULk4ELh-ZE_RQDStSw"
var baseUrlMetrics = "https://www.quandl.com/api/v3/datasets/SF0/" //AAPL_NETINC_MRY.json?api_key=
var baseUrlPrices = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?" //ticker=<your_codes>&date=<your_date>&qopts.columns=<your_columns>
//var metrics = ["NETINC","NETINCCMN","NETINCCMNUSD","SHARESWA","DPS"];
var metrics = ["NETINC", "SHARESWA", "DPS"];

var timeBetweenRetries = 200;
var maxRetries = 3

function requestWithRetry(url, cb, retriesLeft) {
    if (retriesLeft == undefined)
        retriesLeft = maxRetries
    request(url, function (error, response, body) {
        if (response.statusCode != 429) {
            cb(null, response, body)
        } else {
            logger.warn("retrying in " + timeBetweenRetries)
            setTimeout(function () {
                requestWithRetry(url, cb, retriesLeft-1)
            }, timeBetweenRetries)
        }
    })
}

function requestMetric(ticker, metric, cb) {
    var url = baseUrlMetrics + ticker + "_" + metric + "_MRY.json?api_key=" + apiKey
    requestWithRetry(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var data = JSON.parse(body);
            cb(null, ticker, metric, data.dataset.data[0][1])
        } else {
            logger.error(JSON.stringify(response))
            cb(error, ticker, metric, null)
        }
    })
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getUrlForPriceRequest(ticker) {
    var d = new Date();
    var day = pad(d.getDate(), 2);
    var month = pad(d.getMonth(), 2);
    var url = baseUrlPrices + "ticker=" + ticker + "&date.gte=" + d.getFullYear() + "" + month + "" + day;
    url = url + "&qopts.columns=ticker,date,close&api_key=" + apiKey;
    return url;
}

function requestPrice(ticker, cb) {
    var url = getUrlForPriceRequest(ticker);
    requestWithRetry(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var data = JSON.parse(body);
            var prices = data.datatable.data;

            cb(null, prices[prices.length - 1][2]);
        } else {
            logger.error(JSON.stringify(response))
            cb(error, 0);
        }
    })
}

function requestAllMetrics(ticker, cb) {
  var metricValues = {};
  async.each(metrics, 
    function(metric, callback) {
      requestMetric(ticker, metric, function(e, t, m, val) {
        metricValues[m] = val;
        callback(e);
      })
    },
    function(err) {
      if(err) {
        logger.error("problem running code async")
        return cb(err)
      }
      return cb(null, metricValues)
    })
}

function binarySearch(ar, el, compare_fn) {
    var m = 0;
    var n = ar.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = compare_fn(el, ar[k]);
        if (cmp > 0) {
            m = k + 1;
        } else if (cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return -m - 1;
}

function validateTicker(ticker) {
    var found = binarySearch(tickers, { "Ticker": ticker }, function (a, b) {
        if (a.Ticker.toLowerCase() > b.Ticker.toLowerCase())
            return 1;
        else if (a.Ticker.toLowerCase() < b.Ticker.toLowerCase()) {
            return -1;
        } else {
            return 0;
        }
    });
    return found >= 0;
}

function requestPriceAndMetrics(ticker, cb) {
    if (cache[ticker]) {
        var hasExpired = (new Date().getTime() - cache[ticker].lastDateModified.getTime()) > expireCacheInMs
        if (!hasExpired) {
            return cb(null, cache[ticker])
        }
        delete cache[ticker]
    }
    logger.profile("perf_get_api_ticker")
    async.parallel([
        function (callback) {
            requestAllMetrics(ticker, function (err, metrics) {
                callback(err, metrics);
            })
        },
        function (callback) {
            requestPrice(ticker, function (err, price) {
                callback(err, price)
            })
        }],
        function (err, results) {
            logger.profile("perf_get_api_ticker")
            if (err) {
                return cb(err, null)
            }
            var metrics = results[0];
            metrics.price = results[1];
            metrics.lastDateModified = new Date();
            cache[ticker] = metrics;
            cb(null, metrics);
        })
}

app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: 'Some Super Secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache')
app.set('views', './views')

app.get('/', function (req, res) {
    res.render('index.mustache', { user: req.user })
})

app.get('/auth/google',
    passport.authenticate('google', { scope: 'profile' }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    function (req, res) {
        res.redirect('/');
    });

app.get('/auth/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    function (req, res) {
        res.redirect('/');
    });

app.get('/api/:ticker', function (req, res) {
    if (!validateTicker(req.params.ticker)) {
        logger.warn("Ticker not valid: " + req.params.ticker)
        res.status(400).send(JSON.stringify({"error": "Ticker symbol does not exist"}));
    } else {
        var tickerUpper = req.params.ticker.toUpperCase();
        logger.debug("Search for ticker " + tickerUpper)
        requestPriceAndMetrics(tickerUpper, function (err, metrics) {
            if (err) {
                logger.error("Server error for ticker " + tickerUpper, err)
                return res.status(500).send(JSON.stringify({ "error": err }))
            }
            var result = { "data": { "ticker": tickerUpper, "metrics": metrics } };
            res.send(JSON.stringify(result))
        });
    }
})

app.get('/api/users/:id', function (req, res) {
    Model.User.findOne({ identifier: req.params.identifier }, function (err, usr) {
        res.send(JSON.stringify(usr))
    })
})

app.put('/api/favorite/:ticker', function (req, res) {
    if (!req.user) {
        return res.status(401).send("Unauthorized")
    } else {
        req.user.addFavorite(req.params.ticker)
        res.send("OK")
    }
})

app.put('/api/unfavorite/:ticker', function (req, res) {
    if (!req.user) {
        return res.status(401).send("Unauthorized")
    } else {
        req.user.removeFavorite(req.params.ticker)
        res.send("OK")
    }
})

module.exports.app = app
module.exports.validateTicker = validateTicker
module.exports.getUrlForPriceRequest = getUrlForPriceRequest
module.exports.requestPriceAndMetrics = requestPriceAndMetrics
