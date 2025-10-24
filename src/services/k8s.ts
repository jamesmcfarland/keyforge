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
