#!/usr/bin/env groovy

/*
Jenkins pipeline script to build CLIQZ browser for linux
It does the following:
    1. Checks out 'cliqz-oss/browser-f'
    2. Builds a docker image with dependencies installed
Checkout code in respective Jenkinsfile

node("master") {
    stage("Checkout") {
        checkout([
            $class: 'GitSCM',
            branches: [[name: COMMIT_ID]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [],
            submoduleCfg: [],
            userRemoteConfigs: [[url: REPO_URL]]
        ])
    }

    stage("Start build") {
        load ENTRY_POINT
    }
}
*/

def helpers = load 'build-helpers.groovy'

import org.codehaus.groovy.runtime.*;

CQZ_BUILD_ID = DateGroovyMethods.format(new Date(), 'yyyyMMddHHmmss')

// Die early for missing build params
CQZ_RELEASE_CHANNEL
CQZ_BUILD_ID
COMMIT_ID
REPO_URL
CQZ_BUILD_DE_LOCALIZATION
LIN_BUILD_IMAGE
MAC_BUILD_IMAGE
WIN_BUILD_IMAGE
CQZ_GOOGLE_API_KEY_CREDENTIAL_ID
CQZ_MOZILLA_API_KEY_CREDENTIAL_ID
CQZ_AWS_CREDENTIAL_ID
LINUX_BUILD_NODE
CQZ_BALROG_DOMAIN

