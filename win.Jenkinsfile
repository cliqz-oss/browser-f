#!/usr/bin/env groovy

/*
 TRIGGERING JOB

  ```groovy
node(WIN_BUILD_NODE) {

    step([
        $class: 'CopyArtifact',
        projectName: TRIGGERING_JOB_NAME,
        selector: [$class: 'SpecificBuildSelector', buildNumber: TRIGGERING_BUILD_NUMBER],
        target: 'artifacts'
    ])

    def helpers = load "artifacts/build-helpers.groovy"

    helpers.withVagrant("artifacts/${VAGRANTFILE}") { nodeId ->
      node(nodeId) {
        stage("Checkout") {
            helpers.checkoutSCM(REPO_URL, COMMIT_ID)
        }

        load ENTRY_POINT
      }
    }
}
  ```
*/

bat '''
  set CQZ_WORKSPACE=%cd%
  build_win.bat
'''
