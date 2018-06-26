import sys
import logging
import requests

from kickoff.sanity.base import ReleaseSanitizerTestSuite, ReleaseSanitizerRunner, make_generic_get_request, \
                                make_generic_head_request, make_hg_get_request

log = logging.getLogger(__name__)

VERSION_DISPLAY_CONFIG_URI = {
    "fennec": "browser/config/version_display.txt",
    "firefox": "browser/config/version_display.txt",
    "devedition": "browser/config/version_display.txt",
    "thunderbird": "mail/config/version_display.txt",
}


class RevisionsTestSuite(ReleaseSanitizerTestSuite):
    def __init__(self, **kwargs):
        ReleaseSanitizerTestSuite.__init__(self, **kwargs)
        self.version = self.kwargs['version']
        self.product = self.kwargs['product']

    def test_versions_repo_and_revision_check(self, result):
        """test_versions method
        Tests if the indicated branch and revision repo exists
        """
        log.info("Testing repo and revision in tree ...")
        try:
            make_hg_get_request(self.repo_path, self.revision).strip()
        except requests.HTTPError as err:
            err_msg = "{path} repo does not exist with {rev} revision. URL: {url}".format(
                path=self.repo_path, rev=self.revision, url=err.request.url)
            result.add_error(err_msg, sys.exc_info())

    def test_versions_display_validation_in_tree(self, result):
        """test_versions method
        Tests if the upstream display version exists and if it is the same
        with the current one coming from release runner
        """
        log.info("Testing version display validation in tree ...")
        version = self.version
        if '52.' in version:
            # esr-hack: ensure trimming the suffix before comparing, for < esr60
            version = self.version.replace("esr", "")

        try:
            display_version = make_hg_get_request(
                self.repo_path, self.revision,
                filename=VERSION_DISPLAY_CONFIG_URI[self.product],
            ).strip()
        except requests.HTTPError as err:
            err_msg = ("display_version config file not found in {path} under"
                       " {rev} revision. URL: {url}").format(
                           path=self.repo_path,
                           rev=self.revision,
                           url=err.request.url)
            result.add_error(err_msg, sys.exc_info())
            return

        err_msg = ("In-tree display version {tree_version} doesn't "
                   "match ship-it version {version}").format(
                       tree_version=display_version, version=version)
        self.assertEqual(result, version, display_version, err_msg)


class RevisionsSanitizer(ReleaseSanitizerRunner):
    testSuite = RevisionsTestSuite
