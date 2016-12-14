#!/usr/bin/env groovy


LIN_REBUILD_IMAGE = false
WIN_REBUILD_IMAGE = false
CQZ_RELEASE_CHANNEL = JOB_BASE_NAME.replaceAll("-", "")
CQZ_S3_DEBIAN_REPOSITORY_URL = 's3://repository.cliqz.com/dist/debian-pr/'+CQZ_RELEASE_CHANNEL+'/'+BUILD_ID
CQZ_BUILD_ID = ''
COMMIT_ID = BUILD_ID
CQZ_BUILD_DE_LOCALIZATION = ''
CQZ_GOOGLE_API_KEY_CREDENTIAL_ID = 'google-api-key'
CQZ_MOZILLA_API_KEY_CREDENTIAL_ID = 'mozilla-api-key'
CQZ_AWS_CREDENTIAL_ID = 'aws-username-and-pass'
DEBIAN_GPG_KEY_CREDENTIAL_ID = 'debian-gpg-key'
DEBIAN_GPG_PASS_CREDENTIAL_ID = 'debian-gpg-pass'
AWS_REGION = 'us-east-1'
DOCKER_REGISTRY_URL = 'https://141047255820.dkr.ecr.us-east-1.amazonaws.com'
//REPO_URL = 'git@github.com:cliqz-oss/browser-f.git'
REPO_URL = 'https://github.com/cliqz-oss/browser-f.git'

WIN_CERT_PASS_CREDENTIAL_ID = 'c2d53661-8521-47c7-a7b3-73bbb6723c0a'
WIN_CERT_PATH_CREDENTIAL_ID = '44c2aee7-743e-4ede-9411-55ad7219b09c'
CQZ_RELEASE_CHANNEL = 'pr'
CQZ_BUILD_ID = new Date().format('yyyyMMddHHmmss')

CQZ_EXTENSION_URL = 's3://cdncliqz/update/browser/Cliqz.1.9.0.xpi'
CQZ_HTTPSE_EXTENSION_URL = 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.4-browser-signed.xpi'

def jobs = [:]
def helpers


jobs['windows'] = {
    node('browser-windows-pr') {
        def VAGRANTFILE =  "win.Vagrantfile"

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

                withCredentials([usernamePassword(credentialsId: CQZ_AWS_CREDENTIAL_ID, passwordVariable: 'AWS_SECRET_ACCESS_KEY', usernameVariable: 'AWS_ACCESS_KEY_ID')]) {
                    sh "s3cmd cp -d -v  $CQZ_EXTENSION_URL $UPLOAD_PATH"
                    sh "s3cmd cp -d -v $CQZ_HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
                }
            }

            helpers.createEC2Slave("c:/jenkins", CQZ_AWS_CREDENTIAL_ID, AWS_REGION) {
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
                            //load 'Jenkinsfile.win'
                        } // ws
                    } // node(nodeId)
            }
            //def slaveName = 'windows-pr-slave02'
            // helpers.withVagrant("${VAGRANTFILE}", "c:/jenkins", 8, 8192, 5901, false, null) {
            //     nodeId ->
            //         node(nodeId) {
            //             ws('a') {
            //                 stage("VM Checkout") {
            //                     checkout([
            //                         $class: 'GitSCM',
            //                         branches: scm.branches,
            //                         extensions: scm.extensions + [
            //                             [$class: 'CheckoutOption', timeout: 60],
            //                             [$class: 'CloneOption', timeout: 60]
            //                         ],
            //                         userRemoteConfigs: scm.userRemoteConfigs
            //                     ])
            //                 } // stage
            //                 load 'Jenkinsfile.win'
            //                 //load 'Jenkinsfile.win'
            //             } // ws
            //         } // node(nodeId)
            // } // withVagrant


            /*
            helpers.withVagrant("${VAGRANTFILE}", "c:/jenkins", 8, 8192, 5901, false) {
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
                            }
                            load 'Jenkinsfile.win'
                        }
                    } // node(nodeId)
            } // withVagrant
            */
        } // ws
    } // node
}

/*
jobs['mac'] = {
	node('browser-mac-pr') {
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
*/

parallel jobs