stage("Copy XPI") {
    CQZ_VERSION=sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim()
    UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/cliqz@cliqz.com.xpi"
    HTTPSE_UPLOAD_PATH="s3://repository.cliqz.com/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID/https-everywhere@cliqz.com.xpi"

    withCredentials([[
                $class: 'UsernamePasswordMultiBinding',
                credentialsId: CQZ_AWS_CREDENTIAL_ID,
                passwordVariable: 'AWS_SECRET_ACCESS_KEY',
                usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

        sh "s3cmd cp $CQZ_EXTENSION_URL $UPLOAD_PATH"
        sh "s3cmd cp $HTTPSE_EXTENSION_URL $HTTPSE_UPLOAD_PATH"
    }
}

def getBaseBuildParams(jobName, entryPoint) {
  return [
    job: jobName,
    parameters: [
      string(name: 'REPO_URL', value: REPO_URL),
      string(name: 'COMMIT_ID', value: COMMIT_ID),
      string(name: 'ENTRY_POINT', value: entryPoint),
      string(name: 'LINUX_BUILD_NODE', value: LINUX_BUILD_NODE),
      string(name: 'CQZ_RELEASE_CHANNEL', value: CQZ_RELEASE_CHANNEL),
      string(name: 'CQZ_GOOGLE_API_KEY_CREDENTIAL_ID', value: CQZ_GOOGLE_API_KEY_CREDENTIAL_ID),
      string(name: 'CQZ_MOZILLA_API_KEY_CREDENTIAL_ID', value: CQZ_MOZILLA_API_KEY_CREDENTIAL_ID),
      string(name: 'CQZ_AWS_CREDENTIAL_ID', value: CQZ_AWS_CREDENTIAL_ID),
      string(name: 'DEBIAN_GPG_KEY_CREDENTIAL_ID', value: DEBIAN_GPG_KEY_CREDENTIAL_ID),
      string(name: 'DEBIAN_GPG_PASS_CREDENTIAL_ID', value: DEBIAN_GPG_PASS_CREDENTIAL_ID),
      string(name: 'CQZ_BUILD_ID', value: CQZ_BUILD_ID),
      string(name: 'CQZ_S3_DEBIAN_REPOSITORY_URL', value: CQZ_S3_DEBIAN_REPOSITORY_URL),
      string(name: 'TRIGGERING_BUILD_NUMBER', value: env.BUILD_NUMBER),
      string(name: 'TRIGGERING_JOB_NAME', value: env.JOB_NAME),
    ]
  ]
}

def getBaseMacBuildParams() {
  def buildParams  = getBaseBuildParams('browser-f-mac', 'mac.Jenkinsfile')
  buildParams.parameters += [
    booleanParam(name: 'MAC_REBUILD_IMAGE', value: MAC_REBUILD_IMAGE.toBoolean()),
    string(name: 'CQZ_BUILD_DE_LOCALIZATION', value: CQZ_BUILD_DE_LOCALIZATION),
    string(name: 'MAC_BUILD_NODE', value: MAC_BUILD_NODE),
    string(name: 'MAC_CERT_CREDENTIAL_ID', value: MAC_CERT_CREDENTIAL_ID),
    string(name: 'MAC_CERT_PASS_CREDENTIAL_ID', value: MAC_CERT_PASS_CREDENTIAL_ID),
    string(name: 'MAC_CERT_NAME', value: MAC_CERT_NAME),
    string(name: 'MAR_CERT_CREDENTIAL_ID', value: MAR_CERT_CREDENTIAL_ID),
    string(name: 'MAR_CERT_PASS_CREDENTIAL_ID', value: MAR_CERT_PASS_CREDENTIAL_ID),
    string(name: 'VAGRANTFILE', value: 'mac.Vagrantfile'),
    string(name: 'NODE_MEMORY', value: '8000'),
    string(name: 'NODE_CPU_COUNT', value: '4'),
  ]
  return buildParams
}

archive 'build-helpers.groovy'
archive 'win.Vagrantfile'
archive 'mac.Vagrantfile'

stage('Build') {
    parallel (
        'linux en': {
            def buildParams = getBaseBuildParams('browser-f-linux', 'linux.Jenkinsfile')
            buildParams.parameters += [
              booleanParam(name: 'LIN_REBUILD_IMAGE', value: LIN_REBUILD_IMAGE.toBoolean()),
              string(name: 'CQZ_BUILD_DE_LOCALIZATION', value: CQZ_BUILD_DE_LOCALIZATION),
              string(name: 'LINUX_BUILD_NODE', value: LINUX_BUILD_NODE),
              string(name: 'DEBIAN_GPG_KEY_CREDENTIAL_ID', value: DEBIAN_GPG_KEY_CREDENTIAL_ID),
              string(name: 'DEBIAN_GPG_PASS_CREDENTIAL_ID', value: DEBIAN_GPG_PASS_CREDENTIAL_ID),
              string(name: 'CQZ_S3_DEBIAN_REPOSITORY_URL', value: CQZ_S3_DEBIAN_REPOSITORY_URL),
            ]
            job = build buildParams
            submitBalrog(buildParams.job, job.id)
        },
        'mac de': {
            def buildParams = getBaseMacBuildParams()
            buildParams.parameters += [
              string(name: 'CQZ_LANG', value: 'de'),
              string(name: 'NODE_VNC_PORT', value: '7901'),
            ]
            job = build buildParams
            submitBalrog(buildParams.job, job.id, 'obj/i386/build_properties.json')
        },
        'mac en': {
            def buildParams = getBaseMacBuildParams()
            buildParams.parameters += [
              string(name: 'NODE_VNC_PORT', value: '7900'),
            ]
            job = build buildParams
            submitBalrog(buildParams.job, job.id, 'obj/i386/build_properties.json')
        },
        'win': {
            def buildParams = getBaseBuildParams('browser-f-win', 'win.Jenkinsfile')
            buildParams.parameters += [
              booleanParam(name: 'WIN_REBUILD_IMAGE', value: WIN_REBUILD_IMAGE.toBoolean()),
              string(name: 'NODE_VNC_PORT', value: '7900'),
              string(name: 'CQZ_BUILD_DE_LOCALIZATION', value: '1'),
              string(name: 'VAGRANTFILE', value: 'win.Vagrantfile'),
              string(name: 'WIN_BUILD_NODE', value: 'master'),
              string(name: 'WIN_CERT_PATH_CREDENTIAL_ID', value: WIN_CERT_PATH_CREDENTIAL_ID),
              string(name: 'WIN_CERT_PASS_CREDENTIAL_ID', value: WIN_CERT_PASS_CREDENTIAL_ID),
            ]
            if (CQZ_RELEASE_CHANNEL == "release") {
              buildParams.parameters += [
                string(name: 'NODE_MEMORY', value: '16000'),
                string(name: 'NODE_CPU_COUNT', value: '8'),
              ]
            } else {
              buildParams.parameters += [
                string(name: 'NODE_MEMORY', value: '8000'),
                string(name: 'NODE_CPU_COUNT', value: '8'),
              ]
            }
            job = build buildParams
            submitBalrog(buildParams.job, job.id, 'obj/en_build_properties.json')
            submitBalrog(buildParams.job, job.id, 'obj/de_build_properties.json')
        }
    )
}

def submitBalrog(jobName, id, propsPath = 'obj/build_properties.json') {
    def folder = "artifacts/$jobName/$id"
    step([
        $class: 'CopyArtifact',
        projectName: jobName,
        selector: [$class: 'SpecificBuildSelector', buildNumber: id],
        target: folder
    ])

    sh """
        python ./build-tools/scripts/updates/balrog-submitter.py \
            --credentials-file ./mozilla-release/build/creds.txt --username balrogadmin \
            --api-root http://$CQZ_BALROG_DOMAIN/api \
            --build-properties ${folder + '/' + propsPath}
    """
}
