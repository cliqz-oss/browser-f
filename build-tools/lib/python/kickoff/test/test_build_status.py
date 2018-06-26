import unittest
from mock import MagicMock, patch
import taskcluster
from datetime import datetime, timedelta
from dateutil import tz

from kickoff.build_status import are_en_us_builds_completed, EnUsBuildsWatcher, TimeoutWatcher


class BuildsCompletedBase(unittest.TestCase):
    def setUp(self):
        self.index = MagicMock()
        self.revision = 'abcdef123456'
        self.platforms = ('linux', 'win32', 'win64')
        self.tc_task_indexes = {
            "linux": { "signed": "linux_signed_task", "unsigned": "linux_unsigned_task", "ci_system": "tc"},
            "win32": { "signed": "signed_task", "unsigned": "unsigned_task", "repackage-signing": "rs", "ci_system": "tc" },
            "win64": { "signed": "signed_task", "unsigned": "unsigned_task", "repackage-signing": "rs", "ci_system": "tc"},
        }
        self.queue = MagicMock()

        self.now = datetime.now(tz.tzutc())
        self.submitted_at = '{}+00:00'.format(self.now.isoformat())


class AreEnUsBuildsCompletedTest(BuildsCompletedBase):
    # Each test in this suite defines a different release_name. That's because
    # tests are multi-threaded and there are collisions with the internal of
    # memoization of are_en_us_builds_completed()

    def test_returns_true_when_everything_is_ready(self):
        self.index.findTask.side_effect = SideEffects.everything_has_an_id

        release_name = 'Firefox-32.0b1-build1'
        self.assertTrue(are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        ))

    def test_returns_false_if_one_task_is_missing(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task

        release_name = 'Firefox-32.0b1-build2'
        self.assertFalse(are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        ))

    def test_stores_results_of_the_previous_call(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task

        release_name = 'Firefox-32.0b1-build5'
        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 7)

        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 8)

    def test_creates_new_watcher_if_new_release_name(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task

        release_name = 'Firefox-32.0b1-build6'
        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 7)

        release_name = 'Firefox-32.0b1-build99'
        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 14)

    def test_delete_watcher_if_all_builds_are_completed(self):
        self.index.findTask.side_effect = SideEffects.everything_has_an_id

        release_name = 'Firefox-32.0b1-build7'
        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 8)

        are_en_us_builds_completed(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )
        self.assertEqual(self.index.findTask.call_count, 16)


class EnUsBuildsWatcherTest(BuildsCompletedBase):
    def setUp(self):
        BuildsCompletedBase.setUp(self)
        release_name = 'Firefox-46.0b8-build1'
        self.watcher = EnUsBuildsWatcher(
            self.index, release_name, self.submitted_at, self.revision,
            self.platforms, self.queue, self.tc_task_indexes
        )

    def test_returns_true_when_everything_is_ready(self):
        self.index.findTask.side_effect = SideEffects.everything_has_an_id
        self.assertTrue(self.watcher.are_builds_completed())

    def test_returns_false_if_one_task_is_missing(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task
        self.assertFalse(self.watcher.are_builds_completed())

    def test_only_fetches_missing_tasks_the_second_time(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task

        self.watcher.are_builds_completed()
        self.assertEqual(self.index.findTask.call_count, 7)

        self.watcher.are_builds_completed()
        self.assertEqual(self.index.findTask.call_count, 8)

    def test_times_out_1_day_after_submission_in_ship_it(self):
        self.index.findTask.side_effect = SideEffects.linux_has_no_task

        less_than_one_day_after_submission = self.now + timedelta(hours=23, minutes=59, seconds=59)
        with patch('kickoff.build_status.TimeoutWatcher._now', return_value=less_than_one_day_after_submission):
            self.watcher.are_builds_completed()

        one_day_after_submission = self.now + timedelta(days=1, seconds=1)
        with patch('kickoff.build_status.TimeoutWatcher._now', return_value=one_day_after_submission):
            with self.assertRaises(TimeoutWatcher.TimeoutError):
                self.watcher.are_builds_completed()

    def test_tcbuild_finished_but_no_buildbot(self):
        self.index.findTask.side_effect = SideEffects.everything_has_an_id
        self.queue.task.side_effect = SideEffects.tc_tier2_build_has_rank_0

        self.assertFalse(self.watcher.are_builds_completed())
        self.assertEqual(self.index.findTask.call_count, len(self.platforms))

        self.watcher.are_builds_completed()
        self.assertEqual(self.index.findTask.call_count, len(self.platforms) * 2)


class SideEffects:
    @staticmethod
    def everything_has_an_id(_):
        return {'taskId': 'anId'}

    @staticmethod
    def tc_tier2_build_has_rank_0(_):
        return {
            'extra': {
                'index': {
                    'rank': 0,
                }
            }
        }

    @staticmethod
    def linux_has_no_task(namespace):
        if 'linux' in namespace:
            raise taskcluster.exceptions.TaskclusterRestFailure('place', 'hold', 'ers')
        return {'taskId': 'anId'}
