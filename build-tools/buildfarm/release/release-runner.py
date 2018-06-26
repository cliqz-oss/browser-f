#!/usr/bin/env python

import site
import time
import logging
import sys
import os
import re
import subprocess
import hashlib
import functools
import shutil
import tempfile
import requests
from os import path
from optparse import OptionParser
from twisted.python.lockfile import FilesystemLock
from taskcluster import Index, Queue
from taskcluster.utils import slugId
import yaml

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))

from kickoff import (get_partials, ReleaseRunner,
                     make_task_graph_strict_kwargs, long_revision,
                     get_l10n_config, get_en_US_config, email_release_drivers,
                     bump_version, get_funsize_product, get_mar_signing_format)
from kickoff.sanity.base import SanityException, is_candidate_release
from kickoff.sanity.revisions import RevisionsSanitizer
from kickoff.sanity.l10n import L10nSanitizer
from kickoff.sanity.partials import PartialsSanitizer
from kickoff.build_status import are_en_us_builds_completed
from kickoff.tc import resolve_task, submit_parallelized
from release.info import readBranchConfig
from release.l10n import parsePlainL10nChangesets
from release.versions import getAppVersion
from util.hg import mercurial
from util.retry import retry

log = logging.getLogger(__name__)


# both CHECKSUMS and ALL_FILES have been defined to improve the release sanity
# en-US binaries timing by whitelisting artifacts of interest - bug 1251761
CHECKSUMS = set([
    '.checksums',
    '.checksums.asc',
])


ALL_FILES = set([
    '.checksums',
    '.checksums.asc',
    '.complete.mar',
    '.exe',
    '.dmg',
    'tar.bz2',
])

CONFIGS_WORKDIR = 'buildbot-configs'


def check_and_assign_long_revision(release_runner, release, releases_config):
    # Revisions must be checked before trying to get the long one.
    RevisionsSanitizer(**release).run()
    release['mozillaRevision'] = long_revision(
        release['branch'], release['mozillaRevision'])


def assign_and_check_l10n_changesets(release_runner, release, releases_config):
    release['l10n_changesets'] = parsePlainL10nChangesets(
        release_runner.get_release_l10n(release['name']))
    L10nSanitizer(**release).run()


def assign_and_check_partial_updates(release_runner, release, releases_config):
    release['partial_updates'] = get_partials(
        release_runner, release['partials'], release['product'])
    branchConfig = get_branch_config(release)
    release['release_channels'] = update_channels(
        release['version'], branchConfig['release_channel_mappings'][release['product']])
    PartialsSanitizer(**release).run()


def check_allowed_branches(release_runner, release, releases_config):
    product = release['product']
    branch = release['branch']
    for entry in releases_config:
        if entry['product'] == product:
            allowed_branches = entry['allowed_branches']
            for pattern in allowed_branches:
                if re.match(pattern, branch):
                    return
    raise RuntimeError("%s branch is not allowed: %s", branch, allowed_branches)


# So people can't run arbitrary functions
CHECKS_MAPPING = {
    'long_revision': check_and_assign_long_revision,
    'l10n_changesets': assign_and_check_l10n_changesets,
    'partial_updates': assign_and_check_partial_updates,
    'check_allowed_branches': check_allowed_branches,
}


def run_prebuild_sanity_checks(release_runner, releases_config):
    new_valid_releases = []

    # results in:
    # { 'firefox': ['long_revision', 'l10n_changesets', 'partial_updates']}
    checks = {r['product'].lower(): r['checks'] for r in releases_config}

    for release in release_runner.new_releases:
        log.info('Got a new release request: %s' % release)
        try:
            # TODO: this won't work for Thunderbird...do we care?
            release['branchShortName'] = release['branch'].split("/")[-1]

            for check in checks[release['product']]:
                if check not in CHECKS_MAPPING:
                    log.error("Check %s not found", check)
                    continue
                CHECKS_MAPPING[check](release_runner, release, releases_config)

            new_valid_releases.append(release)
        except Exception as e:
            release_runner.mark_as_failed(
                release, 'Sanity checks failed. Errors: %s' % e)
            log.exception(
                'Sanity checks failed. Errors: %s. Release: %s', e, release)
    return new_valid_releases


