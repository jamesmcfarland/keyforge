import { execa } from 'execa'
import { logEvent, logMessage } from './deployment-tracker.js'

export async function provisionInstance(instanceId: string, adminToken: string): Promise<void> {
  const namespace = instanceId
  const chartPath = './helm-chart'

  try {
    await logEvent(instanceId, 'helm_install', 'in_progress', 'Starting helm installation')
    await logMessage(instanceId, 'info', `Installing helm chart for instance ${instanceId}`)

    const helmResult = await execa('helm', [
      'install',
      instanceId,
      chartPath,
      '--namespace', namespace,
      '--create-namespace',
      '--set', `vaultwd.adminToken=${adminToken}`,
      '--wait',
      '--timeout', '5m'
    ])

    await logMessage(instanceId, 'debug', `Helm install stdout: ${helmResult.stdout}`)
    await logEvent(instanceId, 'helm_install', 'success', 'Helm chart installed successfully')

    await logEvent(instanceId, 'postgres_ready', 'in_progress', 'Waiting for postgres deployment')
    await waitForDeployment(namespace, 'postgres', 120000, instanceId)
    await logEvent(instanceId, 'postgres_ready', 'success', 'Postgres deployment ready')

    await logEvent(instanceId, 'vaultwd_ready', 'in_progress', 'Waiting for vaultwd deployment')
    await waitForDeployment(namespace, 'vaultwd', 120000, instanceId)
    await logEvent(instanceId, 'vaultwd_ready', 'success', 'VaultWarden deployment ready')

    await logMessage(instanceId, 'info', `Provisioning completed successfully for instance ${instanceId}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logEvent(instanceId, 'provisioning', 'failed', errorMessage)
    await logMessage(instanceId, 'error', `Provisioning failed: ${errorMessage}`)
    throw new Error(`Failed to provision instance ${instanceId}: ${error}`)
  }
}

export async function deleteInstance(instanceId: string): Promise<void> {
  const namespace = instanceId

  try {
    await execa('helm', ['uninstall', instanceId, '--namespace', namespace])
    await execa('kubectl', ['delete', 'namespace', namespace])
  } catch (error) {
    throw new Error(`Failed to delete instance ${instanceId}: ${error}`)
  }
}

export async function isDeploymentReady(namespace: string, deploymentName: string): Promise<boolean> {
  try {
    const { stdout } = await execa('kubectl', [
      'get',
      'deployment',
      deploymentName,
      '-n', namespace,
      '-o', 'jsonpath={.status.conditions[?(@.type=="Available")].status}'
    ])
    return stdout.trim() === 'True'
  } catch {
    return false
  }
}

async function waitForDeployment(namespace: string, deploymentName: string, timeoutMs = 120000, instanceId?: string): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    const ready = await isDeploymentReady(namespace, deploymentName)
    if (ready) {
      if (instanceId) {
        await logMessage(instanceId, 'debug', `Deployment ${deploymentName} is ready`)
      }
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  if (instanceId) {
    await logMessage(instanceId, 'error', `Deployment ${deploymentName} did not become ready within timeout`)
  }
  throw new Error(`Deployment ${deploymentName} in namespace ${namespace} did not become ready within timeout`)
}

/**
 * Get the NodePort assigned to the vaultwd service
 * @param namespace - The instance namespace
 * @returns The NodePort number
 */
export async function getServiceNodePort(namespace: string): Promise<number> {
  try {
    const { stdout } = await execa('kubectl', [
      'get',
      'service',
      'vaultwd-service',
      '-n', namespace,
      '-o', 'jsonpath={.spec.ports[0].nodePort}'
    ])
    const port = parseInt(stdout.trim(), 10)
    if (isNaN(port)) {
      throw new Error(`Invalid NodePort returned: ${stdout}`)
    }
    return port
  } catch (error) {
    throw new Error(`Failed to get NodePort for namespace ${namespace}: ${error}`)
  }
}

/**
 * Get the cluster access host for VaultWarden instances.
 * Detects if running Kind or standard k8s and returns appropriate host.
 * @returns The host URL (e.g., 'host.docker.internal', 'localhost', or Kind container IP)
 */
export async function getClusterHost(): Promise<string> {
  try {
    // Allow manual override via environment variable
    if (process.env.K8S_HOST) {
      return process.env.K8S_HOST
    }

    // Try to detect Kind cluster by checking current context
    const { stdout: context } = await execa('kubectl', [
      'config',
      'current-context'
    ])
    
    // If it's a Kind cluster, get the container IP
    if (context.includes('kind')) {
      try {
        const { stdout: kindIP } = await execa('docker', [
          'inspect',
          'kind-control-plane',
          '--format',
          '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
        ])
        const ip = kindIP.trim()
        if (ip) {
          return ip
        }
      } catch {
        // Fall through if docker inspect fails
      }
    }
    
    // For k3s/minikube, use host.docker.internal when running in Docker
    // This works on Linux with Docker 20.10+ and extra_hosts configuration
    return 'host.docker.internal'
  } catch (error) {
    // If anything fails, default to host.docker.internal
    console.warn('Failed to detect cluster host, defaulting to host.docker.internal:', error)
    return 'host.docker.internal'
  }
}

/**
 * Build the VaultWarden URL for an instance after provisioning
 * @param namespace - The instance namespace
 * @returns The complete VaultWarden URL
 */
export async function getInstanceUrl(namespace: string): Promise<string> {
  const host = await getClusterHost()
  const nodePort = await getServiceNodePort(namespace)
  return `http://${host}:${nodePort}`
}
