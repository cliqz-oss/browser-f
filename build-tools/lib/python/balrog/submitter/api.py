# TODO: extend API to handle release blobs
import json
import logging
import requests
import os

CA_BUNDLE = os.path.join(os.path.dirname(__file__),
                         '../../../../misc/certs/ca-bundle.crt')


def is_csrf_token_expired(token):
    from datetime import datetime
    expiry = token.split('##')[0]
    if expiry <= datetime.now().strftime('%Y%m%d%H%M%S'):
        return True
    return False


class API(object):
    """A class that knows how to make requests to a Balrog server, including
       pre-retrieving CSRF tokens and data versions.

       url_template: The URL to submit to when request() is called. Standard
                     Python string interpolation can be used here in
                     combination with the url_template_vars argument to
                     request().
       prerequest_url_template: Before submitting the real request, a HEAD
                                operation will be done on this URL. If the
                                HEAD request succeeds, it is expected that
                                there will be X-CSRF-Token and X-Data-Version
                                headers in the response. If the HEAD request
                                results in a 404, another HEAD request to
                                /csrf_token will be made in attempt to get a
                                CSRF Token. This URL can use string
                                interpolation the same way url_template can.
                                In some cases this may be the same as the
                                url_template.
    """
    verify = False
    auth = None
    url_template = None
    prerequest_url_template = None

    def __init__(self, api_root='https://aus4-admin-dev.allizom.org/api',
                 auth=None, ca_certs=CA_BUNDLE, timeout=60, raise_exceptions=True):
        """ Creates an API object which wraps REST API of Balrog server.

        api_root: API root URL of balrog server
        auth    : a tuple of (username, password) or None
        ca_certs: CA bundle. It follows python-requests `verify' usage.
                  If set to False, no SSL verification is done.
                  If set to True, it tries to load a CA bundle from certifi
                  module.
                  If set to string, puthon-requests uses it as a pth to path to
                  CA bundle.
        timeout : request timeout
        raise_exceptions: Sets danger_mode parameter of python-requests config
                          which controls excpetion raising.
        """
        self.api_root = api_root.rstrip('/')
        self.verify = ca_certs
        assert isinstance(auth, tuple) or auth == None, \
            "auth should be set to tuple or None"
        self.auth = auth
        self.timeout = timeout
        self.config = dict(danger_mode=raise_exceptions)
        self.session = requests.session()
        self.csrf_token = None

    def request(self, data=None, method='GET', url_template_vars={}):
        url = self.api_root + self.url_template % url_template_vars
        prerequest_url = self.api_root + \
            self.prerequest_url_template % url_template_vars
        # If we'll be modifying things, do a GET first to get a CSRF token
        # and possibly a data_version.
        if method != 'GET' and method != 'HEAD':
            # Use the URL of the resource we're going to modify first,
            # because we'll need a CSRF token, and maybe its data version.
            try:
                res = self.do_request(prerequest_url, None, 'HEAD', {})
                # If a data_version was specified we shouldn't overwrite it
                # because the caller may be acting on a modified version of
                # a specific older version of the data.
                if 'data_version' not in data:
                    data['data_version'] = res.headers['X-Data-Version']
                # We may already have a non-expired CSRF token, but it's
                # faster/easier just to set it again even if we do, since
                # we've already made the request.
                data['csrf_token'] = self.csrf_token = res.headers[
                    'X-CSRF-Token']
            except requests.HTTPError, e:
                # However, if the resource doesn't exist yet we may as well
                # not bother doing another request solely for a token unless
                # we don't have a valid one already.
                if e.response.status_code != 404:
                    raise
                if not self.csrf_token or is_csrf_token_expired(self.csrf_token):
                    res = self.do_request(
                        self.api_root + '/csrf_token', None, 'HEAD', {})
                    data['csrf_token'] = self.csrf_token = res.headers[
                        'X-CSRF-Token']

        return self.do_request(url, data, method, url_template_vars)

    def do_request(self, url, data, method, url_template_vars):
        logging.debug('Balrog request to %s' % url)
        if data is not None and 'csrf_token' in data:
            sanitised_data = data.copy()
            del sanitised_data['csrf_token']
            logging.debug('Data sent: %s' % sanitised_data)
        else:
            logging.debug('Data sent: %s' % data)
        headers = {'Accept-Encoding': 'application/json',
                   'Accept': 'application/json'}
        try:
            return self.session.request(method=method, url=url, data=data,
                                        config=self.config, timeout=self.timeout,
                                        verify=self.verify, auth=self.auth,
                                        headers=headers)
        except requests.HTTPError, e:
            logging.error('Caught HTTPError: %s' % e.response.content)
            raise


class Release(API):
    url_template = '/releases/%(name)s'
    prerequest_url_template = '/releases/%(name)s'

    def update_release(self, name, version, product, hashFunction, releaseData,
                       data_version=None, schemaVersion=None):
        data = dict(name=name, version=version, product=product,
                    hashFunction=hashFunction, data=releaseData)
        if data_version:
            data['data_version'] = data_version
        if schemaVersion:
            data['schema_version'] = schemaVersion
        return self.request(method='POST', data=data, url_template_vars=dict(name=name))

    def get_data(self, name):
        resp = self.request(url_template_vars=dict(name=name))
        return (json.loads(resp.content), resp.headers['X-Data-Version'])


class SingleLocale(API):
    url_template = '/releases/%(name)s/builds/%(build_target)s/%(locale)s'
    prerequest_url_template = '/releases/%(name)s'

    def update_build(self, name, product, version, build_target, locale,
                     hashFunction, buildData, copyTo=None, alias=None,
                     schemaVersion=None):
        url_template_vars = dict(api_root=self.api_root, name=name,
                                 locale=locale, build_target=build_target)
        data = dict(product=product, version=version,
                    data=buildData, hashFunction=hashFunction)
        if copyTo:
            data['copyTo'] = copyTo
        if alias:
            data['alias'] = alias
        if schemaVersion:
            data['schema_version'] = schemaVersion

        return self.request(method='PUT', data=data,
                            url_template_vars=url_template_vars)


class Rule(API):
    url_template = '/rules/%(rule_id)s'
    prerequest_url_template = '/rules/%(rule_id)s'

    def update_rule(self, rule_id, **rule_data):
        url_template_vars = {'rule_id': rule_id}
        return self.request(method='POST', data=rule_data,
                            url_template_vars=url_template_vars)

    def get_data(self, rule_id):
        resp = self.request(url_template_vars=dict(rule_id=rule_id))
        return (json.loads(resp.content), resp.headers["X-Data-Version"])
