# Troubleshooting Guide

This guide covers common issues you may encounter when setting up and running Keyforge.

## Table of Contents

- [Database Connection Issues](#database-connection-issues)
- [Kubernetes Access Problems](#kubernetes-access-problems)
- [Helm Deployment Errors](#helm-deployment-errors)
- [Docker Compose Issues](#docker-compose-issues)
- [API Server Issues](#api-server-issues)
- [Frontend Connection Issues](#frontend-connection-issues)
- [VaultWarden Provisioning Failures](#vaultwarden-provisioning-failures)
- [Debug Commands](#debug-commands)
- [Log Locations](#log-locations)
- [FAQ](#faq)

---

## Database Connection Issues

### Error: `Connection refused` or `ECONNREFUSED`

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Could not connect to database
```

**Solutions:**

1. **Check PostgreSQL is running:**
   ```bash
   # Docker Compose
   docker compose ps postgres
   
   # Local PostgreSQL (macOS)
   brew services list | grep postgresql
   
   # Local PostgreSQL (Linux)
   systemctl status postgresql
   ```

2. **Verify database credentials:**
   - Check your `.env` file or `DATABASE_URL` environment variable
   - Default: `postgresql://keyforge:keyforge_dev@localhost:5432/keyforge`

3. **Check PostgreSQL port availability:**
   ```bash
   lsof -i :5432
   ```

4. **Wait for PostgreSQL to be ready:**
   ```bash
   # Docker Compose automatically waits via healthcheck
   # Manual check:
   docker compose exec postgres pg_isready -U keyforge
   ```

### Error: `password authentication failed`

**Symptoms:**
```
Error: password authentication failed for user "keyforge"
```

**Solutions:**

1. **Verify environment variables match:**
   - `.env` file: `DB_PASSWORD=your_password`
   - `DATABASE_URL` should include the same password

2. **Reset Docker Compose database:**
   ```bash
   docker compose down -v  # Removes volumes
   docker compose up --build
   ```

3. **Check database user exists:**
   ```bash
   docker compose exec postgres psql -U keyforge -c "\du"
   ```

---

## Kubernetes Access Problems

### Error: `The connection to the server localhost:8080 was refused`

**Symptoms:**
```
Error: Failed to provision instance: kubectl connection refused
```

**Solutions:**

1. **Verify Kubernetes cluster is running:**
   ```bash
   # Kind
   kind get clusters
   
   # Minikube
   minikube status
   
   # Generic
   kubectl cluster-info
   ```

2. **Check KUBECONFIG is set:**
   ```bash
   echo $KUBECONFIG
   # Should show path to config, e.g., ~/.kube/config
   
   # If empty:
   export KUBECONFIG=~/.kube/config
   ```

3. **Verify kubeconfig file exists:**
   ```bash
   ls -la ~/.kube/config
   ```

4. **Test kubectl access:**
   ```bash
   kubectl get nodes
   kubectl get namespaces
   ```

### Error: `connection refused` when API runs in Docker container

**Symptoms:**
```
Error from server: dial tcp 127.0.0.1:26443: connect: connection refused
Failed to provision organisation: helm/kubectl commands failed
```

**Root Cause:**
The API container cannot reach the host's Kubernetes cluster using `127.0.0.1` or `localhost` addresses in your kubeconfig.

**Solution - Configure KUBE_HOST:**

Keyforge automatically patches your kubeconfig at container startup to replace localhost addresses with a host-accessible address. Configure the `KUBE_HOST` environment variable based on your platform:

1. **Detect your platform:**

   **OrbStack (macOS):**
   ```bash
   # Check if OrbStack is running
   pgrep -f OrbStack
   # If running, OrbStack provides 'orbstack' as the hostname
   ```
   
   **Docker Desktop (macOS/Windows):**
   ```bash
   # Docker Desktop provides 'host.docker.internal'
   docker version | grep -i "Docker Desktop"
   ```
   
   **Native Linux Docker:**
   ```bash
   # Check your docker0 bridge IP
   ip addr show docker0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1
   # Usually 172.17.0.1
   ```

2. **Set KUBE_HOST in your `.env` file:**

   ```bash
   # For OrbStack
   KUBE_HOST=orbstack
   
   # For Docker Desktop (default)
   KUBE_HOST=host.docker.internal
   
   # For Linux (use your docker0 IP)
   KUBE_HOST=172.17.0.1
   ```

3. **Rebuild and restart:**
   ```bash
   docker compose down
   docker compose build --no-cache api
   docker compose up -d
   ```

4. **Verify the fix:**
   ```bash
   # Check patched kubeconfig inside container
   docker compose exec api cat /app/.kube/config | grep server:
   
   # Should show your KUBE_HOST value instead of 127.0.0.1
   # Example: server: https://orbstack:26443
   ```

5. **Test connectivity from inside container:**
   ```bash
   docker compose exec api kubectl cluster-info
   docker compose exec api kubectl get nodes
   ```

**How It Works:**
- The `entrypoint.sh` script copies your host kubeconfig to `/app/.kube/config`
- It replaces all `127.0.0.1` and `localhost` addresses with the value of `$KUBE_HOST`
- Docker Compose maps `$KUBE_HOST` to the host gateway via `extra_hosts`
- Your container can now reach the Kubernetes API server on your host

### Error: `x509: certificate is valid for ... not for host.docker.internal`

**Symptoms:**
```
x509: certificate is valid for kubernetes, kubernetes.default, not for host.docker.internal
```

**Root Cause:**
The Kubernetes API server's TLS certificate doesn't include the hostname used to connect from the container.

**Solutions:**

1. **Disable certificate verification (development only):**
   ```bash
   # Inside the container, kubectl will skip TLS verification if insecure-skip-tls-verify is set
   docker compose exec api kubectl config set-cluster <cluster-name> --insecure-skip-tls-verify=true
   ```

2. **For Kind clusters - use the container network IP:**
   ```bash
   # Get the Kind container's IP
   docker inspect kind-control-plane | grep IPAddress
   
   # Set KUBE_HOST to this IP
   KUBE_HOST=172.18.0.2  # Example - use your actual IP
   ```

3. **For production - regenerate API server certificates:**
   This is cluster-specific and beyond the scope of Keyforge. Consult your Kubernetes distribution's documentation.

### Error: `Unable to connect to the server: dial tcp: lookup ... no such host`

**Symptoms:**
```
Unable to connect to the server: dial tcp: lookup orbstack: no such host
```

**Root Cause:**
The `KUBE_HOST` hostname isn't resolvable inside the container.

**Solutions:**

1. **Verify `extra_hosts` in `docker-compose.yml`:**
   ```yaml
   services:
     api:
       extra_hosts:
         - "${KUBE_HOST}:host-gateway"
   ```

2. **Test DNS resolution inside container:**
   ```bash
   docker compose exec api getent hosts $KUBE_HOST
   # Should return: <host-ip> <kube-host>
   ```

3. **Verify KUBE_HOST is set:**
   ```bash
   docker compose exec api env | grep KUBE_HOST
   ```

4. **If using a custom hostname, add it to `/etc/hosts` on your host machine first**

### Error: `forbidden: User "..." cannot create resource`

**Symptoms:**
```
Error: forbidden: User "system:serviceaccount:..." cannot create resource "namespaces"
```

**Solutions:**

1. **Check cluster permissions:**
   ```bash
   kubectl auth can-i create namespaces
   kubectl auth can-i create deployments
   ```

2. **Ensure you're using cluster-admin context:**
   ```bash
   kubectl config view
   kubectl config get-contexts
   kubectl config use-context <admin-context>
   ```

3. **For Kind/Minikube, you should have full admin access by default**

---

## Helm Deployment Errors

### Error: `helm: command not found`

**Solutions:**

1. **Install Helm:**
   ```bash
   # macOS
   brew install helm
   
   # Linux
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   
   # Verify
   helm version
   ```

### Error: `timed out waiting for the condition`

**Symptoms:**
```
Error: timed out waiting for the condition
VaultWarden deployment did not become ready within timeout
```

**Solutions:**

1. **Check deployment status:**
   ```bash
   kubectl get deployments -n <instance-id>
   kubectl describe deployment vaultwd -n <instance-id>
   kubectl get pods -n <instance-id>
   ```

2. **Check pod logs:**
   ```bash
   kubectl logs -n <instance-id> -l app=vaultwd --tail=50
   kubectl logs -n <instance-id> -l app=postgres --tail=50
   ```

3. **Check pod events:**
   ```bash
   kubectl get events -n <instance-id> --sort-by='.lastTimestamp'
   ```

4. **Common causes:**
   - Insufficient cluster resources
   - Image pull failures
   - PVC provisioning issues

5. **Increase timeout in deployment tracker:**
   - Default is 2 minutes (120000ms)
   - Check `src/services/k8s.ts:20` and adjust if needed

### Error: `release ... already exists`

**Symptoms:**
```
Error: cannot re-use a name that is still in use
```

**Solutions:**

1. **List existing releases:**
   ```bash
   helm list --all-namespaces
   ```

2. **Uninstall existing release:**
   ```bash
   helm uninstall <instance-id> -n <instance-id>
   kubectl delete namespace <instance-id>
   ```

3. **Or use the API:**
   ```bash
    curl -X DELETE http://localhost:3000/instances/<instance-id>
   ```

---

## Docker Compose Issues

### Error: `no configuration file provided`

**Symptoms:**
```
no configuration file provided: not found
```

**Solutions:**

1. **Ensure you're in the project root:**
   ```bash
   ls docker-compose.yml
   ```

2. **Use the correct command:**
   ```bash
   docker compose up  # v2 (recommended)
   # OR
   docker-compose up  # v1 (legacy)
   ```

### Error: `port is already allocated`

**Symptoms:**
```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Solutions:**

1. **Check what's using the port:**
   ```bash
   lsof -i :3000  # API port
   lsof -i :5432  # PostgreSQL port
   ```

2. **Stop conflicting services or change ports in `docker-compose.yml`**

### Error: `Build failed` or outdated image

**Solutions:**

1. **Rebuild containers:**
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up
   ```

2. **Clean up old containers and images:**
   ```bash
   docker compose down -v
   docker system prune -a
   ```

---

## API Server Issues

### Error: `EADDRINUSE` - Port 3000 in use

**Solutions:**

1. **Find and kill process:**
   ```bash
   lsof -ti :3000 | xargs kill -9
   ```

2. **Or change port in `.env`:**
   ```
   PORT=3001
   ```

### Error: `Cannot find module` or import errors

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **Rebuild TypeScript:**
   ```bash
   pnpm run build
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Should be 20.x or higher
   ```

### Error: `KUBECONFIG not set` in logs

**Solutions:**

1. **Set environment variable:**
   ```bash
   export KUBECONFIG=~/.kube/config
   pnpm run dev
   ```

2. **Or add to `.env` file:**
   ```
   KUBECONFIG=/path/to/.kube/config
   ```

---

## Frontend Connection Issues

### Error: `Network Error` or `Failed to fetch`

**Symptoms:**
- Frontend shows connection errors
- API requests fail with CORS or network errors

**Solutions:**

1. **Verify API is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check CORS configuration:**
   - API allows `http://localhost:5173` (Vite dev server)
   - Check `src/index.ts:13-16`

3. **Verify frontend environment variables:**
   ```bash
   # frontend/.env
   VITE_API_URL=http://localhost:3000
   ```

4. **Check browser console for specific errors**

---

## VaultWarden Provisioning Failures

### Error: `Provisioning failed: helm install failed`

**Solutions:**

1. **Check deployment logs via API:**
   ```bash
   curl http://localhost:3000/admin/deployments/<deployment-id>/logs
   ```

2. **Check deployment events:**
   ```bash
   curl http://localhost:3000/admin/deployments/<deployment-id>/events
   ```

3. **Verify helm chart exists:**
   ```bash
   ls -la helm-chart/
   ```

4. **Test helm chart manually:**
   ```bash
    helm install test-instance ./helm-chart \
      --namespace test-instance \
     --create-namespace \
     --set vaultwd.adminToken=test123 \
     --dry-run --debug
   ```

### Error: `Postgres deployment not ready`

**Solutions:**

1. **Check PVC status:**
   ```bash
   kubectl get pvc -n <instance-id>
   kubectl describe pvc -n <instance-id>
   ```

2. **Check if cluster has storage class:**
   ```bash
   kubectl get storageclass
   ```

3. **For local clusters (Kind/Minikube), ensure storage provisioner is enabled:**
   ```bash
   # Minikube
   minikube addons enable storage-provisioner
   ```

---

## Debug Commands

### Check API health:
```bash
curl http://localhost:3000/health
```

### List all Docker Compose services:
```bash
docker compose ps
```

### View API logs:
```bash
# Docker Compose
docker compose logs -f api

# Local
pnpm run dev
```

### View database tables:
```bash
docker compose exec postgres psql -U keyforge -d keyforge -c "\dt"
```

### Query deployments:
```bash
docker compose exec postgres psql -U keyforge -d keyforge -c "SELECT * FROM deployment_events ORDER BY created_at DESC LIMIT 10;"
```

### Check Kubernetes resources:
```bash
kubectl get all -n <instance-id>
kubectl get events -n <instance-id> --sort-by='.lastTimestamp'
kubectl logs -n <instance-id> deployment/vaultwd --tail=50
```

### Test helm chart syntax:
```bash
helm lint ./helm-chart
```

### Get VaultWarden service URL:
```bash
kubectl get svc -n <instance-id>
# For LoadBalancer:
kubectl get svc vaultwd -n <instance-id> -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

---

## Log Locations

### Application Logs

- **Docker Compose API logs**: `docker compose logs api`
- **Docker Compose Postgres logs**: `docker compose logs postgres`
- **Local development**: stdout/stderr (visible in terminal)

### Kubernetes Logs

- **VaultWarden pods**: `kubectl logs -n <instance-id> -l app=vaultwd`
- **Postgres pods**: `kubectl logs -n <instance-id> -l app=postgres`
- **All pods in namespace**: `kubectl logs -n <instance-id> --all-containers=true`

### Database Logs

Deployment logs are stored in the `deployment_logs` table:

```bash
# Via API
curl http://localhost:3000/admin/deployments/<deployment-id>/logs

# Via database
docker compose exec postgres psql -U keyforge -d keyforge -c \
  "SELECT * FROM deployment_logs WHERE deployment_id = '<deployment-id>' ORDER BY created_at DESC;"
```

---

## FAQ

### Q: How do I reset everything and start fresh?

**A:**
```bash
# Stop and remove all containers, volumes, and networks
docker compose down -v

# Clean up Kubernetes namespaces
kubectl get namespaces | grep -v "default\|kube-" | awk '{print $1}' | xargs -I {} kubectl delete namespace {}

# Restart
docker compose up --build
```

### Q: Where is the database data stored?

**A:**
- Docker Compose: `postgres_data` volume (persists between restarts)
- To remove: `docker compose down -v`

### Q: How do I access VaultWarden after provisioning?

**A:**
1. Get the service URL:
   ```bash
   kubectl get svc vaultwd -n <instance-id>
   ```
2. For LoadBalancer: Use external IP
3. For NodePort: Use `<node-ip>:<node-port>`
4. For local (Kind): Set up port forwarding:
   ```bash
   kubectl port-forward -n <instance-id> svc/vaultwd 8080:80
   # Access at http://localhost:8080
   ```

### Q: Can I run multiple instance deployments?

**A:** Yes, each instance gets its own Kubernetes namespace and isolated resources.

### Q: How do I check if my kubeconfig is mounted correctly in Docker?

**A:**
```bash
docker compose exec api ls -la /app/.kube/config
docker compose exec api cat /app/.kube/config
```

### Q: The API starts but immediately crashes. What do I check?

**A:**
1. Database connection:
   ```bash
   docker compose logs postgres
   ```
2. Check for migration errors:
   ```bash
   docker compose logs api | grep -i "migration\|error"
   ```
3. Verify environment variables:
   ```bash
   docker compose exec api env | grep DATABASE_URL
   ```

### Q: How do I update the helm chart?

**A:**
1. Edit files in `helm-chart/`
2. Rebuild Docker image: `docker compose build api`
3. Restart: `docker compose up -d api`
4. Test with dry-run: `helm install test ./helm-chart --dry-run --debug`

### Q: What's the difference between deployment_events and deployment_logs?

**A:**
- **deployment_events**: High-level milestones (helm_install, postgres_ready, vaultwd_ready)
- **deployment_logs**: Detailed structured logs with levels (debug, info, warn, error)

---

## Still Having Issues?

1. **Check the logs** using commands in [Debug Commands](#debug-commands)
2. **Review prerequisites** in [PREREQUISITES.md](PREREQUISITES.md)
3. **Consult setup guide** in [SETUP.md](SETUP.md)
4. **Report an issue** at https://github.com/sst/opencode/issues (update with actual repo when available)
