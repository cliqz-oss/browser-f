import re
import requests
import logging

from buglist_creator import create_bugs_url
from kickoff.api import Releases, Release, ReleaseL10n
from release.l10n import parsePlainL10nChangesets
from release.versions import getAppVersion
from util.sendmail import sendmail
from util.retry import retry

log = logging.getLogger(__name__)


def matches(name, patterns):
    return any([re.search(p, name) for p in patterns])


def long_revision(repo, revision):
    """Convert short revision to long using JSON API

    >>> long_revision("releases/mozilla-beta", "59f372c35b24")
    u'59f372c35b2416ac84d6572d64c49227481a8a6c'

    >>> long_revision("releases/mozilla-beta", "59f372c35b2416ac84d6572d64c49227481a8a6c")
    u'59f372c35b2416ac84d6572d64c49227481a8a6c'
    """
    url = "https://hg.mozilla.org/{}/json-rev/{}".format(repo, revision)

    def _get():
        req = requests.get(url, timeout=60)
        req.raise_for_status()
        return req.json()["node"]

    return retry(_get)


class ReleaseRunner(object):
    def __init__(self, api_root=None, username=None, password=None,
                 timeout=60):
        self.new_releases = []
        self.releases_api = Releases((username, password), api_root=api_root,
                                     timeout=timeout)
        self.release_api = Release((username, password), api_root=api_root,
                                   timeout=timeout)
        self.release_l10n_api = ReleaseL10n((username, password),
                                            api_root=api_root, timeout=timeout)

    def get_release_requests(self, release_patterns):
        new_releases = self.releases_api.getReleases()
        if new_releases['releases']:
            new_releases = [self.release_api.getRelease(name) for name in
                            new_releases['releases']]
            our_releases = [r for r in new_releases if
                            matches(r['name'], release_patterns)]
            if our_releases:
                self.new_releases = our_releases
                log.info("Releases to handle are %s", self.new_releases)
                return True
            else:
                log.info("No releases to handle in %s", new_releases)
                return False
        else:
            log.info("No new releases: %s" % new_releases)
            return False

    def get_release_l10n(self, release):
        return self.release_l10n_api.getL10n(release)

    def update_status(self, release, status):
        log.info('updating status for %s to %s' % (release['name'], status))
        try:
            self.release_api.update(release['name'], status=status)
        except requests.HTTPError as e:
            log.warning('Caught HTTPError: %s' % e.response.content)
            log.warning('status update failed, continuing...', exc_info=True)

    def mark_as_completed(self, release):
        log.info('mark as completed %s' % release['name'])
        self.release_api.update(release['name'], complete=True,
                                status='Started')

    def mark_as_failed(self, release, why):
        log.info('mark as failed %s' % release['name'])
        self.release_api.update(release['name'], ready=False, status=why)


def email_release_drivers(smtp_server, from_, to, release, task_group_id, l10n_url):
    # Send an email to the mailing after the build
    email_buglist_string = create_bugs_url(release)

    content = """\
A new build has been submitted through ship-it:

Commit: https://hg.mozilla.org/{path}/rev/{revision}
Task group: https://tools.taskcluster.net/push-inspector/#/{task_group_id}
Locales: {l10n_url} (requires VPN access)

Created by {submitter}
Started by {starter}

{email_buglist_string}
""".format(path=release["branch"], revision=release["mozillaRevision"],
           submitter=release["submitter"], starter=release["starter"],
           task_group_id=task_group_id, l10n_url=l10n_url,
           email_buglist_string=email_buglist_string)

    comment = release.get("comment")
    if comment:
        content += "Comment:\n" + comment + "\n\n"

    # On r-d, we prefix the subject of the email in order to simplify filtering
    subject_prefix = ""
    if "Fennec" in release["name"]:
        subject_prefix = "[mobile] "
    if "Firefox" in release["name"] or "Devedition" in release["name"]:
        subject_prefix = "[desktop] "

    subject = subject_prefix + 'Build of %s' % release["name"]

    sendmail(from_=from_, to=to, subject=subject, body=content,
             smtp_server=smtp_server)


