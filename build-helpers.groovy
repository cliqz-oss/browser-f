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
                [$class: 'CloneOption', depth: 0, noTags: true, reference: '', shallow: false, timeout: 60, honorRefspec: true],
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

@NonCPS
def setNodeLabel(nodeId, label) {
    def allNodes = Jenkins.getInstance().getNodes()
    for (int i =0; i < allNodes.size(); i++) {
        Slave node = allNodes[i]

        if (node.name.toString() == nodeId) {
          node.setLabelString(label)
          return
        }
    }
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
  try {
    createNode(nodeId, jenkinsFolderPath)
  } catch(e) {
    echo "Could not create slave for Docker"
  }

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
def hasNewerQueuedJobs() {
  def queue = jenkins.model.Jenkins.getInstance().getQueue().getItems()
  for (int i=0; i < queue.length; i++) {
    if (queue[i].task.getName() == env.JOB_NAME ) {
      return true
    }
  }
  return false
}

@NonCPS
def getIdleSlave(label) {
  for (slave in Hudson.instance.slaves) {
    if (slave.getLabelString().contains(label)) {
      if (!slave.getComputer().isOffline()) {
        if (slave.getComputer().countBusy() == 0) {
          return slave.name
        }
      }
    }
  }

  return false
}


@NonCPS
def getEC2Slave(String label, String jenkinsFolderPath) {
    def result = [:]
    def nodeId = getIdleSlave(label)

    if (nodeId) {
      result['created'] = false
    } else {
      // This is a new slave, so we need to bootstrap it
      nodeId = "browser-f-${env.JOB_BASE_NAME}"
      try {
          createNode(nodeId, jenkinsFolderPath)
          setNodeLabel(nodeId, label)
          result['created'] = true
      } catch (e) {
          throw e
      }
    }

    result['nodeId'] = nodeId.toString()
    result['secret'] = getNodeSecret(nodeId)
    return result
}

return this
