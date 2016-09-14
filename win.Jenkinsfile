#!/usr/bin/env groovy

/*
 TRIGGERING JOB

  ```groovy
node(WIN_BUILD_NODE) {
    stage("Checkout") {
        checkout([
            $class: 'GitSCM',
            branches: [[name: COMMIT_ID]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [
                [$class: 'CheckoutOption', timeout: 60],
                [$class: 'CloneOption', depth: 0, noTags: true, honorRefspec: true, reference: '', shallow: true, timeout: 60]
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[credentialsId: '0aededfc-f41d-40bd-9a63-dd4524adb7b6', url: REPO_URL]]
        ])
    }

    stage("Start build") {
        load ENTRY_POINT
    }
}
  ```
*/

bat '''
  set CQZ_WORKSPACE=%cd%
  build_win.bat
'''
