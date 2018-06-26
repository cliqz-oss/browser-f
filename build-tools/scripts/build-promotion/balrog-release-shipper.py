#!/usr/bin/env python

from os import path
import logging
import sys
import os

# Use explicit version of python-requests
sys.path.insert(0, path.join(path.dirname(__file__),
                             "../../lib/python/vendor/requests-2.7.0"))
sys.path.insert(0, path.join(path.dirname(__file__),
                             "../../lib/python/vendor/arrow-0.10.0"))
sys.path.insert(0, path.join(path.dirname(__file__),
                             "../../lib/python/vendor/python-dateutil-2.6.0"))
sys.path.insert(0, path.join(path.dirname(__file__),
                             "../../lib/python/vendor/six-1.10.0"))
sys.path.insert(0, path.join(path.dirname(__file__), "../../lib/python"))

from balrog.submitter.cli import ReleaseScheduler

if __name__ == '__main__':

    from argparse import ArgumentParser
    parser = ArgumentParser()
    parser.add_argument("-a", "--api-root", dest="api_root", required=True)
    parser.add_argument("-c", "--credentials-file", dest="credentials_file", required=True)
    parser.add_argument("-u", "--username", dest="username", required=True)
    parser.add_argument("-V", "--version", dest="version", required=True)
    parser.add_argument("-p", "--product", dest="product_name", required=True)
    parser.add_argument("-b", "--build-number", dest="build_number", required=True)
    parser.add_argument("-R", "--rules", dest="rule_ids", action="append", required=True)
    parser.add_argument("-s", "--schedule-at", dest="schedule_at", default=None)
    parser.add_argument("-B", "--background-rate", dest="backgroundRate", default=None)
    parser.add_argument("-v", "--verbose", dest="verbose", action="store_true")
    args = parser.parse_args()

    logging_level = logging.INFO
    if args.verbose:
        logging_level = logging.DEBUG
    logging.basicConfig(stream=sys.stdout, level=logging_level,
                        format="%(message)s")

    credentials = {}
    execfile(args.credentials_file, credentials)
    auth = (args.username, credentials['balrog_credentials'][args.username])
    suffix = os.environ.get("BALROG_BLOB_SUFFIX")

    scheduler = ReleaseScheduler(args.api_root, auth, suffix=suffix)
    if args.backgroundRate:
        scheduler.run(args.product_name.capitalize(), args.version,
                      args.build_number, args.rule_ids, args.schedule_at, args.backgroundRate)
    else:
        scheduler.run(args.product_name.capitalize(), args.version,
                      args.build_number, args.rule_ids, args.schedule_at)
