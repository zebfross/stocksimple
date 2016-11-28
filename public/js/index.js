var model, ko;
function addCommas(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}

function formatNumber(num, numDecimals) {
    if (!num)
        num = 0;
    return addCommas(num.toFixed(numDecimals));
}

function formatCurrency(num, withDecimals) {
    var numDecimals = 0
    if (withDecimals) {
        numDecimals = 2;
    }
    if (!num)
        num = 0;
    return "$" + addCommas(num.toFixed(numDecimals));
}

function formatPercent(num, numDecimals) {
    if (!num)
        num = 0;
    num = num * 100;
    return num.toFixed(numDecimals) + "%";
}

function loading() {
    $("#loadingSpinner").show();
}

function unloading() {
    $("#loadingSpinner").hide();
}

function showError() {
    $("#errorAlert").show();
}

function hideError() {
    $("#errorAlert").hide();
}

function getQueryParameterByName(name, url) {
    if (!url) {
        url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

var url = "http://localhost:3000";

function calculateShift(value) {
    var shift = 1;
    var halfMillion = 500000;
    while (value >= halfMillion) {
        shift *= 10;
        value /= 10;
    }
    return shift;
}

function populateMetrics(ticker) {
    loading();
    hideError();
    $.getJSON(url + "/api/" + ticker, function (data) {
        data = data.data;
        var shift = calculateShift(data.metrics.price * data.metrics["SHARESWA"]);
        var newStock = new StockViewModel(model);
        newStock.ticker(data.ticker);
        newStock.pricePerShare(data.metrics.price);
        newStock.numShares(data.metrics["SHARESWA"] / shift);
        newStock.netIncome(data.metrics["NETINC"] / shift);
        newStock.dividend(data.metrics["DPS"]);
        model.searchResult(newStock);
        unloading();

    }).fail(function () {
        showError();
        unloading();
    });
}

function StockViewModel(parent, _ko) {
    if (ko == undefined)
        ko = _ko;
    var self = this;
    var container = parent;
    this.favorited = ko.observable(false);
    this.pinned = ko.observable(false);
    this.favorite = function () {
        this.favorited(true);
    };
    this.unfavorite = function () {
        this.favorited(false);
    };
    this.pin = function () {
        this.pinned(true);
        if (container.searchResult() != null && container.searchResult().ticker() == this.ticker())
            container.searchResult(null);
        container.addStock(this);
    };
    this.unpin = function () {
        this.pinned(false);
        container.removeStock(this.ticker());        
    };
    this.numShares = ko.observable();
    this.pricePerShare = ko.observable();
    this.customPricePerShare = ko.observable();
    this.resetPricePerShare = function () {
        this.customPricePerShare(this.pricePerShare());
        this.slider.slider('setValue', this.pricePerShare());
    }
    this.netIncome = ko.observable();
    this.ticker = ko.observable();
    this.dividend = ko.observable();
    this.totalDividend = ko.computed(function () {
        return this.dividend() * this.numShares();
    }, this);
    this.price = ko.computed(function () {
        return this.customPricePerShare() * this.numShares();
    }, this);
    this.monthlyCashFlow = ko.computed(function () {
        return this.netIncome() / 12;
    }, this);
    this.totalIncome = ko.computed(function () {
        return this.netIncome() + this.totalDividend();
    }, this);
    this.roi = ko.computed(function () {
        if (this.price() != 0) {
            return this.totalIncome() / this.price();
        }
        return 0;
    }, this);
    this.slider = {};
    this.pricePerShare.subscribe(function (newVal) {
        if (newVal > 0) {
            this.customPricePerShare(newVal);
        }
    }, this);
    this.initSlider = function () {
        this.slider = $('#ticker' + self.ticker()).slider({
            "id": "slider"+ self.ticker(),
            "formatter": function (val) { return "$" + val.toFixed(2); },
            "reversed": true,
            'min': self.pricePerShare() * .5,
            'max': self.pricePerShare() * 1.5,
            'value': self.pricePerShare()
        }).on("slideStop", function (newVal) {
            self.customPricePerShare(newVal.value);
        });
    };
}

var StockListViewModel = function (_ko) {
    if (ko == undefined)
        ko = _ko;
    this.searchResult = ko.observable(null);
    this.currentSelection = ko.observable(-1);
    this.stocks = ko.observableArray([]);
    this.isEmpty = ko.computed(function () {
        if (this.searchResult() == null && this.stocks().length == 0) {
            return true;
        }
        return false;
    }, this);
    this.indexOfTicker = function (ticker) {
        for (var i = 0; i < this.stocks().length; ++i) {
            if (ticker.toUpperCase() == this.stocks()[i].ticker()) {
                return i;
            }
        }
        return -1;
    };
    this.hasTicker = function (ticker) {
        var tickerUpper = ticker.toUpperCase();
        if (this.searchResult() != null && tickerUpper == this.searchResult().ticker())
            return true;
        if (this.indexOfTicker(tickerUpper) >= 0)
            return true;
        return false;
    };
    this.addStock = function (stock) {
        if (this.indexOfTicker(stock.ticker()) < 0) {
            this.stocks.splice(0, 0, stock);
        }
    };
    this.removeStock = function (ticker) {
        var index = this.indexOfTicker(ticker);
        if (index >= 0) {
            this.stocks.splice(index, 1);
        }
    };
    this.initSlider = function () {
        if (model.searchResult() != null) {
            model.searchResult().initSlider();
        }
        for (var i = 0; i < model.stocks().length; ++i) {
            model.stocks()[i].initSlider();
        }
    };
};

var $;
if ($ !== undefined) {
    $(function () {
        var host = window.location.hostname;
        if (host.indexOf(".com") >= 0) {
            url = "http://" + host;
        }
        model = new StockListViewModel();
        ko.applyBindings(model);

        $("#formTickerSearch").submit(function (event) {
            var ticker = $("#tickerInput").val();
            if (!model.hasTicker(ticker)) {
                populateMetrics(ticker);
            }
            $("#tickerInput").val("");
            return false;
        });
    });
}

var module;
if (module) {
    var functionsToExport = {
        calculateShift: calculateShift,
        getQueryParameterByName: getQueryParameterByName,
        formatCurrency: formatCurrency,
        formatNumber: formatNumber,
        StockListViewModel: StockListViewModel,
        StockViewModel: StockViewModel
    };
    module.exports = functionsToExport;
}
