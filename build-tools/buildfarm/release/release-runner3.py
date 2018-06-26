#!/usr/bin/env python
"""
Release runner to schedule action tasks (in-tree scheduling)
"""

import argparse
from copy import deepcopy
import logging
import os
import re
import site
import sys
import taskcluster
import time
import yaml

from os import path
from twisted.python.lockfile import FilesystemLock

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))

from release.info import isFinalRelease

from kickoff import (ReleaseRunner, long_revision, email_release_drivers,
                     bump_version, get_partials)
from kickoff.sanity.partials import PartialsSanitizer
from kickoff.sanity.revisions import RevisionsSanitizer
from kickoff.actions import generate_action_task, submit_action_task, find_decision_task_id
from kickoff.partners import get_partner_config_by_url


log = logging.getLogger(__name__)


def check_and_assign_long_revision(release_runner, release, releases_config):
    # Revisions must be checked before trying to get the long one.
    RevisionsSanitizer(**release).run()
    release['mozillaRevision'] = long_revision(
        release['branch'], release['mozillaRevision'])


def get_trust_domain(releases_config, release):
    product = release['product']
    for entry in releases_config:
        if entry['product'] == product:
            return entry['trust_domain']
    raise RuntimeError("Unknown product %s", product)


def get_notify_to(releases_config, release, default):
    product = release['product']
    for entry in releases_config:
        if entry['product'] == product:
            return entry.get("notify_to_announce", default)
    raise RuntimeError("Unknown product %s", product)


def check_allowed_branches(release_runner, release, releases_config):
    product = release['product']
    branch = release['branch']
    for entry in releases_config:
        if entry['product'] == product:
            allowed_branches = entry['allowed_branches']
            for pattern in allowed_branches:
                if re.match(pattern, branch):
                    return
    raise RuntimeError("%s branch not allowed: %s", branch, allowed_branches)


def assign_and_check_partial_updates(release_runner, release, releases_config):
    release['partial_updates'] = get_partials(
        release_runner, release['partials'], release['product'])
    product = release['product']
    if product in ('thunderbird',):
        return
    PartialsSanitizer(**release).run()


# So people can't run arbitrary functions
CHECKS_MAPPING = {
    'long_revision': check_and_assign_long_revision,
    'check_allowed_branches': check_allowed_branches,
    'partial_updates': assign_and_check_partial_updates,
}


def run_prebuild_sanity_checks(release_runner, releases_config):
    new_valid_releases = []

    # results in:
    # { 'firefox': ['long_revision', 'l10n_changesets', 'partial_updates']}
    checks = {r['product'].lower(): r['checks'] for r in releases_config}

    for release in release_runner.new_releases:
        log.info('Got a new release request: %s' % release)
        try:
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


def is_beta(version):
    return "b" in version


def is_esr(version):
    return "esr" in version


def is_rc(release):
    if not is_beta(release['version']) and not is_esr(release['version']):
        if isFinalRelease(release["version"]):
            return True
        # RC release types will enable beta-channel testing &
        # shipping. We need this for all "final" releases
        # and also any releases that include a beta as a partial.
        # The assumption that "shipping to beta channel" always
        # implies other RC behaviour is bound to break at some
        # point, but this works for now.
        for version in release["partial_updates"]:
            if is_beta(version):
                return True
    return False


def get_beta_num(version):
    if is_beta(version):
        parts = version.split('b')
        return int(parts[-1])


