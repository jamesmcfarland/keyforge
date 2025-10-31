# Kubernetes Manifests

This directory contains Kubernetes manifests for deploying Keyforge to k3s.

## Quick Start

1. **Build and import images:**
   ```bash
   ./scripts/build-and-import.sh
   ```

2. **Configure secrets:**
   ```bash
   cp k8s/secret.yaml.example k8s/secret.yaml
   # Edit k8s/secret.yaml with your values
   ```

3. **Deploy:**
   ```bash
   ./scripts/deploy.sh
   ```

See [K8S_DEPLOYMENT.md](../docs/K8S_DEPLOYMENT.md) for full documentation.

## Files

- `namespace.yaml` - Creates the `keyforge` namespace
- `secret.yaml.example` - Template for secrets (copy to `secret.yaml` and edit)
- `configmap.yaml` - Non-sensitive configuration
- `postgres-statefulset.yaml` - PostgreSQL database with persistent storage
- `postgres-service.yaml` - PostgreSQL service (ClusterIP)
- `api-rbac.yaml` - ServiceAccount, ClusterRole, and ClusterRoleBinding for API
- `api-deployment.yaml` - Keyforge API deployment
- `api-service.yaml` - API service with NodePort (30080)
- `frontend-deployment.yaml` - Frontend deployment
- `frontend-service.yaml` - Frontend service with NodePort (30081)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  k3s Cluster (keyforge namespace)                           │
│                                                              │
│  ┌─────────────┐      ┌─────────────┐     ┌──────────────┐ │
│  │  Frontend   │      │     API     │     │  PostgreSQL  │ │
│  │  NodePort   │─────▶│  NodePort   │────▶│  StatefulSet │ │
│  │   :30081    │      │   :30080    │     │  (ClusterIP) │ │
│  └─────────────┘      └─────────────┘     └──────────────┘ │
│                              │                               │
│                              │ (ServiceAccount + RBAC)       │
│                              ▼                               │
│                       kubectl/helm                           │
│                              │                               │
│                              ▼                               │
│                  ┌────────────────────────┐                  │
│                  │  VaultWarden Instances │                  │
│                  │  (Dynamic namespaces)  │                  │
│                  └────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

- **In-cluster kubectl/helm:** API uses ServiceAccount for k8s operations (no kubeconfig needed)
- **NodePort services:** External access on ports 30080 (API) and 30081 (Frontend)
- **Persistent storage:** PostgreSQL data survives pod restarts
- **No Docker registry:** Images built locally and imported to k3s directly
- **Zero code changes:** Existing VaultWarden cluster DNS URLs work natively in k8s
