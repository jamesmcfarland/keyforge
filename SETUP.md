# Keyforge Setup Guide

This guide walks you through setting up Keyforge for local development or production deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Docker Compose Setup](#docker-compose-setup-recommended)
- [Local Development Setup](#local-development-setup)
- [Kubernetes Configuration](#kubernetes-configuration)
- [Verification](#verification)
- [Database Schema](#database-schema)

## Prerequisites

Before starting, ensure you have all required software installed. See [PREREQUISITES.md](PREREQUISITES.md) for detailed installation instructions.

**Required:**
- Node.js 20+
- pnpm 10.13.1+
- Kubernetes cluster (Kind, minikube, or remote)

**Optional (for Docker setup):**
- Docker Desktop or Docker Engine
- Docker Compose

**Optional (for local setup):**
- kubectl
- helm

## Database Setup

Keyforge uses PostgreSQL for persistent storage. The database stores:
- Union metadata (VaultWarden instances)
- Society metadata (organizations)
- Password references (actual passwords stored in VaultWarden)
- Deployment events and logs

### Database Schema

The application creates 5 tables on first startup:

#### `unions`
Stores VaultWarden instance metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key, format: `union-{hex}` |
| `name` | TEXT | Human-readable name |
| `vaultwd_url` | TEXT | Internal K8s service URL |
| `vaultwd_admin_token` | TEXT | Admin authentication token |
| `status` | VARCHAR(50) | `provisioning`, `ready`, or `failed` |
| `error` | TEXT | Error message if status is `failed` |
| `created_at` | TIMESTAMP | Creation timestamp |

#### `societies`
Stores organization metadata within unions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key, format: `society-{hex}` |
| `name` | TEXT | Society name |
| `union_id` | VARCHAR(255) | Foreign key → `unions.id` (CASCADE DELETE) |
| `vaultwd_org_id` | TEXT | VaultWarden organization UUID |
| `vaultwd_user_email` | TEXT | Service account email |
| `vaultwd_user_token` | TEXT | Bearer token for API calls |
| `status` | VARCHAR(50) | `pending`, `created`, or `failed` |
| `created_at` | TIMESTAMP | Creation timestamp |

#### `passwords`
Stores password metadata (values stored in VaultWarden).

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key, format: `pwd-{hex}` |
| `society_id` | VARCHAR(255) | Foreign key → `societies.id` (CASCADE DELETE) |
| `vaultwd_cipher_id` | VARCHAR(255) | VaultWarden cipher UUID |
| `created_at` | TIMESTAMP | Creation timestamp |

#### `deployment_events`
Tracks provisioning events for debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key |
| `deployment_id` | VARCHAR(255) | Foreign key → `unions.id` (CASCADE DELETE) |
| `step` | VARCHAR(100) | Deployment step name |
| `status` | VARCHAR(50) | `pending`, `in_progress`, `success`, `failed` |
| `message` | TEXT | Event message |
| `created_at` | TIMESTAMP | Event timestamp |

#### `deployment_logs`
Stores structured logs for deployments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Primary key |
| `deployment_id` | VARCHAR(255) | Foreign key → `unions.id` (CASCADE DELETE) |
| `level` | VARCHAR(20) | `info`, `warn`, `error`, `debug` |
| `message` | TEXT | Log message |
| `created_at` | TIMESTAMP | Log timestamp |

### Automatic Migration

Database tables are created automatically when the application starts using Drizzle ORM migrations. No manual SQL execution required.

## Docker Compose Setup (Recommended)

This setup runs both PostgreSQL and the Keyforge API in containers.

### Step 1: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/yourusername/keyforge.git
cd keyforge

# Copy environment template
cp .env.example .env

# Edit .env if needed (optional)
nano .env
```

### Step 2: Create Kubernetes Cluster

The API needs access to a Kubernetes cluster to provision VaultWarden instances.

```bash
# Create a Kind cluster (if you don't have one)
kind create cluster --name keyforge

# Verify cluster is running
kubectl cluster-info
```

### Step 3: Build and Start Services

```bash
# Build the Docker image (includes kubectl and helm)
docker-compose build

# Start services (PostgreSQL + API)
docker-compose up -d

# View logs
docker-compose logs -f api
```

### Step 4: Verify Installation

```bash
# Check services are running
docker-compose ps

# Test API is responding
curl http://localhost:3000

# Expected response:
# {"name":"Keyforge API","version":"0.1.0","status":"running"}
```

### Docker Compose Architecture

```
┌─────────────────────────────────────┐
│  Docker Compose Network             │
│  ┌─────────────────────────────┐    │
│  │  postgres:5432              │    │
│  │  - Volume: postgres_data    │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  api:3000                   │    │
│  │  - Mounts: ~/.kube/config   │    │
│  │  - Mounts: ./helm-chart     │    │
│  │  - Connects to: postgres    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
         │
         └─→ Kubernetes Cluster
```

### Stopping Services

```bash
# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Remove everything including data
docker-compose down -v
```

## Local Development Setup

Run the API directly on your machine without Docker.

### Step 1: Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Verify installation
pnpm list
```

### Step 2: Start PostgreSQL

```bash
# Run PostgreSQL in Docker
docker run -d \
  --name keyforge-postgres \
  -p 5432:5432 \
  -e POSTGRES_DB=keyforge \
  -e POSTGRES_USER=keyforge \
  -e POSTGRES_PASSWORD=keyforge_dev \
  postgres:16-alpine

# Verify it's running
docker ps | grep keyforge-postgres
```

### Step 3: Configure Environment

```bash
# Set database connection string
export DATABASE_URL=postgresql://keyforge:keyforge_dev@localhost:5432/keyforge

# Verify kubectl access
kubectl cluster-info

# Verify helm is installed
helm version
```

### Step 4: Start the API

```bash
# Run with hot reload
pnpm run dev

# API will be available at http://localhost:3000
```

### Step 5: Verify Installation

```bash
# Test API
curl http://localhost:3000

# Check database tables were created
docker exec -it keyforge-postgres psql -U keyforge -c "\dt"
```

Expected output:
```
              List of relations
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+----------
 public | deployment_events | table | keyforge
 public | deployment_logs   | table | keyforge
 public | passwords         | table | keyforge
 public | societies         | table | keyforge
 public | unions            | table | keyforge
```

## Kubernetes Configuration

### Using Kind (Local Development)

```bash
# Create cluster with specific configuration
cat <<EOF | kind create cluster --name keyforge --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker
EOF

# Verify nodes
kubectl get nodes
```

### Using Minikube

```bash
# Start minikube
minikube start --cpus=4 --memory=8192

# Verify
kubectl get nodes
```

### Using Remote Cluster

```bash
# Configure kubectl context
kubectl config use-context your-cluster-context

# Verify access
kubectl cluster-info
kubectl auth can-i create namespace
```

### Kubeconfig Location

The API looks for kubeconfig in this order:
1. `KUBECONFIG` environment variable
2. `~/.kube/config` (default)
3. Docker Compose mounts: `/app/.kube/config`

## Verification

### 1. Test API Health

```bash
curl http://localhost:3000
```

Expected response:
```json
{
  "name": "Keyforge API",
  "version": "0.1.0",
  "status": "running"
}
```

### 2. Create a Test Union

```bash
# Create union
curl -X POST http://localhost:3000/admin/unions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Union"}'

# Save the union_id from response
UNION_ID="union-xxxxxx"

# Check status (wait for "ready")
curl http://localhost:3000/admin/unions/$UNION_ID
```

### 3. Verify Kubernetes Resources

```bash
# List union namespaces
kubectl get namespaces | grep union

# Check pods in union namespace
kubectl get pods -n $UNION_ID

# Expected pods:
# - postgres-xxx (Running)
# - vaultwd-xxx (Running)
```

### 4. Check VaultWarden

```bash
# Port-forward to VaultWarden
kubectl port-forward -n $UNION_ID svc/vaultwd-service 8080:80

# Visit http://localhost:8080 in browser
# You should see the VaultWarden web interface
```

### 5. Test Society Creation

```bash
# Create society
curl -X POST http://localhost:3000/unions/$UNION_ID/societies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Society"}'

# Save society_id from response
SOCIETY_ID="society-xxxxxx"

# Verify
curl http://localhost:3000/unions/$UNION_ID/societies/$SOCIETY_ID
```

### 6. Test Password Operations

```bash
# Create password
curl -X POST http://localhost:3000/unions/$UNION_ID/societies/$SOCIETY_ID/passwords \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Password","value":"secret123"}'

# List passwords
curl http://localhost:3000/unions/$UNION_ID/societies/$SOCIETY_ID/passwords

# Get specific password (includes value)
PASSWORD_ID="pwd-xxxxxx"
curl http://localhost:3000/unions/$UNION_ID/societies/$SOCIETY_ID/passwords/$PASSWORD_ID
```

## Troubleshooting

If you encounter issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems and solutions.

### Quick Debug Commands

```bash
# Check API logs (Docker)
docker-compose logs -f api

# Check API logs (Local)
# Logs are output to console

# Check database connection
docker exec -it keyforge-postgres psql -U keyforge -c "SELECT COUNT(*) FROM unions;"

# Check Kubernetes access
kubectl get namespaces
kubectl cluster-info

# View deployment events
curl http://localhost:3000/admin/deployments/$UNION_ID/events

# View deployment logs
curl "http://localhost:3000/admin/deployments/$UNION_ID/logs?level=error"
```

## Next Steps

- Read [API_REFERENCE.md](API_REFERENCE.md) for complete API documentation
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Check [openapi.yaml](openapi.yaml) for OpenAPI specification
- Visit [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if you encounter issues
