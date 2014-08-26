from __future__ import absolute_import, with_statement, print_function, generators, nested_scopes, unicode_literals

import logging
import threading
import multiprocessing
from urllib2 import urlopen

import ckan.plugins as plugins
import ckan.logic
import ckan.lib.search
import ckan.lib.search.query
from ckan.common import _

log = logging.getLogger(__name__)

HOST = 'http://localhost:8983/solr'
QUERY = 'extras_TempCoverageBegin:[* TO {e}] AND extras_TempCoverageEnd:[{s} TO *]'
START_FIELD = 'extras_TempCoverageBegin'
END_FIELD = 'extras_TempCoverageEnd'


class TimelineAPIPlugin(plugins.SingletonPlugin):
    plugins.implements(plugins.interfaces.IActions, inherit=True)

    def get_actions(self):
        return {'timeline': timeline}

@ckan.logic.side_effect_free
def timeline(context, request_data):
    '''
    Return a list of points for a timeline plot

    :param start: the start point in time
    :type start: int
    :param end: the end point in time
    :type end: int
    :param method: the way to execute the queries
    :type method: str

    :rtype: list
    '''

    log.debug('context: {c}'.format(c=context))
    log.debug('request_data: {r}'.format(r=request_data))

    #ckan.logic.check_access('timeline', context, request_data)

    start = request_data.get('start')
    end = request_data.get('end')
    method = request_data.get('method', 't')

    if start is None:
        raise ckan.logic.ValidationError({'start': _('Missing value')})
    if end is None:
        raise ckan.logic.ValidationError({'end': _('Missing value')})
    if method not in ('s', 'p', 't'):
        raise ckan.logic.ValidationError({'method': _('Wrong value')})
    if start == '*':
        try:
            c = ckan.lib.search.make_connection()
            start = c.select('*:*',
                             fields=['id', '{f}'.format(f=START_FIELD)],
                             sort=['{f} asc'.format(f=START_FIELD)],
                             rows=1).results[0][START_FIELD]
        except:
            raise ckan.logic.ValidationError({'start': _('Could not find start value from Solr')})
        finally:
            c.close()
    if end == '*':
        try:
            c = ckan.lib.search.make_connection()
            end = c.select('*:*',
                           fields=['id', '{f}'.format(f=END_FIELD)],
                           sort=['{f} desc'.format(f=END_FIELD)],
                           rows=1).results[0][END_FIELD]
        except:
            raise ckan.logic.ValidationError({'end': _('Could not find end value from Solr')})
        finally:
            c.close()

    start = int(start)
    end = int(end)
    if end <= start:
        raise ckan.logic.ValidationError({'end': _('Smaller or equal to start')})
    log.debug('start: {}'.format(start))
    log.debug('end: {}'.format(end))

    delta = float(end - start)
    log.debug('delta: {d}'.format(d=delta))

    interval = delta / 100
    log.debug('interval: {i}'.format(i=interval))

    ls = set()
    for a in range(100):
        s = int(start + interval * a)
        e = int(start + interval * (a + 1))
        m = (s + e) / 2
        if s != e:
            ls.add((s, e, m))

    if len(ls) != 100:
        log.warning('{l} not 100 elements'.format(l=len(ls)))

    ls = list(ls)
    # log.debug('ls: {l}'.format(l=ls))


    if method == 't':
        log.debug('Method: threading')
        # TODO: Would collections.deque be faster and/or thread-safer?
        rl = []
        t = [threading.Thread(target=lambda st, en, md: rl.append(ps((st, en, md))), args=l) for l in ls]
        [x.start() for x in t]
        [x.join() for x in t]
    elif method == 'p':
        log.debug('Method: multiprocessing')
        rl = multiprocessing.Pool(multiprocessing.cpu_count()).map(ps, ls)
    elif method == 's':
        log.debug('Method: sequential')
        rl = [ps(l) for l in ls]

    return sorted(rl)


def ps((s, e, m)):
    solr = ckan.lib.search.make_connection()
    n = solr.select(QUERY.format(s=s, e=e),
                    fields=['id'],
                    rows=0)
    solr.close()
    return s, e, m, n._numFound
