#!/usr/bin/env python
import json
import os
import re
import hashlib

supported_platforms = {
        'win': 'win32',
        'win32': 'win32',
        'win64': 'win64',
        'window': 'win64',
        'windows': 'win64',
        'mac64': 'macosx64',
        'mac': 'macosx64',
        'linux-x86_64': 'linux64'
        }

class BuildProperties:
    def __init__(self):
        self.properties = {
                "properties": {
                    "appName": "Firefox",
                    "buildid": "",
                    "completeMarFilename": "",
                    "completeMarHash": "",
                    "completeMarSize": 0,
                    "completeMarUrl": "",
                    "hashType": "sha512",
                    "appVersion": "",
                    "platform": "",
                    "branch": "master",
                    "locale": "",
                    }
                }

    def gen_build_prop_file(self, filename):
        with open(filename, 'w') as build_prop_file:
            json.dump(self.properties, build_prop_file, indent = 4)

    def load_mach_build_props(self, mach_json):
        with open(mach_json,'r') as mach_build_props_file:
            return json.load(mach_build_props_file)

    def load_firefox_build_props(self,ff_json):
        with open(ff_json,'r') as ff_props_file:
            return json.load(ff_props_file)

    def get_firefox_props(self, ff_props_file, firefox_props):
        all_props = firefox_props.copy()
        additional_ff_props = self.load_firefox_build_props(ff_props_file)
        all_props.update(additional_ff_props)
        return all_props

    def update_properties(self, all_props):
        self.properties['properties']['buildid'] = all_props['buildid']
        self.properties['properties']['appVersion'] = all_props['moz_app_version']
        self.properties['properties']['completeMarFilename'] = all_props['completeMarFilename']
        self.properties['properties']['completeMarUrl'] = 'https://repository.cliqz.com/'+ s3_path +'/'+ all_props['completeMarFilename']
        self.properties['properties']['completeMarHash'] = all_props['completeMarHash']

        full_path = os.path.join(os.getcwd(), "dist", "update", all_props['completeMarFilename'])
        mar = open(full_path, 'rb').read()

        self.properties['properties']['completeMarHash'] = hashlib.sha512(mar).hexdigest()
        self.properties['properties']['completeMarSize'] = os.path.getsize(full_path)

        if all_props['moz_pkg_platform'] in supported_platforms:
            self.properties['properties']['platform'] = supported_platforms[all_props['moz_pkg_platform']]
        else:
            raise ValueError("Not supported platform [%s]" % all_props['moz_pkg_platform'])
        self.properties['properties']['locale'] = os.environ.get('LANG', None)
        if not self.properties['properties']['locale']:
            raise ValueError("Environment variable LANG must be set")
        self.properties['properties']['branch'] = os.environ.get('CQZ_RELEASE_CHANNEL', 'master')

if __name__ == '__main__':
    s3_path = os.environ.get('S3_UPLOAD_PATH','')
    if not s3_path:
        raise ValueError("Environment variable S3_UPLOAD_PATH must be set")

    prop = BuildProperties()
    mach_props = prop.load_mach_build_props('dist/mach_build_properties.json')

    firefox_props = {}
    for file in mach_props['uploadFiles']:
        if re.search('(\w+)\.json$', file):
            firefox_props = prop.get_firefox_props(file, firefox_props)

    all_props = mach_props.copy()
    all_props.update(firefox_props)

    prop.update_properties(all_props)
    prop.gen_build_prop_file('build_properties.json')