def get_partials(rr, partial_versions, product):
    partials = {}
    if not partial_versions:
        return partials
    for p in [stripped.strip() for stripped in partial_versions.split(',')]:
        partialVersion, buildNumber = p.split('build')
        partial_release_name = '{}-{}-build{}'.format(
            product.capitalize(), partialVersion, buildNumber,
        )
        partials[partialVersion] = {
            'appVersion': getAppVersion(partialVersion),
            'buildNumber': buildNumber,
            'locales': parsePlainL10nChangesets(
                rr.get_release_l10n(partial_release_name)).keys(),
        }
    return partials


def get_platform_locales(l10n_changesets, platform):
    # hardcode ja/ja-JP-mac exceptions
    if platform == "macosx64":
        ignore = "ja"
    else:
        ignore = "ja-JP-mac"

    return [l for l in l10n_changesets.keys() if l != ignore]


def get_l10n_config(index, product, branch, revision, platforms,
                    l10n_platforms, l10n_changesets, tc_task_indexes):
    l10n_platform_configs = {}
    for platform in l10n_platforms:
        # mar_tools lives in the unsigned task
        unsigned_route = tc_task_indexes[platform]['unsigned'].format(rev=revision)
        unsigned_task = index.findTask(unsigned_route)
        if tc_task_indexes[platform]['ci_system'] == 'bb':
            mar_tools_url = "https://queue.taskcluster.net/v1/task/{taskid}/artifacts/public/build".format(
                taskid=unsigned_task["taskId"]
            )
        else:
            mar_tools_url = "https://queue.taskcluster.net/v1/task/{taskid}/artifacts/public/build/host/bin".format(
                taskid=unsigned_task["taskId"]
            )
            if platform.startswith("mac"):
                # FIXME: dirty dirty hack
                if branch in ("mozilla-beta", "jamun", "maple"):
                    if product == "devedition":
                        mar_tools_url = "https://archive.mozilla.org/pub/devedition/candidates/55.0b14-candidates/build1/mar-tools/macosx64"
                    elif product == "firefox":
                        mar_tools_url = "https://archive.mozilla.org/pub/firefox/candidates/55.0b13-candidates/build1/mar-tools/macosx64"
                elif branch == "mozilla-release":
                    if product == "firefox":
                        mar_tools_url = "https://archive.mozilla.org/pub/firefox/candidates/55.0.3-candidates/build2/mar-tools/macosx64"

        # en-US binary lives all over the places!
        if platform.startswith("linux"):
            route = tc_task_indexes[platform]['signed'].format(rev=revision)
        elif platform.startswith("mac"):
            if tc_task_indexes[platform]['ci_system'] == 'bb':
                route = tc_task_indexes[platform]['signed'].format(rev=revision)
            else:
                route = tc_task_indexes[platform]['repackage'].format(rev=revision)
        elif platform.startswith("win"):
            # BB has all binaries in one task
            # TC generates target.zip in this task, the installer is set below
            route = tc_task_indexes[platform]['signed'].format(rev=revision)
        signed_task = index.findTask(route)
        en_us_binary_url = "https://queue.taskcluster.net/v1/task/{taskid}/artifacts/public/build".format(
            taskid=signed_task["taskId"]
        )

        l10n_platform_configs[platform] = {
            "locales": get_platform_locales(l10n_changesets, platform),
            "en_us_binary_url": en_us_binary_url,
            "mar_tools_url": mar_tools_url,
            "chunks": platforms[platform].get("l10n_chunks", 10),
        }
        # Windows installer is a different beast
        if platform.startswith("win") and tc_task_indexes[platform]['ci_system'] == 'tc':
            route = tc_task_indexes[platform]['repackage-signing'].format(rev=revision)
            installer_task = index.findTask(route)
            en_us_installer_binary_url = "https://queue.taskcluster.net/v1/task/{taskid}/artifacts/public/build".format(
                taskid=installer_task["taskId"]
            )
            l10n_platform_configs[platform]['en_us_installer_binary_url'] = en_us_installer_binary_url

    return {
        "platforms": l10n_platform_configs,
        "changesets": l10n_changesets,
    }


