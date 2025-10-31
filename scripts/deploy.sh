#!/bin/bash
set -e

echo "Deploying Keyforge to k3s..."

# Check if secret exists, if not, create from example
if ! kubectl get secret keyforge-secret -n keyforge &> /dev/null; then
  echo "Creating secret from example..."
  echo "⚠️  WARNING: Using example secret values. Update k8s/secret.yaml with production values!"
  kubectl apply -f k8s/secret.yaml.example
else
  echo "Secret already exists, skipping creation"
fi

# Apply namespace
echo "Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Apply ConfigMap
echo "Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml

# Apply RBAC (ServiceAccount, ClusterRole, ClusterRoleBinding)
echo "Applying RBAC configuration..."
kubectl apply -f k8s/api-rbac.yaml

# Deploy PostgreSQL
echo "Deploying PostgreSQL..."
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/postgres-statefulset.yaml

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n keyforge --timeout=120s

# Deploy API
echo "Deploying API..."
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/api-deployment.yaml

# Wait for API to be ready
echo "Waiting for API to be ready..."
kubectl wait --for=condition=ready pod -l app=keyforge-api -n keyforge --timeout=120s

# Deploy Frontend
echo "Deploying Frontend..."
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for Frontend to be ready
echo "Waiting for Frontend to be ready..."
kubectl wait --for=condition=ready pod -l app=keyforge-frontend -n keyforge --timeout=120s

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Access the application:"
echo "  API:      http://localhost:30080"
echo "  Frontend: http://localhost:30081"
echo ""
echo "Check status:"
echo "  kubectl get pods -n keyforge"
echo "  kubectl get services -n keyforge"
echo ""
echo "View API logs:"
echo "  kubectl logs -f -l app=keyforge-api -n keyforge"
echo ""
echo "Run database migrations:"
echo "  kubectl exec -it -n keyforge \$(kubectl get pod -n keyforge -l app=keyforge-api -o jsonpath='{.items[0].metadata.name}') -- pnpm run db:push"
