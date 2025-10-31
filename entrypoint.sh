#!/bin/bash
set -e

KUBECONFIG_PATH="/app/.kube/config"

# Check if running on VPS with k3s (kubeconfig exists in container)
if [ -f "/root/.kube/config" ]; then
  echo "Detected k3s kubeconfig, patching for Docker bridge network..."
  
  mkdir -p "$(dirname "$KUBECONFIG_PATH")"
  
  # Patch kubeconfig to use Docker bridge gateway IP (172.17.0.1)
  sed 's|server: https://127.0.0.1:6443|server: https://172.17.0.1:6443|g' /root/.kube/config > "$KUBECONFIG_PATH"
  
  echo "Kubeconfig patched: 127.0.0.1:6443 -> 172.17.0.1:6443"
else
  echo "No kubeconfig found - running in local dev mode (Kubernetes features unavailable)"
fi

exec "$@"
