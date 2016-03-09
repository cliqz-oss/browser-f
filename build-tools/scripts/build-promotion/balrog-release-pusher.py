#!/usr/bin/env python
from os import path
import logging
import sys
import argparse

# Use explicit version of python-requests
sys.path.insert(0, path.join(path.dirname(__file__),
                             "../../lib/python/vendor/requests-2.7.0"))
sys.path.insert(0, path.join(path.dirname(__file__), "../../lib/python"))

from balrog.submitter.cli import ReleaseCreatorV4, ReleasePusher

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--app-version", required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--product", required=True, help="Product name")
    parser.add_argument(
        "--api-root", required=True, help="Balrog API URL prefix")
    parser.add_argument(
        "--credentials-file", required=True,
        help="BuildSlaves.py-style python file with Balrog credentials")
    parser.add_argument(
        "--username", required=True, help="Username in the credentials file")
    parser.add_argument(
        "--channel", dest="channels", action="append", required=True,
        help="Channels to set-up fileUrls for")
    parser.add_argument(
        "--rule-to-update", dest="rules_to_update", action="append", required=True,
        help="Test channels that will be automatically enabled")
    parser.add_argument(
        "--platform", dest="platforms", action="append", required=True,
        help="Buildbot-style platforms")
    parser.add_argument(
        "--partial-update", dest="partial_updates", action="append",
        required=True, help="List of partials, including build number (44.0b1build2)")
    parser.add_argument(
        "--requires-mirrors", action="store_true", default=False)
    parser.add_argument(
        "--download-domain", required=True, help="Bouncer domain name")
    parser.add_argument(
        "--archive-domain", required=True, help="File archive domain name")
    parser.add_argument("--open-url", help="What's New Page URL")
    parser.add_argument(
        "--hash-function", default="sha512",
        help="Hash function used in release blobs")
    parser.add_argument(
        "-v", "--verbose", action="store_const", dest="loglevel",
        const=logging.DEBUG, default=logging.INFO,
        help="Increase output verbosity")
    parser.add_argument(
        "--dummy", action="store_true", default=False,
        help="Use dummy balrog blobs")


    args = parser.parse_args()
    logging.basicConfig(format="%(message)s", level=args.loglevel)

    partials = {}
    for v in args.partial_updates:
        version, build_number = v.split("build")
        partials[version] = {"buildNumber": build_number}

    credentials = {}
    execfile(args.credentials_file, credentials)
    auth = (args.username, credentials['balrog_credentials'][args.username])
    creator = ReleaseCreatorV4(args.api_root, auth, dummy=args.dummy)
    pusher = ReleasePusher(args.api_root, auth, dummy=args.dummy)

    creator.run(
        appVersion=args.app_version,
        productName=args.product.capitalize(),
        version=args.version,
        buildNumber=args.build_number,
        updateChannels=args.channels,
        ftpServer=args.archive_domain,
        bouncerServer=args.download_domain,
        enUSPlatforms=args.platforms,
        hashFunction=args.hash_function,
        openURL=args.open_url,
        partialUpdates=partials,
        requiresMirrors=args.requires_mirrors)

    pusher.run(
        productName=args.product.capitalize(),
        version=args.version,
        build_number=args.build_number,
        rule_ids=args.rules_to_update)