def get_branch_config(release):
    return readBranchConfig(path.join(CONFIGS_WORKDIR, "mozilla"), branch=release['branchShortName'])


def update_channels(version, mappings):
    """Return a list of update channels for a version using version mapping

    >>> update_channels("40.0", [(r"^\d+\.0$", ["beta", "release"]), (r"^\d+\.\d+\.\d+$", ["release"])])
    ["beta", "release"]
    >>> update_channels("40.0.1", [(r"^\d+\.0$", ["beta", "release"]), (r"^\d+\.\d+\.\d+$", ["release"])])
    ["release"]

    """
    for pattern, channels in mappings:
        if re.match(pattern, version):
            return channels
    raise RuntimeError("Cannot find update channels for %s" % version)


def validate_signatures(checksums, signature, dir_path, gpg_key_path):
    try:
        cmd = ['gpg', '--batch', '--homedir', dir_path, '--import',
               gpg_key_path]
        subprocess.check_call(cmd)
        cmd = ['gpg', '--homedir', dir_path, '--verify', signature, checksums]
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError:
        log.exception("GPG signature check failed")
        raise SanityException("GPG signature check failed")


def parse_sha512(checksums, files):
    # parse the checksums file and store all sha512 digests
    _dict = dict()
    with open(checksums, 'rb') as fd:
        lines = fd.readlines()
        for line in lines:
            digest, alg, _, name = line.split()
            if alg != 'sha512':
                continue
            _dict[os.path.basename(name)] = digest
    wdict = {k: _dict[k] for k in _dict.keys() if file_in_whitelist(k, files)}
    return wdict


def download_all_artifacts(queue, artifacts, task_id, dir_path):
    failed_downloads = False

    for artifact in artifacts:
        name = os.path.basename(artifact)
        build_url = queue.buildSignedUrl(
            'getLatestArtifact',
            task_id,
            artifact
        )
        log.debug('Downloading %s', name)
        try:
            r = requests.get(build_url, timeout=60)
            r.raise_for_status()
        except requests.HTTPError:
            log.exception("Failed to download %s", name)
            failed_downloads = True
        else:
            filepath = os.path.join(dir_path, name)
            with open(filepath, 'wb') as fd:
                for chunk in r.iter_content(1024):
                    fd.write(chunk)

    if failed_downloads:
        raise SanityException('Downloading artifacts failed')


def validate_checksums(_dict, dir_path):
    for name in _dict.keys():
        filepath = os.path.join(dir_path, name)
        computed_hash = get_hash(filepath)
        correct_hash = _dict[name]
        if computed_hash != correct_hash:
            log.error("failed to validate checksum for %s",
                      name, exc_info=True)
            raise SanityException("Failed to check digest for %s" % name)


def file_in_whitelist(artifact, whitelist):
    return any([artifact.endswith(x) for x in whitelist])


