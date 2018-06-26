# TODO - redo errors to keep in style ??

from __future__ import absolute_import, print_function, unicode_literals

import logging
import os
import xml.etree.ElementTree as ET

import requests

# Suppress chatty requests logging
logging.getLogger("requests").setLevel(logging.WARNING)

log = logging.getLogger(__name__)

GITHUB_API_ENDPOINT = "https://api.github.com/graphql"

"""
LOGIN_QUERY, MANIFEST_QUERY, and REPACK_CFG_QUERY are all written to the Github v4 API,
which users GraphQL. See https://developer.github.com/v4/
"""

LOGIN_QUERY = """query {
  viewer {
    login
    name
  }
}
"""

# Returns the contents of default.xml from a manifest repository
MANIFEST_QUERY = """query {
  repository(owner:"%(owner)s", name:"%(repo)s") {
    object(expression: "master:default.xml") {
      ... on Blob {
        text
      }
    }
  }
}
"""

r"""
Example response:
{
  "data": {
    "repository": {
      "object": {
        "text": "<?xml version=\"1.0\" ?>\n<manifest>\n  " +
        "<remote fetch=\"git@github.com:mozilla-partners/\" name=\"mozilla-partners\"/>\n  " +
        "<remote fetch=\"git@github.com:mozilla/\" name=\"mozilla\"/>\n\n  " +
        "<project name=\"repack-scripts\" path=\"scripts\" remote=\"mozilla-partners\" " +
        "revision=\"master\"/>\n  <project name=\"build-tools\" path=\"scripts/tools\" " +
        "remote=\"mozilla\" revision=\"master\"/>\n  <project name=\"mozilla-EME-free\" " +
        "path=\"partners/mozilla-EME-free\" remote=\"mozilla-partners\" " +
        "revision=\"master\"/>\n</manifest>\n"
      }
    }
  }
}
"""

# Returns the contents of desktop/*/repack.cfg for a partner repository
REPACK_CFG_QUERY = """query{
  repository(owner:"%(owner)s", name:"%(repo)s") {
    object(expression: "master:desktop/"){
      ... on Tree {
        entries {
          name
          object {
            ... on Tree {
              entries {
                name
                object {
                  ... on Blob {
                    text
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
"""
r"""
Example response:
{
  "data": {
    "repository": {
      "object": {
        "entries": [
          {
            "name": "mozilla-EME-free",
            "object": {
              "entries": [
                {
                  "name": "distribution",
                  "object": {}
                },
                {
                  "name": "repack.cfg",
                  "object": {
                    "text": "aus=\"mozilla-EMEfree\"\ndist_id=\"mozilla-EMEfree\"\n" +
                            "dist_version=\"1.0\"\nlinux-i686=true\nlinux-x86_64=true\n" +
                            " locales=\"ach af de en-US\"\nmac=true\nwin32=true\nwin64=true\n" +
                            "output_dir=\"%(platform)s-EME-free/%(locale)s\"\n\n" +
                            "# Upload params\nbucket=\"net-mozaws-prod-delivery-firefox\"\n" +
                            "upload_to_candidates=true\n"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }
}
"""

# Map platforms in repack.cfg into their equivalents in taskcluster
TC_PLATFORM_PER_FTP = {
    'linux-i686': 'linux-nightly',
    'linux-x86_64': 'linux64-nightly',
    'mac': 'macosx64-nightly',
    'win32': 'win32-nightly',
    'win64': 'win64-nightly',
}

TASKCLUSTER_PROXY_SECRET_ROOT = 'http://taskcluster/secrets/v1/secret/'

# cache data at the module level
partner_configs = {}


def query_api(query, token):
    """ Make a query with a Github auth header, returning the json """
    headers = {'Authorization': 'bearer %s' % token}
    r = requests.post(GITHUB_API_ENDPOINT, json={'query': query}, headers=headers)
    r.raise_for_status()

    j = r.json()
    if 'errors' in j:
        raise RuntimeError("Github query error - %s", j['errors'])
    return j


def check_login(token):
    log.debug("Checking we have a valid login")
    query_api(LOGIN_QUERY, token)


def get_repo_params(repo):
    """ Parse the organisation and repo name from an https or git url for a repo """
    if repo.startswith('https'):
        # eg https://github.com/mozilla-partners/mozilla-EME-free
        return repo.rsplit('/', 2)[-2:]
    elif repo.startswith('git@'):
        # eg git@github.com:mozilla-partners/mailru.git
        repo = repo.replace('.git', '')
        return repo.split(':')[-1].split('/')


