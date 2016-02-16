#!/usr/bin/env python

import os
from os import path
import sys
import logging
import argparse
import site

logging.basicConfig(
    stream=sys.stdout, level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))
site.addsitedir(path.join(path.dirname(__file__), "../../lib/python/vendor"))
from release.info import readReleaseConfig, readConfig
from util.hg import update, mercurial
from util.retry import retry
import requests

REQUIRED_RELEASE_CONFIG = ("version", "stage_product")


def update_bouncer_aliases(tuxedoServerUrl, auth, version, bouncer_aliases):
    for related_product_template, alias in bouncer_aliases.iteritems():
        update_bouncer_alias(tuxedoServerUrl, auth, version,
                             related_product_template, alias)


def update_bouncer_alias(tuxedoServerUrl, auth, version,
                         related_product_template, alias):
    url = "%s/create_update_alias" % tuxedoServerUrl
    related_product = related_product_template % {"version": version}

    data = {"alias": alias, "related_product": related_product}
    log.info("Updating %s to point to %s using %s", alias, related_product,
             url)

    # Wrap the real call to hide credentials from retry's logging
    def do_update_bouncer_alias():
        r = requests.post(url, data=data, auth=auth, verify=False)
        r.raise_for_status()

    retry(do_update_bouncer_alias)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()

    parser.add_argument("-r", "--release-config", required=True,
                        help="Release config file location relative to "
                        "buildbot-configs repo root")
    parser.add_argument("-b", "--buildbot-configs", required=True,
                        help="buildbot-configs mercurial repo URL")
    parser.add_argument("-t", "--release-tag", required=True)
    args = parser.parse_args()

    mercurial(args.buildbot_configs, "buildbot-configs")
    update("buildbot-configs", revision=args.release_tag)

    releaseConfigFile = path.join("buildbot-configs", args.release_config)
    releaseConfig = readReleaseConfig(
        releaseConfigFile, required=REQUIRED_RELEASE_CONFIG)

    version = releaseConfig['version']
    bouncer_aliases = releaseConfig.get('bouncer_aliases')

    if bouncer_aliases:
        credentials_file = path.join(os.getcwd(), "oauth.txt")
        credentials = readConfig(
            credentials_file,
            required=["tuxedoUsername", "tuxedoPassword"])
        auth = (credentials["tuxedoUsername"],
                credentials["tuxedoPassword"])

        update_bouncer_aliases(
            tuxedoServerUrl=releaseConfig["tuxedoServerUrl"],
            auth=auth,
            version=version,
            bouncer_aliases=bouncer_aliases)
    else:
        log.warn("No bouncer aliases defined, skipping...")
