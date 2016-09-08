#!/usr/bin/env groovy

stage('bootstrap') {
    sh 'pip install compare-locales'
    sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive'
}

withEnv([
    "CQZ_BUILD_ID=$CQZ_BUILD_ID",
    "CQZ_BUILD_DE_LOCALIZATION=$CQZ_BUILD_DE_LOCALIZATION",
    "CQZ_RELEASE_CHANNEL=$CQZ_RELEASE_CHANNEL"]) {

    stage('build') {
        withCredentials([
            [$class: 'StringBinding', credentialsId: 'e2c7ea0a-285e-4199-9667-af2223d3b14a', variable: 'CQZ_GOOGLE_API_KEY'],
            [$class: 'StringBinding', credentialsId: '3e57ee4e-4ca7-4d07-aeb6-96422b66b3e8', variable: 'MOZ_MOZILLA_API_KEY']]) {

            sh './magic_build_and_package.sh --clobber'
        }
    }

    stage('sign') {
        // remove old package - important if clobber was not done
        sh 'rm -rf obj/pkg || true'

        withCredentials([
            [$class: 'FileBinding', credentialsId: MAC_CERT_CREDENTIAL_ID, variable: 'CERT_FILE'],
            [$class: 'StringBinding', credentialsId: MAC_CERT_PASS_CREDENTIAL_ID, variable: 'CERT_PASS']
        ]) {
            try {
                // create temporary keychain and make it a default one
                sh '''#!/bin/bash -l -x
                    security create-keychain -p cliqz cliqz
                    security list-keychains -s cliqz
                    security default-keychain -s cliqz
                    security unlock-keychain -p cliqz cliqz
                '''

                sh '''#!/bin/bash -l +x
                    security import $CERT_FILE -P $CERT_PASS -k cliqz -A
                '''

                withEnv(["MAC_CERT_NAME=$CQZ_CERT_NAME"]) {
                    sh './sign_mac.sh'
                }
            } finally {
                sh '''#!/bin/bash -l -x
                    security delete-keychain cliqz
                    security list-keychains -s login.keychain
                    security default-keychain -s login.keychain
                    true
                '''
            }
        }
    }

    stage('upload') {
        withEnv(['CQZ_CERT_DB_PATH=/Users/vagrant/certs']) {
            try {
                //expose certs
                withCredentials([
                    [$class: 'FileBinding', credentialsId: MAR_CERT_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PATH'],
                    [$class: 'StringBinding', credentialsId: MAR_CERT_PASS_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PWD']]) {

                    sh '''#!/bin/bash -x
                        mkdir $CQZ_CERT_DB_PATH
                        cd /usr/local/Cellar/nss/3.24/bin
                        ./certutil -N -d $CQZ_CERT_DB_PATH -f emptypw.txt
                        set +x
                        ./pk12util -i $CLZ_CERTIFICATE_PATH -W $CLZ_CERTIFICATE_PWD -d $CQZ_CERT_DB_PATH
                    '''
                }

                withCredentials([[
                    $class: 'UsernamePasswordMultiBinding',
                    credentialsId: CQZ_AWS_CREDENTIAL_ID,
                    passwordVariable: 'AWS_SECRET_ACCESS_KEY',
                    usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

                    sh """#!/bin/bash -l -x
                        ./magic_upload_files.sh
                    """

                    archiveArtifacts 'obj/i386/build_properties.json'
                }
            } finally {
                // remove certs
                sh 'rm -r $CQZ_CERT_DB_PATH || true'
            }
        }
    }
}
