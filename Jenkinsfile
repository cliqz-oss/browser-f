#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
*/

import org.codehaus.groovy.runtime.*;

def CQZ_BUILD_ID = DateGroovyMethods.format(new Date(), 'yyyyMMddHHmmss').trim()

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
    CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1")
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
        'linux en': { load 'linux.Jenkinsfile' }
    )
}