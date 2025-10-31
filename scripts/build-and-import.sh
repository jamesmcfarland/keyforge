#!/bin/bash
set -e

echo "Building Keyforge images and importing to k3s..."

# Build API image
echo "Building API image..."
docker build -t keyforge-api:latest -f Dockerfile .

# Build frontend image
echo "Building frontend image..."
docker build -t keyforge-frontend:latest -f frontend/Dockerfile ./frontend

# Save images to tar files
echo "Saving images to tar files..."
docker save keyforge-api:latest -o /tmp/keyforge-api.tar
docker save keyforge-frontend:latest -o /tmp/keyforge-frontend.tar

# Import images to k3s
echo "Importing images to k3s..."
sudo k3s ctr images import /tmp/keyforge-api.tar
sudo k3s ctr images import /tmp/keyforge-frontend.tar

# Clean up tar files
echo "Cleaning up..."
rm /tmp/keyforge-api.tar /tmp/keyforge-frontend.tar

echo "Done! Images imported to k3s:"
sudo k3s ctr images ls | grep keyforge
