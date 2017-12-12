/**
 * @author Mikael Karlsson <i8myshoes@gmail.com>
 * @copyright 2014-2016  CSC - IT Center for Science Ltd, Finland
 * @license GNU Affero General Public License version 3 (AGPLv3)
 */

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
const api_url = "/api/3/action/timeline";

$(function () {
    /** Add hidden <input> tags #ext_timeline_start and #ext_timeline_end to search form */
    var form = $('#dataset-search');
    /** CKAN 2.1 */
    if (!form.length) {
        form = $('.search-form');
    }
    $('<input type="hidden" id="ext_timeline_start" name="ext_timeline_start" />').appendTo(form);
    $('<input type="hidden" id="ext_timeline_end" name="ext_timeline_end" />').appendTo(form);

    const timeline = $('#timeline');
    start_box = timeline.find('#start');
    end_box = timeline.find('#end');
    start_box_hidden = $('#ext_timeline_start');
    end_box_hidden = $('#ext_timeline_end');
    const q_box = timeline.find('#timeline-q');
    const fq_box = timeline.find('#timeline-fq');
    var temp_points = [];

    /** Define a new jQuery function to parse parameters from URL */
    $.urlParam = function(name) {
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null) { return null; } else { return decodeURIComponent(results[1]) || 0; }
    };

    /** Pick out relevant parameters */
    const param_start = $.urlParam('ext_timeline_start');
    const param_end = $.urlParam('ext_timeline_end');

    /** Enable human readable datetime tooltips for search boxes */
    start_box.tooltip({title: function () { if (start_box.val()) return helpers.datetimeAsZeroBased(start_box.val()) }});
    end_box.tooltip({title: function () { if (end_box.val()) return helpers.datetimeAsZeroBased(end_box.val()) }});

    /** Populate the timeline boxes, hidden fields and graph points */
    if (param_start) {
        (function (zero, unix) {
            update_search_box(start_box, zero, 'zero2dt');
            /** TODO: Hidden field should be filled by using copy_search_box */
            update_search_box(start_box_hidden, zero, 'zero');
            points.push(function (x) { return [x, x] }(unix));
        })(param_start, helpers.sToMs(helpers.zeroBasedAsUnix(param_start)));
    }
    if (param_end) {
        (function (zero, unix) {
            update_search_box(end_box, zero, 'zero2dt');
            /** TODO: Hidden field should be filled by using copy_search_box */
            update_search_box(end_box_hidden, zero, 'zero');
            points.push(function (x) { return [x, x] }(unix));
        })(param_end, helpers.sToMs(helpers.zeroBasedAsUnix(param_end)));
    }

    /** Create the graphs before showing the modal */
    $('#timelineModal').on('show', function () {
        temp_points = shallow_copy(points);

        !$('#big-chart').highcharts() && $('#big-chart').highcharts({
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

                            /** Update big-chart with new values */
                            $.post(api_url,
                                encodeURIComponent(JSON.stringify({
                                    start: parseInt(helpers.unixAsZeroBased(helpers.msToS(min))),
                                    end: parseInt(helpers.unixAsZeroBased(helpers.msToS(max))),
                                    q: q_box.val(),
                                    fq: JSON.parse(fq_box.val()),
                                })),
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
                        temp_points && temp_points.forEach(function (v) {
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
                minRange: 100 * 1000,
                title: { text: 'Time' }
            },
            yAxis: {
                title: { text: '# of datasets' },
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
                                if (temp_points.length > 1) {
                                    if (!is_redraw) { return false }
                                }

                                /** Check that mouse was clicked */
                                if (was_mouse_click) {
                                    temp_points.push([this.x, this.x]);
                                    temp_points.sort(function (a, b) {
                                        return a[0] > b[0];
                                    });
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
                                    if (temp_points.length == 1) {
                                        temp_points = [];
                                    }
                                    else if (temp_points.length == 2) {
                                        temp_points = temp_points.filter(function (p) { return p[1] != this.x }, this);
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
            tooltip: {
                xDateFormat: '%Y-%m-%d %H:%M:%S'
            },
            /** Don't show credits link */
            credits: { enabled: false },
            /** Don't show legend at bottom */
            legend: { enabled: false }
        });

        !$('#small-chart').highcharts() && $.post(api_url,
            encodeURIComponent(JSON.stringify({
                start: '*',
                end: '*',
                q: q_box.val(),
                fq: JSON.parse(fq_box.val()),
            })),
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
                        // spacingLeft: 60,
                        events: {
                            selection: function (event) {
                                if (event.xAxis) {
                                    var min = event.xAxis[0].min;
                                    var max = event.xAxis[0].max;

                                    /** Update big-chart with new values */
                                    $.post(api_url,
                                        encodeURIComponent(JSON.stringify({
                                            start: parseInt(helpers.unixAsZeroBased(helpers.msToS(min))),
                                            end: parseInt(helpers.unixAsZeroBased(helpers.msToS(max))),
                                            q: q_box.val(),
                                            fq: JSON.parse(fq_box.val()),
                                        })),
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
                        title: { text: 'Years' }
                    },
                    yAxis: {
                        title: { text: 'Histogram' },
                        labels: { enabled: false },
                        min: 0
                    },
                    series: [
                        {
                            name: 'Datasets',
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
        if ($('#big-chart').highcharts()) {
            $('#big-chart').highcharts().redraw();
            $('#big-chart').highcharts().reflow();
        }
        if ($('#small-chart').highcharts()) {
            $('#small-chart').highcharts().redraw();
            $('#small-chart').highcharts().reflow();
        }
    });

    /** Save points on clicking 'Apply' */
    $('#timelineModal').find('#apply').on('click', function () {
        points = shallow_copy(temp_points);
        if (points.length == 1) {
            update_search_box(start_box, points[0][0], 'ms');
            update_search_box(start_box_hidden, points[0][0], 'ms');
            update_search_box(end_box, '');
            update_search_box(end_box_hidden, '');
        }
        else if (points.length == 2) {
            update_search_box(start_box, points[0][0], 'ms');
            update_search_box(start_box_hidden, points[0][0], 'ms');
            update_search_box(end_box, points[1][0], 'ms');
            update_search_box(end_box_hidden, points[1][0], 'ms');
        }
    });

    /** Set onchange triggers for search boxes */
    start_box.change(start_box_hidden, copy_search_box);
    end_box.change(end_box_hidden, copy_search_box);

    /** Copy value from one search box to another, and update graph points */
    function copy_search_box(e) {
        // TODO! 'start' and 'end' values should be validated so 'start' != 'end'. New value should be set +/- 1 if equal.
        // TODO! Points should be updated first and search boxes updated after that. So that the order is correct 'start' < 'end'.
        var v = '';
        const t = $(this);
        const jquery = e.data;

        /** Check that 'this' element has a value */
        if (t.val()) {
            v = t.val();
            const new_p = helpers.sToMs(helpers.datetimeAsUnix(v));
            update_search_box(t, v, 'dt', true);
        }
        /** Check that jquery object's value isn't same, before setting */
        if (jquery.val() != v) {
            if (jquery.val()) {
                const old_p = helpers.sToMs(helpers.zeroBasedAsUnix(Number(jquery.val())));
            }
            update_search_box(jquery, v, 'dt2zero', true);
        }

        /** Update points for graph */
        if (old_p) {
            points = points.filter(function (x) { return x[0] != old_p; });
        }
        if (new_p) {
            points.push([new_p, new_p]);
        }
        points.sort(function (a, b) {
            return a[0] > b[0];
        });
    }

    /** Update a search box. Supports epoch and zero based times */
    function update_search_box(jquery, val, format, tooltip) {
        var c = '';
        var timeResolution = ['year', 'month', 'date', 'hour', 'minute', 'second'];
        if (val) {
            if (format == 'ms') {
                c = helpers.unixAsZeroBased(helpers.msToS(Number(val)));
            }
            else if (format == 's') {
                c = helpers.unixAsZeroBased(Number(val));
            }
            else if (format == 'zero') {
                c = Number(val);
            }
            else if (format == 'dt' || format == 'dt2zero') {
                var m = 0;
                if (moment.utc(val.trim(), moment.ISO_8601, true).isValid()) {
                    m = moment.utc(val.trim(), moment.ISO_8601, true);
                    /* Pick the end of year for end boxes. */
                    if (jquery.is('#end, #ext_timeline_end')) {
                        var tr = m.parsingFlags().parsedDateParts.length;
                        m.endOf(timeResolution[tr-1]);
                    }
                }
                else if (!isNaN(parseInt(val))) {
                    m = moment.utc({'year': parseInt(val)});
                    /* Pick the end of year for end boxes. */
                    if (jquery.is('#end, #ext_timeline_end')) {
                        m.endOf('year');
                    }
                }
                if (m !== 0) {
                    if (format == 'dt') {
                        c = m.format("YYYY-MM-DD HH:mm:ss")
                    } else if (format == 'dt2zero') {
                        c = helpers.datetimeAsZeroBased(m)
                    }
                }
            }
            else if (format == 'zero2dt'){
                c = helpers.zeroBasedAsDatetime(val)
            }
        }
        jquery.val(c);
        if (tooltip) { jquery.tooltip('show') }
    }
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

/** dt should be local non-UTC datetime as "2017-03-18 21:15:45" "2017-03-18 21:15" "2017-03-18" "2017-03" "2017" */
helpers.datetimeAsUnix = function (dt) {
    return moment.utc(dt).unix();
};

/** dt should be local non-UTC datetime as "2017-03-18 21:15:45" "2017-03-18 21:15" "2017-03-18" "2017-03" "2017" */
helpers.datetimeAsZeroBased = function (dt) {
    return helpers.unixAsZeroBased(helpers.datetimeAsUnix(dt));
};

/** zb should be seconds from Year 0 in UTC, as Number or String */
helpers.zeroBasedAsDatetime = function (zb) {
    return moment.unix(helpers.zeroBasedAsUnix(zb)).utc().format("YYYY-MM-DD HH:mm:ss");
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

    const step = (etime - stime) / n;

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
