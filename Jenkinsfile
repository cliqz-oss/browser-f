#!/usr/bin/env groovy

import org.codehaus.groovy.runtime.*;
import groovy.transform.Field

CQZ_RELEASE_CHANNEL = JOB_BASE_NAME.replaceAll("-", "")
CQZ_S3_DEBIAN_REPOSITORY_URL = 's3://repository.cliqz.com/dist/debian-pr/'+CQZ_RELEASE_CHANNEL+'/'+BUILD_ID
COMMIT_ID = BUILD_ID
CQZ_BUILD_DE_LOCALIZATION = ''
DEBIAN_GPG_KEY_CREDENTIAL_ID = 'debian-gpg-key'
DEBIAN_GPG_PASS_CREDENTIAL_ID = 'debian-gpg-pass'
DOCKER_REGISTRY_URL = 'https://141047255820.dkr.ecr.us-east-1.amazonaws.com'
REPO_URL = 'https://github.com/cliqz-oss/browser-f.git'
CQZ_BUILD_ID = new Date().format('yyyyMMddHHmmss')

def jobs = [:]
def helpers

uploaded_lock = 0
uploaded = false

properties([
    [$class: 'JobRestrictionProperty'], 
    parameters([
        string(defaultValue: 'pr', name: 'RELEASE_CHANNEL'),
        string(defaultValue: 'google-api-key', name: 'CQZ_GOOGLE_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'mozilla-api-key', name: 'CQZ_MOZILLA_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'f3c1a44b-1da8-4b37-a45d-a764b3f0b40b', name: 'CQZ_AWS_CREDENTIAL_ID'),
        string(defaultValue: 's3://cdncliqz/update/browser_beta/latest.xpi', name: 'CQZ_EXTENSION_URL'),
        string(defaultValue: "4757E2EB2FE332E076F294D0230F41B6009968E5", name: "CQZ_CERT_NAME"),
        string(defaultValue: 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.8-browser-signed.xpi', name: 'CQZ_HTTPSE_EXTENSION_URL'),
        string(defaultValue: 'us-east-1', name: 'AWS_REGION'),
        string(defaultValue: '/home/jenkins/libs/cliqz-builder/ansible/ec2', name: 'ANSIBLE_PLAYBOOK_PATH'),
        string(defaultValue: "8000", name: 'NODE_MEMORY'),
        string(defaultValue: "4", name: 'NODE_CPU_COUNT'),
        string(defaultValue: "7900", name: 'NODE_VNC_PORT'),
        string(defaultValue: "c2d53661-8521-47c7-a7b3-73bbb6723c0a", name: "WIN_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "44c2aee7-743e-4ede-9411-55ad7219b09c", name: "WIN_CERT_PATH_CREDENTIAL_ID"),
        string(defaultValue: "761dc30d-f04f-49a5-9940-cdd8ca305165", name: "MAC_CERT_CREDENTIAL_ID"),
        string(defaultValue: "3428e3e4-5733-4e59-8c6b-f95f1ee00322", name: "MAC_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "761dc30d-f04f-49a5-9940-cdd8ca305165", name: "MAR_CERT_CREDENTIAL_ID"),
        string(defaultValue: "3428e3e4-5733-4e59-8c6b-f95f1ee00322", name: "MAR_CERT_PASS_CREDENTIAL_ID"),
        string(defaultValue: "1.10.0", name: "CQZ_VERSION"),
        booleanParam(defaultValue: false, description: '', name: 'MAC_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'WIN_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'LIN_REBUILD_IMAGE'),
    ]), 
    pipelineTriggers([])
])

node('docker') {
    docker.image('garland/docker-s3cmd').inside() {
        stage('Build Browser') {
            stage("Copy XPI") {
                UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$env.CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
                HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$env.CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    credentialsId: CQZ_AWS_CREDENTIAL_ID,
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {

                    sh "s3cmd cp -d -v  $CQZ_EXTENSION_URL $UPLOAD_PATH"
                    sh "s3cmd cp -d -v $CQZ_HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
                }
            }       
        }
    }
}

node {
    // jobs["mac"] = {   
    //     node('chromium_mac_buildserver') {
    //         ws('x') {
    //             stage('OSX Hypervisor Checkout') {
    //                 checkout scm
    //             }
                                 
    //             def LANG_PARAM = ""
    //             try {
    //                 if (env.CQZ_LANG) {
    //                     LANG_PARAM = "-lang ${CQZ_LANG}"
    //                 }
    //             } catch(e) {}
                    
    //             stage('OSX Bootstrap') {
    //                 sh '/bin/bash -lc "pip install compare-locales"'
    //                 sh '/bin/bash -lc "python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=browser --no-interactive"'
    //                 sh '/bin/bash -lc "brew uninstall terminal-notifier"'
    //             }

    //             withEnv([
    //                 "CQZ_BUILD_ID=$CQZ_BUILD_ID",
    //                 "CQZ_BUILD_DE_LOCALIZATION=$CQZ_BUILD_DE_LOCALIZATION",
    //                 "CQZ_RELEASE_CHANNEL=$CQZ_RELEASE_CHANNEL"]) {

    //                 stage('OSX Build') {
    //                      withCredentials([
    //                          [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID, variable: 'CQZ_GOOGLE_API_KEY'],
    //                          [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID, variable: 'MOZ_MOZILLA_API_KEY']]) {

    //                          sh '/bin/bash -lc "./magic_build_and_package.sh --clobber ${LANG_PARAM}"'
    //                          }
    //                 }

    //                 stage('OSX Sign') {
    //                         // remove old package - important if clobber was not done
    //                     sh '/bin/bash -lc "rm -rf obj/pkg"'

    //                     withCredentials([
    //                         [$class: 'FileBinding', credentialsId: MAC_CERT_CREDENTIAL_ID, variable: 'CERT_FILE'],
    //                         [$class: 'StringBinding', credentialsId: MAC_CERT_PASS_CREDENTIAL_ID, variable: 'CERT_PASS']
    //                     ]) {
    //                         try {
    //                             // create temporary keychain and make it a default one
    //                             sh '''#!/bin/bash -l -x
    //                                 security create-keychain -p cliqz cliqz
    //                                 security list-keychains -s cliqz
    //                                 security default-keychain -s cliqz
    //                                 security unlock-keychain -p cliqz cliqz
    //                             '''

    //                             sh '''#!/bin/bash -l +x
    //                                 security import $CERT_FILE -P $CERT_PASS -k cliqz -A
    //                             '''

    //                             withEnv(["CQZ_CERT_NAME=$CQZ_CERT_NAME"]) {
    //                                 sh '/bin/bash -lc "./sign_mac.sh ${LANG_PARAM}"'
    //                             }
    //                         } finally {
    //                             sh '''#!/bin/bash -l -x
    //                                 security delete-keychain cliqz
    //                                 security list-keychains -s login.keychain
    //                                 security default-keychain -s login.keychain
    //                                 true
    //                             '''
    //                         }
    //                     }
    //                 }

    //                 stage('OSX Upload') {
    //                     if (env.RELEASE_CHANNEL == 'pr') {
    //                         sh '/bin/bash -lc "./magic_upload_files.sh"'
    //                     } else {
    //                         withEnv(['CQZ_CERT_DB_PATH=/Users/vagrant/certs']) {
    //                             try {
    //                                 //expose certs
    //                                 withCredentials([
    //                                     [$class: 'FileBinding', credentialsId: MAR_CERT_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PATH'],
    //                                     [$class: 'StringBinding', credentialsId: MAR_CERT_PASS_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PWD']]) {

    //                                     sh '''#!/bin/bash -l -x
    //                                         mkdir $CQZ_CERT_DB_PATH
    //                                         cd `brew --prefix nss`/bin
    //                                         ./certutil -N -d $CQZ_CERT_DB_PATH -f emptypw.txt
    //                                         set +x
    //                                         ./pk12util -i $CLZ_CERTIFICATE_PATH -W $CLZ_CERTIFICATE_PWD -d $CQZ_CERT_DB_PATH
    //                                     '''
    //                                 }

    //                                 withCredentials([[
    //                                     $class: 'UsernamePasswordMultiBinding',
    //                                     credentialsId: CQZ_AWS_CREDENTIAL_ID,
    //                                     passwordVariable: 'AWS_SECRET_ACCESS_KEY',
    //                                     usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

    //                                     sh """#!/bin/bash -l -x
    //                                         ./magic_upload_files.sh ${LANG_PARAM}
    //                                     """

    //                                     archiveArtifacts 'obj/i386/build_properties.json'
    //                                 }
    //                             } finally {
    //                                 // remove certs
    //                                 sh 'rm -r $CQZ_CERT_DB_PATH || true'
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }   
    //     }
    // }

    jobs["windows"] = {
        node('browser-windows-pr') {
            ws('x') {
                stage('Windows Hypervizor Checkout') {
                    checkout scm
                }

                try {
                   helpers = load "build-helpers.groovy"
                } catch(e) {
                    echo "Could not load build-helpers"
                    throw e
                }

                def ec2_node = helpers.getEC2Slave("c:/jenkins", CQZ_AWS_CREDENTIAL_ID, AWS_REGION, ANSIBLE_PLAYBOOK_PATH)
                if (ec2_node.created) {
                    echo "Node is just created needs to be provisioned"
                    withCredentials([
                        [$class: 'AmazonWebServicesCredentialsBinding', accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: env.CQZ_AWS_CREDENTIAL_ID, secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        withEnv([
                          "aws_access_key=${env.AWS_ACCESS_KEY_ID}",
                          "aws_secret_key=${env.AWS_SECRET_ACCESS_KEY}",
                          "instance_name=${nodeId}",]) {
                            sh "ansible-playbook ${ansible_path}/bootstrap.yml"
                        }
                    }
                    

                    def command = "aws ec2 describe-instances --filters \"Name=tag:Name,Values=${ec2_node.nodeId}\" | grep PrivateIpAddress | head -1 | awk -F \':\' '{print \$2}' | sed \'s/[\",]//g\'"
                    def nodeIP
                    def nodeSecret = getNodeSecret(nodeId)
                    
                    withCredentials([
                      [$class: 'AmazonWebServicesCredentialsBinding',
                      accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                      credentialsId: env.CQZ_AWS_CREDENTIAL_ID,
                      secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                          withEnv([
                              "AWS_DEFAULT_REGION=${env.AWS_REGION}"    
                              ]) {
                              nodeIP = sh(returnStdout: true, script: "${command}").trim()
                          }
                    } // withCredentials
                    
                    withEnv([
                      "instance_name=${ec2_node.nodeId}",
                      "JENKINS_URL=${env.JENKINS_URL}",
                      "NODE_ID=${ec2_node.nodeId}",
                      "NODE_SECRET=${nodeSecret}"]) {
                          sh "ansible-playbook -i ${nodeIP}, ${ansible_path}/playbook.yml"
                    }
                }
                
                node(ec2_node.nodeId) {
                    ws('a') {
                        stage("EC2 SCM Checkout") {
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

                        // withCredentials([
                        //     [$class: 'FileBinding', credentialsId: WIN_CERT_PATH_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PATH'],
                        //     [$class: 'StringBinding', credentialsId: WIN_CERT_PASS_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PWD'],
                        //     [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID, variable: 'MOZ_MOZILLA_API_KEY'],
                        //     [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID, variable: 'CQZ_GOOGLE_API_KEY'],
                        //     [$class: 'AmazonWebServicesCredentialsBinding', accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: CQZ_AWS_CREDENTIAL_ID, secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']
                        //     ]) {

                        //     withEnv([
                        //       "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}",
                        //       "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
                        //       "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
                        //       "CLZ_CERTIFICATE_PWD=${CLZ_CERTIFICATE_PWD}",
                        //       "CLZ_CERTIFICATE_PATH=${CLZ_CERTIFICATE_PATH}"
                        //     ]){
                        //       stage('WIN Build') {
                        //         bat '''
                        //             set CQZ_WORKSPACE=%cd%
                        //             build_win.bat
                        //         '''
                        //       }
                        //     }

                        //     if (CQZ_BUILD_DE_LOCALIZATION == "1") {
                        //       archiveArtifacts 'obj/en_build_properties.json'
                        //       archiveArtifacts 'obj/de_build_properties.json'
                        //     } else {
                        //       archiveArtifacts 'obj/build_properties.json'
                        //     }
                        // }
                    }// ws
                } // node(nodeId)
            }
        }
    }
    
    // jobs["linux"] = {
    //     node('browser') {
    //         ws('build') {
    //             stage('checkout') {
    //               checkout scm
    //             }
    //             withCredentials([
    //                 [$class: 'FileBinding', credentialsId: WIN_CERT_PATH_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PATH'],
    //                 [$class: 'StringBinding', credentialsId: WIN_CERT_PASS_CREDENTIAL_ID, variable: 'CLZ_CERTIFICATE_PWD'],
    //                 [$class: 'StringBinding', credentialsId: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID, variable: 'MOZ_MOZILLA_API_KEY'],
    //                 [$class: 'StringBinding', credentialsId: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID, variable: 'CQZ_GOOGLE_API_KEY'],
    //                 [$class: 'AmazonWebServicesCredentialsBinding', accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: CQZ_AWS_CREDENTIAL_ID, secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']
    //                 ]) {

    //                 withEnv([
    //                   "CQZ_BUILD_DE_LOCALIZATION=${CQZ_BUILD_DE_LOCALIZATION}",
    //                   "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
    //                   "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
    //                   "CLZ_CERTIFICATE_PWD=${CLZ_CERTIFICATE_PWD}",
    //                   "CLZ_CERTIFICATE_PATH=${CLZ_CERTIFICATE_PATH}"
    //                 ]){
    //                   stage('WIN Build') {
    //                     bat '''
    //                         set CQZ_WORKSPACE=%cd%
    //                         build_win.bat
    //                     '''
    //                   }
    //                 }

    //                 if (CQZ_BUILD_DE_LOCALIZATION == "1") {
    //                   archiveArtifacts 'obj/en_build_properties.json'
    //                   archiveArtifacts 'obj/de_build_properties.json'
    //                 } else {
    //                   archiveArtifacts 'obj/build_properties.json'
    //                 }
    //             }
    //         }
    //     }
    // }

    parallel jobs
} 
