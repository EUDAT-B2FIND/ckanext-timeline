const samples = 100;

/** Contains the data for selected start and end points */
var start_point;
var end_point;

/** Contains the x values for selected points [real, current-approximate] */
var points = [];

/** Text boxes for search interface */
var start_box;
var end_box;
var start_box_hidden;
var end_box_hidden;

/** Indicates whether mouse was clicked */
var was_mouse_click = false;

/** Indicates whether we are redrawing */
var is_redraw = false;

/** Contains the data for the big chart */
var big_chart_data;

/** Contains the data for the small chart */
var small_chart_data;

/** Contains the URL for the CKAN API */
const api_url = "http://eudat6a.dkrz.de/api/3/action/timeline";

$(function () {
    /** Add hidden <input> tags #ext_timeline_start and #ext_timeline_end to search form */
    var form = $('#dataset-search');
    /** CKAN 2.1 */
    if (!form.length) {
        form = $('.search-form');
    }
    $('<input type="hidden" id="ext_timeline_start" name="ext_timeline_start" />').appendTo(form);
    $('<input type="hidden" id="ext_timeline_end" name="ext_timeline_end" />').appendTo(form);

    start_box = $('#timeline #start');
    end_box = $('#timeline #end');
    start_box_hidden = $('#ext_timeline_start');
    end_box_hidden = $('#ext_timeline_end');

    /** Define a new jQuery function to parse parameters from URL */
    $.urlParam = function(name) {
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null) { return null; } else { return decodeURIComponent(results[1]) || 0; }
    };

    /** Pick out relevant parameters */
    const param_start = $.urlParam('ext_timeline_start');
    const param_end = $.urlParam('ext_timeline_end');

    /** Populate the timeline boxes and hidden fields */
    if (param_start) {
        start_box.val(param_start);
        start_box_hidden.val(param_start);
    }
    if (param_end) {
        end_box.val(param_end);
        end_box_hidden.val(param_end);
    }

    /** Create the graphs before showing the modal */
    $('#timelineModal').on('show', function () {
        $('#big-chart').highcharts({
            chart: {
                type: 'line',
                zoomType: 'x',
                events: {
                    selection: function (event) {
                        const chart = $('#big-chart').highcharts();
                        const series = chart.series[0];
                        if (event.xAxis) {
                            const min = event.xAxis[0].min;
                            const max = event.xAxis[0].max;
                            console.log("Big chart: ", min, max);

                            /** Update big-chart with new values */
                            $.getJSON(api_url,
                                {
                                    start: parseInt(helpers.unixAsZeroBased(helpers.msToS(min))),
                                    end: parseInt(helpers.unixAsZeroBased(helpers.msToS(max)))
                                },
                                function (data) {
                                    series.setData(
                                        data.result.map(function (x) {
                                            return [helpers.sToMs(helpers.zeroBasedAsUnix(x[2])), x[3]];
                                    }));
                            });
                        }
                        else if (event.resetSelection) {
                            /** Reset big-chart data to the selection from small-chart */
                            series.setData(shallow_copy(big_chart_data));
                        }
                        /** Disables visual zooming */
                        // event.preventDefault();
                    },
                    redraw: function (event) {
                        const chart = $('#big-chart').highcharts();
                        const series = chart.series[0];
                        is_redraw = true;

                        /** Clear selected points */
                        chart.getSelectedPoints().forEach(function (p) { p.select(false, true) });

                        /** Restore selected points if withing selected range
                         * NOTE! This approximates to the nearest point, as exact point might not exist */
                        points && points.forEach(function (v) {
                            const ext = chart.xAxis[0].getExtremes();
                            const real_point = v[0];
                            if (real_point >= ext.dataMin && real_point <= ext.dataMax) {
                                /** Find the nearest point and select it */
                                const np = nearestNumValue(series.data.map(function (p) { return p.x }), real_point);
                                series.data[np[2]].select(true, true);

                                /** Save chosen point */
                                v[1] = np[1];
                            }
                        });
                        is_redraw = false;
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
                floor: 0
            },
            series: [
                {
                    name: 'Datasets'
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
                    point: {
                        events: {
                            select: function (event) {
                                var chart = $('#big-chart').highcharts();

                                /** Prevent non-accumulate clicks */
                                if (!event.accumulate) {
                                    was_mouse_click = false;
                                    return false;
                                }

                                /** Prevent selection of more than 2 points */
                                if (points.length > 1) {
                                    if (!is_redraw) { return false }
                                }

                                /** Check that mouse was clicked */
                                if (was_mouse_click) {
                                    points.push([this.x, this.x]);
                                    points.sort(function (a, b) {
                                        return a[0] > b[0];
                                    });
                                    if (points.length == 1) {
                                        start_box.val(points[0][0]);
                                        start_box_hidden.val(points[0][0]);
                                        end_box.val('');
                                        end_box_hidden.val('');
                                    }
                                    else if (points.length == 2) {
                                        start_box.val(points[0][0]);
                                        start_box_hidden.val(points[0][0]);
                                        end_box.val(points[1][0]);
                                        end_box_hidden.val(points[1][0]);
                                    }
                                    was_mouse_click = false;
                                }
                            },
                            unselect: function (event) {
                                /** Prevent non-accumulate clicks */
                                if (!event.accumulate) {
                                    was_mouse_click = false;
                                    return false;
                                }

                                /** Check that mouse was clicked */
                                if (was_mouse_click) {
                                    /** Remove point from points */
                                    if (points.length == 1) {
                                        points = [];
                                        start_box.val('');
                                        start_box_hidden.val('');
                                        end_box.val('');
                                        end_box_hidden.val('');
                                    }
                                    else if (points.length == 2) {
                                        points = points.filter(function (p) { return p[1] != this.x }, this);
                                        start_box.val(points[0][0]);
                                        start_box_hidden.val(points[0][0]);
                                        end_box.val('');
                                        end_box_hidden.val('');
                                    }
                                    was_mouse_click = false;
                                }
                            },
                            click: function (event) {
                                was_mouse_click = true;
                            }
                        }
                    }
                }
            },
            /** Don't show credits link */
            credits: { enabled: false },
            /** Don't show legend at bottom */
            legend: { enabled: false }
        });

        $.getJSON(api_url,
            {
                start: '*',
                end: '*'
            },
            function (data) {
                small_chart_data = data.result.map(function (x) {
                    return [helpers.sToMs(helpers.zeroBasedAsUnix(x[2])), x[3]];
                });

                $('#small-chart').highcharts({
                    chart: {
                        type: 'line',
                        // type: 'area',
                        // type: 'column',
                        // type: 'spline',
                        zoomType: 'x',
                        spacingLeft: 60,
                        events: {
                            selection: function (event) {
                                if (event.xAxis) {
                                    var min = event.xAxis[0].min;
                                    var max = event.xAxis[0].max;
                                    console.log("Small chart: ", min, max);

                                    /** Update big-chart with new values */
                                    $.getJSON(api_url,
                                        {
                                            start: parseInt(helpers.unixAsZeroBased(helpers.msToS(min))),
                                            end: parseInt(helpers.unixAsZeroBased(helpers.msToS(max)))
                                        },
                                        function (data) {
                                            big_chart_data = data.result.map(function (x) {
                                                return [helpers.sToMs(helpers.zeroBasedAsUnix(x[2])), x[3]];
                                            });
                                            $('#big-chart').highcharts().series[0].setData(shallow_copy(big_chart_data));
                                    });

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
                            data: shallow_copy(small_chart_data)
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
            }
        );
    });

    /** Reflow the graphs when showing the modal */
    $('#timelineModal').on('shown', function () {
        $('#big-chart').highcharts().reflow();
        $('#small-chart').highcharts().reflow();
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
    return helpers.yearZero.unix() + Number(zb);
};

/** ux should be seconds from Year 1970 (Epoch) in UTC, as Number or String */
helpers.unixAsZeroBased = function (ux) {
    return Number(ux) - helpers.yearZero.unix();
};

/** Converts milliseconds to seconds */
helpers.msToS = function (ms) {
    return ms / 1000;
};

/** Converts seconds to milliseconds */
helpers.sToMs = function (s) {
    return s * 1000;
};

/** Generates a random integer between min and max */
helpers.getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

    return data;
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

    return data;
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
    return array.slice(0);
}

/** Find the closest numeric element value in an array. Returns the difference, element and index */
function nearestNumValue(array, value) {
    return array.map(function (n) {
        return [Math.abs(value - n), n];
    }).reduce(function (a, b, i) {
        b.push(i);
        return a[0] < b[0] ? a : b;
    });
}
