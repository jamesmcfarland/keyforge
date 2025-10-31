# Kubernetes Native Deployment Guide

This guide explains how to deploy Keyforge entirely within k3s on your VPS, eliminating Docker container networking complexity.

## Architecture Overview

**Previous Setup (Docker + k3s hybrid):**
- API and Frontend in Docker containers
- VaultWarden instances in k3s
- Networking issues: Docker containers couldn't reach k3s cluster DNS
- Required complex bridge networking and kubeconfig mounting

**New Setup (k3s native):**
- Everything runs in k3s (API, Frontend, PostgreSQL, VaultWarden)
- API uses in-cluster ServiceAccount + RBAC for kubectl/helm operations
- VaultWarden cluster DNS works natively - **zero API code changes needed**
- NodePort services for external access via localhost and Tailscale IP

## Services & Ports

| Service | Internal Port | NodePort | External Access |
|---------|--------------|----------|-----------------|
| API | 3000 | 30080 | `localhost:30080` or `<tailscale-ip>:30080` |
| Frontend | 3001 | 30081 | `localhost:30081` or `<tailscale-ip>:30081` |
| PostgreSQL | 5432 | - | Internal only (ClusterIP) |

## Prerequisites

1. **k3s installed on VPS**
2. **Docker** (for building images locally)
3. **kubectl** access to your k3s cluster
4. **Tailscale IP** (if using remote access)

## Deployment Steps

### 1. Update Configuration

Edit `k8s/configmap.yaml` and update:
- `CORS_ORIGINS` - Replace `100.x.x.x` with your actual Tailscale IP
- `VITE_API_BASE` - Set to your API URL (use NodePort 30080)

Example:
```yaml
CORS_ORIGINS: "http://localhost:3001,http://100.64.1.123:30081"
VITE_API_BASE: "http://localhost:30080"
```

### 2. Create Secrets

Copy the secret template and add your credentials:
```bash
cp k8s/secret.yaml.example k8s/secret.yaml
```

Edit `k8s/secret.yaml` and set:
- `DB_PASSWORD` - PostgreSQL password
- `ADMIN_API_KEY` - Generate with `openssl rand -hex 32`
- `ROOT_JWT_PUBLIC_KEY` - (Optional) JWT public key for instance auth

**Important:** Add `k8s/secret.yaml` to `.gitignore` to prevent committing secrets!

### 3. Build and Import Images

Build Docker images and import them to k3s (no registry needed):
```bash
./scripts/build-and-import.sh
```

This script:
1. Builds API and Frontend images with Docker
2. Saves them to tar files
3. Imports them directly to k3s using `k3s ctr images import`

### 4. Deploy to k3s

Run the deployment script:
```bash
./scripts/deploy.sh
```

This script:
1. Creates the `keyforge` namespace
2. Applies secrets and config
3. Sets up RBAC (ServiceAccount, ClusterRole, ClusterRoleBinding)
4. Deploys PostgreSQL with persistent storage
5. Deploys API with in-cluster kubectl/helm access
6. Deploys Frontend
7. Waits for all pods to be ready

### 5. Run Database Migrations

After deployment, push the database schema:
```bash
kubectl exec -it -n keyforge \
  $(kubectl get pod -n keyforge -l app=keyforge-api -o jsonpath='{.items[0].metadata.name}') \
  -- pnpm run db:push
```

Or use drizzle-kit migrate:
```bash
kubectl exec -it -n keyforge \
  $(kubectl get pod -n keyforge -l app=keyforge-api -o jsonpath='{.items[0].metadata.name}') \
  -- pnpm run db:migrate
```

## Access the Application

**API:**
- Local: `http://localhost:30080`
- Tailscale: `http://<your-tailscale-ip>:30080`

**Frontend:**
- Local: `http://localhost:30081`
- Tailscale: `http://<your-tailscale-ip>:30081`

**Health Check:**
```bash
curl http://localhost:30080/health
```

## Port Forwarding (Optional)

If you want to access the API on port 3000 (for Cloudflare Tunnel compatibility):
```bash
kubectl port-forward -n keyforge svc/keyforge-api-service 3000:3000
```

For the frontend on port 3001:
```bash
kubectl port-forward -n keyforge svc/keyforge-frontend-service 3001:3001
```

## Management Commands

### Check Status
```bash
# All resources in keyforge namespace
kubectl get all -n keyforge

# Pod status
kubectl get pods -n keyforge

# Service endpoints
kubectl get services -n keyforge
```

### View Logs
```bash
# API logs
kubectl logs -f -l app=keyforge-api -n keyforge

# Frontend logs
kubectl logs -f -l app=keyforge-frontend -n keyforge

# PostgreSQL logs
kubectl logs -f -l app=postgres -n keyforge
```

