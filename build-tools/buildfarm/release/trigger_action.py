import argparse
import json
import logging
import site
import taskcluster
import yaml
import copy
from urllib import unquote
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

from os import path

site.addsitedir(path.join(path.dirname(__file__), "../../lib/python"))

from kickoff.actions import generate_action_task, submit_action_task, find_decision_task_id

log = logging.getLogger(__name__)
SUPPORTED_ACTIONS = [
    "promote_firefox_partners",
    "publish_fennec",
    "push_devedition",
    "push_firefox",
    "ship_devedition",
    "ship_fennec",
    "ship_fennec_rc",
    "ship_firefox",
    "ship_firefox_rc",
    "push_thunderbird",
    "ship_thunderbird",
]


def get_trust_domain(releases_config, product):
    for entry in releases_config:
        if entry['product'] == product:
            return entry['trust_domain']
    raise RuntimeError("Unknown product %s", product)


def get_task(task_id):
    queue = taskcluster.Queue()
    return queue.task(task_id)


# https://www.peterbe.com/plog/best-practice-with-retries-with-requests
def requests_retry_session(
    retries=5,
    backoff_factor=0.3,
    status_forcelist=(500, 502, 504),
    session=None,
):
    session = session or requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session


def get_artifact_text(queue, task_id, path):
    """Retries download + returns the contents of the artifact"""
    url = unquote(queue.buildUrl('getLatestArtifact', task_id, path))
    r = requests_retry_session().get(url, timeout=5)
    r.raise_for_status()
    return r.text


def main():
    logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s",
                        level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--action-task-id", required=True,
        help="Task ID of the initial action task (promote_fennec or promote_firefox"
    )
    parser.add_argument(
        "--decision-task-id",
        help="(Optional) Specify the decision task of the revision to use. "
        "Normally we would use the revision from the action_task_id, but "
        "we may want to specify a separate revision for this action, e.g. when "
        "we land a fix for the push or ship phases but don't want to re-promote."
    )
    parser.add_argument("--previous-graph-ids",
                        help="Override previous graphs.")
    parser.add_argument("--release-runner-config", required=True, type=argparse.FileType('r'),
                        help="Release runner config")
    parser.add_argument("--action-flavor", required=True, choices=SUPPORTED_ACTIONS)
    parser.add_argument("--partner-build-num", type=int, default=1,
                        help="Specify the partner build number")
    parser.add_argument("--partner-subset", type=str,
                        help="Specify a comma-delimited subset of partners to repack")
    parser.add_argument("--force", action="store_true", default=False,
                        help="Submit action task without asking")
    args = parser.parse_args()
    release_runner_config = yaml.safe_load(args.release_runner_config)
    tc_config = {
        "credentials": {
            "clientId": release_runner_config["taskcluster"].get("client_id"),
            "accessToken": release_runner_config["taskcluster"].get("access_token"),
        },
        "maxRetries": 12,
    }
    queue = taskcluster.Queue(tc_config)

    prev_action_task = get_task(args.action_task_id)
    action_task_input = copy.deepcopy(prev_action_task["extra"]["action"]["context"]["input"])

    decision_task_id = args.decision_task_id
    if decision_task_id:
        params_yaml = get_artifact_text(queue, decision_task_id, 'public/parameters.yml')
    else:
        params_yaml = get_artifact_text(queue, args.action_task_id, 'public/parameters.yml')

    parameters = yaml.safe_load(params_yaml)
    project = parameters["project"]
    revision = parameters["head_rev"]

    if not decision_task_id:
        product = args.action_flavor.split('_')[1]
        trust_domain = get_trust_domain(release_runner_config['releases'], product)
        decision_task_id = find_decision_task_id(
            trust_domain=trust_domain,
            project=project, revision=revision,
        )

    previous_graph_ids = []
    if args.previous_graph_ids:
        previous_graph_ids.extend(args.previous_graph_ids.split(','))
    if decision_task_id not in previous_graph_ids:
        previous_graph_ids.insert(0, decision_task_id)
    action_task_input.update({
        "release_promotion_flavor": args.action_flavor,
        "previous_graph_ids": previous_graph_ids + [args.action_task_id],
    })
    if 'partner' in args.action_flavor:
        action_task_input.update({
            "release_partner_build_number": args.partner_build_num,
        })
        if args.partner_subset:
            action_task_input['release_partners'] = args.partner_subset.split(',')
    action_task_id, action_task = generate_action_task(
            decision_task_id=decision_task_id,
            action_task_input=action_task_input,
    )

    log.info("Submitting action task %s for %s", action_task_id, args.action_flavor)
    log.info("Project: %s", project)
    log.info("Revision: %s", revision)
    log.info("Next version: %s", action_task_input["next_version"])
    log.info("Build number: %s", action_task_input["build_number"])
    log.info("Task definition:\n%s", json.dumps(action_task, sort_keys=True, indent=2))
    if not args.force:
        yes_no = raw_input("Submit the task? [y/N]: ")
        if yes_no not in ('y', 'Y'):
            log.info("Not submitting")
            exit(1)

    submit_action_task(queue=queue, action_task_id=action_task_id,
                       action_task=action_task)


if __name__ == "__main__":
    main()
