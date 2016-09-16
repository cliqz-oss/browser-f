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

withCredentials([
    [$class: 'FileBinding', credentialsId: WIN_CERT_PATH_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PATH'],
    [$class: 'StringBinding', credentialsId: WIN_CERT_PASS_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PWD'],
    [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY, variable: 'MOZ_MOZILLA_API_KEY'],
    [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY, variable: 'CQZ_GOOGLE_API_KEY'],
    [$class: 'UsernamePasswordMultiBinding', credentialsId: CQZ_AWS_CREDENTIAL_ID, passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

    bat '''
      set CQZ_WORKSPACE=%cd%
      build_win.bat
    '''

    archiveArtifacts 'obj/en_build_properties.json'
    archiveArtifacts 'obj/de_build_properties.json'
 }