def get_en_US_config(index, product, branch, revision, platforms,
                     tc_task_indexes):
    platform_configs = {}
    for platform in platforms:
        signed_route = tc_task_indexes[platform]['signed'].format(rev=revision)
        signed_task = index.findTask(signed_route)
        unsigned_route = tc_task_indexes[platform]['unsigned'].format(rev=revision)
        unsigned_task = index.findTask(unsigned_route)
        platform_configs[platform] = {
            "signed_task_id": signed_task["taskId"],
            "unsigned_task_id": unsigned_task["taskId"],
            "ci_system": tc_task_indexes[platform]["ci_system"],
        }
        for t in ("repackage", "repackage-signing"):
            if t in tc_task_indexes[platform]:
                route = tc_task_indexes[platform][t].format(rev=revision)
                task = index.findTask(route)
                platform_configs[platform]['{}_task_id'.format(t)] = task['taskId']

    return {
        "platforms": platform_configs,
    }


# FIXME: the following function should be removed and we should use
# next_version provided by ship-it
def bump_version(version):
    """Bump last digit

    >>> bump_version("45.0")
    '45.0.1'
    >>> bump_version("45.0.1")
    '45.0.2'
    >>> bump_version("45.0b3")
    '45.0b4'
    >>> bump_version("45.0esr")
    '45.0.1esr'
    >>> bump_version("45.0.1esr")
    '45.0.2esr'
    >>> bump_version("45.2.1esr")
    '45.2.2esr'
    """
    split_by = "."
    digit_index = 2
    suffix = ""
    if "b" in version:
        split_by = "b"
        digit_index = 1
    if "esr" in version:
        version = version.replace("esr", "")
        suffix = "esr"
    v = version.split(split_by)
    if len(v) < digit_index + 1:
        # 45.0 is 45.0.0 actually
        v.append("0")
    v[-1] = str(int(v[-1]) + 1)
    return split_by.join(v) + suffix


