import site
import logging
from os import path

import requests
from util.hg import make_hg_url
from util.retry import retry

site.addsitedir(path.join(path.dirname(__file__), ".."))
log = logging.getLogger(__name__)

L10N_DASHBOARD_URL_TEMPLATE = "https://l10n.mozilla.org/shipping/l10n-changesets?ms={milestone}"


def make_generic_head_request(page_url):
    """Make generic HEAD request to check page existence"""
    def _get():
        req = requests.head(page_url, timeout=60)
        req.raise_for_status()

    retry(_get, attempts=5, sleeptime=1)


def make_generic_get_request(page_url):
    """Make generic GET request to retrieve some page content"""
    def _get():
        req = requests.get(page_url, timeout=60)
        req.raise_for_status()
        return req.content

    return retry(_get, attempts=5, sleeptime=1)


def make_hg_get_request(repo_path, revision,
                        filename=None, hg_url='hg.mozilla.org'):
    """Wrapper to make a GET request for a specific URI under hg repo"""
    url = make_hg_url(hg_url, repo_path, revision=revision, filename=filename)
    return make_generic_get_request(url)


def is_candidate_release(channels):
    """Determine if this is a candidate release or not

    Because ship-it can not tell us if this is a candidate release (yet!),
    we assume it is when we have determined, based on version,
    that we are planning to ship to more than one update_channel
    e.g. for candidate releases we have:
     1) one channel to test the 'candidate' release with: 'beta' channel
     2) once verified, we ship to the main channel: 'release' channel
    """
    return channels and len(channels) > 1


class SanityException(Exception):
    """Should the release sanity process collect any errors, this
    custom exception is to be thrown in release runner.
    """
    pass


class OpsMixin(object):
    """Helper class Mixin to enrich ReleaseSanitizerTestSuite behavior
    """
    def assertEqual(self, result, first, second, err_msg):
        """Method inspired from unittest implementation
        The :result is the aggregation object to collect all potential errors
        """
        if not first == second:
            result.add_error(err_msg)


class ReleaseSanitizerTestSuite(OpsMixin):
    """Main release sanity class - the one to encompass all test methods and
    all behavioral changes that need to be addressed. It is inspired by
    the functionality of unittest module classes. It needs to be used
    along with a ReleaseSanitizerResult object to aggregate all potential
    exceptions.

    Once instance needs to hold the task graph arguments that come from
    Ship-it via release runner. Using the arguments, certain behaviors are
    tested (e.g. partials, l10n, versions, config, etc)

    To add more testing methods, please prefix the method with 'test_' in
    order to have it run by sanitize() main method.
    """
    def __init__(self, **kwargs):
        log.debug('Test suite kwargs', kwargs)
        self.kwargs = kwargs
        self.repo_path = self.kwargs['branch']
        self.revision = self.kwargs['mozillaRevision']
        # TODO be more consistent with branch names
        self.branch = self.kwargs['branchShortName']

    def sanitize(self, result):
        """Main method to run all the sanity checks. It collects all the
        methods prefixed with 'test_' and runs them accordingly.
        It runs all the test and collects any potential errors in the :result
        object.
        """
        test_methods = [m for m in filter(lambda k: k.startswith("test_"), dir(self))
                        if callable(getattr(self, m))]
        for test_method in test_methods:
            log.debug("Calling testing method %s", test_method)
            getattr(self, test_method)(result)


class ReleaseSanitizerResult(object):
    """Aggregate exceptions result-object like. It's passed down in all
    ReleaseSanitizerTestSuite methods to collect all potential errors.
    This is usefule to avoid incremenatal fixes in release sanity
    """
    def __init__(self):
        self.errors = []

    def add_error(self, err_msg, err=None):
        """Method to collect a new errors. It collects the exception
        stacktrace and stores the exception value along with the message"""
        # each error consist of a tuple containing the error message and any
        # other potential information we might get useful from the
        # sys.exc_info(). If there is no such, explanatory string will be added
        self.errors.append((err_msg, self._exc_info_to_string(err)))
        # append an empty line after each exceptions to have a nicer output
        log.info("Collecting a new exception: %s", err_msg)

    def _exc_info_to_string(self, err):
        if err is None:
            return "Result of assertion, no exception stacktrace available"
        # trim the traceback part from the exc_info result tuple
        _, value = err[:2]
        return value

    def __str__(self):
        """Define the output to be user-friendly readable"""
        # make some room to separate the output from the exception stacktrace
        ret = "\n\n"
        for msg, err in self.errors:
            ret += "* {msg}:\n{err}\n\n".format(msg=msg, err=err)
        return ret


class ReleaseSanitizerRunner(object):
    """Runner class that is to be called from release runner. It wraps up
    the logic to interfere with both the ReleaseSanitizerTestSuite and the
    ReleaseSanitizerResult. Upon successful run, errors in results should be
    an empty list. Otherwise, the errors list can be retrieved and processed.
    """
    resultClass = ReleaseSanitizerResult
    testSuite = ReleaseSanitizerTestSuite

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.result = self.resultClass()

    def run(self):
        """Main method to call for the actual test of release sanity"""
        test_suite = self.testSuite(**self.kwargs)
        log.info("Attempting to sanitize ...")
        test_suite.sanitize(self.result)

        if not self.was_successful():
            errors = self.get_errors()
            raise SanityException("Issues on release sanity %s" % errors)

    def was_successful(self):
        """Tells whether or not the result was a success"""
        return len(self.result.errors) == 0

    def get_errors(self):
        """Retrieves the list of errors from the result objecti
        in a nicely-formatted string
        """
        return self.result
