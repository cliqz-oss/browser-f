#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
*/
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
        checkout
            changelog: false,
            poll: false,
            scm: [
                $class: 'GitSCM',
                branches: [[name: COMMIT_ID]],
                doGenerateSubmoduleConfigurations: false,
                extensions: [
                    [$class: 'CheckoutOption', timeout: 30],
                    [$class: 'CloneOption', depth: 0, noTags: false, reference: '', shallow: false, timeout: 30]
                ],
                submoduleCfg: [],
                userRemoteConfigs: [[url: REPO_URL]]
            ]
    }

    def imgName = 'cliqz-oss/browser-f'

    stage('Build Image') {

        // Build params with context
        def cacheParams = REBUILD_IMAGE.toBoolean() ? '--pull --no-cache=true' : ''

        // Avoiding docker context
        sh 'rm -rf docker && mkdir docker && cp Dockerfile docker/'

        // Build image with a specific user
        sh "cd docker && docker build -t ${imgName} ${cacheParams} --build-arg user=`whoami` --build-arg uid=`id -u` --build-arg gid=`id -g` ."
    }

    docker.image(imgName).inside() {

       stage('Update Dependencies') {
            // Install any missing dependencies. Try to rebuild base image from time to time to speed up this process
            sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive'
        }

        withEnv([
            "CQZ_BUILD_ID=$CQZ_BUILD_ID",
            "CQZ_COMMIT=$CQZ_COMMIT",
            "CQZ_RELEASE_CHANNEL=$CQZ_RELEASE_CHANNEL",
            "CQZ_BUILD_DE_LOCALIZATION=$CQZ_BUILD_DE_LOCALIZATION"]) {

            stage('Build Browser') {
                withCredentials([
                    [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID, variable: 'CQZ_GOOGLE_API_KEY'],
                    [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID, variable: 'MOZ_MOZILLA_API_KEY']]) {

                     sh './magic_build_and_package.sh  --clobber'
                }
            }

            withCredentials([[
                $class: 'UsernamePasswordMultiBinding',
                credentialsId: CQZ_AWS_CREDENTIAL_ID,
                passwordVariable: 'AWS_SECRET_ACCESS_KEY',
                usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

                stage('Publisher (Debian Repo)') {
                    sh './sign_lin.sh'
                }

                stage('Publisher (Internal)') {
                    sh './magic_upload_files.sh'
                }
            }
        }
    }
}
