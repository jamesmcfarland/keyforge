# Keyforge

> Multi-tenant VaultWarden orchestration for organisations

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Overview

Keyforge is an open-source API that provisions and manages isolated [VaultWarden](https://github.com/dani-garcia/vaultwarden) password manager instances on Kubernetes. It enables each instance to have its own VaultWarden deployment with multiple organisations for shared credential management.

**Use Case:** Users select their organisation, request passwords, and Keyforge routes them to the correct VaultWarden instance to access shared credentials (Slack logins, event management platforms, etc.).

## Key Features

- **Multi-tenant isolation**: Each instance gets its own VaultWarden deployment in a dedicated Kubernetes namespace
- **Organization management**: Create organisations (VaultWarden organizations) within each instance
- **Password orchestration**: Store and retrieve shared credentials via REST API
- **Automatic provisioning**: Helm-based deployment of VaultWarden + PostgreSQL
- **Secure by default**: Namespace isolation, encrypted passwords, admin token authentication

## Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm 10.13.1+**
- **Docker** and **Docker Compose** (for containerized setup)
- **Kubernetes cluster** (Kind, minikube, or remote)
- **kubectl** and **helm** (if not using Docker)

See [PREREQUISITES.md](PREREQUISITES.md) for detailed setup instructions.

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/keyforge.git
cd keyforge

# Copy environment variables
cp .env.example .env

# Create a Kind cluster (if you don't have one)
kind create cluster --name keyforge

# Start services (PostgreSQL + API)
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f api

# API will be available at http://localhost:3000
```

### Option 2: Local Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=keyforge \
  -e POSTGRES_USER=keyforge \
  -e POSTGRES_PASSWORD=keyforge_dev \
  postgres:16-alpine

# Set environment variables
export DATABASE_URL=postgresql://keyforge:keyforge_dev@localhost:5432/keyforge

# Run the API
pnpm run dev

# API will be available at http://localhost:3000
```

### Option 3: Frontend + Backend

```bash
# Terminal 1: Start backend (choose Docker or Local above)
docker-compose up -d

# Terminal 2: Start frontend
cd frontend
pnpm install
pnpm run dev

# Frontend will be available at http://localhost:5173
```

## Usage Example

### 1. Create an Instance (VaultWarden Instance)

```bash
curl -X POST http://localhost:3000/admin/instances \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineering Team"}'
```

Response:
```json
{
  "instance_id": "instance-2574af3733dd26f5",
  "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
  "admin_token": "...",
  "status": "provisioning"
}
```

### 2. Check Instance Status

```bash
curl http://localhost:3000/admin/instances/instance-2574af3733dd26f5
```

Wait until `status: "ready"` before creating organisations.

### 3. Create an Organisation

```bash
curl -X POST http://localhost:3000/instances/instance-2574af3733dd26f5/organisations \
  -H "Content-Type: application/json" \
  -d '{"name":"Robotics Team"}'
```

### 4. Add a Password

```bash
curl -X POST http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords \
  -H "Content-Type: application/json" \
  -d '{"name":"Slack Workspace","value":"super-secret-password"}'
```

### 5. List Passwords

```bash
curl http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords
```

## Architecture

```
┌─────────────────────────────────────┐
│   Platform API (Proprietary)       │
└─────────────┬───────────────────────┘
               │ HTTP
               ▼
┌─────────────────────────────────────┐
│      Keyforge API (GPLv3)           │
│  ┌──────────────────────────────┐   │
│  │ Provisioning Layer           │   │
│  │ (Helm + Kubernetes)          │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ Registry Service             │   │
│  │ (Instance/Organisation)      │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ VaultWarden Client           │   │
│  └──────────────────────────────┘   │
└─────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Kubernetes Cluster                 │
│  ┌─────────────────────────────┐    │
│  │ Namespace: instance-xxx     │    │
│  │  ├─ VaultWarden Pod         │    │
│  │  ├─ PostgreSQL Pod          │    │
│  │  └─ Persistent Volumes      │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Namespace: instance-yyy     │    │
│  │  ├─ VaultWarden Pod         │    │
│  │  └─ ...                     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## Key Concepts

### Instance
- One VaultWarden instance deployed to Kubernetes
- One namespace per instance: `instance-{id}`
- One PostgreSQL database per instance (containerized within the namespace)
- Multiple organisations can exist within one VaultWarden instance

### Organisation
- A VaultWarden "Organization" within an instance
- Stores shared passwords for that organisation
- Members can be added with different access levels

### Routing
Request flow: `organisation_id` → lookup `instance_id` + `org_id` → lookup `vaultwd_url` → HTTP call to correct VaultWarden instance

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions with database information
- [PREREQUISITES.md](PREREQUISITES.md) - Required software and installation guides
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation
- [openapi.yaml](openapi.yaml) - OpenAPI specification

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: [Hono](https://hono.dev/) (TypeScript web framework)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Orchestration**: Kubernetes (Kind for local, any K8s for production)
- **Deployment**: Helm charts
- **Password Manager**: [VaultWarden](https://github.com/dani-garcia/vaultwarden) (Bitwarden-compatible server)

## Project Structure

```
keyforge/
├── src/
│   ├── index.ts              # Main Hono app
│   ├── types.ts              # TypeScript interfaces
│   ├── routes/
│   │   ├── admin.ts          # Instance management & deployment endpoints
│   │   ├── organisations.ts  # Organisation & password management
│   │   └── health.ts         # Health check endpoints
│   ├── services/
│   │   ├── vaultwd-client.ts # VaultWarden HTTP client
│   │   ├── registry.ts       # Database queries
│   │   ├── k8s.ts            # Kubernetes/Helm operations
│   │   └── deployment-tracker.ts # Deployment event logging
│   ├── db/
│   │   ├── schema.ts         # Drizzle ORM schemas
│   │   ├── client.ts         # Database connection
│   │   └── migrate.ts        # Database initialization
│   └── middleware/
│       └── error-handler.ts  # Global error handling
├── helm-chart/               # VaultWarden Helm chart templates
├── frontend/                 # React admin dashboard
├── docker-compose.yml        # Local development setup
├── Dockerfile                # API container with kubectl/helm
└── openapi.yaml              # API specification
```

## Development

```bash
# Run with hot reload
pnpm run dev

# Build TypeScript
pnpm run build

# Run production build
pnpm start

# Generate database migrations
pnpm run db:generate

# Run database migrations
pnpm run db:migrate
```

## Testing

```bash
# Verify Kubernetes access
kubectl cluster-info

# List deployed instances
kubectl get namespaces | grep instance

# Check instance pods
kubectl get pods -n instance-<id>

# Port-forward to VaultWarden UI
kubectl port-forward -n instance-<id> svc/vaultwd-service 8080:80
# Visit http://localhost:8080
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

- Each instance's data is isolated at the Kubernetes namespace + database level
- Passwords are encrypted by VaultWarden using industry-standard encryption
- Admin tokens use Argon2id hashing
- No secrets are logged or exposed in API responses

For security issues, please see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Keyforge uses [VaultWarden](https://github.com/dani-garcia/vaultwarden) (AGPLv3), but as an orchestration layer, Keyforge itself is GPLv3. Platform code using Keyforge's API can be proprietary.

## Acknowledgments

- [VaultWarden](https://github.com/dani-garcia/vaultwarden) - The excellent Bitwarden-compatible server
- [Hono](https://hono.dev/) - Fast, lightweight web framework
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe database toolkit
