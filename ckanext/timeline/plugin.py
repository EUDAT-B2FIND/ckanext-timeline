'''
:author: Mikael Karlsson <i8myshoes@gmail.com>
:copyright: 2014-2016  CSC - IT Center for Science Ltd, Finland
:license: GNU Affero General Public License version 3 (AGPLv3)
'''

from __future__ import absolute_import, with_statement, print_function, generators, nested_scopes, division
# from __future__ import unicode_literals  # Causes template error

import logging
import threading
import multiprocessing
import re
import json
from contextlib import closing

import ckan.plugins as plugins
import ckan.logic
import ckan.lib.search
import ckan.plugins.toolkit as toolkit
from ckan.common import _, c

log = logging.getLogger(__name__)

START_FIELD = 'extras_TempCoverageBegin'
END_FIELD = 'extras_TempCoverageEnd'
QUERY = '{sf}:[* TO {e}] AND {ef}:[{s} TO *]'
RANGES = 100


class TimelinePlugin(plugins.SingletonPlugin):
    '''
    Timeline plugin class that extends CKAN's functionality
    '''

    plugins.implements(plugins.interfaces.IActions, inherit=True)
    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.IPackageController, inherit=True)

    def update_config(self, config):
        '''
        Adds template and static directories to config
        '''
        toolkit.add_template_directory(config, 'templates')
        toolkit.add_resource('fanstatic', 'ckanext-timeline')

    def before_search(self, search_params):
        '''
        Adds start and end point coming from timeline to 'fq'
        '''
        log.debug('search_params: {0}'.format(search_params))
        extras = search_params.get('extras')
        log.debug('extras: {0}'.format(extras))
        if not extras:
            # There are no extras in the search params, so do nothing.
            return search_params

        start_point = extras.get('ext_timeline_start')
        log.debug('start_point: {0}'.format(start_point))

        end_point = extras.get('ext_timeline_end')
        log.debug('end_point: {0}'.format(end_point))

        # log.debug('c: {0}'.format(c))

        if not start_point and not end_point:
            # The user didn't select either a start and/or end date, so do nothing.
            return search_params
        if not start_point:
            start_point = '*'
        if not end_point:
            end_point = '*'

        # Add a time-range query with the selected start and/or end points into the Solr facet queries.
        fq = search_params.get('fq', '')
        log.debug("fq: {0}".format(fq))
        log.debug('fq is {0}'.format(type(fq)))
        assert isinstance(fq, basestring)
        fq = '{fq} +{q}'.format(fq=fq, q=QUERY).format(s=start_point, e=end_point, sf=START_FIELD, ef=END_FIELD)
        log.debug("fq: {0}".format(fq))
        search_params['fq'] = fq
        log.debug("search_params: {0}".format(search_params))

        return search_params

    def after_search(self, search_results, search_params):
        '''
        Exports Solr 'q' and 'fq' to the context so the timeline can use them
        '''

        # log.debug("search_results: {0}".format(search_results))
        log.debug("search_params: {0}".format(search_params))
        # log.debug('c: {0}'.format(c))
        c.timeline_q = search_params.get('q', '')
        c.timeline_fq = json.dumps(search_params.get('fq', []))
        log.debug('c: {0}'.format(c))

        return search_results

    def get_actions(self):
        return {'timeline': timeline}


