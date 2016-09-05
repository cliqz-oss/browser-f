#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
*/

load 'build-helpers.groovy'

node(BUILD_NODE) {
    // Die early for missing build params
    CQZ_RELEASE_CHANNEL
    CQZ_BUILD_ID
    COMMIT_ID
    REPO_URL
    CQZ_BUILD_DE_LOCALIZATION
    REBUILD_IMAGE
    CQZ_GOOGLE_API_KEY_CREDENTIAL_ID
    CQZ_MOZILLA_API_KEY_CREDENTIAL_ID
    CQZ_AWS_CREDENTIAL_ID

    stage('Checkout') {
        checkoutSCM(REPO_URL, COMMIT_ID)
    }

    stage('Build') {
        parallel (
            'linux en': { load 'linux.Jenkinsfile' }
        )
    }
}