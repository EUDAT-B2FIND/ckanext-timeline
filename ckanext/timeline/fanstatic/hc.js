const samples = 100;

/** Contains the data for the big chart */
var big_chart_data;

/** Contains the data for the small chart */
var small_chart_data;

/** Contains the URL for the CKAN API */
const api_url = "http://eudat6a.dkrz.de/api/3/action/timeline"

$(function () {
    $('#big-chart').highcharts({
        chart: {
            type: 'line',
            zoomType: 'x',
            events: {
                selection: function (event) {
                    if (event.xAxis) {
                        var min = event.xAxis[0].min;
                        var max = event.xAxis[0].max;
                        console.log("Big chart: ", min, max);

                        /** Update big-chart with new values */
                        $.getJSON(api_url,
                            {
                                start: parseInt(helpers.unixAsZeroBased(helpers.msToS(min))),
                                end: parseInt(helpers.unixAsZeroBased(helpers.msToS(max)))
                            },
                            function (data) {
                                $('#big-chart').highcharts().series[0].setData(
                                    data.result.map(function (x) {
                                        return [helpers.sToMs(helpers.zeroBasedAsUnix(x[2])), x[3]]
                                }));
                        });
                    }
                    else if (event.resetSelection) {
                        console.log("Reset: ", event);
                        $('#big-chart').highcharts().series[0].setData(shallow_copy(big_chart_data));
                    }
                    /** Disables visual zooming */
                    // event.preventDefault();
                }
            }
        },
        title: {
            text: 'Datasets relative to time'
        },
        xAxis: {
            type: 'datetime',
            minRange: samples * 1000,
            title: {
                text: 'Time'
            }
        },
        yAxis: {
            title: {
                text: 'Datasets'
            },
            min: 0
        },
        series: [
            {
                name: 'Datasets',
                /** Stupid random start values */
                // data: helpers.generateRandomData(-100, samples)
            }
        ],
        plotOptions: {
            series: {
                // marker: { enabled: false },
                /** Hides the line */
                // lineWidth: 0,
                allowPointSelect: true,
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
                        var min = event.xAxis[0].min;
                        var max = event.xAxis[0].max;
                        console.log("Small chart: ", min, max);

                        /** Update big-chart with new values */
                        $('#big-chart').highcharts().series[0].setData(helpers.generateRandomDataEnd(min, max, samples));

                        /** Apply mask on y-axis */
                        this.xAxis[0].removePlotBand('mask');
                        this.xAxis[0].addPlotBand({
                            id: 'mask',
                            from: min,
                            to: max,
                            color: 'rgba(0, 0, 0, 0.2)'
                        });
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
            labels: { enabled: false },
            min: 0
        },
        series: [
            {
                name: 'Datasets',
                /** Stupid random start values */
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
        // credits: { enabled: false },
        /** Don't show legend at bottom */
        legend: { enabled: false }
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
helpers.zeroBasedAsUnix = function (zb) {
    return helpers.yearZero.unix() + Number(zb)
};

/** ux should be seconds from Year 1970 (Epoch) in UTC, as Number or String */
helpers.unixAsZeroBased = function (ux) {
    return Number(ux) - helpers.yearZero.unix()
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
    var start;

    if (stime < -1000 || stime > 2500) {
        start = stime;
    } else {
        start = moment.utc([stime]).valueOf();
    }

    const min = helpers.sToMs(helpers.week);
    const max = helpers.sToMs(helpers.year);

    for (var i = 0; i < n; i++) {
        data.push([
            start += helpers.getRandomInt(min, max),
            helpers.getRandomInt(0, 20)
        ]);
    }

    return data
};

/** Generates some random data for diagram */
helpers.generateRandomDataEnd = function (stime, etime, n) {
    var data = [];

    console.log(stime, etime, n);
    const step = (etime - stime) / n;
    console.log("step = ", step);

    for (var i = 0, start = stime; i < n; i++) {
        data.push([
            start += step,
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
    // rest = (rest % helpers.second);

    return human + " " + era;
}

/** Creates a shallow copy of an array */
function shallow_copy(array) {
  return array.slice(0)
}
