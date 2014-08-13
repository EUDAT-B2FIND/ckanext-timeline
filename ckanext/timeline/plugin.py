import logging

import ckan.plugins as plugins
import ckan.logic
from ckan.common import _

log = logging.getLogger(__name__)


class TimelineAPIPlugin(plugins.SingletonPlugin):
    plugins.implements(plugins.interfaces.IActions, inherit=True)

    def get_actions(self):
        return {"timeline": timeline}

@ckan.logic.side_effect_free
def timeline(context, request_data):
    '''
    Return a list of points for a timeline plot

    :param start: the start point in time
    :type start: int
    :param end: the end point in time
    :type end: int

    :rtype: dictionary
    '''

    log.debug("context: {}".format(context))
    log.debug("request_data: {}".format(request_data))

    #ckan.logic.check_access("timeline", context, request_data)

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
    log.debug("delta: {}".format(delta))

    interval = delta / 100
    log.debug("interval: {}".format(interval))

    ls = set()
    for a in range(100):
        ls.add((int(start + interval * a), int(start + interval * (a + 1))))

    if len(ls) != 100:
        log.warning('{} not 100 elements'.format(len(ls)))

    ls = sorted(list(ls))
    log.debug("ls: {}".format(ls))

    return ls
