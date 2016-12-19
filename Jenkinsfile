#!/usr/bin/env groovy


// LIN_REBUILD_IMAGE = false
// WIN_REBUILD_IMAGE = false
CQZ_RELEASE_CHANNEL = JOB_BASE_NAME.replaceAll("-", "")
CQZ_S3_DEBIAN_REPOSITORY_URL = 's3://repository.cliqz.com/dist/debian-pr/'+CQZ_RELEASE_CHANNEL+'/'+BUILD_ID
COMMIT_ID = BUILD_ID
CQZ_BUILD_DE_LOCALIZATION = ''
// CQZ_GOOGLE_API_KEY_CREDENTIAL_ID = 'google-api-key'
// CQZ_MOZILLA_API_KEY_CREDENTIAL_ID = 'mozilla-api-key'
DEBIAN_GPG_KEY_CREDENTIAL_ID = 'debian-gpg-key'
DEBIAN_GPG_PASS_CREDENTIAL_ID = 'debian-gpg-pass'
DOCKER_REGISTRY_URL = 'https://141047255820.dkr.ecr.us-east-1.amazonaws.com'
REPO_URL = 'https://github.com/cliqz-oss/browser-f.git'
WIN_CERT_PASS_CREDENTIAL_ID = 'c2d53661-8521-47c7-a7b3-73bbb6723c0a'
WIN_CERT_PATH_CREDENTIAL_ID = '44c2aee7-743e-4ede-9411-55ad7219b09c'
CQZ_BUILD_ID = new Date().format('yyyyMMddHHmmss')

// CQZ_AWS_CREDENTIAL_ID = 'aws-username-and-pass'

// AWS_REGION = 'us-east-1'

// ANSIBLE_PLAYBOOK_PATH = '/home/jenkins/libs/cliqz-builder/ansible/ec2'


// CQZ_RELEASE_CHANNEL = 'pr'


// CQZ_EXTENSION_URL = 's3://cdncliqz/update/browser/Cliqz.1.11.1.xpi'
// CQZ_HTTPSE_EXTENSION_URL = 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.8-browser-signed.xpi'

def jobs = [:]
def helpers

properties([
    [$class: 'JobRestrictionProperty'], 
    parameters([
        string(defaultValue: 'pr', name: 'RELEASE_CHANNEL'),
        string(defaultValue: 'google-api-key', name: 'CQZ_GOOGLE_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'mozilla-api-key', name: 'CQZ_MOZILLA_API_KEY_CREDENTIAL_ID'),
        string(defaultValue: 'f3c1a44b-1da8-4b37-a45d-a764b3f0b40b', name: 'CQZ_AWS_CREDENTIAL_ID'),
        string(defaultValue: 's3://cdncliqz/update/browser_beta/latest.xpi', name: 'CQZ_EXTENSION_URL'),
        string(defaultValue: 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.8-browser-signed.xpi', name: 'CQZ_HTTPSE_EXTENSION_URL'),
        string(defaultValue: 'us-east-1', name: 'AWS_REGION'),
        string(defaultValue: '/home/jenkins/libs/cliqz-builder/ansible/ec2', name: 'ANSIBLE_PLAYBOOK_PATH'),
        booleanParam(defaultValue: false, description: '', name: 'MAC_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'WIN_REBUILD_IMAGE'),
        booleanParam(defaultValue: false, description: '', name: 'LIN_REBUILD_IMAGE'),
    ]), 
    pipelineTriggers([])
])

/*
jobs['windows'] = {
    node('browser-windows-pr') {
        ws('x') {
            stage('Hypervizor Checkout') {
                checkout([
                    $class: 'GitSCM',
                    branches: scm.branches,
                    extensions: scm.extensions + [
                        [$class: 'CheckoutOption', timeout: 60],
                        [$class: 'CloneOption', timeout: 60]
                    ],
                    userRemoteConfigs: scm.userRemoteConfigs
                ])

                helpers = load "build-helpers.groovy"
            }

            stage("Copy XPI") {
                CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
                UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
                HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

                //withCredentials([usernamePassword(credentialsId: CQZ_AWS_CREDENTIAL_ID, passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                //    sh "s3cmd cp -d -v  $CQZ_EXTENSION_URL $UPLOAD_PATH"
                //    sh "s3cmd cp -d -v $CQZ_HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
                //}

                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    credentialsId: CQZ_AWS_CREDENTIAL_ID,
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {

                    sh "s3cmd cp -d -v  $CQZ_EXTENSION_URL $UPLOAD_PATH"
                    sh "s3cmd cp -d -v $CQZ_HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
                }

            }

            helpers.withEC2Slave("c:/jenkins", CQZ_AWS_CREDENTIAL_ID, AWS_REGION, ANSIBLE_PLAYBOOK_PATH) {
                nodeId ->
                    node(nodeId) {
                        ws('a') {
                            stage("VM Checkout") {
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
*/

jobs['mac'] = {
	node('chromium_mac_buildserver') {
		ws('x') {
			stage('Hypervisor Checkout') {
				checkout scm
			}

			stage("Start Build") {
				load 'Jenkinsfile.mac'
			}
		}
	}
}
parallel jobs
