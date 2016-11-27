var express = require('express')
var app = express()
var request = require('request');
var async = require('async');
var tickers = require('./tickers.json');

var cache = {}
var apiKey = "sWULk4ELh-ZE_RQDStSw"
var baseUrlMetrics = "https://www.quandl.com/api/v3/datasets/SF0/" //AAPL_NETINC_MRY.json?api_key=
var baseUrlPrices = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?" //ticker=<your_codes>&date=<your_date>&qopts.columns=<your_columns>
//var metrics = ["NETINC","NETINCCMN","NETINCCMNUSD","SHARESWA","DPS"];
var metrics = ["NETINC", "SHARESWA", "DPS"];

function requestMetric(ticker, metric, cb) {
    var url = baseUrlMetrics + ticker + "_" + metric + "_MRY.json?api_key=" + apiKey
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var data = JSON.parse(body);
        cb(ticker, metric, data.dataset.data[0][1])
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
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var data = JSON.parse(body);
            var prices = data.datatable.data;
            
            cb(prices[prices.length - 1][2]);
        }
    })
}

function requestAllMetrics(ticker, cb) {
    if (cache[ticker])
        return cb(cache[ticker])
  var metricValues = {};
  async.each(metrics, 
    function(metric, callback) {
      requestMetric(ticker, metric, function(t, m, val) {
        metricValues[m] = val;
        callback();
      })
    },
    function(err) {
      if(err) {
        console.log("problem running code async")
        return cb(err)
      }
      cache[ticker] = metricValues
      return cb(metricValues)
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
        return cb(cache[ticker])
    }
    async.parallel([
        function (callback) {
            requestAllMetrics(ticker, function (metrics) {
                callback(null, metrics);
            })
        },
        function (callback) {
            requestPrice(ticker, function (price) {
                callback(null, price)
            })
        }],
        function (err, results) {
            var metrics = results[0];
            metrics.price = results[1];
            cache[ticker] = metrics;
            cb(metrics);
        })
}

app.use(express.static(__dirname + '/public'));

app.get('/api/:ticker', function (req, res) {
    res.append("Access-Control-Allow-Origin", "*");
    if (!validateTicker(req.params.ticker)) {
        res.status(400).send(JSON.stringify({"error": "Ticker symbol does not exist"}));
    } else {
        var tickerUpper = req.params.ticker.toUpperCase();
        requestPriceAndMetrics(tickerUpper, function (metrics) {
            var result = { "data": { "ticker": tickerUpper, "metrics": metrics } };
            res.send(JSON.stringify(result))
        });
    }
})

module.exports.app = app
module.exports.validateTicker = validateTicker
module.exports.getUrlForPriceRequest = getUrlForPriceRequest
module.exports.requestPriceAndMetrics = requestPriceAndMetrics