def make_task_graph_strict_kwargs(appVersion, balrog_api_root, balrog_password, balrog_username,
                                  beetmover_aws_access_key_id, beetmover_aws_secret_access_key,
                                  beetmover_candidates_bucket, bouncer_enabled, branch, buildNumber,
                                  build_tools_repo_path, candidates_fennec_enabled,
                                  checksums_enabled, binary_transparency_enabled, en_US_config,
                                  root_home_dir, extra_balrog_submitter_params, final_verify_channels,
                                  final_verify_platforms, uptake_monitoring_platforms,
                                  funsize_balrog_api_root, l10n_config, signing_cert, mar_signing_format,
                                  l10n_changesets, mozharness_changeset, next_version,
                                  partial_updates, partner_repacks_platforms,
                                  eme_free_repacks_platforms, sha1_repacks_platforms,
                                  postrelease_bouncer_aliases_enabled, uptake_monitoring_enabled,
                                  postrelease_version_bump_enabled, moz_disable_mar_cert_verification,
                                  postrelease_mark_as_shipped_enabled, accepted_mar_channel_id, public_key,
                                  product, stage_product, funsize_product, push_to_candidates_enabled,
                                  push_to_releases_automatic, push_to_releases_enabled, release_channels,
                                  repo_path, revision, signing_class, signing_pvt_key, source_enabled,
                                  tuxedo_server_url, update_verify_enabled, updates_builder_enabled,
                                  updates_enabled, verifyConfigs, version, publish_to_balrog_channels,
                                  snap_enabled, update_verify_channel, update_verify_requires_cdn_push,
                                  release_eta, lzma_to_bz2, balrog_vpn_proxy):
    """simple wrapper that sanitizes whatever calls make_task_graph uses universally known kwargs"""

    kwargs = dict(
        appVersion=appVersion,
        balrog_api_root=balrog_api_root,
        balrog_password=balrog_password,
        balrog_username=balrog_username,
        balrog_vpn_proxy=balrog_vpn_proxy,
        beetmover_aws_access_key_id=beetmover_aws_access_key_id,
        beetmover_aws_secret_access_key=beetmover_aws_secret_access_key,
        beetmover_candidates_bucket=beetmover_candidates_bucket,
        bouncer_enabled=bouncer_enabled,
        branch=branch,
        buildNumber=buildNumber,
        build_tools_repo_path=build_tools_repo_path,
        candidates_fennec_enabled=candidates_fennec_enabled,
        checksums_enabled=checksums_enabled,
        binary_transparency_enabled=binary_transparency_enabled,
        en_US_config=en_US_config,
        final_verify_channels=final_verify_channels,
        final_verify_platforms=final_verify_platforms,
        uptake_monitoring_platforms=uptake_monitoring_platforms,
        funsize_balrog_api_root=funsize_balrog_api_root,
        l10n_changesets=l10n_changesets,
        l10n_config=l10n_config,
        mozharness_changeset=mozharness_changeset,
        next_version=next_version,
        partial_updates=partial_updates,
        partner_repacks_platforms=partner_repacks_platforms,
        eme_free_repacks_platforms=eme_free_repacks_platforms,
        sha1_repacks_platforms=sha1_repacks_platforms,
        postrelease_bouncer_aliases_enabled=postrelease_bouncer_aliases_enabled,
        uptake_monitoring_enabled=uptake_monitoring_enabled,
        postrelease_version_bump_enabled=postrelease_version_bump_enabled,
        postrelease_mark_as_shipped_enabled=postrelease_mark_as_shipped_enabled,
        product=product,
        public_key=public_key,
        push_to_candidates_enabled=push_to_candidates_enabled,
        push_to_releases_automatic=push_to_releases_automatic,
        push_to_releases_enabled=push_to_releases_enabled,
        release_channels=release_channels,
        repo_path=repo_path,
        revision=revision,
        signing_class=signing_class,
        accepted_mar_channel_id=accepted_mar_channel_id,
        signing_cert=signing_cert,
        mar_signing_format=mar_signing_format,
        moz_disable_mar_cert_verification=moz_disable_mar_cert_verification,
        root_home_dir=root_home_dir,
        signing_pvt_key=signing_pvt_key,
        source_enabled=source_enabled,
        stage_product=stage_product,
        tuxedo_server_url=tuxedo_server_url,
        update_verify_enabled=update_verify_enabled,
        updates_builder_enabled=updates_builder_enabled,
        updates_enabled=updates_enabled,
        verifyConfigs=verifyConfigs,
        version=version,
        publish_to_balrog_channels=publish_to_balrog_channels,
        snap_enabled=snap_enabled,
        update_verify_channel=update_verify_channel,
        update_verify_requires_cdn_push=update_verify_requires_cdn_push,
        funsize_product=funsize_product,
        release_eta=release_eta,
        lzma_to_bz2=lzma_to_bz2,
    )
    if extra_balrog_submitter_params:
        kwargs["extra_balrog_submitter_params"] = extra_balrog_submitter_params

    # don't import releasetasks until required within function impl to avoid
    # global failures during nosetests
    from releasetasks import make_tasks
    return make_tasks(**kwargs)


def get_funsize_product(product_name):
    if product_name == 'devedition':    # See bug 1366075
        return 'firefox'
    return product_name


def get_mar_signing_format(version):
    # XXX mar_sha384 was introduced in 56.0b4. That version wasn't used for comparison because
    # the string '56.0.1' is considered smaller than '56.0b4'
    return 'mar' if version < '56.0' else 'mar_sha384'
