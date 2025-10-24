import { execa } from 'execa'
import { logEvent, logMessage } from './deployment-tracker.js'

export async function provisionUnion(unionId: string, adminToken: string): Promise<void> {
  const namespace = unionId
  const chartPath = './helm-chart'

  try {
    await logEvent(unionId, 'helm_install', 'in_progress', 'Starting helm installation')
    await logMessage(unionId, 'info', `Installing helm chart for union ${unionId}`)

    const helmResult = await execa('helm', [
      'install',
      unionId,
      chartPath,
      '--namespace', namespace,
      '--create-namespace',
      '--set', `vaultwd.adminToken=${adminToken}`,
      '--wait',
      '--timeout', '5m'
    ])

    await logMessage(unionId, 'debug', `Helm install stdout: ${helmResult.stdout}`)
    await logEvent(unionId, 'helm_install', 'success', 'Helm chart installed successfully')

    await logEvent(unionId, 'postgres_ready', 'in_progress', 'Waiting for postgres deployment')
    await waitForDeployment(namespace, 'postgres', 120000, unionId)
    await logEvent(unionId, 'postgres_ready', 'success', 'Postgres deployment ready')

    await logEvent(unionId, 'vaultwd_ready', 'in_progress', 'Waiting for vaultwd deployment')
    await waitForDeployment(namespace, 'vaultwd', 120000, unionId)
    await logEvent(unionId, 'vaultwd_ready', 'success', 'VaultWarden deployment ready')

    await logMessage(unionId, 'info', `Provisioning completed successfully for union ${unionId}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await logEvent(unionId, 'provisioning', 'failed', errorMessage)
    await logMessage(unionId, 'error', `Provisioning failed: ${errorMessage}`)
    throw new Error(`Failed to provision union ${unionId}: ${error}`)
  }
}

export async function deleteUnion(unionId: string): Promise<void> {
  const namespace = unionId

  try {
    await execa('helm', ['uninstall', unionId, '--namespace', namespace])
    await execa('kubectl', ['delete', 'namespace', namespace])
  } catch (error) {
    throw new Error(`Failed to delete union ${unionId}: ${error}`)
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

async function waitForDeployment(namespace: string, deploymentName: string, timeoutMs = 120000, unionId?: string): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    const ready = await isDeploymentReady(namespace, deploymentName)
    if (ready) {
      if (unionId) {
        await logMessage(unionId, 'debug', `Deployment ${deploymentName} is ready`)
      }
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  if (unionId) {
    await logMessage(unionId, 'error', `Deployment ${deploymentName} did not become ready within timeout`)
  }
  throw new Error(`Deployment ${deploymentName} in namespace ${namespace} did not become ready within timeout`)
}
