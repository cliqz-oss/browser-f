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
        helpers = load 'build-helpers.groovy'

        ws('x') {
            stage('checkout') {
                checkout scm
            }
            helpers.withVagrant("artifacts/${VAGRANTFILE}", "/jenkins", 4, 8192, 5901, true) {
                nodeId ->
                    node(nodeId) {
                        stage("Checkout") {
                            helpers.checkoutSCM(REPO_URL, COMMIT_ID)
                        }

                        stage("Start build") {
                            load 'Jenkinsfile.win'
                        }
                    }
            }
        }      
    }
  }

parallel jobs
