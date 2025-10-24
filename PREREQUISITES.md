# Prerequisites

This document lists all software requirements for running Keyforge.

## Required Software

### Node.js 20+

Keyforge requires Node.js version 20 or higher.

**Check if installed:**
```bash
node --version
# Should output: v20.x.x or higher
```

**Installation:**

- **macOS** (Homebrew):
  ```bash
  brew install node@20
  ```

- **macOS/Linux** (nvm):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 20
  nvm use 20
  ```

- **Windows**: Download from [nodejs.org](https://nodejs.org/)

- **Linux** (apt):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

### pnpm 10.13.1+

Keyforge uses pnpm as its package manager.

**Check if installed:**
```bash
pnpm --version
# Should output: 10.13.1 or higher
```

**Installation:**

After Node.js is installed:
```bash
# Enable corepack (comes with Node.js 16+)
corepack enable

# Install specific version
corepack prepare pnpm@10.13.1 --activate

# Verify
pnpm --version
```

**Alternative (npm):**
```bash
npm install -g pnpm@10.13.1
```

### Kubernetes Cluster

Keyforge provisions VaultWarden instances on Kubernetes. You need access to a cluster.

#### Option 1: Kind (Recommended for Local)

Kind runs Kubernetes in Docker containers.

**Check if installed:**
```bash
kind version
```

**Installation:**

- **macOS** (Homebrew):
  ```bash
  brew install kind
  ```

- **Linux**:
  ```bash
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind
  ```

- **Windows** (Chocolatey):
  ```bash
  choco install kind
  ```

**Create cluster:**
```bash
kind create cluster --name keyforge
```

#### Option 2: Minikube

**Check if installed:**
```bash
minikube version
```

**Installation:**

- **macOS** (Homebrew):
  ```bash
  brew install minikube
  ```

- **Linux**:
  ```bash
  curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
  sudo install minikube-linux-amd64 /usr/local/bin/minikube
  ```

- **Windows** (Chocolatey):
  ```bash
  choco install minikube
  ```

**Start cluster:**
```bash
minikube start
```

#### Option 3: Remote Cluster

You can use any Kubernetes cluster (GKE, EKS, AKS, etc.) as long as you have:
- Valid kubeconfig file
- Permission to create namespaces
- Permission to create deployments, services, and PVCs

## Optional Software (Docker Setup)

If using Docker Compose, you need Docker and Docker Compose.

### Docker Desktop (macOS/Windows)

**Check if installed:**
```bash
docker --version
docker-compose --version
```

**Installation:**

Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

### Docker Engine (Linux)

**Installation (Ubuntu/Debian):**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

**Verify:**
```bash
docker --version
docker compose version
```

## Optional Software (Local Setup)

If running locally without Docker, you need kubectl and helm.

### kubectl

**Check if installed:**
```bash
kubectl version --client
```

**Installation:**

- **macOS** (Homebrew):
  ```bash
  brew install kubectl
  ```

- **Linux**:
  ```bash
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x kubectl
  sudo mv kubectl /usr/local/bin/
  ```

- **Windows** (Chocolatey):
  ```bash
  choco install kubernetes-cli
  ```

**Verify access:**
```bash
kubectl cluster-info
```

### Helm

**Check if installed:**
```bash
helm version
```

**Installation:**

- **macOS** (Homebrew):
  ```bash
  brew install helm
  ```

- **Linux**:
  ```bash
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ```

- **Windows** (Chocolatey):
  ```bash
  choco install kubernetes-helm
  ```

**Verify:**
```bash
helm version
```

## Optional Software (Frontend)

To run the React frontend dashboard:

### Already have Node.js and pnpm?

You're all set! The frontend uses the same tools.

## Verification Checklist

Run these commands to verify all prerequisites are met:

```bash
# Node.js
node --version  # Should be v20.x.x or higher

# pnpm
pnpm --version  # Should be 10.13.1 or higher

# Kubernetes cluster
kubectl cluster-info  # Should show cluster info

# Docker (if using Docker Compose)
docker --version  # Should show Docker version
docker compose version  # Should show Docker Compose version

# kubectl (if running locally)
kubectl version --client  # Should show client version

# Helm (if running locally)
helm version  # Should show Helm version

# Verify Kubernetes permissions
kubectl auth can-i create namespace  # Should output: yes
kubectl auth can-i create deployment  # Should output: yes
```

## Platform-Specific Notes

### macOS

- Use Homebrew for easiest installation
- Docker Desktop includes Kubernetes (can use instead of Kind)
- M1/M2 Macs: All tools have ARM64 builds available

### Linux

- Ensure Docker is installed and user is in `docker` group
- Some distributions require manual kubectl/helm installation
- Kind is the recommended local Kubernetes option

### Windows

- Use WSL2 for best experience
- Docker Desktop requires WSL2 backend
- All commands in this guide work in WSL2 terminal
- Native Windows (PowerShell) is supported but less tested

## Minimum System Requirements

- **CPU**: 4 cores (2 for API, 2+ for Kubernetes)
- **RAM**: 8GB minimum (4GB for K8s, 2GB for API, 2GB for OS)
- **Disk**: 20GB free space (for Docker images and K8s resources)
- **OS**: macOS 10.15+, Ubuntu 20.04+, Windows 10+ with WSL2

## Recommended System Requirements

- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Disk**: 50GB+ free space
- **OS**: Latest stable versions

## Network Requirements

- Internet access for:
  - Downloading Docker images (VaultWarden, PostgreSQL)
  - Installing npm packages
  - Accessing npm/Docker registries

- Ports needed:
  - `3000`: Keyforge API
  - `5173`: Frontend (React dev server)
  - `5432`: PostgreSQL (if running locally)
  - `8080`: VaultWarden (when port-forwarding)

## Next Steps

Once all prerequisites are installed, proceed to [SETUP.md](SETUP.md) for detailed setup instructions.
