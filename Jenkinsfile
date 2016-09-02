#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
Build parameters:
    CQZ_RELEASE_CHANNEL
    CQZ_BUILD_ID
    CQZ_COMMIT
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
        deleteDir()
        checkout changelog: false, poll: false, scm: [$class: 'GitSCM', branches: [[name: CQZ_COMMIT]],
        doGenerateSubmoduleConfigurations: false, extensions: [
        [$class: 'CheckoutOption', timeout: 30], [$class: 'CloneOption', depth: 0, noTags: false, reference: '',
        shallow: false, timeout: 30]], submoduleCfg: [],
        userRemoteConfigs: [[url: 'https://github.com/faheem-cliqz/browser-f']]]
    }

    def imgName = 'cliqz-oss/browser-f'

    stage('Build Image') {

        // Build params with context
        buildParams = REBUILD_IMAGE.toBoolean() ? '--pull --no-cache=true .' : '.'

        // Build docker image with params
        docker.build(imgName, buildParams)
    }

    // Start a container
    docker.image(imgName).inside("-u 0:0") {

        stage('Build Browser') {

            // Install any missing dependencies. Try to rebuild base image from time to time to speed up this process
            //sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive'

      sh '''#!/bin/bash -xe
env
unset BUILD_URL
unset HOSTNAME
unset HUDSON_SERVER_COOKIE
unset HOST
unset TERM
unset BUILD_TAG
unset JOB_URL
unset JENKINS_HOME
unset HUDSON_URL
unset JOB_NAME
unset BUILD_DISPLAY_NAME
unset JENKINS_URL
unset BUILD_ID
unset SHLVL
unset HOME
unset EXECUTOR_NUMBER
unset JENKINS_SERVER_COOKIE
unset CLASSPATH
unset HUDSON_HOME
unset NODE_NAME
unset BUILD_NUMBER
export SHELL=/bin/bash
env
ls
./magic_build_and_package.sh
      '''


            /*
            // Build browser
            withCredentials([
                [$class: 'StringBinding', credentialsId: 'CQZ_GOOGLE_API_KEY', variable: 'CQZ_GOOGLE_API_KEY'],
                [$class: 'StringBinding', credentialsId: 'MOZ_MOZILLA_API_KEY', variable: 'MOZ_MOZILLA_API_KEY']]) {

                // Load environment variables
                withEnv([
                    "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
                    "CQZ_COMMIT=${CQZ_COMMIT}",
                    "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
                    "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}"]) {


                }
            }
            */

        stage('Publisher (Debian Repo)') {
/*
                sh '''#!/bin/bash -xe
source ./certs/s3cmd_repository_cliqz_com.sh
./sign_lin.sh
'''
*/
        }

        stage('Publisher (Internal)') {
            /*
            sh '''#!/bin/bash -xe
export SHELL=/bin/bash
cp ./certs/s3boto_repository_cliqz_com ~/.boto
./magic_upload_files.sh
rm ~/.boto
'''
*/
        }
        }
    }
}
