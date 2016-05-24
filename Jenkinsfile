node {
  // die early without CQZ_BUILD_ID
  CQZ_BUILD_ID

  try {
    CQZ_COMMIT
  } catch (MissingPropertyExceptionmpe) {
    CQZ_COMMIT = ''
  }
  CQZ_COMMIT = CQZ_COMMIT ? CQZ_COMMIT : 'master'

  stage 'checkout'
  git branch: CQZ_COMMIT, url: 'https://github.com/cliqz-oss/browser-f'

  stage 'expose certs'
  sh 'rm -fr certs'
  sh 'cp -R /cliqz certs'

  stage 'prepare docker'
  def imgName = "cliqz-oss/browser-f:${env.BUILD_TAG}"
  docker.build(imgName, ".")
  docker.image(imgName).inside("-u 0:0") {
    sh 'python mozilla-release/python/mozboot/bin/bootstrap.py --application-choice=desktop --no-interactive'
  }


  stage 'build'
  docker.image(imgName).inside("-u 0:0") {
    withEnv([
      "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
      "CQZ_COMMIT=${CQZ_COMMIT}",
      "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
      "CQZ_DE_LOCALIZATION=${CQZ_DE_LOCALIZATION}",
    ]) {
      sh '''#!/bin/bash -xe
export SHELL=/bin/bash
cp ./certs/s3boto_repository_cliqz_com ~/.boto
source ./certs/cliqz_browser_api_keys.sh
./magic_build_and_package.sh  --clobber
      '''
    }
  }

  stage 'publish debian repo'
  docker.image(imgName).inside("-u 0:0") {
    withEnv([
      "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
    ]) {
      sh '''#!/bin/bash -xe
source ./certs/s3cmd_repository_cliqz_com.sh
./sign_lin.sh
      '''
    }
  }

  stage 'publish updates'
  docker.image(imgName).inside("-u 0:0") {
    withEnv([
      "CQZ_BUILD_ID=${CQZ_BUILD_ID}",
      "CQZ_COMMIT=${CQZ_COMMIT}",
      "CQZ_RELEASE_CHANNEL=${CQZ_RELEASE_CHANNEL}",
      "CQZ_DE_LOCALIZATION=${CQZ_DE_LOCALIZATION}",
    ]) {
      sh '''#!/bin/bash -xe
export SHELL=/bin/bash
cp ./certs/s3boto_repository_cliqz_com ~/.boto
./magic_upload_files.sh
rm ~/.boto
      '''
    }
  }

  stage "remove certs"
  sh 'rm -rf certs'
}