def is_partner_enabled(release, min_version):
    major_version = int(release['version'].split('.')[0])
    if release["product"] == "firefox" and major_version >= min_version:
        if is_beta(release['version']):
            if get_beta_num(release['version']) >= 8:
                return True
        elif not is_esr(release['version']):
            return True
    return False


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

    github_token = config['git']['github_token']
    partner_config = deepcopy(config['partners'])
    rr_config = config['release-runner']
    sleeptime = rr_config['sleeptime']
    smtp_server = rr_config.get('smtp_server', 'localhost')
    notify_from = rr_config.get('notify_from')
    notify_to = rr_config.get('notify_to_announce')

    rr = ReleaseRunner(api_root=api_root, username=username, password=password)
    tc_config = {
        "credentials": {
            "clientId": config["taskcluster"].get("client_id"),
            "accessToken": config["taskcluster"].get("access_token"),
        },
        "maxRetries": 12,
    }
    queue = taskcluster.Queue(tc_config)

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

    rc = 0
    for release in new_releases:
        try:
            version = release["version"]
            # XXX we may want to move next_version logic to the release_promotion action.
            next_version = bump_version(version.replace("esr", ""))
            project = release["branchShortName"]
            revision = release["mozillaRevision"]
            # XXX we probably want to find a decision task ID for the action, and a separate
            # one for the revision-to-promote, to allow for https://trello.com/c/u6MHrz8y .
            decision_task_id = find_decision_task_id(
                trust_domain=get_trust_domain(config['releases'], release),
                project=project, revision=revision,
            )
            action_task_input = {
                "build_number": release["buildNumber"],
                "next_version": next_version,
                # specify version rather than relying on in-tree version,
                # so if a version bump happens between the build and an action task
                # revision, we still use the correct version.
                "version": version,
                "release_promotion_flavor": "promote_{}".format(release["product"]),
                "previous_graph_ids": [decision_task_id],
                "release_eta": release.get("release_eta", ""),
            }
            if "partial_updates" in release:
                action_task_input["partial_updates"] = {}
                for partial_version, info in release["partial_updates"].items():
                    action_task_input["partial_updates"][partial_version] = {
                        "buildNumber": info["buildNumber"],
                        "locales": info["locales"]
                    }
            if release["product"] == "firefox":
                if is_rc(release):
                    # XXX The current plan is to run promote_firefox_rc, then
                    # ship_firefox_rc, then push_firefox, then ship_firefox.
                    # We need to support this workflow. However, rr3 doesn't
                    # support anything more than the first action task yet,
                    # so this isn't a missing feature for RCs specifically.
                    action_task_input["release_promotion_flavor"] = "{}_rc".format(
                        action_task_input["release_promotion_flavor"]
                    )
            if not is_partner_enabled(release, partner_config['partner_min_version']):
                action_task_input['release_enable_emefree'] = False
                action_task_input['release_enable_partners'] = False
            action_task_id, action_task = generate_action_task(
                decision_task_id=decision_task_id,
                action_task_input=action_task_input,
            )
            submit_action_task(queue=queue, action_task_id=action_task_id,
                               action_task=action_task)
            rr.mark_as_completed(release)
            l10n_url = rr.release_l10n_api.getL10nFullUrl(release['name'])
            email_release_drivers(smtp_server=smtp_server, from_=notify_from,
                                  to=[get_notify_to(config['releases'], release, notify_to)],
                                  release=release,
                                  task_group_id=action_task_id, l10n_url=l10n_url)
        except Exception as exception:
            # We explicitly do not raise an error here because there's no
            # reason not to start other releases if creating the Task Graph
            # fails for another one. We _do_ need to set this in order to exit
            # with the right code, though.
            rc = 2
            rr.mark_as_failed(
                release,
                'Failed to start release promotion. Error(s): %s' % (exception)
            )
            log.exception('Failed to start release "%s". Error(s): %s',
                          release['name'], exception)
            log.debug('Release failed: %s', release)

    if rc != 0:
        sys.exit(rc)

    log.debug('Sleeping for %s seconds before polling again', sleeptime)
    time.sleep(sleeptime)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-l', '--lockfile',
                        default=path.join(os.getcwd(), ".release-runner.lock"))
    parser.add_argument('-c', '--config', required=True, help='Configuration file')
    args = parser.parse_args()

    lockfile = args.lockfile
    log.debug("Using lock file %s", lockfile)
    lock = FilesystemLock(lockfile)
    if not lock.lock():
        raise Exception("Cannot acquire lock: %s" % lockfile)
    log.debug("Lock acquired: %s", lockfile)
    if not lock.clean:
        log.warning("Previous run did not properly exit")
    try:
        main(args)
    finally:
        log.debug("Releasing lock: %s", lockfile)
        lock.unlock()
