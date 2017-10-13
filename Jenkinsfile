#!/usr/bin/env groovy

import org.codehaus.groovy.runtime.*;
import groovy.transform.Field

CQZ_RELEASE_CHANNEL = JOB_BASE_NAME.replaceAll("-", "")
CQZ_S3_DEBIAN_REPOSITORY_URL = 's3://repository.cliqz.com/dist/debian-pr/'+CQZ_RELEASE_CHANNEL+'/'+BUILD_ID
COMMIT_ID = BUILD_ID
CQZ_BUILD_DE_LOCALIZATION = ''
CQZ_BUILD_ID = new Date().format('yyyyMMddHHmmss')

def jobs = [:]
def helpers

def withRVM(version, cl) {
    RVM_HOME='$HOME/.rvm'
    paths = [
        "$RVM_HOME/bin",
        "${env.PATH}"
    ]
    
    def path = paths.join(':')

    withEnv(["PATH=${env.PATH}:$HOME/.rvm/bin", "RVM_HOME=$RVM_HOME"]) {
        sh "set +x; source $RVM_HOME/scripts/rvm; rvm use --create --install --binary $version"
    }

    withEnv([
        "PATH=$path",
        "RUBY_VERSION=$version"
        ]) {
            cl()
    }
}


properties([
    [$class: 'JobRestrictionProperty'],
    disableConcurrentBuilds(),
    parameters([
        string(defaultValue: 'pr', name: 'RELEASE_CHANNEL'),
        string(defaultValue: 'google-api-key',
                name: 'CQZ_GOOGLE_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'mozilla-api-key',
                name: 'CQZ_MOZILLA_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'f3c1a44b-1da8-4b37-a45d-a764b3f0b40b',
                name: 'CQZ_AWS_CREDENTIAL_ID'),
        string(defaultValue: 's3://cdncliqz/update/browser_beta/latest.xpi',
                name: 'CQZ_EXTENSION_URL'),
        string(defaultValue: "5B0571C810B2BC947DE61ADCE8512CEA605A5625",
                name: "CQZ_CERT_NAME"),
        string(defaultValue: 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.17-browser-signed.xpi',
                name: 'CQZ_HTTPSE_EXTENSION_URL'),
        string(defaultValue: 'us-east-1', name: 'AWS_REGION'),
        string(defaultValue: "c2d53661-8521-47c7-a7b3-73bbb6723c0a",
                name: "WIN_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "2832a98c-40f1-4dbf-afba-b74b91796d21",
                name: "WIN_CERT_PATH_CREDENTIAL_ID"),
        string(defaultValue: "6712f640-9e25-4ec8-b7af-2456ca41b4b3",
                name: "MAC_CERT_CREDENTIAL_ID"),
        string(defaultValue: "fe75da3d-cb92-4d23-aeab-9e72ca044099",
                name: "MAC_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "761dc30d-f04f-49a5-9940-cdd8ca305165",
                name: "MAR_CERT_CREDENTIAL_ID"),
        string(defaultValue: "3428e3e4-5733-4e59-8c6b-f95f1ee00322",
                name: "MAR_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "0ece63d0-527d-4468-9b1d-032235589419",
                name: "MAR_CERT_NICKNAME"),
        string(defaultValue: "debian-gpg-key",
                name: "DEBIAN_GPG_KEY_CREDENTIAL_ID"),
        string(defaultValue: "debian-gpg-pass",
                name: "DEBIAN_GPG_PASS_CREDENTIAL_ID"),
        string(defaultValue: "6f6191fb-8560-45aa-836e-a478097d0702",
                name:"WINDOWS_SLAVE_CREDENTIALS"),
        string(defaultValue: 'cliqz/ansible:20170511173229',
                name: 'IMAGE_NAME'),
        string(defaultValue: 'ami-66c1b770',
                name: 'IMAGE_AMI'),
        string(defaultValue: 'https://141047255820.dkr.ecr.us-east-1.amazonaws.com',
                name: 'DOCKER_REGISTRY_URL'),
        string(defaultValue: "1.16.0", name: "CQZ_VERSION"),
        booleanParam(defaultValue: false, description: '',
                    name: 'LIN_REBUILD_IMAGE'),
    ]),
    pipelineTriggers([])
])

