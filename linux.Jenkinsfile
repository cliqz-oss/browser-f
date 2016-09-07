#!/usr/bin/env groovy

/*
* Linux builder
* Note: Checkout being done by a triggering job
*/

def imgName = 'cliqz-oss/browser-f'

// Die early for missing build params
CQZ_S3_DEBIAN_REPOSITORY_URL

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
        "CQZ_COMMIT=$COMMIT_ID",
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
                try {
                    withCredentials([
                        [$class: 'FileBinding', credentialsId: DEBIAN_GPG_KEY_CREDENTIAL_ID, variable: 'DEBIAN_GPG_KEY'],
                        [$class: 'StringBinding', credentialsId: DEBIAN_GPG_PASS_CREDENTIAL_ID, variable: 'DEBIAN_GPG_PASS']]) {

                        sh 'echo $DEBIAN_GPG_PASS > debian.gpg.pass'

                        withEnv([
                            "CQZ_S3_DEBIAN_REPOSITORY_URL=$CQZ_S3_DEBIAN_REPOSITORY_URL"]) {

                            sh './sign_lin.sh'
                        }
                    }
                } finally {
                    sh 'rm -rf debian.gpg.pass'
                }
            }

            stage('Publisher (Internal)') {
                sh './magic_upload_files.sh'
                archiveArtifacts 'obj/build_properties.json'
            }
        }
    }
}