def sanitize_en_US_binary(queue, task_id, gpg_key_path):
    # each platform en-US gets its own tempdir workground
    tempdir = tempfile.mkdtemp()
    log.debug('Temporary playground is %s', tempdir)

    # get all artifacts and trim but 'name' field from the json entries
    all_artifacts = [k['name']
                     for k in queue.listLatestArtifacts(task_id)['artifacts']]
    # filter files to hold the whitelist-related only
    artifacts = filter(lambda k: file_in_whitelist(
        k, ALL_FILES), all_artifacts)
    # filter out everything but the checkums artifacts
    checksums_artifacts = filter(
        lambda k: file_in_whitelist(k, CHECKSUMS), all_artifacts)
    other_artifacts = list(set(artifacts) - set(checksums_artifacts))
    # iterate in artifacts and grab checksums and its signature only
    log.info("Retrieve the checksums file and its signature ...")
    for artifact in checksums_artifacts:
        name = os.path.basename(artifact)
        build_url = queue.buildSignedUrl(
            'getLatestArtifact',
            task_id,
            artifact
        )
        log.debug('Downloading %s', name)
        try:
            r = requests.get(build_url, timeout=60)
            r.raise_for_status()
        except requests.HTTPError:
            log.exception("Failed to download %s file", name)
            raise SanityException("Failed to download %s file" % name)
        filepath = os.path.join(tempdir, name)
        with open(filepath, 'wb') as fd:
            for chunk in r.iter_content(1024):
                fd.write(chunk)
        if name.endswith(".checksums.asc"):
            signature = filepath
        else:
            checksums = filepath

    # perform the signatures validation test
    log.info("Attempt to validate signatures ...")
    validate_signatures(checksums, signature, tempdir, gpg_key_path)
    log.info("Signatures validated correctly!")

    log.info("Download all artifacts ...")
    download_all_artifacts(queue, other_artifacts, task_id, tempdir)
    log.info("All downloads completed!")

    log.info("Retrieve all sha512 from checksums file...")
    sha512_dict = parse_sha512(checksums, ALL_FILES - CHECKSUMS)
    log.info("All sha512 digests retrieved")

    log.info("Validating checksums for each artifact ...")
    validate_checksums(sha512_dict, tempdir)
    log.info("All checksums validated!")

    # remove entire playground before moving forward
    log.debug("Deleting the temporary playground ...")
    shutil.rmtree(tempdir)


def get_hash(path, hash_type="sha512"):
    h = hashlib.new(hash_type)
    with open(path, "rb") as f:
        for chunk in iter(functools.partial(f.read, 4096), ''):
            h.update(chunk)
    return h.hexdigest()


def validate_graph_kwargs(queue, gpg_key_path, **kwargs):
    # TODO: to be moved under kickoff soon, once new relpro sanity is in place
    # bug 1282959
    platforms = kwargs['en_US_config']['platforms']
    for platform in platforms:
        # FIXME: enable sanity check later for TC platforms
        if platforms[platform]["signed_task_id"] != platforms[platform]["unsigned_task_id"]:
            log.warning("Skipping en-US sanity for %s, TC platform", platform)
            continue
        task_id = platforms[platform]['signed_task_id']
        log.info('Performing release sanity for %s en-US binary', platform)
        sanitize_en_US_binary(queue, task_id, gpg_key_path)

    log.info("Release sanity for all en-US is now completed!")


