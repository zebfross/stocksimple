var express = require('express')
var app = express()
var request = require('request');
var async = require('async');

var cache = {}
var apiKey = "sWULk4ELh-ZE_RQDStSw"
var baseUrl = "https://www.quandl.com/api/v3/datasets/SF0/" //AAPL_NETINC_MRY.json?api_key=
//var metrics = ["NETINC","NETINCCMN","NETINCCMNUSD","SHARESWA","DPS"];
var metrics = ["NETINC", "SHARESWA", "DPS"];

function requestMetric(ticker, metric, cb) {
    var url = baseUrl + ticker + "_" + metric + "_MRY.json?api_key=" + apiKey
    console.log("requesting url: " + url);
    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var data = JSON.parse(body);
        cb(ticker, metric, data.dataset.data[0][1])
      }
    })
}

function requestAllMetrics(ticker, cb) {
  if(cache[ticker]) {
    return cb(cache[ticker])
  }
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

app.get('/:ticker', function (req, res) {
    res.append("Access-Control-Allow-Origin", "*");
    requestAllMetrics(req.params.ticker, function(metrics) {
      var result = {"data": {"ticker": req.params.ticker, "metrics": metrics}};
      res.send(JSON.stringify(result))
    })
})

app.listen(8005, function () {
  console.log('Example app listening on port 3000!')
})
