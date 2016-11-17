#!/usr/bin/env groovy

LIN_REBUILD_IMAGE = false
CQZ_S3_DEBIAN_REPOSITORY_URL = 's3://repository.cliqz.com/dist/debian-pr'
CQZ_RELEASE_CHANNEL = 'pr/'+BRANCH_NAME
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

def ensureSafeWorkspace(Closure block) {
	def maxWorkspacePathLen = 60;
	def isUnsafe = pwd().contains("%") || (pwd().length()>maxWorkspacePathLen);
	if (isUnsafe) { // Then we will request a new workspace...
		ws(safePath(env.JOB_NAME).take(maxWorkspacePathLen)) {
			block();
		}
	} else { // Just call the closure in the current workspace (Avoid unnecessary master@2 workspace for example)
		block();
	}
}

node('browser') {
  ensureSafeWorkspace {
    stage('checkout') {
      checkout scm
    }

    stage("Start build") {
      load 'Jenkinsfile.lin'
    }
  }
}
