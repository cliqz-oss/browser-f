#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import json
import buildconfig


def parse_cmdline(args):
    """Take a list of strings in the format K=V and turn them into a python
    dictionary"""
    contents = {}
    for arg in args:
        key, s, value = arg.partition("=")
        if s == '':
            print "ERROR: Malformed command line key value pairing (%s)" % arg
            exit(1)
        contents[key.lower()] = value
    return contents


def main():
    if len(sys.argv) < 2:
        print "ERROR: You must specify an output file"
        exit(1)

    all_key_value_pairs = {}
    important_substitutions = [
        'target_alias', 'target_cpu', 'target_os', 'target_vendor',
        'host_alias', 'host_cpu', 'host_os', 'host_vendor',
        'MOZ_UPDATE_CHANNEL', 'MOZ_APP_VENDOR', 'MOZ_APP_NAME',
        'MOZ_APP_VERSION', 'MOZ_APP_MAXVERSION', 'MOZ_APP_ID',
        'CC', 'CXX', 'AS']

    all_key_value_pairs = dict([(x.lower(), buildconfig.substs[x]) for x in important_substitutions])
    all_key_value_pairs.update(parse_cmdline(sys.argv[2:]))

<<<<<<< HEAD
    with open(sys.argv[1], "w+") as f:
||||||| merged common ancestors
    with open(args.output_json, 'wb') as f:
=======
    with open(args.output_json, 'wt') as f:
>>>>>>> origin/upstream-releases
        json.dump(all_key_value_pairs, f, indent=2, sort_keys=True)
        f.write('\n')

<<<<<<< HEAD
||||||| merged common ancestors
    with open(args.buildhub_json, 'wb') as f:
        build_time = datetime.datetime.strptime(build_id, '%Y%m%d%H%M%S')
        s = buildconfig.substs
        record = {
            'build': {
                'id': build_id,
                'date': build_time.isoformat() + 'Z',
                'as': s['AS'],
                'cc': s['CC'],
                'cxx': s['CXX'],
                'host': s['host_alias'],
                'target': s['target_alias'],
            },
            'source': {
                'product': s['MOZ_APP_NAME'],
                'repository': s['MOZ_SOURCE_REPO'],
                'tree': os.environ['MH_BRANCH'],
                'revision': s['MOZ_SOURCE_CHANGESET'],
            },
            'target': {
                'platform': args.pkg_platform,
                'os': mozinfo.info['os'],
                # This would be easier if the locale was specified at configure time.
                'locale': os.environ.get('AB_CD', 'en-US'),
                'version': s['MOZ_APP_VERSION_DISPLAY'] or s['MOZ_APP_VERSION'],
                'channel': s['MOZ_UPDATE_CHANNEL'],
            },
        }

        if args.no_download:
            package = None
        elif args.installer and os.path.exists(args.installer):
            package = args.installer
        else:
            package = args.package
        if package:
            st = os.stat(package)
            mtime = datetime.datetime.fromtimestamp(st.st_mtime)
            record['download'] = {
                # The release pipeline will update these keys.
                'url': os.path.basename(package),
                'mimetype': 'application/octet-stream',
                'date': mtime.isoformat() + 'Z',
                'size': st.st_size,
            }

        json.dump(record, f, indent=2, sort_keys=True)
        f.write('\n')

    with open(args.output_txt, 'wb') as f:
        f.write('buildID={}\n'.format(build_id))

=======
    with open(args.buildhub_json, 'wt') as f:
        build_time = datetime.datetime.strptime(build_id, '%Y%m%d%H%M%S')
        s = buildconfig.substs
        record = {
            'build': {
                'id': build_id,
                'date': build_time.isoformat() + 'Z',
                'as': s['AS'],
                'cc': s['CC'],
                'cxx': s['CXX'],
                'host': s['host_alias'],
                'target': s['target_alias'],
            },
            'source': {
                'product': s['MOZ_APP_NAME'],
                'repository': s['MOZ_SOURCE_REPO'],
                'tree': os.environ['MH_BRANCH'],
                'revision': s['MOZ_SOURCE_CHANGESET'],
            },
            'target': {
                'platform': args.pkg_platform,
                'os': mozinfo.info['os'],
                # This would be easier if the locale was specified at configure time.
                'locale': os.environ.get('AB_CD', 'en-US'),
                'version': s['MOZ_APP_VERSION_DISPLAY'] or s['MOZ_APP_VERSION'],
                'channel': s['MOZ_UPDATE_CHANNEL'],
            },
        }

        if args.no_download:
            package = None
        elif args.installer and os.path.exists(args.installer):
            package = args.installer
        else:
            package = args.package
        if package:
            st = os.stat(package)
            mtime = datetime.datetime.fromtimestamp(st.st_mtime)
            record['download'] = {
                # The release pipeline will update these keys.
                'url': os.path.basename(package),
                'mimetype': 'application/octet-stream',
                'date': mtime.isoformat() + 'Z',
                'size': st.st_size,
            }

        json.dump(record, f, indent=2, sort_keys=True)
        f.write('\n')

    with open(args.output_txt, 'wt') as f:
        f.write('buildID={}\n'.format(build_id))

>>>>>>> origin/upstream-releases

if __name__=="__main__":
    main()
