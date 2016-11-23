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
            stage('checkout') {
                checkout scm
            }
            helpers = load 'build-helpers.groovy'
            
            helpers.withVagrant("${VAGRANTFILE}", "c:/jenkins", 4, 8192, 5901, false) {
                nodeId ->
                    node(nodeId) {
                        stage("Host Checkout") {
                            checkout([
                                $class: 'GitSCM',
                                branches: scm.branches,
                                extensions: scm.extensions + [
                                    [$class: 'CheckoutOption', timeout: 60],
                                    [$class: 'CleanCheckout']
                                ],
                                userRemoteConfigs: scm.userRemoteConfigs
                            ])
                        }
                        stage('Load Config') {
                            CLZ_CERTIFICATE_PATH = 'c:\\certs\\OmahaTestCert.pfx'
                            CLZ_CERTIFICATE_PWD = 'test'
                            CQZ_RELEASE_CHANNEL = 'pr'
                            CQZ_GOOGLE_API_KEY = 'AIzaSyDxAm11-Q2fFycxT2WRizsKRqdJIv0GPLo'
                            MOZ_MOZILLA_API_KEY = '4fb80dd9-1969-49e8-bec7-501de9f0cd39'

                            print "Loading Windows configuration"
                            load 'Jenkinsfile.win'
                        }
                    }
            }
        }      
    }
}

parallel jobs
