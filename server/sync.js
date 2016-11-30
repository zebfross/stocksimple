var request = require('request');
var async = require('async');
var tickers = require('../tickers.json');
var logger = require('./logger')
var Model = require('./model')

var apiKey = process.env.Quandl_Api_Key
var baseUrlMetrics = "https://www.quandl.com/api/v3/datasets/SF0/" //AAPL_NETINC_MRY.json?api_key=
var baseUrlPrices = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?" //ticker=<your_codes>&date=<your_date>&qopts.columns=<your_columns>
//var metrics = ["NETINC","NETINCCMN","NETINCCMNUSD","SHARESWA","DPS"];
var _metrics = ["NETINC", "SHARESWA", "DPS"];

var timeBetweenRetries = 400;
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
                requestWithRetry(url, cb, retriesLeft - 1)
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
            if(prices.length > 0)
                cb(null, prices[prices.length - 1][2]);
            else
                cb(null, 0)
        } else {
            logger.error(JSON.stringify(response))
            cb(error, 0);
        }
    })
}

function requestAllMetrics(ticker, cb) {
    var metricValues = {};
    async.each(_metrics,
        function (metric, callback) {
            requestMetric(ticker, metric, function (e, t, m, val) {
                metricValues[m] = val;
                callback(e);
            })
        },
        function (err) {
            if (err) {
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

function requestPriceAndMetrics(ticker, cb) {
    logger.debug("requestPriceAndMetrics for " + ticker)
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
            if (err) {
                return cb(err, null)
            }
            var metrics = results[0];
            metrics.price = results[1];
            metrics.lastDateModified = new Date();
            cb(null, metrics);
        })
}

function storeMetrics(ticker, metrics, done) {
    Model.Ticker.findByTicker(ticker, function (err, result) {
        var tickerObj = { ticker: ticker }
        if (!err && result) {
            tickerObj = result
            for (var metric in _metrics) {
                if (metrics[metric])
                    tickerObj[metric] = metrics[metric]
            }
            logger.debug("storeMetrics", metrics)
        } else {
            var temp = { ticker: ticker }
            for (var metric in _metrics) {
                if (metrics[metric])
                    temp[metric] = metrics[metric]
            }
            logger.debug("storeMetrics", temp)
            tickerObj = new Model.Ticker(temp)
        }

        tickerObj.dateFundamentalsUpdated = new Date()
        tickerObj.datePriceUpdated = new Date()
        
        tickerObj.save(function (err, result) {
            if (err || !result)
                logger.error("error storing ticker", tickerObj)
            done()
        })
    })
}

function retrieveTickerBlock(start, blocksize, max) {
    var tasks = []
    var next = start
    if (next < tickers.length && next < start + blocksize && next <= start + max) {
        var ticker_1 = tickers[next].Ticker
        tasks.push(function (callback) {
            requestPriceAndMetrics(ticker_1, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
    }
    next += 1
    if (next < tickers.length && next < start + blocksize && next <= start + max) {
        var ticker_2 = tickers[next].Ticker
        tasks.push(function (callback) {
            requestPriceAndMetrics(ticker_2, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
    }
    next += 1
    if (next < tickers.length && next < start + blocksize && next <= start + max) {
        var ticker_3 = tickers[next].Ticker
        tasks.push(function (callback) {
            requestPriceAndMetrics(ticker_3, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
    }
    async.parallel(tasks, function (err, results) {
        if (start + blocksize < max)
            retrieveTickerBlock(start + blocksize, blocksize, max - blocksize)
    })
}

retrieveTickerBlock(0, 3, 10)
