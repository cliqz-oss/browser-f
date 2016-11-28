import jenkins.model.*
import hudson.model.*
import hudson.slaves.*

def checkoutSCM(URL, COMMIT) {
    checkout(
        changelog: false,
        poll: false,
        scm: [
            $class: 'GitSCM',
            branches: [[name: COMMIT]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [
                [$class: 'CheckoutOption', timeout: 30],
                [$class: 'CloneOption', depth: 0, noTags: true, reference: '', shallow: false, timeout: 30, honorRefspec: true],
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[credentialsId: '0aededfc-f41d-40bd-9a63-dd4524adb7b6', url: URL]]
        ]
    )
}

@NonCPS
def createNode(nodeId, jenkinsFolderPath) {
    def launcher = new JNLPLauncher()
    def node = new DumbSlave(
        nodeId,
        jenkinsFolderPath,
        launcher
    )
    Jenkins.instance.addNode(node)
}

@NonCPS
def removeNode(nodeId) {
    def allNodes = Jenkins.getInstance().getNodes()
    for (int i =0; i < allNodes.size(); i++) {
        Slave node = allNodes[i]

        if (node.name.toString() == nodeId) {
            Jenkins.getInstance().removeNode(node)
            return
        }
    }
}

@NonCPS
def getNodeSecret(nodeId) {
    return jenkins.slaves.JnlpSlaveAgentProtocol.SLAVE_SECRET.mac(nodeId)
}

def withDocker(String imageName, String jenkinsFolderPath, Closure body) {
  def nodeId = "${env.BUILD_TAG}"
  def error

  // Prepare image
  try {
    // authorize docker deamon to access registry
    sh "`aws ecr get-login --region=$AWS_REGION`"

    docker.withRegistry(DOCKER_REGISTRY_URL) {
      def image = docker.image(imageName)
      image.pull()
      imageName = image.imageName()
    }
  } catch (e) {
    // local registry does not require auth
  }

  // Create Jenkins node
  createNode(nodeId, jenkinsFolderPath)
  try {
    def nodeSecret = getNodeSecret(nodeId)

      // Start agent
    docker.image(imageName).inside() {
      sh """
        rm -f slave.jar
        # TODO: move to docker image
        sudo apt-get install openjdk-7-jre -y
        wget $JENKINS_URL/jnlpJars/slave.jar
        nohup java -jar slave.jar -jnlpUrl ${env.JENKINS_URL}/computer/$nodeId/slave-agent.jnlp -secret $nodeSecret &
      """

      // Run the closure
      body(nodeId)
    }
  } catch (e) {
    error = e
  } finally {
    removeNode(nodeId)
    if (error) {
      throw error
    }
  }
}

def withVagrant(String vagrantFilePath, String jenkinsFolderPath, Integer cpu, Integer memory, Integer vnc_port, Boolean rebuild, Closure body) {
    def nodeId = "${env.BUILD_TAG}"
    createNode(nodeId, jenkinsFolderPath)
    try {
        def nodeSecret = getNodeSecret(nodeId)

        withEnv([
            "VAGRANT_VAGRANTFILE=${vagrantFilePath}",
            "NODE_CPU_COUNT=${cpu}",
            "NODE_MEMORY=${memory}",
            "NODE_VNC_PORT=${vnc_port}",
            "NODE_SECRET=${nodeSecret}",
            "NODE_ID=${nodeId}",
            ]) {

            sh 'vagrant halt --force'
            if (rebuild) {
              sh 'vagrant destroy --force'
            }
            sh  'vagrant up'
        }

        body(nodeId)
    } finally {
        removeNode(nodeId)
        withEnv(["VAGRANT_VAGRANTFILE=${vagrantFilePath}"]) {
            sh 'vagrant halt --force'
        }
    }
}

@NonCPS
def uploadExtensions(aws_credential_id, release_channel, cqz_build_id, cqz_extension_url, httpse_extension_url ) {
        def cqz_version = "1.9.0" //sh(returnStdout: true, script: "awk -F '=' '/version/ {print \$2}' ./repack/distribution/distribution.ini | head -n1").trim() 
        def upload_path="s3://repository.cliqz.com/dist/${release_channel}/${cqz_version}/${cqz_build_id}/cliqz@cliqz.com.xpi"
        def httpse_upload_path="s3://repository.cliqz.com/dist/${release_channel}/${cqz_version}/${cqz_build_id}/https-everywhere@cliqz.com.xpi"

        withCredentials([[
            $class: 'UsernamePasswordMultiBinding',
            credentialsId: aws_credential_id, 
            passwordVariable: 'AWS_SECRET_ACCESS_KEY',
            usernameVariable: 'AWS_ACCESS_KEY_ID']]) {

                sh "s3cmd cp ${cqz_extension_url} ${upload_path}"
                sh "s3cmd cp ${httpse_extension_url} ${httpse_upload_path}"
        }
        echo "Finished uploading"
        return true
}


return this
