from __future__ import absolute_import, with_statement, print_function, generators, nested_scopes, unicode_literals

import logging

import ckan.plugins as plugins
import ckan.logic
import ckan.lib.search
import ckan.lib.search.query
from ckan.common import _

log = logging.getLogger(__name__)


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

    :rtype: list
    '''

    log.debug('context: {c}'.format(c=context))
    log.debug('request_data: {r}'.format(r=request_data))

    #ckan.logic.check_access('timeline', context, request_data)

    start = request_data.get('start')
    end = request_data.get('end')

    if start is None:
        raise ckan.logic.ValidationError({'start': _('Missing value')})
    if end is None:
        raise ckan.logic.ValidationError({'end': _('Missing value')})

    start = int(start)
    end = int(end)
    if end <= start:
        raise ckan.logic.ValidationError({'end': _('Smaller or equal to start')})

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

    ls = sorted(list(ls))
    # log.debug('ls: {l}'.format(l=ls))

    solr = ckan.lib.search.make_connection()

    rl = []
    for s, e, m in ls:
        r = solr.select('extras_TempCoverageBegin:[* TO {e}] AND extras_TempCoverageEnd:[{s} TO *]'.format(s=s, e=e),
                        fields=['id'],
                        rows=0)
        rl.append((s, e, m, r._numFound))

    solr.close()

    return rl
