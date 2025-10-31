# Docker-Native Setup with NodePort Access

This guide explains the simplified docker-native architecture where the Keyforge API runs in Docker and connects to a Kubernetes cluster (Kind or k3s) on the same host.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Single Host (VPS/Local Machine)                        │
│                                                          │
│  Docker Compose:                                         │
│  ┌────────────┐  ┌──────────────┐                       │
│  │ PostgreSQL │  │ Keyforge API │                       │
│  │ :5432      │◄─┤ :3000        │                       │
│  └────────────┘  └──────┬───────┘                       │
│                         │                                │
│                         │ (kubectl/helm via kubeconfig)  │
│                         ▼                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Kind/k3s Cluster                                 │  │
│  │                                                    │  │
│  │  Namespace: instance-abc                          │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ VaultWarden Pod :80                         │  │  │
│  │  │ Service NodePort: 30001                     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  │  Namespace: instance-xyz                          │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ VaultWarden Pod :80                         │  │  │
│  │  │ Service NodePort: 30002                     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ▲
         │ User accesses API
         │ API proxies to VaultWarden via NodePort
```

## Key Features

- **Persistent URLs**: Each VaultWarden instance gets a NodePort that persists across restarts
- **Automatic Discovery**: API automatically discovers the NodePort assigned by Kubernetes
- **Kind Support**: Detects Kind clusters and uses Docker network IP for access
- **k3s/Minikube Support**: Uses `host.docker.internal` to reach host from API container (Linux/Mac/Windows)

## Prerequisites

1. **Docker** and **Docker Compose**
2. **Kubernetes cluster** (choose one):
   - **Kind** (recommended): `kind create cluster --name keyforge`
   - **k3s**: Install k3s on the host
   - **Minikube**: `minikube start`
3. **kubectl** configured to access your cluster
4. **helm** (included in Docker image, or install locally)

## Setup Instructions

### 1. Create Kubernetes Cluster

#### Option A: Kind (Recommended)
```bash
# Create Kind cluster
kind create cluster --name keyforge

# Verify
kubectl cluster-info
kubectl get nodes
```

#### Option B: k3s
```bash
# Install k3s (on Linux)
curl -sfL https://get.k3s.io | sh -

# Copy kubeconfig
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config

# Verify
kubectl get nodes
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate admin API key
echo "ADMIN_API_KEY=$(openssl rand -hex 32)" >> .env

# Edit .env if needed
nano .env
```

### 3. Start Services

```bash
# Build and start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f api

# Check status
docker-compose ps
```

### 4. Test the Setup

```bash
# Health check
curl http://localhost:3000

# Create an instance
curl -X POST http://localhost:3000/admin/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"name":"Test Instance"}'

# Response will include:
# - instance_id
# - vaultwd_url: "http://pending.instance-xxx" (initial)
# - admin_token
# - jwt_private_key
# - status: "provisioning"

# Wait a moment, then check instance status
curl http://localhost:3000/admin/instances/instance-xxx \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# When ready, vaultwd_url will be updated to: "http://localhost:30XXX"
# or "http://172.18.0.2:30XXX" (for Kind)
```

## How It Works

### 1. Instance Creation
When you create an instance:
1. API generates a placeholder URL: `http://pending.instance-xxx`
2. API stores instance in database with status `provisioning`
3. API triggers helm install asynchronously

### 2. Provisioning
During provisioning:
1. Helm creates namespace (e.g., `instance-abc`)
2. Deploys VaultWarden + PostgreSQL
3. Creates Service with type `NodePort`
4. Kubernetes assigns a random port (30000-32767)

### 3. URL Discovery
After provisioning succeeds:
1. API queries the Service for its assigned NodePort
2. API detects cluster type (Kind vs standard k8s)
3. For Kind: Gets Docker container IP
4. For k3s/minikube: Uses `localhost`
5. Constructs final URL: `http://<host>:<nodePort>`
6. Updates instance in database with actual URL
7. Sets status to `ready`

### 4. Persistence
The NodePort persists across:
- Pod restarts
- Node restarts  
- Docker restarts
- System reboots

As long as the Kubernetes Service exists, the same port is assigned.

## Network Access

### From API Container
The API accesses VaultWarden via:
- **Kind**: `http://172.18.0.X:30001` (Docker network IP)
- **k3s/minikube**: `http://localhost:30001` (host network)

### From Host Machine
You can access VaultWarden directly:
```bash
# Get instance URL from API
INSTANCE_URL=$(curl -s http://localhost:3000/admin/instances/instance-xxx \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq -r '.vaultwd_url')

# Access VaultWarden
curl $INSTANCE_URL
```

### From External Users
If deploying on a VPS, users access:
1. **Keyforge API**: `http://your-vps-ip:3000`
2. **VaultWarden** (via API proxy or direct): `http://your-vps-ip:30XXX`

## Troubleshooting

### Instance stuck in "provisioning"
```bash
# Check deployment logs
curl http://localhost:3000/admin/deployments/instance-xxx/logs \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# Check Kubernetes resources
kubectl get all -n instance-xxx

# Check pod logs
kubectl logs -n instance-xxx -l app=vaultwd
```

### Can't access VaultWarden URL
```bash
# Check if service exists
kubectl get svc -n instance-xxx

# Check NodePort
kubectl get svc vaultwd-service -n instance-xxx \
  -o jsonpath='{.spec.ports[0].nodePort}'

# Test from host
curl http://localhost:30001  # replace with your NodePort
```

### Kind: Connection refused
```bash
# Get Kind container IP
docker inspect kind-control-plane \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Test connection
curl http://172.18.0.2:30001  # replace with Kind IP
```

## Cleanup

```bash
# Stop services (keeps data)
docker-compose stop

# Remove containers (keeps data)
docker-compose down

# Remove everything including data
docker-compose down -v

# Delete Kind cluster
kind delete cluster --name keyforge

# Delete k3s
sudo /usr/local/bin/k3s-uninstall.sh  # On Linux
```

## Production Considerations

For production deployments:

1. **Use Ingress** instead of NodePort for better routing
2. **Add TLS** with Let's Encrypt certificates
3. **Configure firewall** to restrict NodePort access
4. **Use managed k8s** (GKE, EKS, AKS) instead of Kind
5. **Set resource limits** in helm chart
6. **Enable monitoring** (Prometheus, Grafana)
7. **Configure backups** for PostgreSQL data

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.
