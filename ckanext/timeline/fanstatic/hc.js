$(function () {
    $('#big-chart').highcharts({
        chart: {
            type: 'line',
            zoomType: 'x',
            events: {
                selection: function (event) {
                    if (event.xAxis) {
                        console.log("Big", event.xAxis[0].min, event.xAxis[0].max);
                    }
                }
            }
        },
        title: {
            text: 'Datasets relative to time'
        },
        xAxis: {
            type: 'datetime',
            title: {
                text: 'Time'
            }
        },
        yAxis: {
            title: {
                text: 'Datasets'
            }
        },
        series: [
            {
                name: 'Datasets',
                data: helpers.generateRandomData(-100, 100)
            }
        ],
        plotOptions: {
            series: {
//                marker: { enabled: false },
                allowPointSelect: true
            }
        },
        /** Don't show credits link */
        credits: { enabled: false },
        /** Don't show legend at bottom */
        legend: { enabled: false }
    });

    $('#small-chart').highcharts({
        chart: {
            type: 'line',
            zoomType: 'x',
            spacingLeft: 60,
            events: {
                selection: function (event) {
                    if (event.xAxis) {
                        console.log("Small", event.xAxis[0].min, event.xAxis[0].max);
                        $('#big-chart').highcharts().series[0].setData(helpers.generateRandomData(-100, 100));
                    }
                    event.preventDefault()
                }
            }
        },
        title: { text: null },
        xAxis: {
            type: 'datetime',
            title: { enabled: false }
        },
        yAxis: {
            title: { enabled: false },
            labels: { enabled: false }
        },
        series: [
            {
                name: 'Datasets',
                data: helpers.generateRandomData(-300, 1000)
            }
        ],
        plotOptions: {
            series: {
                marker: { enabled: false },
                enableMouseTracking: false
            }
        },
        tooltip: { enabled: false },
        /** Don't show credits link */
        credits: { enabled: false },
        /** Don't show legend at bottom */
        legend: { enabled: false }
    });

    /** Get JSON data from CKAN API */
    $.getJSON("http://eudat6a.dkrz.de/api/timegraph?start=x&end=y", function (data) {
        options.series[0].data = data;
        var chart = new Highcharts.Chart(options);
    });
});


/** Define some helper properties and methods */
function helpers() {
}

helpers.yearZero = moment.utc([0]);
helpers.epoch = moment.utc([1970]);
helpers.second = 1;
helpers.minute = 60 * helpers.second;
helpers.hour = 60 * helpers.minute;
helpers.day = 24 * helpers.hour;
helpers.week = 7 * helpers.day;
helpers.month = 30 * helpers.day;
helpers.year = 12 * helpers.month;

/** zb should be seconds from Year 0 in UTC, as Number or String */
helpers.zeroBasedAsMoment = function (zb) {
    return moment.unix(helpers.yearZero.unix() + Number(zb))
};

/** Converts milliseconds to seconds */
helpers.msToS = function (ms) {
    return ms / 1000
};

/** Converts seconds to milliseconds */
helpers.sToMs = function (s) {
    return s * 1000
};

/** Generates a random integer between min and max */
helpers.getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
};

/** Generates some random data for diagram */
helpers.generateRandomData = function (stime, n) {
    var data = [];
    var start = moment.utc([stime]).valueOf();

    for (var i = 0; i < n; i++) {
        data.push([
            start += helpers.getRandomInt(helpers.sToMs(helpers.week), helpers.sToMs(helpers.year)),
            helpers.getRandomInt(0, 20)
        ]);
    }

    return data
};


/** Converts integer seconds into human readable format */
function convertSecondsToHuman(seconds) {
    var era;

    if (seconds < 0) {
        // Negative values = Before Christ
        era = "BC";
        seconds = Math.abs(seconds);
    } else if (seconds >= 0) {
        // Positive values = After Christ
        era = "AD";
    } else {
        return null;
    }

    function calcToHuman(rest, div, sign) {
        var t = Math.round(rest / div);
        if (t)
            return "" + t + sign;
        else
            return "";
    }

    var rest = seconds;
    var human = "";

    human += calcToHuman(rest, helpers.year, "y");
    rest = (rest % helpers.year);

    human += calcToHuman(rest, helpers.month, "m");
    rest = (rest % helpers.month);

    human += calcToHuman(rest, helpers.day, "d");
    rest = (rest % helpers.day);

    human += calcToHuman(rest, helpers.hour, "h");
    rest = (rest % helpers.hour);

    human += calcToHuman(rest, helpers.minute, "m");
    rest = (rest % helpers.minute);

    human += calcToHuman(rest, helpers.second, "s");
//    rest = (rest % helpers.second);

    return human + " " + era;
}
