# JWT Authentication Setup Guide

This guide explains how to set up and use JWT authentication in Keyforge for both root-level and instance-level operations.

## Table of Contents

1. [Overview](#overview)
2. [Root Key Setup](#root-key-setup)
3. [Generating JWT Tokens](#generating-jwt-tokens)
4. [Using JWTs in API Requests](#using-jwts-in-api-requests)
5. [Client-Side Integration](#client-side-integration)
6. [Troubleshooting](#troubleshooting)

## Overview

Keyforge uses ECDSA P-256 (ES256) JWT tokens for authentication. There are two levels of authentication:

- **Root Authentication**: Admin operations using the root public key (`ROOT_JWT_PUBLIC_KEY` environment variable)
- **Instance Authentication**: Per-instance operations using instance-specific keys generated during instance creation

### Key Security Features

- **Algorithm**: ECDSA P-256 (ES256) provides strong cryptographic security
- **Key Management**: Root keys are environment-configured; instance keys are generated and stored in the database
- **Token Validation**: Includes signature verification, expiration checking, and instance ID validation
- **Audit Logging**: All authentication attempts (success and failure) are logged for compliance

## Root Key Setup

### 1. Generate Root Key Pair (One-time Setup)

The root key pair is generated once and the public key is configured as an environment variable.

```bash
# Using OpenSSL to generate an ECDSA P-256 key pair
openssl ecparam -name prime256v1 -genkey -noout -out root_private.pem
openssl ec -in root_private.pem -pubout -out root_public.pem

# View the keys
cat root_private.pem
cat root_public.pem
```

### 2. Configure Environment Variables

Add the root public key to your `.env` file:

```bash
# .env
ROOT_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----"
```

**Important**: The private key (`root_private.pem`) should be:
- Stored securely (separate from the application)
- Never committed to version control
- Only accessible to authorized personnel/systems that need to generate root tokens
- Rotated periodically per your security policy

## Generating JWT Tokens

### Token Structure

All JWT tokens include the following claims:

```json
{
  "sub": "root",                    // Subject (root or organization name)
  "instanceId": "uuid-here",        // Instance identifier
  "requestId": "uuid-here",         // Unique request identifier
  "isAdmin": true,                  // Admin privilege flag
  "iat": 1234567890,               // Issued at (Unix timestamp)
  "exp": 1234571490,               // Expiration (Unix timestamp)
  "metadata": {}                    // Custom metadata object
}
```

### Root Token Generation

Root tokens are used to create instances and perform admin operations. Generate them using the root private key:

#### Node.js/JavaScript

```javascript
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Read the root private key
const rootPrivateKey = fs.readFileSync('root_private.pem', 'utf-8');

// Create root JWT token
function generateRootToken(instanceId, expirySeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    sub: 'root',
    instanceId: instanceId,
    requestId: crypto.randomUUID(),
    isAdmin: true,
    iat: now,
    exp: now + expirySeconds,
    metadata: {}
  };
  
  const token = jwt.sign(payload, rootPrivateKey, { algorithm: 'ES256' });
  return token;
}

// Usage
const token = generateRootToken('my-instance-123');
console.log('Root JWT Token:', token);
```

#### Python

```python
import json
import jwt
import uuid
import time
from datetime import datetime, timedelta

# Read the root private key
with open('root_private.pem', 'r') as f:
    root_private_key = f.read()

def generate_root_token(instance_id, expiry_seconds=3600):
    now = int(time.time())
    
    payload = {
        'sub': 'root',
        'instanceId': instance_id,
        'requestId': str(uuid.uuid4()),
        'isAdmin': True,
        'iat': now,
        'exp': now + expiry_seconds,
        'metadata': {}
    }
    
    token = jwt.encode(payload, root_private_key, algorithm='ES256')
    return token

# Usage
token = generate_root_token('my-instance-123')
print(f'Root JWT Token: {token}')
```

#### cURL + jq (For Testing)

If you need to generate tokens for testing without writing code:

```bash
# Create token payload
PAYLOAD=$(jq -n \
  --arg sub "root" \
  --arg instanceId "test-instance-123" \
  --arg requestId "$(uuidgen)" \
  '{
    sub: $sub,
    instanceId: $instanceId,
    requestId: $requestId,
    isAdmin: true,
    iat: (now | floor),
    exp: ((now | floor) + 3600),
    metadata: {}
  }')

# Sign with private key (requires an external JWT signing tool)
# This is not recommended for production - use the JavaScript/Python examples above
```

### Instance Token Generation

Instance tokens are generated when creating an instance and use the instance's private key:

```javascript
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// After instance creation, retrieve the instance's private key from the API response or database
const instancePrivateKey = "-----BEGIN EC PRIVATE KEY-----\n..."; // From database

function generateInstanceToken(instanceId, subjectName, expirySeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    sub: subjectName,                    // e.g., 'org-123' or 'api-client'
    instanceId: instanceId,
    requestId: crypto.randomUUID(),
    isAdmin: false,                     // Instance tokens are never admin
    iat: now,
    exp: now + expirySeconds,
    metadata: {
      client: 'my-app',
      version: '1.0.0'
    }
  };
  
  const token = jwt.sign(payload, instancePrivateKey, { algorithm: 'ES256' });
  return token;
}

// Usage
const token = generateInstanceToken('my-instance-123', 'org-456', 3600);
console.log('Instance JWT Token:', token);
```

## Using JWTs in API Requests

### Create Instance (Admin)

```bash
# Generate root JWT token
JWT_TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const fs = require('fs');
  const crypto = require('crypto');
  const key = fs.readFileSync('root_private.pem', 'utf-8');
  const payload = {
    sub: 'root',
    instanceId: 'new-instance',
    requestId: crypto.randomUUID(),
    isAdmin: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    metadata: {}
  };
  console.log(jwt.sign(payload, key, { algorithm: 'ES256' }));
")

# Create instance
curl -X POST http://localhost:3000/admin/instances \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-instance",
    "namespace": "production"
  }'
```

### Access Organization (Instance)

```bash
# Use the instance private key to generate a token
INSTANCE_JWT_TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');
  const key = \`-----BEGIN EC PRIVATE KEY-----
...instance private key...
-----END EC PRIVATE KEY-----\`;
  const payload = {
    sub: 'org-123',
    instanceId: 'my-instance',
    requestId: crypto.randomUUID(),
    isAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    metadata: {}
  };
  console.log(jwt.sign(payload, key, { algorithm: 'ES256' }));
")

# Access organization
curl -X GET "http://localhost:3000/instances/my-instance/organisations/org-123" \
  -H "Authorization: Bearer $INSTANCE_JWT_TOKEN"
```

## Client-Side Integration

### Web Application (TypeScript/React)

```typescript
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

class KeyforgeClient {
  private instanceId: string;
  private instancePrivateKey: string;

  constructor(instanceId: string, instancePrivateKey: string) {
    this.instanceId = instanceId;
    this.instancePrivateKey = instancePrivateKey;
  }

  private generateToken(subject: string, expirySeconds: number = 3600): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      sub: subject,
      instanceId: this.instanceId,
      requestId: uuidv4(),
      isAdmin: false,
      iat: now,
      exp: now + expirySeconds,
      metadata: {
        client: 'web-app',
        timestamp: new Date().toISOString()
      }
    };
    
    return jwt.sign(payload, this.instancePrivateKey, { algorithm: 'ES256' });
  }

  async getOrganization(orgId: string): Promise<any> {
    const token = this.generateToken(`org-${orgId}`);
    
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/instances/${this.instanceId}/organisations/${orgId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch organization: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createSecret(orgId: string, secretData: any): Promise<any> {
    const token = this.generateToken(`org-${orgId}`);
    
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/instances/${this.instanceId}/organisations/${orgId}/secrets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(secretData)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create secret: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Usage
const client = new KeyforgeClient('my-instance', process.env.INSTANCE_PRIVATE_KEY!);
const org = await client.getOrganization('org-123');
```

### Backend Service (Node.js/Express)

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

class KeyforgeService {
  private instanceId: string;
  private instancePrivateKey: string;
  private baseUrl: string;

  constructor(instanceId: string, instancePrivateKey: string, baseUrl: string = 'http://localhost:3000') {
    this.instanceId = instanceId;
    this.instancePrivateKey = instancePrivateKey;
    this.baseUrl = baseUrl;
  }

  private generateToken(subject: string, expirySeconds: number = 3600): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      sub: subject,
      instanceId: this.instanceId,
      requestId: uuidv4(),
      isAdmin: false,
      iat: now,
      exp: now + expirySeconds,
      metadata: {
        service: 'backend-service',
        environment: process.env.NODE_ENV
      }
    };
    
    return jwt.sign(payload, this.instancePrivateKey, { algorithm: 'ES256' });
  }

  async listSecrets(orgId: string): Promise<any[]> {
    const token = this.generateToken(`org-${orgId}`);
    
    const response = await axios.get(
      `${this.baseUrl}/instances/${this.instanceId}/organisations/${orgId}/secrets`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  }

  async rotateSecret(orgId: string, secretId: string, newValue: string): Promise<any> {
    const token = this.generateToken(`org-${orgId}`);
    
    const response = await axios.patch(
      `${this.baseUrl}/instances/${this.instanceId}/organisations/${orgId}/secrets/${secretId}`,
      { value: newValue },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  }
}

// Usage
const service = new KeyforgeService(
  process.env.INSTANCE_ID!,
  process.env.INSTANCE_PRIVATE_KEY!
);

app.get('/api/secrets/:orgId', async (req, res) => {
  try {
    const secrets = await service.listSecrets(req.params.orgId);
    res.json(secrets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});
```

## Troubleshooting

### Invalid Token Signature

**Problem**: `Invalid token signature or expired` error

**Solutions**:
1. Verify the private key matches the public key configured in the environment
2. Check token expiration: `jwt.decode(token).exp` should be greater than current Unix timestamp
3. Ensure the algorithm is ES256
4. For instance tokens, verify the correct instance private key is being used

### Unknown Instance Error

**Problem**: `Unknown instance or invalid token` error

**Solutions**:
1. Verify the `instanceId` in the JWT payload matches an existing instance
2. Check that the instance was successfully created in the database
3. Ensure the instance public key is properly stored

### Access Denied to Instance

**Problem**: `Access denied to this instance` error on instance-level requests

**Solutions**:
1. For non-admin tokens, verify the `instanceId` in the token matches the requested resource
2. Check that the organization/resource belongs to the requested instance
3. Admin tokens (with `isAdmin: true`) can access any instance

### Token Validation Failures

**Problem**: Tokens are rejected even with valid signatures

**Solutions**:
1. Verify the token includes all required claims: `sub`, `instanceId`, `requestId`, `isAdmin`, `iat`, `exp`
2. Check that `iat` (issued at) is not in the future
3. Ensure `exp` (expiration) is in the future
4. For instance tokens, verify `isAdmin` is `false`

## Security Best Practices

1. **Key Rotation**: Rotate root keys periodically (e.g., quarterly)
2. **Token Expiration**: Use short expiration times (5-15 minutes) for sensitive operations
3. **Separate Keys**: Never use the same private key for multiple purposes
4. **Audit Logs**: Monitor audit logs for suspicious authentication patterns
5. **TLS/HTTPS**: Always use HTTPS in production to protect tokens in transit
6. **Env Variables**: Store private keys in environment variables, not in code
7. **Token Refresh**: Implement token refresh patterns for long-lived client sessions

## Additional Resources

- [JWT.io - Introduction to JWT](https://jwt.io/introduction)
- [ECDSA - Wikipedia](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 7518 - JSON Web Algorithms (JWA)](https://tools.ietf.org/html/rfc7518)
