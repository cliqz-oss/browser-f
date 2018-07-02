import sys
import logging
import requests
import re

from kickoff.sanity.base import ReleaseSanitizerTestSuite, ReleaseSanitizerRunner, make_generic_get_request, \
                                make_generic_head_request, make_hg_get_request

log = logging.getLogger(__name__)

SINGLE_LOCALE_CONFIG_URI_TEMPLATE = "testing/mozharness/configs/single_locale/{branch}.py"
LOCALE_BASE_URL_TEMPLATE = "{hg_l10n_base}/{locale}/raw-file/{revision}"
SHIPPED_LOCALES_CONFIG_URI = "browser/locales/shipped-locales"


def get_single_locale_config(repo_path, revision, branch):
    """Get single locale from remote mh configs
    Example for mozilla-beta, random revision:

    >>>
    config = {
        "nightly_build": True,
        "branch": "mozilla-beta",
        ...
        # l10n
        "hg_l10n_base": "https://hg.mozilla.org/releases/l10n/mozilla-beta",
        # repositories
        "mozilla_dir": "mozilla-beta",
        'purge_minsize': 12,
        'is_automation': True,
        ...
    }
    """
    filename = SINGLE_LOCALE_CONFIG_URI_TEMPLATE.format(branch=branch)
    return make_hg_get_request(repo_path, revision, filename=filename)


class L10nTestSuite(ReleaseSanitizerTestSuite):

    def __init__(self, **kwargs):
        ReleaseSanitizerTestSuite.__init__(self, **kwargs)
        self.locales = self.kwargs['l10n_changesets']

    def test_l10n_verify_changesets(self, result):
        """test_l10n method
        Tests if the l10n changesets (locale, revision) are actually valid.
        It does a validity check on each of the locales revision. In order
        to query that particular l10n release url, the single locale
        config file from mozharness is grabbed first.
        """
        log.info("Testing current l10n changesets ...")
        try:
            ret = get_single_locale_config(self.repo_path,
                                           self.revision,
                                           self.branch).strip()
        except requests.HTTPError as err:
            err_msg = ("Failed to retrieve single locale config file for"
                       " {path}, revision {rev}. URL: {url}").format(
                           path=self.repo_path,
                           rev=self.revision,
                           branch=self.branch,
                           url=err.request.url)
            result.add_error(err_msg, sys.exc_info())
            return None

        locals_dict = dict()
        exec(ret, {}, locals_dict)
        single_locale_config = locals_dict.get('config')

        for locale in sorted(self.locales.keys()):
            revision = self.locales[locale]
            locale_url = LOCALE_BASE_URL_TEMPLATE.format(
                hg_l10n_base=single_locale_config["hg_l10n_base"].strip('/'),
                locale=locale,
                revision=revision
            )

            try:
                make_generic_head_request(locale_url)
            except requests.HTTPError:
                err_msg = "Locale {locale} not found".format(locale=locale_url)
                result.add_error(err_msg, sys.exc_info())

    def test_l10n_shipped_locales(self, result):
        """test_l10n method
        Tests if the current locales coming from release runner are in fact
        the same as the shipped locales.
        """
        log.info("Testing l10n shipped locales ...")
        try:
            # TODO: mind that we will need something similar for Fennec
            ret = make_hg_get_request(self.repo_path, self.revision,
                                      filename=SHIPPED_LOCALES_CONFIG_URI).strip()
        except requests.HTTPError as err:
            err_msg = ("Shipped locale file not found in {path} repo under rev"
                       " {revision}. URL: {url}").format(
                           path=self.repo_path,
                           revision=self.revision,
                           url=err.request.url)
            result.add_error(err_msg, sys.exc_info())
            return

        shipped_l10n = set([l.split()[0] for l in ret.splitlines()])
        current_l10n = set(self.locales.keys())

        err_msg = "Current l10n changesets and shipped locales differ!"
        # we have en-US in shipped locales, but not in l10n changesets, because
        # there is no en-US repo
        self.assertEqual(result, shipped_l10n.difference(current_l10n),
                         set(['en-US']),
                         err_msg)
        self.assertEqual(result, current_l10n.difference(shipped_l10n),
                         set([]),
                         err_msg)


class L10nSanitizer(ReleaseSanitizerRunner):
    testSuite = L10nTestSuite
