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
    [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID, variable: 'MOZ_MOZILLA_API_KEY'],
    [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID, variable: 'CQZ_GOOGLE_API_KEY'],
    [$class: 'UsernamePasswordMultiBinding', credentialsId: CQZ_AWS_CREDENTIAL_ID, passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID']]) {


    withEnv([
      "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}",
      "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
      "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
    ]) {
      stage('build') {
        bat '''
          set CQZ_WORKSPACE=%cd%
          build_win.bat
        '''
      }
    }

    if (CQZ_BUILD_DE_LOCALIZATION == "1") {
      archiveArtifacts 'obj/en_build_properties.json'
      archiveArtifacts 'obj/de_build_properties.json'
    } else {
      archiveArtifacts 'obj/build_properties.json'
    }
 }
