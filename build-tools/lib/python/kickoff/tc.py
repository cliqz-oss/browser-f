import logging

import concurrent.futures as futures

log = logging.getLogger(__name__)
CONCURRENCY = 50


def resolve_task(queue, task_id, worker_id="releaserunner"):
    curr_status = queue.status(task_id)
    run_id = curr_status['status']['runs'][-1]['runId']
    payload = {"workerGroup": curr_status['status']['workerType'],
               "workerId": worker_id}
    queue.claimTask(task_id, run_id, payload)
    queue.reportCompleted(task_id, run_id)


def submit_parallelized(queue, tasks):
    """Submit topologically sorted tasks parallelized

    Stolen from https://dxr.mozilla.org/mozilla-central/rev/f0abd25e1f4acced652d180c34b7c9eda638deb1/taskcluster/taskgraph/create.py#28
    """

    def submit_task(t_id, t_def):
        log.info("Submitting %s", t_id)
        queue.createTask(t_id, t_def)

    with futures.ThreadPoolExecutor(CONCURRENCY) as e:
        fs = {}
        for task_id, task_def in tasks.items():
            deps_fs = [fs[dep] for dep in task_def.get('dependencies', [])
                       if dep in fs]
            # Wait for dependencies before submitting this.
            for f in futures.as_completed(deps_fs):
                    f.result()

            fs[task_id] = e.submit(submit_task, task_id, task_def)

        # Wait for all futures to complete.
        for f in futures.as_completed(fs.values()):
            f.result()
