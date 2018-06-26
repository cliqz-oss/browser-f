import sys
import logging
import requests

from kickoff.sanity.base import ReleaseSanitizerTestSuite, ReleaseSanitizerRunner, make_generic_get_request, \
                                is_candidate_release
from kickoff import matches

log = logging.getLogger(__name__)


BETA_PATTERNS = [r"\d+\.0b\d+"]


class PartialsTestSuite(ReleaseSanitizerTestSuite):
    def __init__(self, **kwargs):
        ReleaseSanitizerTestSuite.__init__(self, **kwargs)
        self.partial_updates = self.kwargs['partial_updates']

    def test_partials_validity(self, result):
        """test_partials method
        Tests some validity checks against the partials. It goes over the list
        of specified partials and performs some tests:
            1. Firstly, checks the partial version has a corresponding
            (version, buildnumer) under the candidates directory on S3.
            In order to perform this check, rather than checking the complete
            mar (CMAR) files, we check the SHA512 checksums file. Upon a
            successful release build, the checksums file is the last one
            to be generated since it contains all the hashes for all the files.
            Therefore, if the checksums file exist, it means all the other files
            made it through the candidates directory (including CMAR)

            2. Secondly, checks if the partial versions has a corresponding
            of that specific version under releases directory on S3.
            The first check ensured that we had a release build that made it
            through the candidates directory, now we need to checck if we
            actually had a successful ship for that particular partial version.
            For that, we follow the same logic as above by checking the SHA512
            checksums under the releases directory. If it's there, it means we
            have successfully shipped. If something went wrong, we'll hit an
            error.

            3. Ultimately it makes sure the partial version build from
            candidates is actually the same that shipped under releases.
            This check prevents one possible fail-scenario in which the build
            under canidates is good and valid, but a follow-up build was
            actually shipped under releases. Since shipping to releases
            implies an actual copy of the files, for that particular reason we
            make sure that SHA512 checksums of the build under candidates is
            bitwise the same as the one from releases.
        """
        log.info("Testing partials validity ...")

        def grab_partial_sha(url):
            """Quick helper function to grab a SHA512 file"""
            sha_sum = None
            try:
                sha_sum = make_generic_get_request(url).strip()
            except requests.HTTPError:
                err_msg = "Broken build - hash {url} not found".format(url=url)
                result.add_error(err_msg, sys.exc_info())

            return sha_sum

        for pversion, info in self.kwargs["partial_updates"].iteritems():
            buildno = info["buildNumber"]

            # make sure partial is valid and shipped correctly to /candidates
            candidates_template = get_url_template(self.branch, 'candidates')
            _url = candidates_template.format(
                product=self.kwargs["product"], version=pversion, build_number=buildno
            )
            candidate_sha = grab_partial_sha(_url)

            # make sure partial has a shipped release under /releases
            releases_template = get_url_template(self.branch, 'releases')
            _url = releases_template.format(product=self.kwargs["product"], version=pversion)
            releases_sha = grab_partial_sha(_url)

            err_msg = ("{version}-build{build_number} is a good candidate"
                       " build, but not the one we shipped! URL: {url}").format(
                           version=pversion,
                           build_number=buildno,
                           url=_url)
            self.assertEqual(result, releases_sha, candidate_sha, err_msg)

    def test_partials_release_candidate_validity(self, result):
        """test_partials method
        Tests if a RC contains both beta and release in list of partials.
        We hit this issue in bug 1265579 in which the updates builder failed
        if partials were all-beta OR if no-beta at all
        """
        log.info("Testing RC partials ...")
        if not is_candidate_release(self.kwargs.get("release_channels")):
            log.info("Skipping this test as we're not dealing with a RC now")
            return

        ret = [matches(name, BETA_PATTERNS) for name in self.partial_updates]
        at_least_one_beta = any(ret)
        all_betas = all(ret) and ret != []

        partials = ["{name}".format(name=p) for p in self.partial_updates]
        err_msg = "No beta found in the RC list of partials: {l}".format(l=partials)
        self.assertEqual(result, at_least_one_beta, True, err_msg)

        err_msg = ("All partials in the RC list are betas. At least a non-beta"
                   " release is needed in {l}").format(l=partials)
        self.assertEqual(result, all_betas, False, err_msg)


class PartialsSanitizer(ReleaseSanitizerRunner):
    testSuite = PartialsTestSuite


def get_url_template(branch, candidates_or_releases):
    if branch in ('mozilla-beta', 'mozilla-release') or 'mozilla-esr' in branch:
        domain_name = 'archive.mozilla.org'
    else:
        domain_name = 'bucketlister-delivery.stage.mozaws.net'

    if candidates_or_releases == 'releases':
        path = 'pub/{product}/releases/{version}/SHA512SUMS'
    elif candidates_or_releases == 'candidates':
        path = 'pub/{product}/candidates/{version}-candidates/build{build_number}/SHA512SUMS'
    else:
        raise Exception('Unsupported "candidates_or_releases": "{}"'.format(candidates_or_releases))

    return 'https://{}/{}'.format(domain_name, path)