@ckan.logic.side_effect_free
def timeline(context, request_data):
    '''
    Returns a list of points for a timeline plot

    :param start: the start point in time
    :type start: int
    :param end: the end point in time
    :type end: int
    :param method: the way to execute the queries
    :type method: str
    :param q: the query to use
    :type q: str
    :param fq: the facet query to use
    :type fq: str

    :rtype: list[int, int, int, int]
    '''

    # log.debug('context: {c}'.format(c=context))
    # log.debug('request_data: {r}'.format(r=request_data))
    # log.debug('c: {0}'.format(c))

    # ckan.logic.check_access('timeline', context, request_data)

    start = request_data.get('start')
    end = request_data.get('end')
    method = request_data.get('method', 't')
    q = request_data.get('q', '*:*')
    fq = request_data.get('fq', [])
    log.debug('q: "{0}"'.format(q))
    log.debug('fq: {0}'.format(fq))
    log.debug('fq is {0}'.format(type(fq)))
    assert isinstance(fq, list)

    # Validate values
    if start is None:
        raise ckan.logic.ValidationError({'start': _('Missing value')})
    if end is None:
        raise ckan.logic.ValidationError({'end': _('Missing value')})
    if method not in ('s', 'p', 't'):
        raise ckan.logic.ValidationError({'method': _('Wrong value')})

    # Remove existing timeline parameters from 'fq'
    t_fq = fq.pop([i for i, x in enumerate(fq) if START_FIELD in x or END_FIELD in x or "dataset_type:dataset" in x][0])
    log.debug('t_fq: "{0}"'.format(t_fq))
    # TODO! This should be made more dynamic by using QUERY as template for RE
    t_fq = re.sub(r' +\+{sf}:\[\* TO (\*|\d+)\] AND {ef}:\[(\*|\d+) TO \*\]'.format(sf=START_FIELD, ef=END_FIELD), '', t_fq)
    log.debug('t_fq: "{0}"'.format(t_fq))
    fq.append(t_fq)

    # Handle open/'*' start and end points
    if start == '*':
        try:
            with closing(ckan.lib.search.make_connection()) as con:
                start = con.query(q,
                                  fq=fq + ['{f}:[* TO *]'.format(f=START_FIELD)],
                                  fields=['id', '{f}'.format(f=START_FIELD)],
                                  sort=['{f} asc'.format(f=START_FIELD)],
                                  rows=1).results[0][START_FIELD]
        except Exception as e:
            log.debug(e)
            raise ckan.logic.ValidationError({'start': _('Could not find start value from Solr')})
        log.debug('start: {0}'.format(start))
    if end == '*':
        try:
            with closing(ckan.lib.search.make_connection()) as con:
                end = con.query(q,
                                fq=fq + ['{f}:[* TO *]'.format(f=END_FIELD)],
                                fields=['id', '{f}'.format(f=END_FIELD)],
                                sort=['{f} desc'.format(f=END_FIELD)],
                                rows=1).results[0][END_FIELD]
        except Exception as e:
            log.debug(e)
            raise ckan.logic.ValidationError({'end': _('Could not find end value from Solr')})
        log.debug('end: {0}'.format(end))

    # Convert to ints
    start = int(start)
    end = int(end)
    assume(start, int)
    assume(end, int)

    # Verify 'end' larger than 'start'
    if end <= start:
        raise ckan.logic.ValidationError({'end': _('Smaller or equal to start')})
    # log.debug('start: {0}'.format(start))
    # log.debug('end: {0}'.format(end))

    delta = end - start
    # log.debug('delta: {d}'.format(d=delta))
    assume(delta, int)

    interval = delta / RANGES
    # log.debug('interval: {i}'.format(i=interval))
    assume(interval, float)

    # Expand amount of ranges to RANGES
    if interval < 1:
        interval = 1.0
        log.debug('new interval: {i}'.format(i=interval))
        assume(interval, float)
        start -= (RANGES - delta) // 2
        assume(start, int)

    # Use a set for tuple uniqueness
    ls = set()

    # Create the ranges
    for a in range(RANGES):
        s = int(start + interval * a)
        e = int(start + interval * (a + 1))
        m = (s + e) // 2
        assume(s, int) and assume(e, int) and assume(m, int)

        # Make sure 's' and 'e' are not equal
        if s != e:
            ls.add((s, e, m))

    if len(ls) != RANGES:
        log.warning('{l} not {r} elements'.format(l=len(ls), r=RANGES))

    # Convert 'ls' to a list, because of JSON
    ls = list(ls)
    # log.debug('ls: {l}'.format(l=ls))

    # Make requests
    if method == 't':
        log.debug('Method: threading')
        # TODO: Would collections.deque be faster and/or thread-safer?
        rl = []
        t = [threading.Thread(target=lambda st, en, md: rl.append(ps((st, en, md, q, fq))), args=l) for l in ls]
        [x.start() for x in t]
        [x.join() for x in t]
    elif method == 'p':
        log.debug('Method: multiprocessing')
        rl = multiprocessing.Pool(multiprocessing.cpu_count()).map(ps, [tcons(a, (q, fq)) for a in ls])
    elif method == 's':
        log.debug('Method: sequential')
        rl = [ps(tcons(l, (q, fq))) for l in ls]

    # Sort the list for readability
    return sorted(rl)


def ps(t):
    '''
    Makes a request to Solr and returns the result

    :param t: Tuple containing "start", "end", "mean", "q" and "fq" values
    :type t: (int, int, int, str, [str])
    :rtype: (int, int, int, int)
    '''
    s, e, m, q, fq = t
    assume(s, int) and assume(e, int) and assume(m, int)
    with closing(ckan.lib.search.make_connection()) as solr:
        n = solr.query(q,
                       fq=fq + ['{0}'.format(QUERY.format(s=s, e=e, sf=START_FIELD, ef=END_FIELD))],
                       fields=['id'],
                       rows=0)
    assume(n._numFound, long)
    found = int(n._numFound)
    assume(found, int)

    return s, e, m, found


def assume(var, instance):
    assert isinstance(var, instance), type(var)
    return True


def tcons(*args):
    '''
    Tuple cons. Chains together iterables and returns as tuple
    '''
    from itertools import chain
    return tuple(chain(*args))