def get_partners(manifestRepo, token):
    """ Given the url to a manifest repository, retieve the default.xml and parse it into a
    list of parter repos.
    """
    log.debug("Querying for manifest in %s", manifestRepo)
    owner, repo = get_repo_params(manifestRepo)
    query = MANIFEST_QUERY % {'owner': owner, 'repo': repo}
    raw_manifest = query_api(query, token)
    log.debug("Raw manifest: %s", raw_manifest)
    if not raw_manifest['data']['repository']:
        raise RuntimeError(
            "Couldn't load partner manifest at %s, insufficient permissions ?" %
            manifestRepo
        )
    e = ET.fromstring(raw_manifest['data']['repository']['object']['text'])

    remotes = {}
    partners = {}
    for child in e:
        if child.tag == 'remote':
            name = child.attrib['name']
            url = child.attrib['fetch']
            remotes[name] = url
            log.debug('Added remote %s from %s', name, url)
        elif child.tag == 'project':
            # we don't need to check any code repos
            if 'scripts' in child.attrib['path']:
                continue
            partner_url = "%s%s" % (remotes[child.attrib['remote']],
                                    child.attrib['name'])
            partners[child.attrib['name']] = partner_url
            log.debug("Added partner %s" % partner_url)
    return partners


def parse_config(data):
    """ Parse a single repack.cfg file into a python dictionary.
    data is contents of the file, in "foo=bar\nbaz=buzz" style. We do some translation on
    locales and platforms data, otherewise passthrough
    """
    config = {'platforms': []}
    for l in data.splitlines():
        if '=' in l:
            l = str(l)
            key, value = l.split('=', 2)
            value = value.strip('\'"').rstrip('\'"')
            if key in ('linux-i686', 'linux-x86_64', 'mac', 'win32', 'win64'):
                if value.lower() == 'true':
                    config['platforms'].append(TC_PLATFORM_PER_FTP[key])
                continue
            if key == 'locales':
                # a list please
                value = value.split(" ")
            config[key] = value
    return config


def get_repack_configs(repackRepo, token):
    """ For a partner repository, retrieve all the repack.cfg files and parse them into a dict """
    log.debug("Querying for configs in %s", repackRepo)
    owner, repo = get_repo_params(repackRepo)
    query = REPACK_CFG_QUERY % {'owner': owner, 'repo': repo}
    raw_configs = query_api(query, token)
    raw_configs = raw_configs['data']['repository']['object']['entries']

    configs = {}
    for sub_config in raw_configs:
        name = sub_config['name']
        for file in sub_config['object'].get('entries', []):
            if file['name'] != 'repack.cfg':
                continue
            configs[name] = parse_config(file['object']['text'])
    ALLOWED_KEYS = ('locales', 'upload_to_candidates', 'platforms')
    for subpartner, sub_config in configs.items():
        for key in list(sub_config.keys()):
            if key not in ALLOWED_KEYS:
                del(sub_config[key])
    return configs


def get_partner_config_by_url(manifest_url, kind, token, partner_subset=None):
    """ Retrieve partner data starting from the manifest url, which points to a repository
    containing a default.xml that is intended to be drive the Google tool 'repo'. It
    descends into each partner repo to lookup and parse the repack.cfg file(s).

    If partner_subset is a list of sub_config names only return data for those.

    Supports caching data by kind to avoid repeated requests, relying on the related kinds for
    partner repacking, signing, repackage, repackage signing all having the same kind prefix.
    """
    if kind not in partner_configs:
        log.info('Looking up data for %s from %s', kind, manifest_url)
        check_login(token)
        partners = get_partners(manifest_url, token)

        partner_configs[kind] = {}
        for partner, partner_url in partners.items():
            partner_configs[kind][partner] = get_repack_configs(partner_url, token)

        # if we're only interested in a subset of partners we remove the rest
        if partner_subset:
            new_config = {}
            for partner in partner_subset:
                if partner not in partner_configs[kind]:
                    # TODO - should be fatal ?
                    log.warning('Partner config for %s not found, skipping', partner)
                    partner_subset.remove(partner)
                else:
                    new_config[partner] = partner_configs[kind][partner]
            partner_configs[kind] = new_config

    return partner_configs[kind]
