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

WIN_CERT_PATH_CREDENTIAL_ID = '54335c2c-be98-4f2a-b207-80c4e4069140'
WIN_CERT_PASS_CREDENTIAL_ID = 'c16b8eb2-ddd0-4034-bfcf-e52fa9663edd'
CLZ_CERTIFICATE_PWD = 'test'
CQZ_RELEASE_CHANNEL = 'pr'
CQZ_GOOGLE_API_KEY_CREDENTIAL_ID = 'google-api-key'
CQZ_MOZILLA_API_KEY_CREDENTIAL_ID = 'mozilla-api-key'
CQZ_AWS_CREDENTIAL_ID = 'aws-username-and-pass'
CQZ_BUILD_ID = new Date().format('yyyyMMddHHmmss')

CQZ_EXTENSION_URL = 's3://cdncliqz/update/browser/Cliqz.1.9.0.xpi'
CQZ_HTTPSE_EXTENSION_URL = 's3://cdncliqz/update/browser/https-everywhere/https-everywhere@cliqz.com-5.2.4-browser-signed.xpi'

def jobs = [:]
def helpers

/*
jobs['linux'] = {
    node('browser') {
      ws('x') {
        stage('checkout') {
          checkout scm
        }

        stage("Start build") {
          load 'Jenkinsfile.lin'
        }
      }
    }

    stage("Start build") {
      load 'Jenkinsfile.lin'
    }
}
*/

jobs['windows'] = {
    node('browser-windows-pr') {
        def VAGRANTFILE =  "win.Vagrantfile"

        ws('x') {
            stage('Hypervizor Checkout') {
                /*
                checkout([
                                $class: 'GitSCM',
                                branches: scm.branches,
                                extensions: scm.extensions + [
                                    [$class: 'CheckoutOption', timeout: 60],
                                    [$class: 'CloneOption', depth: 0, honorRefspec: true, noTags: true, reference: '', shallow: true, timeout: 60]
                                ],
                                userRemoteConfigs: scm.userRemoteConfigs
                            ])
                */
                checkout scm
                helpers = load "build-helpers.groovy"
            }
            stage("Copy XPI") {
                CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
                UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
                HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

                withCredentials([[
                    $class: 'UsernamePasswordMultiBinding', 
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID', 
                    credentialsId: CQZ_AWS_CREDENTIAL_ID, 
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        sh "s3cmd cp -d -v  $CQZ_EXTENSION_URL $UPLOAD_PATH"
                        sh "s3cmd cp -d -v $HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
                }
            }
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
                    }
            }
            */
        }      
    }
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
