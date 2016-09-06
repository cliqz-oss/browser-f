#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
Checkout code in respective Jenkinsfile

node("master") {
    stage("Checkout") {
        checkout([
            $class: 'GitSCM',
            branches: [[name: COMMIT_ID]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [],
            submoduleCfg: [],
            userRemoteConfigs: [[url: REPO_URL]]
        ])
    }

    stage("Start build") {
        load ENTRY_POINT
    }
}
*/

import org.codehaus.groovy.runtime.*;

CQZ_BUILD_ID = DateGroovyMethods.format(new Date(), 'yyyyMMddHHmmss')

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
LINUX_BUILD_NODE

stage("Copy XPI") {
    CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
    UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
    HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

    withCredentials([[
                $class: 'UsernamePasswordMultiBinding',
                credentialsId: CQZ_AWS_CREDENTIAL_ID,
                passwordVariable: 'AWS_SECRET_ACCESS_KEY',
                usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

        sh "s3cmd cp $CQZ_EXTENSION_URL $UPLOAD_PATH"
        sh "s3cmd cp $HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
    }
}

stage('Build') {
    parallel (
        'linux en': {
            build job: 'browser-f-linux', parameters: [
                string(name: 'REPO_URL', value: REPO_URL),
                string(name: 'COMMIT_ID', value: COMMIT_ID),
                string(name: 'ENTRY_POINT', value: ENTRY_POINT),
                string(name: 'LINUX_BUILD_NODE', value: LINUX_BUILD_NODE),
                string(name: 'CQZ_RELEASE_CHANNEL', value: CQZ_RELEASE_CHANNEL),
                string(name: 'CQZ_BUILD_DE_LOCALIZATION', value: CQZ_BUILD_DE_LOCALIZATION),
                string(name: 'CQZ_GOOGLE_API_KEY_CREDENTIAL_ID', value: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID),
                string(name: 'CQZ_MOZILLA_API_KEY_CREDENTIAL_ID', value: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID),
                string(name: 'CQZ_AWS_CREDENTIAL_ID', value: CQZ_AWS_CREDENTIAL_ID),
                booleanParam(name: 'REBUILD_IMAGE', value: REBUILD_IMAGE.toBoolean()),
                string(name: 'DEBIAN_GPG_KEY_CREDENTIAL_ID', value: DEBIAN_GPG_KEY_CREDENTIAL_ID),
                string(name: 'DEBIAN_GPG_PASS_CREDENTIAL_ID', value: DEBIAN_GPG_PASS_CREDENTIAL_ID),
                string(name: 'CQZ_BUILD_ID', value: CQZ_BUILD_ID)]
        }
    )
}
