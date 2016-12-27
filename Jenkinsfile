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
        booleanParam(defaultValue: false, description: '', name: 'MAC_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'WIN_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'LIN_REBUILD_IMAGE'),
    ]), 
    pipelineTriggers([])
])


def withLock(Integer retry_times, Integer wait_sleep, Closure body) {
    while (retry_times > 0) {
        if (uploaded_lock == 0) {
            if (uploaded) {
                echo 'Extension uploaded. Skipping'
                retry_times = 0
            } else {
                uploaded_lock++
                body()
                uploaded = true
                uploaded_lock--
                retry_times = 0
            }
        } else if (!uploaded){
            echo "Extensions not uploaded but could not acquire lock. Waiting ${wait_sleep} seconds"
            sleep wait_sleep
            retry_times--
        }
    }
    if (retry_times == 0 && !uploaded) {
        throw new RuntimeException("Could not upload extensions")
    }
}


def mac_build() {
    return {
        retry(3) {
            node('chromium_mac_buildserver') {
                ws('x') {
                    stage('OSX Hypervisor Checkout') {
                        checkout scm
                    }

                    withLock(5, 30) {
                        stage("Copy XPI") {
                            CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
                            UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
                            HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

                            withEnv([
                                "UPLOAD_PATH=$UPLOAD_PATH",
                                "HTTPSE_UPLOAD_PATH=$HTTPSE_UPLOAD_PATH"
                                ]) {
                                withCredentials([
                                    [$class: 'AmazonWebServicesCredentialsBinding',
                                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                    credentialsId: CQZ_AWS_CREDENTIAL_ID,
                                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {

                                        sh '/bin/bash -lc "s3cmd cp -d -v ${CQZ_EXTENSION_URL} ${UPLOAD_PATH}"'
                                        sh '/bin/bash -lc "s3cmd cp -d -v ${CQZ_HTTPSE_EXTENSION_URL} ${HTTPSE_UPLOAD_PATH}"'
                                }
                            }
                        }
                    }
                    load 'Jenkinsfile.mac'
                }
            }
        }
    }
}

def windows_build() {
    return {
        retry(3) {
            node('browser-windows-pr') {
                ws('x') {
                    stage('Windows Hypervizor Checkout') {
                        checkout scm
                    }

                    withLock(5, 30) {
                        stage("Copy XPI") {
                            CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
                            UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
                            HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

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
                    
                    helpers = load "build-helpers.groovy"
                    helpers.withEC2Slave("c:/jenkins", CQZ_AWS_CREDENTIAL_ID, AWS_REGION, ANSIBLE_PLAYBOOK_PATH) {
                        nodeId ->
                            node(nodeId) {
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
                                    load 'Jenkinsfile.win'    
                                }// ws
                            } // node(nodeId)
                    }
                    
                } // ws
            } // node
        }
    }
}


def linux_build() {
    return {
        retry(3) {
            node('browser') {
              ws('build') {
                stage('checkout') {
                  checkout scm
                }

                stage("Start build") {
                  load 'Jenkinsfile.lin'
                }
              }
            }
        }
    }
}

parallel(
    mac: mac_build(),
    windows: windows_build(),
    linux: linux_build()
    ) 
