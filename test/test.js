var assert = require('assert')
var app = require('../app')
var client = require('../public/js/index')
var async = require('async')

var apiKey = process.env.Quandl_Api_Key

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
        it('should return data with appropriate properties and return quickly when cached', function (done) {
            async.series([
                function (callback) {
                    app.requestPriceAndMetrics("LVS", function (err, metrics) {
                        assert(err == null, "Error should be null")
                        assert(metrics != null, "Metrics should be not null")
                        assert(metrics.hasOwnProperty("SHARESWA"), "Has SHARESWA Property")
                        assert(metrics.hasOwnProperty("DPS"), "Has DPS property")
                        assert(metrics.hasOwnProperty("NETINC"), "Has NETINC property")
                        assert(metrics.hasOwnProperty("price"), "Has price property")
                        assert(metrics["price"] > 0, "price > 0")
                        callback(err, metrics)
                    })
                },
                function (callback) {
                    //should return quickly since we just requested this ticker -- enforced by test timeout
                    app.requestPriceAndMetrics("LVS", function (err, metrics) {
                        assert(err == null, "2nd Errorshould be null")
                        callback(err, metrics)
                    })
                }], function (err, results) {
                    done()
                })
        })
    })
})

// mock knockout for mocha unit tests
mockKO = {
    observable: function (val) {
        var innerVal = val;
        var ret = function (v) {
            if (v === undefined)
                return innerVal;
            innerVal = v;
            return v;
        };
        ret.subscribe = function (foo) { }
        return ret
    },
    computed: function (func) {
        return func
    },
    observableArray: function (val) {
        var innerVal = val;
        var ret = function (v) {
            if (v === undefined)
                return innerVal;
            innerVal = v;
            return v;
        };
        ret.splice = function (start, count, item) {
            if (count > 0)
                return innerVal.splice(start, count);
            else
                return innerVal.splice(start, count, item);
        }
        return ret;
    }
}

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

    describe('StockListViewModel', function () {
        var listModel = new client.StockListViewModel(mockKO);
        var searchResult = new client.StockViewModel(listModel, mockKO);
        searchResult.ticker("LVS");

        beforeEach(function () {
            listModel.stocks([])
            listModel.searchResult(null)
        })

        it('should add stock to list if pinned and not twice if pinned twice', function () {
            assert(listModel.stocks().length == 0, "list starts out empty")
            searchResult.pin()
            assert(listModel.stocks().length == 1, "list is incremented when pinned")
            searchResult.pin()
            assert(listModel.stocks().length == 1, "list does not increment if pinned twice")
        })
        it('should remove stock from list if unpinned', function () {
            searchResult.pin()
            searchResult.unpin()
            assert(listModel.stocks().length == 0, "list is decremented when unpinned")
        })
        it('should show as empty or not', function () {
            assert(listModel.isEmpty(), "list is empty to start")

            listModel.searchResult(searchResult)
            assert(!listModel.isEmpty(), "list should now contain a search result")

            listModel.searchResult(null)
            listModel.addStock(searchResult)
            assert(!listModel.isEmpty(), "list should now contain an item in list")
        })
    })
})