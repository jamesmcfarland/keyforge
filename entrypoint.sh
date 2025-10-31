#!/bin/bash
set -e

KUBECONFIG_ORIG="/app/.kube/config.orig"
KUBECONFIG_PATH="/app/.kube/config"

if [ -f "$KUBECONFIG_ORIG" ]; then
  echo "Copying kubeconfig..."
  
  mkdir -p "$(dirname "$KUBECONFIG_PATH")"
  cp "$KUBECONFIG_ORIG" "$KUBECONFIG_PATH"
  
  echo "Kubeconfig copied successfully"
else
  echo "Warning: Kubeconfig not found at $KUBECONFIG_ORIG"
  echo "Kubernetes commands may fail without a valid kubeconfig"
fi

exec "$@"
