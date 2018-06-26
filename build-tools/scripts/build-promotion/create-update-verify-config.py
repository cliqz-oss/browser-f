#!/usr/bin/env python

import site
from os import path
import logging
import argparse
import math

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))
site.addsitedir(path.join(path.dirname(__file__), "../../lib/python/vendor"))

from distutils.version import LooseVersion
from release.updates.patcher import PatcherConfig
from release.l10n import makeReleaseRepackUrls
from release.platforms import buildbot2updatePlatforms, buildbot2ftp
from release.paths import makeReleasesDir, makeCandidatesDir
from release.updates.verify import UpdateVerifyConfig

log = logging.getLogger()


def is_triangualar(x):
    """Check if a number is triangular (0, 1, 3, 6, 10, 15, ...)
    see: https://en.wikipedia.org/wiki/Triangular_number#Triangular_roots_and_tests_for_triangular_numbers

    >>> is_triangualar(0)
    True
    >>> is_triangualar(1)
    True
    >>> is_triangualar(2)
    False
    >>> is_triangualar(3)
    True
    >>> is_triangualar(4)
    False
    >>> all(is_triangualar(x) for x in [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105])
    True
    >>> all(not is_triangualar(x) for x in [4, 5, 8, 9, 11, 17, 25, 29, 39, 44, 59, 61, 72, 98, 112])
    True
    """
    n = (math.sqrt(8*x + 1) - 1)/2
    return n == int(n)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", dest="config", required=True,
                        type=argparse.FileType('r'), help="Patcher config")
    parser.add_argument("--platform", required=True)
    parser.add_argument("--update-verify-channel", required=True)
    parser.add_argument("--full-check-locale", dest="full_check_locales",
                        action="append", default=['de', 'en-US', 'ru'])
    parser.add_argument("--output", dest="output", required=True,
                        type=argparse.FileType('w'))
    parser.add_argument("-v", "--verbose", action="store_const",
                        dest="loglevel", const=logging.DEBUG,
                        default=logging.INFO,
                        help="Increase output verbosity")
    parser.add_argument("--product", required=True, help="Product name")
    parser.add_argument("--stage-product", help="Stage product name")
    parser.add_argument("--archive-prefix", required=True)
    parser.add_argument("--previous-archive-prefix")
    parser.add_argument("--balrog-url", required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--updater-platform", dest="updater_platform", default=None)
    args = parser.parse_args()
    logging.basicConfig(format="%(message)s", level=args.loglevel)

    ftp_platform = buildbot2ftp(args.platform)
    full_check_locales = args.full_check_locales
    product_name = args.product
    stage_product_name = args.stage_product or product_name
    prev_archive_prefix = args.previous_archive_prefix or args.archive_prefix
    aus_server_url = args.balrog_url
    build_number = args.build_number
    updater_platform = args.updater_platform

    # Current version data
    pc = PatcherConfig(args.config.read())
    partials = pc['current-update']['partials'].keys()
    app_name = pc['appName']
    to_version = pc['current-update']['to']
    to_release = pc['release'][to_version]
    to_ = makeReleaseRepackUrls(
        product_name, app_name, to_version, args.platform,
        locale='%locale%', signed=True, exclude_secondary=True
    ).values()[0]
    candidates_dir = makeCandidatesDir(
        stage_product_name, to_version, build_number, ftp_root='/')
    to_path = "%s%s" % (candidates_dir, to_)

    uvc = UpdateVerifyConfig(
        product=app_name, channel=args.update_verify_channel,
        aus_server=aus_server_url, to=to_path,
        to_build_id=to_release["platforms"][ftp_platform],
        to_app_version=to_release["version"],
        to_display_version=to_release["prettyVersion"])

    # getUpdatePaths yields all of the update paths, but we need to know
    # everything about a fromVersion before we can add it to the update
    # verify config, so we need to collect everything it yields before
    # acting on it.
    updatePaths = {}
    for fromVersion, platform, locale, _, _ in pc.getUpdatePaths():
        # Skip paths from platforms we don't care about.
        if platform != ftp_platform:
            continue
        if fromVersion not in updatePaths:
            updatePaths[fromVersion] = []
        updatePaths[fromVersion].append(locale)

    completes_only_index = 0
    for fromVersion in reversed(sorted(updatePaths, key=LooseVersion)):
        locales = updatePaths[fromVersion]
        from_ = pc["release"][fromVersion]
        appVersion = from_["extension-version"]
        build_id = from_["platforms"][ftp_platform]
        mar_channel_IDs = from_.get('mar-channel-ids')
        if not updater_platform:
            updater_platform = args.platform

        # Use new build targets for Windows, but only on compatible
        #  versions (42+). See bug 1185456 for additional context.
        if args.platform not in ("win32", "win64") or \
                LooseVersion(fromVersion) < LooseVersion("42.0"):
            update_platform = buildbot2updatePlatforms(args.platform)[0]
        else:
            update_platform = buildbot2updatePlatforms(args.platform)[1]

        path_ = makeReleaseRepackUrls(
            product_name, app_name, fromVersion, args.platform,
            locale='%locale%', signed=True, exclude_secondary=True
        ).values()[0]
        release_dir = makeReleasesDir(stage_product_name, fromVersion, ftp_root='/')
        from_path = "%s%s" % (release_dir, path_)
        updater_package = "%s%s" % (release_dir, makeReleaseRepackUrls(
            product_name, app_name, fromVersion, updater_platform,
            locale='%locale%', signed=True, exclude_secondary=True
        ).values()[0])

        # Exclude locales being full checked
        quick_check_locales = [l for l in locales
                               if l not in full_check_locales]
        # Get the intersection of from and to full_check_locales
        this_full_check_locales = [l for l in full_check_locales
                                   if l in locales]

        if fromVersion in partials:
            log.info("Generating configs for partial update checks for %s" %
                     fromVersion)
            uvc.addRelease(release=appVersion, build_id=build_id,
                           locales=locales,
                           patch_types=["complete", "partial"],
                           from_path=from_path,
                           ftp_server_from=prev_archive_prefix,
                           ftp_server_to=args.archive_prefix,
                           mar_channel_IDs=mar_channel_IDs,
                           platform=update_platform,
                           updater_package=updater_package)
        else:
            if this_full_check_locales and is_triangualar(completes_only_index):
                log.info("Generating full check configs for %s" % fromVersion)
                uvc.addRelease(release=appVersion, build_id=build_id,
                               locales=this_full_check_locales,
                               from_path=from_path,
                               ftp_server_from=prev_archive_prefix,
                               ftp_server_to=args.archive_prefix,
                               mar_channel_IDs=mar_channel_IDs,
                               platform=update_platform,
                               updater_package=updater_package)
            # Quick test for other locales, no download
            if len(quick_check_locales) > 0:
                log.info("Generating quick check configs for %s" % fromVersion)
                if not is_triangualar(completes_only_index):
                    # Assuming we skipped full check locales, using all locales
                    _locales = locales
                else:
                    # Excluding full check locales from the quick check
                    _locales = quick_check_locales
                uvc.addRelease(release=appVersion, build_id=build_id,
                               locales=_locales,
                               platform=update_platform)
            completes_only_index += 1

    uvc.write(args.output)
