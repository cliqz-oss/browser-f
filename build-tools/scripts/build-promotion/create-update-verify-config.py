#!/usr/bin/env python

import site
from os import path
import logging
import argparse

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))
site.addsitedir(path.join(path.dirname(__file__), "../../lib/python/vendor"))

from distutils.version import LooseVersion
from release.updates.patcher import PatcherConfig
from release.l10n import makeReleaseRepackUrls
from release.platforms import buildbot2updatePlatforms, buildbot2ftp
from release.paths import makeReleasesDir, makeCandidatesDir
from release.updates.verify import UpdateVerifyConfig

log = logging.getLogger()


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
    parser.add_argument("--archive-prefix", required=True)
    parser.add_argument("--previous-archive-prefix")
    parser.add_argument("--balrog-url", required=True)
    parser.add_argument("--build-number", required=True)

    args = parser.parse_args()
    logging.basicConfig(format="%(message)s", level=args.loglevel)

    ftp_platform = buildbot2ftp(args.platform)
    full_check_locales = args.full_check_locales
    product_name = args.product
    prev_archive_prefix = args.previous_archive_prefix or args.archive_prefix
    aus_server_url = args.balrog_url
    build_number = args.build_number

    # Current version data
    pc = PatcherConfig(args.config.read())
    partials = pc['current-update']['partials'].keys()
    app_name = pc['appName']
    to_version = pc['current-update']['to']
    to_ = makeReleaseRepackUrls(
        product_name, app_name, to_version, args.platform,
        locale='%locale%', signed=True, exclude_secondary=True
    ).values()[0]
    candidates_dir = makeCandidatesDir(
        product_name, to_version, build_number, ftp_root='/')
    to_path = "%s%s" % (candidates_dir, to_)

    uvc = UpdateVerifyConfig(
        product=app_name, channel=args.update_verify_channel,
        aus_server=aus_server_url, to=to_path)

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

    for fromVersion in reversed(sorted(updatePaths, key=LooseVersion)):
        locales = updatePaths[fromVersion]
        from_ = pc["release"][fromVersion]
        appVersion = from_["extension-version"]
        build_id = from_["platforms"][ftp_platform]
        mar_channel_IDs = from_.get('mar-channel-ids')

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
        release_dir = makeReleasesDir(product_name, fromVersion, ftp_root='/')
        from_path = "%s%s" % (release_dir, path_)

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
                           platform=update_platform)
        else:
            if len(this_full_check_locales) > 0:
                log.info("Generating full check configs for %s" % fromVersion)
                uvc.addRelease(release=appVersion, build_id=build_id,
                               locales=this_full_check_locales,
                               from_path=from_path,
                               ftp_server_from=prev_archive_prefix,
                               ftp_server_to=args.archive_prefix,
                               mar_channel_IDs=mar_channel_IDs,
                               platform=update_platform)
            # Quick test for other locales, no download
            if len(quick_check_locales) > 0:
                log.info("Generating quick check configs for %s" % fromVersion)
                uvc.addRelease(release=appVersion, build_id=build_id,
                               locales=quick_check_locales,
                               platform=update_platform)

    uvc.write(args.output)
