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
    BUILD_NODE
*/
node(BUILD_NODE) {
    // Die early without CQZ_BUILD_ID, CQZ_RELEASE_CHANNEL or CQZ_COMMIT
    CQZ_BUILD_ID
    CQZ_COMMIT
    CQZ_RELEASE_CHANNEL
    CQZ_BUILD_DE_LOCALIZATION

    stage('Checkout') {
        //  deleteDir()
        checkout changelog: false, poll: false, scm: [$class: 'GitSCM', branches: [[name: CQZ_COMMIT]],
        doGenerateSubmoduleConfigurations: false, extensions: [
        [$class: 'CheckoutOption', timeout: 30], [$class: 'CloneOption', depth: 0, noTags: false, reference: '',
        shallow: false, timeout: 30]], submoduleCfg: [],
        userRemoteConfigs: [[url: 'https://github.com/cliqz-oss/browser-f']]]
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

    // Start a container
    // Mount to a smaller path. Problems while building on longer work paths
    // TODO: Explicit mounted paths should supersede implicit ones. Docker plugin problems :(
    docker.image(imgName).inside() {

        stage('Build Browser') {

            // Install any missing dependencies. Try to rebuild base image from time to time to speed up this process
            sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive'

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

                    sh './magic_build_and_package.sh  --clobber'
                }
            }
        }

        stage('Publisher (Debian Repo)') {
            sh '''
                source ./certs/s3cmd_repository_cliqz_com.sh
                ./sign_lin.sh
            '''
        }

        stage('Publisher (Internal)') {
            sh '''
                cp ./certs/s3boto_repository_cliqz_com ~/.boto
                ./magic_upload_files.sh
                rm ~/.boto
            '''
        }
    }
}
