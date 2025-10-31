#!/bin/bash
set -e

KUBECONFIG_ORIG="/app/.kube/config.orig"
KUBECONFIG_PATH="/app/.kube/config"
KUBE_HOST="${KUBE_HOST:-172.17.0.1}"

if [ -f "$KUBECONFIG_ORIG" ]; then
  echo "Copying and patching kubeconfig..."
  echo "Using Kubernetes host: $KUBE_HOST"
  
  mkdir -p "$(dirname "$KUBECONFIG_PATH")"
  cp "$KUBECONFIG_ORIG" "$KUBECONFIG_PATH"
  
  sed -i "s|https://127\.0\.0\.1:|https://${KUBE_HOST}:|g" "$KUBECONFIG_PATH"
  sed -i "s|https://localhost:|https://${KUBE_HOST}:|g" "$KUBECONFIG_PATH"
  
  echo "Kubeconfig patched successfully"
else
  echo "Warning: Kubeconfig not found at $KUBECONFIG_ORIG"
  echo "Kubernetes commands may fail without a valid kubeconfig"
fi

exec "$@"
