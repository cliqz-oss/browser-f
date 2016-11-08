#!/usr/bin/env groovy

node('docker') {
  stage('checkout') {
    checkout scm
  }

  load 'linux.Jenkinsfile'
}