node('docker && us-east-1') {
    stage("Copy XPI") {
        UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/${params.CQZ_VERSION}/${CQZ_BUILD_ID}/cliqz@cliqz.com.xpi"
        HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/${params.CQZ_VERSION}/${CQZ_BUILD_ID}/https-everywhere@cliqz.com.xpi"

        withCredentials([
            [$class: 'AmazonWebServicesCredentialsBinding',
            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
            credentialsId: params.CQZ_AWS_CREDENTIAL_ID,
            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {

            sh "aws s3 cp ${params.CQZ_EXTENSION_URL} $UPLOAD_PATH"
            sh "aws s3 cp ${params.CQZ_HTTPSE_EXTENSION_URL} $HTTPSE_UPLOAD_PATH"
        }
    }
}

node('docker && us-east-1') {
    ws() {
        stage('Helpers Checkout') {
            checkout scm
        }
        try {
           helpers = load "build-helpers.groovy"
        } catch(e) {
            echo "Could not load build-helpers"
            throw e
        }
    }
}

jobs["windows"] = {
    // Check if there are later jobs wating in a queue and abort
    if (helpers.hasNewerQueuedJobs()) {
        error("Has Jobs in queue, aborting")
    }

    // We can now use the slave to do a windows build
    node('windows && pr') {
        ws('a') {
            stage("Windows EC2 SCM Checkout") {
                checkout([
                    $class: 'GitSCM',
                    branches: scm.branches,
                    extensions: scm.extensions + [
                        [$class: 'CheckoutOption', timeout: 60],
                        [$class: 'CloneOption', timeout: 60]
                    ],
                    userRemoteConfigs: scm.userRemoteConfigs
                ])
            } // stage

            stage("Fix git windows file-endings") {
                bat "git config core.autocrlf false && git config core.eof lf &&  git rm --cached -r -q . && git reset --hard -q"
            }

            stage('fix keys') {
              withCredentials([
                [
                  $class: 'StringBinding',
                  credentialsId: params.CQZ_GOOGLE_API_KEY_CREDENTIAL_ID,
                  variable: 'CQZ_GOOGLE_API_KEY'
                ],
                [
                  $class: 'StringBinding',
                  credentialsId: params.CQZ_MOZILLA_API_KEY_CREDENTIAL_ID,
                  variable: 'MOZ_MOZILLA_API_KEY'
                ],
              ]) {
                writeFile file: "mozilla-desktop-geoloc-api.key", text: "${MOZ_MOZILLA_API_KEY}"
                writeFile file: "google-desktop-api.key", text: "${CQZ_GOOGLE_API_KEY}"
              }
            }

            withCredentials([
                [$class: 'FileBinding',
                    credentialsId: params.WIN_CERT_PATH_CREDENTIAL_ID,
                    variable: 'CLZ_CERTIFICATE_PATH'],
                [$class: 'StringBinding',
                    credentialsId: params.WIN_CERT_PASS_CREDENTIAL_ID,
                    variable: 'CLZ_CERTIFICATE_PWD'],
                [$class: 'AmazonWebServicesCredentialsBinding',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    credentialsId: params.CQZ_AWS_CREDENTIAL_ID,
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']
                ]) {

                withEnv([
                  "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}",
                  "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
                  "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
                ]){
                  stage('Windows Build') {
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
            } // withCredentials
        } // ws
    }
}

jobs["mac"] = {
    node('browser && osx && pr') {
        ws('x') {
            stage('OSX Hypervisor Checkout') {
                checkout scm
            }

            def LANG_PARAM = ""
            try {
                if (env.CQZ_LANG) {
                    LANG_PARAM = "-lang ${CQZ_LANG}"
                }
            } catch(e) {}

            stage('OSX Bootstrap') {
                withRVM('ruby-2.4.2') {
                    sh '/bin/bash -lc "pip install compare-locales"'
                    sh '/bin/bash -lc "python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive"'
                    sh '/bin/bash -lc "brew uninstall terminal-notifier"'
                    sh '/bin/bash -lc "brew install wget --with-libressl"'
                }
            }

            withEnv([
                "CQZ_BUILD_ID=$CQZ_BUILD_ID",
                "CQZ_BUILD_DE_LOCALIZATION=$CQZ_BUILD_DE_LOCALIZATION",
                "CQZ_RELEASE_CHANNEL=$CQZ_RELEASE_CHANNEL"]) {

                withCredentials([
                    [$class: 'StringBinding',
                    credentialsId: params.CQZ_GOOGLE_API_KEY_CREDENTIAL_ID,
                    variable: 'CQZ_GOOGLE_API_KEY'],
                    [$class: 'StringBinding',
                    credentialsId: params.CQZ_MOZILLA_API_KEY_CREDENTIAL_ID,
                    variable: 'MOZ_MOZILLA_API_KEY']]) {

                    stage('fix keys') {
                        writeFile file: "mozilla-desktop-geoloc-api.key", text: "${MOZ_MOZILLA_API_KEY}"
                        writeFile file: "google-desktop-api.key", text: "${CQZ_GOOGLE_API_KEY}"
                    }
                }

                stage('OSX Build') {
                    sh '/bin/bash -lc "./magic_build_and_package.sh --clobber ${LANG_PARAM}"'
                }

                stage('OSX Sign') {
                        // remove old package - important if clobber was not done
                    sh '/bin/bash -lc "rm -rf obj/pkg"'

                    withCredentials([
                        [$class: 'FileBinding',
                            credentialsId: params.MAC_CERT_CREDENTIAL_ID,
                            variable: 'CERT_FILE'],
                        [$class: 'StringBinding',
                            credentialsId: params.MAC_CERT_PASS_CREDENTIAL_ID,
                            variable: 'CERT_PASS']
                    ]) {
                        // create temporary keychain and make it a default one
                        sh '''#!/bin/bash -l -x
                            security create-keychain -p cliqz cliqz
                            security list-keychains -s cliqz
                            security default-keychain -s cliqz
                            security set-keychain-settings -t 3600 cliqz
                            security unlock-keychain -p cliqz cliqz
                        '''

                        sh '''#!/bin/bash -l -x
                            security import $CERT_FILE -P $CERT_PASS -k cliqz -A
                            security set-key-partition-list -S apple-tool:,apple: -s -k cliqz cliqz
                        '''

                        withEnv(["CQZ_CERT_NAME=$params.CQZ_CERT_NAME"]) {
                            sh '/bin/bash -lc "./sign_mac.sh ${LANG_PARAM}"'
                            
                        }
                        
                    }
                }

                stage('OSX Upload') {
                    withEnv(["CQZ_CERT_DB_PATH=$HOME/certs"]) {
                        try {
                            //expose certs
                            withCredentials([
                                [$class: 'FileBinding',
                                    credentialsId: params.MAC_CERT_CREDENTIAL_ID,
                                    variable: 'CLZ_CERTIFICATE_PATH'],
                                [$class: 'StringBinding',
                                    credentialsId: params.MAC_CERT_PASS_CREDENTIAL_ID,
                                    variable: 'CLZ_CERTIFICATE_PWD']]) {

                                sh '''#!/bin/bash -l -x
                                    if [ -d $CQZ_CERT_DB_PATH ]; then
                                        rm -rf $CQZ_CERT_DB_PATH
                                    fi
                                    mkdir -p $CQZ_CERT_DB_PATH
                                    cd `brew --prefix nss`/bin
                                    ./certutil -N -d $CQZ_CERT_DB_PATH -f emptypw.txt
            
                                    ./pk12util -i $CLZ_CERTIFICATE_PATH -W $CLZ_CERTIFICATE_PWD -d $CQZ_CERT_DB_PATH
                                '''
                            }

                            withCredentials([
                                // [file(credentialsId: '1cb02bb6-3c6a-4959-91fb-5ce241af3ecc', 
                                // variable: 'CREDENTIALS_TEMPLATE'), 
                                [$class: 'AmazonWebServicesCredentialsBinding', 
                                accessKeyVariable: 'AWS_ACCESS_KEY_ID', 
                                credentialsId: params.CQZ_AWS_CREDENTIAL_ID, 
                                secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'],
                                string(credentialsId: params.MAR_CERT_NICKNAME, 
                                variable: 'MAR_CERT_NAME')
                            ]) {
                                // sh '/bin/bash -lc "chmod a+x $CREDENTIALS_TEMPLATE; $CREDENTIALS_TEMPLATE ${params.AWS_REGION} $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY > ~/.aws/credentials"'
                                sh '/bin/bash -lc "./magic_upload_files.sh ${LANG_PARAM}"'

                                archiveArtifacts 'obj/build_properties.json'
                            }
                        } finally {
                            // remove certs and credentials
                            sh 'rm -r $CQZ_CERT_DB_PATH || true'
                            sh '''#!/bin/bash -l -x
                                security delete-keychain cliqz
                                security list-keychains -s login.keychain
                                security default-keychain -s login.keychain
                                true
                            '''
                        }
                    }
                    
                }
            }
        }
    }
}

jobs["linux"] = {
    node('ubuntu && browser') {
        ws('build') {
            stage('Linux Docker Checkout') {
                checkout scm
            }

            stage("Linux Build") {
                def imageName = 'browser-f'

                try {
                    // authorize docker deamon to access registry
                    sh "`aws ecr get-login --region=${params.AWS_REGION}`"

                    docker.withRegistry(params.DOCKER_REGISTRY_URL) {
                        def image = docker.image(imageName)
                        image.pull()
                        imageName = image.imageName()
                    }
                } catch (e) {
                    // if registry fails, build image localy
                    // Build params with context
                    def cacheParams = params.LIN_REBUILD_IMAGE.toBoolean() ? '--pull --no-cache=true' : ''

                    // Avoiding docker context
                    sh 'rm -rf docker && mkdir docker && cp Dockerfile docker/'

                    // Build image with a specific user
                    sh "cd docker && docker build -t ${imageName} ${cacheParams} --build-arg user=`whoami` --build-arg uid=`id -u` --build-arg gid=`id -g` ."
                }

                docker.image(imageName).inside() {
                    stage('Linux Update Dependencies') {
                    // Install any missing dependencies. Try to rebuild base image from time to time to speed up this process
                        sh '/bin/bash -lc "python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive"'
                    }

                    withEnv([
                        "CQZ_BUILD_ID=$CQZ_BUILD_ID",
                        "CQZ_COMMIT=$COMMIT_ID",
                        "CQZ_RELEASE_CHANNEL=$CQZ_RELEASE_CHANNEL",
                        "CQZ_BUILD_DE_LOCALIZATION=$CQZ_BUILD_DE_LOCALIZATION"]) {

                        withCredentials([
                            [$class: 'StringBinding',
                                credentialsId: params.CQZ_GOOGLE_API_KEY_CREDENTIAL_ID,
                                variable: 'CQZ_GOOGLE_API_KEY'],
                            [$class: 'StringBinding',
                                credentialsId: params.CQZ_MOZILLA_API_KEY_CREDENTIAL_ID,
                                variable: 'MOZ_MOZILLA_API_KEY']]) {

                            stage('fix keys') {
                                writeFile file: "mozilla-desktop-geoloc-api.key", text: "${MOZ_MOZILLA_API_KEY}"
                                writeFile file: "google-desktop-api.key", text: "${CQZ_GOOGLE_API_KEY}"
                            }
                        }

                        stage('Linux Build Browser') {
                          try {
                              sh '/bin/bash -lc "./magic_build_and_package.sh  --clobber"'
                          } catch (e) {
                              archive 'obj/config.log'
                              throw e
                          }
                        }

                        withCredentials([
                            [$class: 'AmazonWebServicesCredentialsBinding',
                                accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                credentialsId: params.CQZ_AWS_CREDENTIAL_ID,
                                secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                            stage('Publisher (Debian Repo)') {
                                try {
                                    withCredentials([
                                        [$class: 'FileBinding',
                                            credentialsId: params.DEBIAN_GPG_KEY_CREDENTIAL_ID,
                                            variable: 'DEBIAN_GPG_KEY'],
                                        [$class: 'StringBinding',
                                            credentialsId: params.DEBIAN_GPG_PASS_CREDENTIAL_ID,
                                            variable: 'DEBIAN_GPG_PASS']]) {

                                        sh 'echo $DEBIAN_GPG_PASS > debian.gpg.pass'

                                        withEnv([
                                            "CQZ_S3_DEBIAN_REPOSITORY_URL=$CQZ_S3_DEBIAN_REPOSITORY_URL"]) {
                                            sh '/bin/bash -lc "./sign_lin.sh"'
                                        }
                                    }
                                } finally {
                                    sh 'rm -rf debian.gpg.pass'
                                }
                            }

                            stage('Linux Publisher (Internal)') {
                                sh '/bin/bash -lc "./magic_upload_files.sh"'
                                archiveArtifacts 'obj/build_properties.json'
                            }
                        }
                    }
                }
            }
        }
    }
}

parallel jobs
