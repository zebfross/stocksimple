var assert = require('assert')
var app = require('../app')
var client = require('../js/index')

var apiKey = "sWULk4ELh-ZE_RQDStSw"

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

describe('App', function () {
    describe('validateTicker', function () {
        it('should return true for tickers that exist and false for tickers that dont', function () {
            assert.equal(app.validateTicker('MSFT'), true, "ticker MSFT")
            assert.equal(app.validateTicker('bogus'), false, "ticker bogus")
            assert.equal(app.validateTicker('APOL'), true, "ticker APOL")
            assert.equal(app.validateTicker('aapl'), true, "ticker aapl")
        })
    })
    describe('getUrlForPriceRequest', function () {
        it('should create correct url for LVS', function () {
            var d = new Date()
            var expectedUrl = "https://www.quandl.com/api/v3/datatables/WIKI/PRICES.json?ticker=LVS&date.gte="
            expectedUrl += d.getFullYear() + "" + pad(d.getMonth(), 2) + "" + pad(d.getDate(), 2) + "&qopts.columns=ticker,date,close&api_key=" + apiKey
            assert.equal(app.getUrlForPriceRequest("LVS"), expectedUrl)
        })
    })
    describe('requestPriceAndMetrics', function () {
        this.timeout(5000)
        it('should return data with appropriate properties', function (done) {
            app.requestPriceAndMetrics("LVS", function (metrics) {
                assert(metrics != null)
                assert(metrics.hasOwnProperty("SHARESWA"))
                assert(metrics.hasOwnProperty("DPS"))
                assert(metrics.hasOwnProperty("NETINC"))
                assert(metrics.hasOwnProperty("price"))
                done()
            })
        })
    })
})

describe('Client', function () {
    describe('calculateShift', function () {
        it('should calculate a reasonable shift', function () {
            var tenMillion = 10000000
            assert.equal(client.calculateShift(tenMillion), 100)
            var tenBillion = 10000000000
            assert.equal(client.calculateShift(tenBillion), 100000)
        })
    })
    describe('formatCurrency', function () {
        it('should format currency without decimals', function () {
            assert.equal(client.formatCurrency(2536335.23), "$2,536,335")
            assert.equal(client.formatCurrency(923526336.2336), "$923,526,336")
        })
        it('should format currency with decimals', function () {
            assert.equal(client.formatCurrency(2536335.23, true), "$2,536,335.23")
            assert.equal(client.formatCurrency(923526336.4536, true), "$923,526,336.45")
        })
    })
})