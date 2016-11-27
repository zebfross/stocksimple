var model;
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

        model.ticker(data.ticker);
        model.pricePerShare(data.metrics.price);
        model.numShares(data.metrics["SHARESWA"] / shift);
        model.netIncome(data.metrics["NETINC"] / shift);
        model.dividend(data.metrics["DPS"]);

        unloading();

    }).fail(function () {
        showError();
        unloading();
    });
}

function StockViewModel() {
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
    };
    this.unpin = function () {
        this.pinned(false);
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
    this.slider;
    this.pricePerShare.subscribe(function (newVal) {
        if (newVal > 0) {
            this.customPricePerShare(newVal);
            var sliderModel = this;
            this.slider = $('#ticker1').slider({
                "formatter": function (val) { return "$" + val.toFixed(2); },
                "reversed": true,
                'min': newVal * .5,
                'max': newVal * 1.5,
                'value': newVal
            }).on("slideStop", function (newVal) {
                console.log(newVal)
                sliderModel.customPricePerShare(newVal.value);
            });
        }
    }, this);
}

var $;
if ($ !== undefined) {
    $(function () {
        var host = window.location.hostname;
        if (host.indexOf(".com") >= 0) {
            url = "http://" + host;
        }
        model = new StockViewModel();
        ko.applyBindings(model);

        $("#formTickerSearch").submit(function (event) {
            populateMetrics($("#tickerInput").val());
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
        formatNumber: formatNumber
    };
    module.exports = functionsToExport;
}