def main(options):
    log.info('Loading config from %s' % options.config)

    with open(options.config, 'r') as config_file:
        config = yaml.load(config_file)

    if config['release-runner'].get('verbose', False):
        log_level = logging.DEBUG
    else:
        log_level = logging.INFO
    logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s",
                        level=log_level)
    # Suppress logging of retry(), see bug 925321 for the details
    logging.getLogger("util.retry").setLevel(logging.WARN)

    api_root = config['api']['api_root']
    username = config['api']['username']
    password = config['api']['password']

    rr_config = config['release-runner']

    buildbot_configs = rr_config['buildbot_configs']
    buildbot_configs_branch = rr_config['buildbot_configs_branch']
    sleeptime = rr_config['sleeptime']
    notify_from = rr_config.get('notify_from')
    notify_to = rr_config.get('notify_to_announce')
    docker_worker_key = rr_config.get('docker_worker_key')
    signing_pvt_key = config['signing'].get('pvt_key')
    if isinstance(notify_to, basestring):
        notify_to = [x.strip() for x in notify_to.split(',')]
    smtp_server = rr_config.get('smtp_server', 'localhost')
    tc_config = {
        "credentials": {
            "clientId": config['taskcluster'].get('client_id'),
            "accessToken": config['taskcluster'].get('access_token'),
        }
    }
    # Extend tc_config for retries, see Bug 1293744
    # https://github.com/taskcluster/taskcluster-client.py/blob/0.0.24/taskcluster/client.py#L30
    # This is a stopgap until Bug 1259627 is fixed.
    retrying_tc_config = tc_config.copy()
    retrying_tc_config.update({"maxRetries": 12})
    balrog_username = config['balrog'].get("username")
    balrog_password = config["balrog"].get("password")
    extra_balrog_submitter_params = config["balrog"].get("extra_balrog_submitter_params", "")
    beetmover_aws_access_key_id = config["beetmover"].get("aws_access_key_id")
    beetmover_aws_secret_access_key = config["beetmover"].get("aws_secret_access_key")
    gpg_key_path = config["signing"].get("gpg_key_path")

    # TODO: replace release sanity with direct checks of en-US and l10n
    # revisions (and other things if needed)

    rr = ReleaseRunner(api_root=api_root, username=username, password=password)
    index = Index(tc_config)
    queue = Queue(retrying_tc_config)

    # Main loop waits for new releases, processes them and exits.
    while True:
        try:
            log.debug('Fetching release requests')
            rr.get_release_requests([r['pattern'] for r in config['releases']])
            if rr.new_releases:
                new_releases = run_prebuild_sanity_checks(
                    rr, config['releases'])
                break
            else:
                log.debug('Sleeping for %d seconds before polling again' %
                          sleeptime)
                time.sleep(sleeptime)
        except:
            log.error("Caught exception when polling:", exc_info=True)
            sys.exit(5)

    retry(mercurial, args=(buildbot_configs, CONFIGS_WORKDIR),
          kwargs=dict(branch=buildbot_configs_branch))

    if 'symlinks' in config:
        format_dict = dict(buildbot_configs=CONFIGS_WORKDIR)
        for target in config['symlinks']:
            symlink = config['symlinks'].get(target).format(**format_dict)
            if path.exists(symlink):
                log.warning("Skipping %s -> %s symlink" % (symlink, target))
            else:
                log.info("Adding %s -> %s symlink" % (symlink, target))
                os.symlink(target, symlink)
    rc = 0
    for release in new_releases:
        branchConfig = get_branch_config(release)
        # candidate releases are split in two graphs and release-runner only handles the first
        # graph of tasks. so parts like postrelease, push_to_releases/mirrors, and mirror dependant
        # channels are handled in the second generated graph outside of release-runner.
        # This is not elegant but it should do the job for now
        release_channels = release['release_channels']
        candidate_release = is_candidate_release(release_channels)
        if candidate_release:
            postrelease_enabled = False
            postrelease_bouncer_aliases_enabled = False
            final_verify_channels = [
                c for c in release_channels if c not in branchConfig.get('mirror_requiring_channels', [])
            ]
            publish_to_balrog_channels = [
                c for c in release_channels if c not in branchConfig.get('mirror_requiring_channels', [])
            ]
            push_to_releases_enabled = False
            postrelease_mark_as_shipped_enabled = False
        else:
            postrelease_enabled = branchConfig[
                'postrelease_version_bump_enabled'][release['product']]
            postrelease_bouncer_aliases_enabled = branchConfig[
                'postrelease_bouncer_aliases_enabled']
            postrelease_mark_as_shipped_enabled = branchConfig[
                'postrelease_mark_as_shipped_enabled']
            final_verify_channels = release_channels
            publish_to_balrog_channels = release_channels
            push_to_releases_enabled = True

        # XXX: Doesn't work with neither Fennec nor Thunderbird
        platforms = branchConfig['release_platforms']

        try:
            task_group_id = None
            done = are_en_us_builds_completed(
                index=index, release_name=release['name'],
                submitted_at=release['submittedAt'],
                revision=release['mozillaRevision'],
                platforms=platforms, queue=queue,
                tc_task_indexes=branchConfig['tc_indexes'][release['product']])
            if not done:
                log.info(
                    'Builds are not completed yet, skipping release "%s" for now', release['name'])
                rr.update_status(release, 'Waiting for builds to be completed')
                continue

            log.info('Every build is completed for release: %s',
                     release['name'])
            rr.update_status(release, 'Generating task graph')

            kwargs = {
                "public_key": docker_worker_key,
                "version": release["version"],
                # ESR should not use "esr" suffix here:
                "next_version": bump_version(release["version"].replace("esr", "")),
                "appVersion": getAppVersion(release["version"]),
                "buildNumber": release["buildNumber"],
                "release_eta": release.get("release_eta"),
                "source_enabled": True,
                "checksums_enabled": True,
                "binary_transparency_enabled": branchConfig.get("binary_transparency_enabled", False),
                "repo_path": release["branch"],
                "revision": release["mozillaRevision"],
                "product": release["product"],
                "funsize_product": get_funsize_product(release["product"]),
                # if mozharness_revision is not passed, use 'revision'
                "mozharness_changeset": release.get('mh_changeset') or release['mozillaRevision'],
                "partial_updates": release.get('partial_updates', list()),
                "branch": release['branchShortName'],
                "updates_enabled": bool(release["partials"]),
                "l10n_config": get_l10n_config(
                    index=index, product=release[
                        "product"], branch=release['branchShortName'],
                    revision=release['mozillaRevision'],
                    platforms=branchConfig['platforms'],
                    l10n_platforms=branchConfig['l10n_release_platforms'],
                    l10n_changesets=release['l10n_changesets'],
                    tc_task_indexes=branchConfig['tc_indexes'][release['product']],
                ),
                "en_US_config": get_en_US_config(
                    index=index, product=release[
                        "product"], branch=release['branchShortName'],
                    revision=release['mozillaRevision'],
                    platforms=branchConfig['release_platforms'],
                    tc_task_indexes=branchConfig['tc_indexes'][release['product']],
                ),
                "verifyConfigs": {},
                "balrog_vpn_proxy": branchConfig["balrog_vpn_proxy"],
                "balrog_api_root": branchConfig["balrog_api_root"],
                "funsize_balrog_api_root": branchConfig["funsize_balrog_api_root"],
                "balrog_username": balrog_username,
                "balrog_password": balrog_password,
                "beetmover_aws_access_key_id": beetmover_aws_access_key_id,
                "beetmover_aws_secret_access_key": beetmover_aws_secret_access_key,
                # TODO: stagin specific, make them configurable
                "signing_class": branchConfig['signing_class'][release["product"]],
                "accepted_mar_channel_id": branchConfig.get('accepted_mar_channel_id', {}).get(release["product"]),
                "signing_cert": branchConfig['signing_cert'][release["product"]],
                "mar_signing_format": get_mar_signing_format(release["version"]),
                "moz_disable_mar_cert_verification": branchConfig.get('moz_disable_mar_cert_verification'),
                "root_home_dir": branchConfig['root_home_dir'][release["product"]],
                "bouncer_enabled": branchConfig["bouncer_enabled"],
                "updates_builder_enabled": branchConfig["updates_builder_enabled"],
                "update_verify_enabled": branchConfig["update_verify_enabled"],
                "release_channels": release_channels,
                "final_verify_channels": final_verify_channels,
                "final_verify_platforms": branchConfig['release_platforms'],
                "uptake_monitoring_platforms": branchConfig['uptake_monitoring_platforms'][release["product"]],
                "signing_pvt_key": signing_pvt_key,
                "build_tools_repo_path": branchConfig['build_tools_repo_path'],
                "push_to_candidates_enabled": branchConfig['push_to_candidates_enabled'],
                # TODO: temporary config enabled during 53 Fennec beta cycle
                "candidates_fennec_enabled": branchConfig.get('candidates_fennec_enabled'),
                "stage_product": branchConfig['stage_product'][release['product']],
                "postrelease_bouncer_aliases_enabled": postrelease_bouncer_aliases_enabled,
                "uptake_monitoring_enabled": branchConfig['uptake_monitoring_enabled'],
                "tuxedo_server_url": branchConfig['tuxedoServerUrl'],
                "postrelease_version_bump_enabled": postrelease_enabled,
                "postrelease_mark_as_shipped_enabled": postrelease_mark_as_shipped_enabled,
                "push_to_releases_enabled": push_to_releases_enabled,
                "push_to_releases_automatic": branchConfig['push_to_releases_automatic'],
                "beetmover_candidates_bucket": branchConfig["beetmover_buckets"][release["product"]],
                "partner_repacks_platforms": branchConfig.get("partner_repacks_platforms", {}).get(release["product"], []),
                "eme_free_repacks_platforms": branchConfig.get("eme_free_repacks_platforms", {}).get(release["product"], []),
                "sha1_repacks_platforms": branchConfig.get("sha1_repacks_platforms", []),
                "l10n_changesets": release['l10n_changesets'],
                "extra_balrog_submitter_params": extra_balrog_submitter_params + " --product " + release["product"].capitalize(),
                "publish_to_balrog_channels": publish_to_balrog_channels,
                "snap_enabled": branchConfig.get("snap_enabled", {}).get(release["product"], False),
                "update_verify_channel": branchConfig.get("update_verify_channel", {}).get(release["product"]),
                "update_verify_requires_cdn_push": branchConfig.get("update_verify_requires_cdn_push", False),
                "lzma_to_bz2": branchConfig.get("lzma_to_bz2", False),
            }

            # TODO: en-US validation for multiple tasks
            # validate_graph_kwargs(queue, gpg_key_path, **kwargs)
            task_group_id, toplevel_task_id, tasks = make_task_graph_strict_kwargs(**kwargs)
            rr.update_status(release, "Submitting tasks")
            log.info("Tasks generated!")
            import pprint
            for task_id, task_def in tasks.items():
                log.debug("%s ->\n%s", task_id,
                          pprint.pformat(task_def, indent=4, width=160))
            submit_parallelized(queue, tasks)
            resolve_task(queue, toplevel_task_id)

            rr.mark_as_completed(release)
            l10n_url = rr.release_l10n_api.getL10nFullUrl(release['name'])
            email_release_drivers(smtp_server=smtp_server, from_=notify_from,
                                  to=notify_to, release=release,
                                  task_group_id=task_group_id, l10n_url=l10n_url)
        except Exception as exception:
            # We explicitly do not raise an error here because there's no
            # reason not to start other releases if creating the Task Graph
            # fails for another one. We _do_ need to set this in order to exit
            # with the right code, though.
            rc = 2
            rr.mark_as_failed(
                release,
                'Failed to start release promotion (graph ID: %s). Error(s): %s' % (
                    task_group_id, exception)
            )
            log.exception('Failed to start release "%s" promotion for graph %s. Error(s): %s',
                          release['name'], task_group_id, exception)
            log.debug('Release failed: %s', release)

    if rc != 0:
        sys.exit(rc)

    log.debug('Sleeping for %s seconds before polling again', sleeptime)
    time.sleep(sleeptime)


if __name__ == '__main__':
    parser = OptionParser(__doc__)
    parser.add_option('-l', '--lockfile', dest='lockfile',
                      default=path.join(os.getcwd(), ".release-runner.lock"))
    parser.add_option('-c', '--config', dest='config',
                      help='Configuration file')

    options = parser.parse_args()[0]

    if not options.config:
        parser.error('Need to pass a config')

    lockfile = options.lockfile
    log.debug("Using lock file %s", lockfile)
    lock = FilesystemLock(lockfile)
    if not lock.lock():
        raise Exception("Cannot acquire lock: %s" % lockfile)
    log.debug("Lock acquired: %s", lockfile)
    if not lock.clean:
        log.warning("Previous run did not properly exit")
    try:
        main(options)
    finally:
        log.debug("Releasing lock: %s", lockfile)
        lock.unlock()
