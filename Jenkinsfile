#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
Build parameters:
    CQZ_BUILD_ID
    CQZ_COMMIT
    CQZ_RELEASE_CHANNEL
    CQZ_BUILD_DE_LOCALIZATION
    REBUILD_IMAGE
*/
node('ubuntu && docker && gpu') {
    // Die early without CQZ_BUILD_ID, CQZ_RELEASE_CHANNEL or CQZ_COMMIT
    CQZ_BUILD_ID
    CQZ_COMMIT
    CQZ_RELEASE_CHANNEL
    CQZ_BUILD_DE_LOCALIZATION

    stage('Checkout') {
        checkout changelog: false, poll: false, scm: [$class: 'GitSCM', branches: [[name: CQZ_COMMIT]],
        doGenerateSubmoduleConfigurations: false, extensions: [[$class: 'CheckoutOption', timeout: 30],
        [$class: 'CloneOption', depth: 0, noTags: false, reference: '', shallow: false, timeout: 30]],
        submoduleCfg: [], userRemoteConfigs: [[url: 'https://github.com/faheem-cliqz/browser-f']]]
    }

    stage('Build Base Image') {
        def imgName = 'cliqz-oss/browser-f'
        buildParams = REBUILD_IMAGE.toBoolean() ? '--pull --no-cache=true .' : '.'
        docker.build(imgName, buildParams)
    }

  /*
    stage('Build Base Image') {

        // Start a container
        docker.image(imgName).inside("-u 0:0") {

        // Install any missing dependencies
        sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=desktop --no-interactive'

        withEnv([
            "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
            "CQZ_COMMIT=${CQZ_COMMIT}",
            "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
            "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}"]) {
                sh '''#!/bin/bash -xe export SHELL=/bin/bash cp ./certs/s3boto_repository_cliqz_com ~/.boto source ./certs/cliqz_browser_api_keys.sh ./magic_build_and_package.sh  --clobber'''
            }
        }
    }
  */
}
