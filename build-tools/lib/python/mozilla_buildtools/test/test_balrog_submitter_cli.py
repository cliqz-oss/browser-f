import unittest
import sys
from balrog.submitter.cli import NightlySubmitterBase, NightlySubmitterV4


class TestNightlySubmitterBase(unittest.TestCase):

    def test_replace_canocical_url(self):
        url_replacements = [
            ("ftp.mozilla.org", "download.cdn.mozilla.net")
        ]
        submitter = NightlySubmitterBase(api_root=None, auth=None,
                                         url_replacements=url_replacements)
        self.assertEqual(
            'http://download.cdn.mozilla.net/pub/mozilla.org/some/file',
            submitter._replace_canocical_url(
                'http://ftp.mozilla.org/pub/mozilla.org/some/file')
        )


class TestNightlySubmitterV4(unittest.TestCase):

    def test_canonical_ur_replacement(self):
        if sys.version_info < (2, 7):
            return
        url_replacements = [
            ("ftp.mozilla.org", "download.cdn.mozilla.net")
        ]
        submitter = NightlySubmitterV4(api_root=None, auth=None,
                                       url_replacements=url_replacements)
        completeInfo = [{
            'size': 123,
            'hash': 'abcd',
            'url': 'http://ftp.mozilla.org/url'
        }]
        data = submitter._get_update_data("prod", "brnch", completeInfo)
        self.assertDictEqual(
            data,
            {'completes': [{
                'fileUrl': 'http://download.cdn.mozilla.net/url',
                'filesize': 123,
                'from': '*',
                'hashValue': 'abcd'
            }]})

    def test_no_canonical_ur_replacement(self):
        if sys.version_info < (2, 7):
            return
        submitter = NightlySubmitterV4(api_root=None, auth=None,
                                       url_replacements=None)
        completeInfo = [{
            'size': 123,
            'hash': 'abcd',
            'url': 'http://ftp.mozilla.org/url'
        }]
        data = submitter._get_update_data("prod", "brnch", completeInfo)
        self.assertDictEqual(
            data,
            {'completes': [{
                'fileUrl': 'http://ftp.mozilla.org/url',
                'filesize': 123,
                'from': '*',
                'hashValue': 'abcd'
            }]})
