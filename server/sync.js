var request = require('request');
var async = require('async');
var tickers = require('../tickers.json');
var logger = require('./logger')
var Model = require('./model')
var fs = require('fs')
var csv = require('csv')
var unzip = require('unzip')

var apiKey = process.env.Quandl_Api_Key
var baseUrlMetrics = "https://www.quandl.com/api/v3/datasets/SF0/" //AAPL_NETINC_MRY.json?api_key=
var baseUrlPrices = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?" //ticker=<your_codes>&date=<your_date>&qopts.columns=<your_columns>
//var metrics = ["NETINC","NETINCCMN","NETINCCMNUSD","SHARESWA","DPS"];
var _metrics = ["NETINC", "SHARESWA", "DPS"];

var timeBetweenRetries = 600;
var maxRetries = 10

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function requestWithRetry(url, cb, retriesLeft) {
    if (retriesLeft == undefined)
        retriesLeft = maxRetries
    if (retriesLeft <= 0)
        return cb({ error: "Exceeded number of retries" }, null, null)
    request(url, function (error, response, body) {
        if (response.statusCode != 429) {
            cb(null, response, body)
        } else {
            var waitTime = randomInt(200, 800)
            logger.debug("retrying in " + waitTime + " with " + retriesLeft + " retries left")
            setTimeout(function () {
                requestWithRetry(url, cb, retriesLeft - 1)
            }, waitTime)
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
            logger.debug(JSON.stringify(response))
            cb(error, ticker, metric, null)
        }
    }, maxRetries)
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getUrlForPriceRequest(ticker, asCsv) {
    var d = new Date();
    var day = pad(d.getDate(), 2);
    var month = pad(d.getMonth(), 2);
    var url = baseUrlPrices + "date.gte=" + d.getFullYear() + "" + month + "" + day;
    url = url + "&qopts.columns=ticker,date,close&api_key=" + apiKey;
    if (asCsv) {
        url = url + "&qopts.export=true"
    } else {
        url = url + "&ticker=" + ticker
    }
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
            logger.debug(JSON.stringify(response))
            cb(error, 0);
        }
    }, maxRetries)
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
                logger.debug("problem running code async")
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
        }/*,
        function (callback) {
            requestPrice(ticker, function (err, price) {
                callback(err, price)
            })
        }*/],
        function (err, results) {
            if (err) {
                return cb(err, null)
            }
            var metrics = results[0];
            //metrics.price = results[1];
            metrics.lastDateModified = new Date();
            metrics.ticker = ticker
            cb(null, metrics);
        })
}

function storeMetrics(ticker, metrics, done) {
    logger.debug("storing " + ticker, metrics)
    Model.Ticker.findByTicker(ticker, function (err, result) {
        var tickerObj = { ticker: ticker/*, price: metrics.price */}
        if (!err && result) {
            tickerObj = result
            /*tickerObj.price = metrics.price*/
            for (var i = 0; i < _metrics.length; ++i) {
                var metric = _metrics[i]
                if (metrics[metric])
                    tickerObj[metric] = metrics[metric]
            }
        } else {
            tickerObj = new Model.Ticker(tickerObj)
            for (var i = 0; i < _metrics.length; ++i) {
                var metric = _metrics[i]
                if (metrics[metric])
                    tickerObj[metric] = metrics[metric]
            }
        }

        tickerObj.dateFundamentalsUpdated = new Date()
        tickerObj.datePriceUpdated = new Date()
        
        tickerObj.save(function (err, result) {
            if (err || !result)
                logger.debug("error storing ticker", tickerObj)
            done()
        })
    })
}

function retrieveTickerBlock(start, blocksize, max) {
    var tasks = []
    var next = start
    if (next < tickers.length && next < start + blocksize && next < max) {
        tasks.push(function (callback) {
            logger.debug("processing " + start)
            requestPriceAndMetrics(tickers[start].Ticker, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
        tasks.push(function (callback) {
            logger.debug("processing " + (start+1))
            requestPriceAndMetrics(tickers[start + 1].Ticker, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
        tasks.push(function (callback) {
            logger.debug("processing " + (start + 3))
            requestPriceAndMetrics(tickers[start + 3].Ticker, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, 0)
                })
            })
        })
        async.parallel(tasks, function (err, results) {
            if (start + blocksize < max)
                retrieveTickerBlock(start + blocksize, blocksize, max)
        })
    } else {
        logger.debug("all done at " + start)
    }
}

//retrieveTickerBlock(876, 3, 2500)



function requestAllPrices() {
    var url = getUrlForPriceRequest(null, true);
    requestWithRetry(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var json = JSON.parse(body)
            var zipfile = json.datatable_bulk_download.file.link
            logger.debug("zipfile: " + zipfile)
            request(zipfile)
                .pipe(unzip.Parse())
                .on('entry', function (entry) {
                    var fileName = entry.path;

                    logger.debug("unzipped file " + fileName)
                    var type = entry.type; // 'Directory' or 'File'
                    var size = entry.size;
                    entry.pipe(fs.createWriteStream(__dirname + '/prices.csv'));
                      
                });
        } else {
            logger.debug("error getting all prices", response)
        }
    }, maxRetries)
}

function updateAllPrices() {
    var tickersSeen = {}
    var results = fs.readFile(__dirname + "/prices.csv", 'utf-8', function (err, data) {
        csv.parse(data, function (err, data) {
           for (var i = data.length-1; i > 0; i--) {
                var ticker = data[i][0]
                var price = data[i][2]
                if (price > 0 && !tickersSeen[ticker]) {
                    
                    tickersSeen[ticker] = true
                    Model.Ticker.update({ ticker: ticker }, { price: price }, function (err, numAffected) {
                        logger.debug("rows affected: " + JSON.stringify(numAffected))
                    })
                }
            }
        });
    })
    // read prices.csv
    // for each ticker in prices
    //   Model.Ticker.update({ticker: ticker}, {price: price}, function(err, numAffected) {

    //   })
}

//requestAllPrices()

//updateAllPrices()
var total = 0
var totalFound = 0

function fillTicker(err, i, callback) {
    Model.Ticker.findByTicker(tickers[i].Ticker, function (err, found) {
        if (!found) {
            logger.debug("missing " + tickers[i].Ticker)
            requestPriceAndMetrics(tickers[i].Ticker, function (err, metrics) {
                storeMetrics(metrics.ticker, metrics, function () {
                    callback(null, i++, fillTicker)
                })
            })
        } else {
            callback(null, i++, fillTicker)
        }
    })
}

fillTicker(null, 0, fillTicker)

//logger.debug(getUrlForPriceRequest(null, true))