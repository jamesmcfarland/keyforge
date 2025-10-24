# Production Deployment Guide

This guide covers deploying Keyforge to production environments.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Kubernetes Cluster Setup](#kubernetes-cluster-setup)
- [Database Setup](#database-setup)
- [API Server Deployment](#api-server-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Security Considerations](#security-considerations)
- [Monitoring and Observability](#monitoring-and-observability)
- [Backup and Recovery](#backup-and-recovery)
- [Scaling](#scaling)
- [Troubleshooting Production Issues](#troubleshooting-production-issues)

---

## Architecture Overview

Keyforge production deployment consists of:

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
│                   (nginx/ALB/Cloudflare)                     │
└─────────────┬─────────────────────────────┬─────────────────┘
              │                             │
              │                             │
    ┌─────────▼─────────┐         ┌────────▼────────┐
    │  Frontend (React) │         │  API Server     │
    │  Static Files     │         │  (Hono/Node.js) │
    └───────────────────┘         └────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   PostgreSQL    │
                                  │    Database     │
                                  └────────┬────────┘
                                           │
                              ┌────────────▼────────────────┐
                              │   Kubernetes Cluster        │
                              │  (VaultWarden Deployments)  │
                              └─────────────────────────────┘
```

**Components:**

1. **Frontend** - React SPA served as static files
2. **API Server** - Node.js application managing deployments
3. **PostgreSQL** - Metadata storage for unions, societies, passwords, and deployment tracking
4. **Kubernetes** - Target cluster for VaultWarden instances

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB SSD
- Network: 100 Mbps

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ SSD
- Network: 1 Gbps

### Software Requirements

- **Node.js** 20.x or higher
- **PostgreSQL** 16.x or higher
- **Kubernetes Cluster** with admin access
- **kubectl** configured for cluster access
- **Helm** 3.x
- **pnpm** 10.13.1 or higher
- **Reverse Proxy** (nginx, Caddy, Traefik, etc.)

### Kubernetes Cluster

Supported cluster types:
- Managed Kubernetes (EKS, GKE, AKS)
- Self-hosted (kubeadm, k3s, RKE2)
- On-premises

**Required permissions:**
- Create/delete namespaces
- Deploy helm charts
- Create LoadBalancer services
- Manage secrets
- Access to storage provisioner

---

## Deployment Options

### Option 1: Docker-based Deployment (Recommended for Small Teams)

Simple deployment using Docker containers with docker-compose or standalone.

### Option 2: Systemd Service (Linux Servers)

Run API server as a systemd service with system PostgreSQL.

### Option 3: Kubernetes Deployment (Enterprise)

Deploy the entire stack (including API and database) to Kubernetes.

### Option 4: Cloud Platform (Serverless/PaaS)

Deploy to cloud platforms like Heroku, Railway, Render, or Fly.io.

---

## Kubernetes Cluster Setup

### 1. Verify Cluster Access

```bash
kubectl cluster-info
kubectl get nodes
kubectl version
```

### 2. Configure RBAC (if needed)

Create a service account with necessary permissions:

```yaml
# keyforge-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: keyforge-deployer
  namespace: keyforge
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: keyforge-deployer
rules:
  - apiGroups: [""]
    resources: ["namespaces", "services", "secrets", "persistentvolumeclaims"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: keyforge-deployer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: keyforge-deployer
subjects:
  - kind: ServiceAccount
    name: keyforge-deployer
    namespace: keyforge
```

Apply:
```bash
kubectl apply -f keyforge-rbac.yaml
```

### 3. Configure Storage Class

Ensure a default storage class exists for PVC provisioning:

```bash
kubectl get storageclass
```

If needed, create one:

```yaml
# storageclass.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs  # Change based on provider
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

### 4. Configure LoadBalancer or Ingress

For VaultWarden services to be accessible:

**Option A: LoadBalancer (Cloud)**
```yaml
# Already configured in helm-chart/templates/vaultwd-service.yaml
type: LoadBalancer
```

**Option B: Ingress Controller**

Install ingress controller (e.g., nginx-ingress):

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx
```

Modify `helm-chart/templates/vaultwd-service.yaml` to use ClusterIP and create Ingress resources.

---

## Database Setup

### Option 1: Managed Database (Recommended)

Use managed PostgreSQL from cloud providers:

- **AWS RDS**
- **Google Cloud SQL**
- **Azure Database for PostgreSQL**
- **DigitalOcean Managed Database**
- **Supabase**

**Benefits:**
- Automated backups
- High availability
- Automatic updates
- Monitoring included

**Configuration:**

1. Create PostgreSQL 16+ instance
2. Create database: `keyforge`
3. Create user with full permissions
4. Note connection URL: `postgresql://user:password@host:5432/keyforge`

### Option 2: Self-hosted PostgreSQL

Install PostgreSQL on your server:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-16

# Start service
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE keyforge;
CREATE USER keyforge WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE keyforge TO keyforge;
\c keyforge
GRANT ALL ON SCHEMA public TO keyforge;
EOF
```

### Database Security

1. **Use strong passwords** (16+ characters, random)
2. **Enable SSL/TLS** connections
3. **Restrict network access** (firewall rules)
4. **Regular backups** (see [Backup and Recovery](#backup-and-recovery))
5. **Monitor connections** and query performance

---

## API Server Deployment

### Option 1: Docker with docker-compose

**1. Clone repository:**
```bash
git clone <your-repo-url> keyforge
cd keyforge
```

**2. Create production environment file:**
```bash
cp .env.example .env.production
```

**3. Edit `.env.production`:**
```env
# Database
DATABASE_URL=postgresql://keyforge:STRONG_PASSWORD@your-db-host:5432/keyforge
DB_PASSWORD=STRONG_PASSWORD

# Kubernetes
KUBECONFIG=/app/.kube/config

# Environment
NODE_ENV=production
```

**4. Create production docker-compose:**

```yaml
# docker-compose.prod.yml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: production
      KUBECONFIG: /app/.kube/config
    volumes:
      - ${HOME}/.kube/config:/app/.kube/config:ro
      - ./helm-chart:/app/helm-chart:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**5. Deploy:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Option 2: Systemd Service

**1. Build application:**
```bash
pnpm install --frozen-lockfile
pnpm run build
```

**2. Create systemd service file:**

```ini
# /etc/systemd/system/keyforge.service
[Unit]
Description=Keyforge API Server
After=network.target postgresql.service

[Service]
Type=simple
User=keyforge
Group=keyforge
WorkingDirectory=/opt/keyforge
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://keyforge:PASSWORD@localhost:5432/keyforge"
Environment="KUBECONFIG=/home/keyforge/.kube/config"
ExecStart=/usr/bin/node /opt/keyforge/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**3. Create user and deploy:**
```bash
sudo useradd -r -s /bin/false keyforge
sudo mkdir -p /opt/keyforge
sudo cp -r dist node_modules helm-chart package.json /opt/keyforge/
sudo chown -R keyforge:keyforge /opt/keyforge

# Copy kubeconfig
sudo mkdir -p /home/keyforge/.kube
sudo cp ~/.kube/config /home/keyforge/.kube/config
sudo chown -R keyforge:keyforge /home/keyforge/.kube

# Start service
sudo systemctl daemon-reload
sudo systemctl enable keyforge
sudo systemctl start keyforge
sudo systemctl status keyforge
```

### Option 3: Kubernetes Deployment

Deploy the API server itself to Kubernetes:

```yaml
# k8s-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: keyforge
---
apiVersion: v1
kind: Secret
metadata:
  name: keyforge-secrets
  namespace: keyforge
type: Opaque
stringData:
  DATABASE_URL: postgresql://keyforge:PASSWORD@postgres-host:5432/keyforge
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keyforge-api
  namespace: keyforge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: keyforge-api
  template:
    metadata:
      labels:
        app: keyforge-api
    spec:
      serviceAccountName: keyforge-deployer
      containers:
      - name: api
        image: your-registry/keyforge:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: keyforge-secrets
              key: DATABASE_URL
        - name: NODE_ENV
          value: production
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: keyforge-api
  namespace: keyforge
spec:
  type: LoadBalancer
  selector:
    app: keyforge-api
  ports:
  - port: 80
    targetPort: 3000
```

Apply:
```bash
kubectl apply -f k8s-deployment.yaml
```

---

## Frontend Deployment

### 1. Build Frontend

```bash
cd frontend
pnpm install --frozen-lockfile

# Set production API URL
echo "VITE_API_BASE=https://api.keyforge.example.com" > .env.production

pnpm run build
```

This creates `frontend/dist/` with static files.

### 2. Deploy with Nginx

```nginx
# /etc/nginx/sites-available/keyforge
server {
    listen 80;
    server_name keyforge.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name keyforge.example.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/keyforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/keyforge.example.com/privkey.pem;
    
    # Frontend static files
    root /var/www/keyforge/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

Deploy:
```bash
sudo cp -r frontend/dist /var/www/keyforge/
sudo ln -s /etc/nginx/sites-available/keyforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Deploy to CDN/Static Hosting

Upload `frontend/dist/` to:

- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod --dir=dist`
- **Cloudflare Pages**: Connect Git repo
- **AWS S3 + CloudFront**: Sync to S3 bucket
- **GitHub Pages**: Push to gh-pages branch

**Important:** Configure environment variable `VITE_API_BASE` to point to your production API URL.

---

## Security Considerations

### 1. Database Security

- ✅ Use strong, unique passwords (32+ characters)
- ✅ Enable SSL/TLS connections (`?sslmode=require` in DATABASE_URL)
- ✅ Restrict network access (firewall, security groups)
- ✅ Regular security updates
- ✅ Enable connection limits
- ✅ Monitor for suspicious activity

### 2. API Security

- ✅ **Authentication**: Implement API authentication (JWT, API keys)
- ✅ **Rate limiting**: Add rate limiting middleware
- ✅ **CORS**: Configure strict CORS policies
- ✅ **Input validation**: Validate all inputs
- ✅ **Secrets management**: Use environment variables or secrets managers (AWS Secrets Manager, HashiCorp Vault)
- ✅ **HTTPS only**: Enforce TLS 1.2+
- ✅ **Security headers**: Use helmet.js or similar

**Example rate limiting:**
```typescript
import { rateLimiter } from 'hono-rate-limiter'

app.use('*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'anonymous'
}))
```

### 3. Kubernetes Security

- ✅ Use RBAC with least privilege
- ✅ Network policies to isolate namespaces
- ✅ Pod security policies/standards
- ✅ Scan images for vulnerabilities
- ✅ Keep cluster updated
- ✅ Audit logging enabled

### 4. VaultWarden Admin Tokens

- ✅ Generate cryptographically strong tokens (32+ characters)
- ✅ Store securely in Kubernetes secrets
- ✅ Never log admin tokens
- ✅ Rotate tokens regularly
- ✅ Use different tokens per union

### 5. Frontend Security

- ✅ Implement authentication
- ✅ Sanitize user inputs
- ✅ Use Content Security Policy (CSP)
- ✅ Regular dependency updates
- ✅ HTTPS only

---

## Monitoring and Observability

### 1. Application Monitoring

**Recommended tools:**
- **APM**: New Relic, Datadog, Sentry
- **Logs**: ELK Stack, Loki, CloudWatch
- **Metrics**: Prometheus + Grafana

### 2. Database Monitoring

Monitor:
- Connection pool usage
- Query performance
- Slow queries
- Disk usage
- Replication lag (if applicable)

### 3. Kubernetes Monitoring

Monitor:
- Cluster health
- Node resources
- Deployment status
- PVC usage
- Failed provisioning attempts

**Prometheus metrics example:**

```typescript
import { Hono } from 'hono'
import promClient from 'prom-client'

const register = new promClient.Registry()

const provisioningDuration = new promClient.Histogram({
  name: 'keyforge_provisioning_duration_seconds',
  help: 'Duration of VaultWarden provisioning',
  labelNames: ['status'],
  registers: [register]
})

app.get('/metrics', (c) => {
  return c.text(register.metrics(), 200, {
    'Content-Type': register.contentType
  })
})
```

### 4. Alerting

Set up alerts for:
- API server downtime
- Database connection failures
- Failed provisioning attempts
- Disk space warnings
- High error rates

---

## Backup and Recovery

### 1. Database Backups

**Automated backups:**

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/var/backups/keyforge"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="postgresql://keyforge:PASSWORD@localhost:5432/keyforge"

mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/keyforge_$TIMESTAMP.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "keyforge_*.sql.gz" -mtime +30 -delete
```

**Cron job:**
```cron
0 2 * * * /usr/local/bin/keyforge-backup.sh
```

### 2. Configuration Backups

Back up:
- `.env` files (without secrets in version control)
- Kubernetes configs
- Helm chart values
- Nginx/web server configs

### 3. Disaster Recovery

**Recovery steps:**

1. **Provision new infrastructure**
2. **Restore database from backup:**
   ```bash
   gunzip < backup.sql.gz | psql $DATABASE_URL
   ```
3. **Deploy application** (API + frontend)
4. **Verify health checks**
5. **Update DNS** if needed

**RTO/RPO targets:**
- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 24 hours

---

## Scaling

### Horizontal Scaling

**API Server:**
```yaml
# Kubernetes deployment
spec:
  replicas: 3  # Scale to 3 replicas

  # Or use HPA
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: keyforge-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: keyforge-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Database:**
- Enable read replicas for read-heavy workloads
- Use connection pooling (PgBouncer)
- Consider managed database auto-scaling

### Vertical Scaling

Increase resources:
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "1000m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

### Kubernetes Cluster Scaling

- Enable cluster autoscaler
- Add more nodes as unions grow
- Use node pools for different workload types

---

## Troubleshooting Production Issues

### High CPU/Memory Usage

1. **Check metrics**: Prometheus, CloudWatch, etc.
2. **Profile application**: Use Node.js profiler
3. **Optimize queries**: Check slow database queries
4. **Scale resources**: Add more replicas or increase limits

### Failed Provisioning

1. **Check deployment logs**: `GET /admin/deployments/{id}/logs`
2. **Check Kubernetes events**: `kubectl get events -n {union-id}`
3. **Verify cluster capacity**: `kubectl describe nodes`
4. **Check helm chart**: `helm lint ./helm-chart`

### Database Connection Pool Exhausted

1. **Increase pool size** in `src/db/client.ts`
2. **Add connection pooler** (PgBouncer)
3. **Check for connection leaks**
4. **Monitor active connections**

### Certificate Expiration

Use Let's Encrypt with auto-renewal:
```bash
certbot renew --nginx
```

Set up monitoring for certificate expiration.

---

## Performance Optimization

1. **Enable caching** (Redis for API responses)
2. **Database indexing** (ensure proper indexes on queries)
3. **CDN for frontend** (CloudFlare, AWS CloudFront)
4. **Connection pooling** (PgBouncer)
5. **Compression** (gzip/brotli for API responses)

---

## Further Reading

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Security Checklist](https://cheatsheetseries.owasp.org/)

## Related Documentation

- [Main README](README.md)
- [Setup Guide](SETUP.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Frontend README](frontend/README.md)
