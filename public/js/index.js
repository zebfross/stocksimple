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
var slider;

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
        slider.slider('setValue', data.metrics.price);

        model.ticker(ticker);
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
    this.numShares = ko.observable();
    this.pricePerShare = ko.observable();
    this.netIncome = ko.observable();
    this.ticker = ko.observable();
    this.dividend = ko.observable();
    this.totalDividend = ko.computed(function () {
        return this.dividend() * this.numShares();
    }, this);
    this.price = ko.computed(function () {
        return this.pricePerShare() * this.numShares();
    }, this);
    this.monthlyCashFlow = ko.computed(function () {
        return this.netIncome() / 12;
    }, this);
    this.roi = ko.computed(function () {
        if (this.price() != 0) {
            return this.netIncome() / this.price();
        }
    }, this);
}

var $;
if ($ !== undefined) {
    $(function () {
        slider = $('#ticker1').slider({
            "formatter": function (val) { return "$" + val.toFixed(2); },
            "reversed": true
        });
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