### Shell Access
```bash
# API pod shell
kubectl exec -it -n keyforge \
  $(kubectl get pod -n keyforge -l app=keyforge-api -o jsonpath='{.items[0].metadata.name}') \
  -- /bin/sh

# PostgreSQL shell
kubectl exec -it -n keyforge postgres-0 -- psql -U keyforge
```

### Update Deployment

After code changes:
1. Rebuild and import images:
   ```bash
   ./scripts/build-and-import.sh
   ```

2. Restart deployments to use new images:
   ```bash
   kubectl rollout restart deployment/keyforge-api -n keyforge
   kubectl rollout restart deployment/keyforge-frontend -n keyforge
   ```

### Delete Everything
```bash
kubectl delete namespace keyforge
```

## In-Cluster kubectl/helm Operations

The API pod uses a ServiceAccount (`keyforge-api`) with RBAC permissions to:
- Create/manage namespaces
- Deploy VaultWarden via helm charts
- Manage services, deployments, secrets, PVCs

This eliminates the need to mount kubeconfig files, as the pod uses the in-cluster service account token automatically.

## Key Architecture Decisions

### 1. No Docker Registry
- Images built locally and imported directly to k3s
- Deployments use `imagePullPolicy: Never`
- Simpler setup for single-node deployments

### 2. NodePort Services
- API on port 30080 (k8s NodePort range: 30000-32767)
- Frontend on port 30081
- Accessible via localhost and Tailscale IP

### 3. StatefulSet for PostgreSQL
- Persistent storage with PVC (5Gi)
- Data survives pod restarts
- Single replica (sufficient for this use case)

### 4. Vite Dev Server for Frontend
- Keeps HMR (Hot Module Replacement) functionality
- Suitable for internal tools
- Can be upgraded to production build later if needed

### 5. ConfigMap Environment Variables
- Non-sensitive config in ConfigMap
- Sensitive values in Secret
- Easy to update without rebuilding images

## Troubleshooting

### Pods Not Starting
```bash
# Check pod events
kubectl describe pod -n keyforge <pod-name>

# Check logs
kubectl logs -n keyforge <pod-name>
```

### Database Connection Issues
```bash
# Verify PostgreSQL is running
kubectl get pods -n keyforge -l app=postgres

# Check database connectivity from API pod
kubectl exec -it -n keyforge \
  $(kubectl get pod -n keyforge -l app=keyforge-api -o jsonpath='{.items[0].metadata.name}') \
  -- nc -zv postgres-service.keyforge.svc.cluster.local 5432
```

### Image Pull Errors
```bash
# Verify images are imported to k3s
sudo k3s ctr images ls | grep keyforge

# Re-import if needed
./scripts/build-and-import.sh
```

### RBAC Permission Issues
```bash
# Check ServiceAccount exists
kubectl get serviceaccount keyforge-api -n keyforge

# Check ClusterRole and ClusterRoleBinding
kubectl get clusterrole keyforge-api-role
kubectl get clusterrolebinding keyforge-api-binding

# View API pod logs for permission errors
kubectl logs -f -l app=keyforge-api -n keyforge
```

### Port Access Issues
```bash
# Check NodePort services
kubectl get svc -n keyforge

# Test local access
curl http://localhost:30080/health

# Check if ports are listening on host
sudo netstat -tlnp | grep 30080
```

## Migration from Docker Setup

If you're migrating from the docker-compose setup:

1. **Stop Docker containers:**
   ```bash
   docker-compose down
   ```

2. **Backup PostgreSQL data** (if needed):
   ```bash
   docker-compose exec postgres pg_dump -U keyforge keyforge > backup.sql
   ```

3. **Deploy to k3s** (follow steps above)

4. **Restore data** (if needed):
   ```bash
   kubectl exec -i -n keyforge postgres-0 -- psql -U keyforge keyforge < backup.sql
   ```

## Local Development

The `docker-compose.yml` file is **unchanged** and can still be used for local development:
```bash
docker-compose up
```

This is useful for:
- Testing changes locally before deploying to k3s
- Running without k3s on your development machine
- Quick iteration during development

## Security Considerations

1. **Secrets Management:** Never commit `k8s/secret.yaml` to version control
2. **RBAC Scope:** The API ServiceAccount has broad permissions - consider restricting in production
3. **Network Policies:** Consider adding NetworkPolicies to restrict pod-to-pod communication
4. **HTTPS:** For production, add TLS termination (Ingress with cert-manager or Cloudflare Tunnel)

## Next Steps

1. **Set up Cloudflare Tunnel** to expose API/Frontend with HTTPS
2. **Configure Tailscale** for secure remote access
3. **Add monitoring** (Prometheus, Grafana)
4. **Set up backups** for PostgreSQL data
5. **Configure resource limits** based on your VPS capacity
