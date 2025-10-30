# API Reference

Complete reference for the Keyforge API (version 0.1.0).

## Base URL

```
http://localhost:3000
```

## Table of Contents

- [Authentication](#authentication)
- [Key Concepts](#key-concepts)
- [Admin Endpoints](#admin-endpoints)
  - [Create Instance](#create-instance)
  - [List Instances](#list-instances)
  - [Get Instance Details](#get-instance-details)
  - [Delete Instance](#delete-instance)
  - [List Deployments](#list-deployments)
  - [Get Deployment Details](#get-deployment-details)
  - [Get Deployment Events](#get-deployment-events)
  - [Get Deployment Logs](#get-deployment-logs)
- [Organisation Endpoints](#organisation-endpoints)
  - [Create Organisation](#create-organisation)
  - [Get Organisation Details](#get-organisation-details)
  - [Create Password](#create-password)
  - [List Passwords](#list-passwords)
  - [Get Password Details](#get-password-details)
  - [Update Password](#update-password)
  - [Delete Password](#delete-password)
- [Health Endpoints](#health-endpoints)
  - [Check VaultWarden Health](#check-vaultwarden-health)
- [Common Response Codes](#common-response-codes)
- [ID Patterns](#id-patterns)
- [Error Responses](#error-responses)

---

## Authentication

Keyforge uses **dual authentication** depending on the endpoint:

### Admin Endpoints Authentication

**API Key Authentication** is required for all admin operations (`/admin/*` routes).

#### Setup

1. Generate a secure random API key:
   ```bash
   openssl rand -hex 32
   ```

2. Add to your `.env` file:
   ```bash
   ADMIN_API_KEY=your_generated_key_here
   ```

3. Include in requests:
   ```
   Authorization: Bearer <API_KEY>
   ```

#### Example

```bash
curl -X GET http://localhost:3000/admin/instances \
  -H "Authorization: Bearer abc123def456..."
```

#### Error Responses

Authentication errors return `401 Unauthorized`:

```json
{
  "error": "Invalid API key"
}
```

### Instance-Level Authentication

**JWT Authentication** is required for instance-specific operations (`/organisations/*` routes).

#### Token Types

- **Instance Token**: For instance-specific operations (organisations, passwords)
  - `sub` = `"{instance_id}"`
  - `instanceId` = `"{instance_id}"`
  - Signed with instance private key (returned when creating an instance)

#### JWT Payload Structure

```json
{
  "sub": "instance-2574af3733dd26f5",
  "iat": 1234567890,
  "exp": 1234567950,
  "instanceId": "instance-2574af3733dd26f5",
  "requestId": "uuid-v4",
  "metadata": {
    "client": "my-app",
    "version": "1.0.0"
  },
  "isAdmin": false
}
```

**Fields:**
- `sub` - Subject: instance ID or organization identifier
- `iat` - Issued at (Unix timestamp in seconds)
- `exp` - Expiration (Unix timestamp in seconds, typically `iat + 60`)
- `jti` - JWT ID (unique token identifier, required)
- `instanceId` - Instance identifier (required)
- `requestId` - Unique request identifier (UUIDv4 recommended)
- `metadata` - Client-defined custom data (optional)

### Token Expiration

Tokens should be **short-lived** (60 seconds recommended):
```javascript
const iat = Math.floor(Date.now() / 1000)
const exp = iat + 60
```

### Authorization Header

Include the token in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

### Instance Public Keys

**Instance Public Keys:**
- Generated when instance is created
- Private key returned once in the create instance response
- Public key stored in database
- Used to verify instance token signatures

### Protected Routes

- **Admin routes** (`/admin/*`): Require API key authentication
- **Organisation routes** (`/organisations/*`): Require JWT instance token with matching `instanceId`
- **Health routes** (`/health/*`): Public, no authentication required

### JWT Error Responses

Authentication errors return `401 Unauthorized`:

```json
{
  "error": "No authorization token"
}
```

```json
{
  "error": "Invalid token signature or expired"
}
```

```json
{
  "error": "Unknown instance or invalid token"
}
```

Authorization errors return `403 Forbidden`:

```json
{
  "error": "Admin access required"
}
```

```json
{
  "error": "Access denied to this instance"
}
```

### JWT Signing Examples

**Node.js with crypto module:**
```javascript
import { createPrivateKey, sign } from 'crypto'

function signJWT(payload, privateKeyPem) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
    .toString('base64')
    .replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''}[c]))
  
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''}[c]))
  
  const message = `${header}.${body}`
  const privateKey = createPrivateKey(privateKeyPem)
  const signature = sign('sha256', Buffer.from(message), privateKey)
    .toString('base64')
    .replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''}[c]))
  
  return `${message}.${signature}`
}

// Usage
const payload = {
  sub: 'instance-abc123',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60,
  instanceId: 'instance-abc123',
  requestId: crypto.randomUUID(),
  metadata: {}
}

const token = signJWT(payload, privateKey)
```

### Audit Logging

All authenticated requests are logged with:
- Timestamp
- Endpoint path and HTTP method
- Instance ID and Request ID
- Response status code
- Event type categorization
- Custom metadata

Logs are stored in the `audit_logs` table and can be queried for compliance.

---

## Key Concepts

- **Instance**: A VaultWarden instance deployed to Kubernetes with isolated resources
- **Organisation**: An organization within an instance that can manage shared passwords
- **Password**: An encrypted credential stored in an organisation's vault
- **Deployment**: Alias for an instance, used in monitoring endpoints

---

## Admin Endpoints

### Create Instance

**POST** `/admin/instances`

Provisions a new VaultWarden instance in Kubernetes. Returns immediately with `provisioning` status.

**Request Body:**

```json
{
  "name": "production-environment"
}
```

**Response:** `202 Accepted`

```json
{
  "instance_id": "instance-2574af3733dd26f5",
  "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
  "admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
  "jwt_private_key": "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVcB/UNPxalR9z...",
  "status": "provisioning"
}
```

**Notes:**
- Provisioning is asynchronous and takes 2-5 minutes
- Admin token is only returned once - store it securely
- **JWT Private Key is only sent once - store it in your secrets manager or secure vault**
- Use the JWT private key to sign all future requests to this instance
- Check status via [Get Instance Details](#get-instance-details)

**Example:**

```bash
# Use your admin API key
curl -X POST http://localhost:3000/admin/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"name": "production-environment"}'
```

**Note:** The JWT private key is returned in the instance creation response. Clients must securely store and sign JWTs with this key for instance-level operations.

---

### List Instances

**GET** `/admin/instances`

Returns all instances.

**Response:** `200 OK`

```json
{
  "instances": [
    {
      "id": "instance-2574af3733dd26f5",
      "name": "production-environment",
      "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
      "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
      "status": "ready",
      "error": null,
      "created_at": 1761318123092
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/admin/instances
```

---

### Get Instance Details

**GET** `/admin/instances/{instance_id}`

Returns details for a specific instance.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier (e.g., `instance-2574af3733dd26f5`)

**Response:** `200 OK`

```json
{
  "id": "instance-2574af3733dd26f5",
  "name": "production-environment",
  "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
  "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
  "status": "ready",
  "error": null,
  "created_at": 1761318123092
}
```

**Instance Status Values:**
- `provisioning`: Kubernetes resources are being created
- `ready`: VaultWarden is running and accessible
- `failed`: Provisioning failed (see `error` field)

**Example:**

```bash
curl http://localhost:3000/admin/instances/instance-2574af3733dd26f5
```

---

### Delete Instance

**DELETE** `/admin/instances/{instance_id}`

Deletes an instance's Kubernetes namespace and all associated resources.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier

**Response:** `200 OK`

```json
{
  "message": "Instance deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/admin/instances/instance-2574af3733dd26f5
```

---

### List Deployments

**GET** `/admin/deployments`

Returns all deployments (same as [List Instances](#list-instances)).

**Response:** `200 OK`

```json
{
  "deployments": [
    {
      "id": "instance-2574af3733dd26f5",
      "name": "production-environment",
      "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
      "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
      "status": "ready",
      "error": null,
      "created_at": 1761318123092
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/admin/deployments
```

---

### Get Deployment Details

**GET** `/admin/deployments/{deployment_id}`

Returns detailed information about a deployment including organisations and events.

**Path Parameters:**
- `deployment_id` (string, required): Deployment identifier (instance ID)

**Response:** `200 OK`

```json
{
  "instance": {
    "id": "instance-2574af3733dd26f5",
    "name": "production-environment",
    "vaultwd_url": "http://vaultwd-service.instance-2574af3733dd26f5.svc.cluster.local",
    "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
    "status": "ready",
    "error": null,
    "created_at": 1761318123092
  },
  "organisations": [
    {
      "id": "organisation-e6557cc8e1656983",
      "name": "engineering-team",
      "instance_id": "instance-2574af3733dd26f5",
      "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
      "vaultwd_user_email": "organisation-e6557cc8e1656983@keyforge.local",
      "status": "created",
      "created_at": 1761318156000
    }
  ],
  "events": [
    {
      "id": "evt-1a2b3c4d5e6f7890",
      "deployment_id": "instance-2574af3733dd26f5",
      "step": "helm_install",
      "status": "success",
      "message": "Helm chart installed successfully",
      "created_at": 1761318123092
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5
```

---

### Get Deployment Events

**GET** `/admin/deployments/{deployment_id}/events`

Returns all events for a deployment.

**Path Parameters:**
- `deployment_id` (string, required): Deployment identifier

**Response:** `200 OK`

```json
{
  "deployment_id": "instance-2574af3733dd26f5",
  "events": [
    {
      "id": "evt-1a2b3c4d5e6f7890",
      "deployment_id": "instance-2574af3733dd26f5",
      "step": "helm_install",
      "status": "success",
      "message": "Helm chart installed successfully",
      "created_at": 1761318123092
    },
    {
      "id": "evt-2b3c4d5e6f789012",
      "deployment_id": "instance-2574af3733dd26f5",
      "step": "postgres_ready",
      "status": "success",
      "message": "Postgres deployment ready",
      "created_at": 1761318145000
    }
  ]
}
```

**Event Status Values:**
- `pending`: Event not started
- `in_progress`: Event in progress
- `success`: Event completed successfully
- `failed`: Event failed

**Common Event Steps:**
- `helm_install`: Helm chart installation
- `postgres_ready`: PostgreSQL deployment ready
- `vaultwd_ready`: VaultWarden deployment ready
- `provisioning`: Overall provisioning status

**Example:**

```bash
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5/events
```

---

### Get Deployment Logs

**GET** `/admin/deployments/{deployment_id}/logs`

Returns logs for a deployment with pagination and filtering.

**Path Parameters:**
- `deployment_id` (string, required): Deployment identifier

**Query Parameters:**
- `level` (string, optional): Filter by log level (`info`, `warn`, `error`, `debug`)
- `since` (integer, optional): Filter logs since timestamp (Unix milliseconds)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Logs per page (default: 100, max: 1000)

**Response:** `200 OK`

```json
{
  "deployment_id": "instance-2574af3733dd26f5",
  "logs": [
    {
      "id": "log-1a2b3c4d5e6f7890",
      "deployment_id": "instance-2574af3733dd26f5",
      "level": "info",
      "message": "Installing helm chart for instance instance-2574af3733dd26f5",
      "created_at": 1761318123092
    },
    {
      "id": "log-2b3c4d5e6f789012",
      "deployment_id": "instance-2574af3733dd26f5",
      "level": "debug",
      "message": "Helm install stdout: Release \"instance-2574af3733dd26f5\" has been installed.",
      "created_at": 1761318135000
    }
  ],
  "total": 250,
  "page": 1,
  "limit": 100
}
```

**Examples:**

```bash
# Get all logs
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5/logs

# Get only error logs
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5/logs?level=error

# Get logs since timestamp
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5/logs?since=1761318120000

# Pagination
curl http://localhost:3000/admin/deployments/instance-2574af3733dd26f5/logs?page=2&limit=50
```

---

## Organisation Endpoints

### Create Organisation

**POST** `/instances/{instance_id}/organisations`

Creates a new organization (organisation) within an instance.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier

**Headers:**
- `Authorization` (string, required): Bearer token (JWT signed with instance private key)

**Request Body:**

```json
{
  "name": "engineering-team"
}
```

**Response:** `201 Created`

```json
{
  "organisation_id": "organisation-e6557cc8e1656983",
  "instance_id": "instance-2574af3733dd26f5",
  "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
  "status": "created"
}
```

**Error Responses:**
- `404`: Instance not found
- `503`: Instance not ready yet (still provisioning)

**Example:**

```bash
# Sign JWT with instance private key
JWT_TOKEN="eyJhbGc..." # Signed with instance private key from instance creation

curl -X POST http://localhost:3000/instances/instance-2574af3733dd26f5/organisations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name": "engineering-team"}'
```

---

### Get Organisation Details

**GET** `/instances/{instance_id}/organisations/{organisation_id}`

Returns details for a specific organisation.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier

**Headers:**
- `Authorization` (string, required): Bearer token (JWT signed with instance private key)

**Response:** `200 OK`

```json
{
  "id": "organisation-e6557cc8e1656983",
  "name": "engineering-team",
  "instance_id": "instance-2574af3733dd26f5",
  "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
  "vaultwd_user_email": "organisation-e6557cc8e1656983@keyforge.local",
  "vaultwd_user_token": "eyJhbGc...",
  "status": "created",
  "created_at": 1761318156000
}
```

**Example:**

```bash
curl http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983
```

---

### Create Password

**POST** `/instances/{instance_id}/organisations/{organisation_id}/passwords`

Creates a new password entry in the organisation's vault.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier

**Request Body:**

```json
{
  "name": "database-password",
  "value": "super-secret-123"
}
```

**Response:** `201 Created`

```json
{
  "password_id": "pwd-657bbc9ee11296d0",
  "organisation_id": "organisation-e6557cc8e1656983",
  "name": "database-password",
  "created_at": 1761318165804
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords \
  -H "Content-Type: application/json" \
  -d '{"name": "database-password", "value": "super-secret-123"}'
```

---

### List Passwords

**GET** `/instances/{instance_id}/organisations/{organisation_id}/passwords`

Returns all passwords for an organisation (without values).

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier

**Response:** `200 OK`

```json
{
  "organisation_id": "organisation-e6557cc8e1656983",
  "passwords": [
    {
      "id": "pwd-657bbc9ee11296d0",
      "organisation_id": "organisation-e6557cc8e1656983",
      "name": "database-password",
      "created_at": 1761318165804
    },
    {
      "id": "pwd-789abc0e11296d12",
      "organisation_id": "organisation-e6557cc8e1656983",
      "name": "api-key",
      "created_at": 1761318180000
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords
```

---

### Get Password Details

**GET** `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`

Returns full password details including the **decrypted password value**.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier
- `password_id` (string, required): Password identifier

**Response:** `200 OK`

```json
{
  "id": "pwd-657bbc9ee11296d0",
  "organisation_id": "organisation-e6557cc8e1656983",
  "name": "database-password",
  "value": "super-secret-123",
  "created_at": 1761318165804
}
```

**⚠️ Security Note:** This endpoint returns the plaintext password. Use with caution.

**Example:**

```bash
curl http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0
```

---

### Update Password

**PUT** `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`

Updates the name and/or value of a password.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier
- `password_id` (string, required): Password identifier

**Request Body:**

At least one field is required:

```json
{
  "name": "updated-password-name",
  "value": "new-super-secret-456"
}
```

**Response:** `200 OK`

```json
{
  "id": "pwd-657bbc9ee11296d0",
  "organisation_id": "organisation-e6557cc8e1656983",
  "name": "updated-password-name",
  "value": "new-super-secret-456",
  "created_at": 1761318165804
}
```

**Examples:**

```bash
# Update both name and value
curl -X PUT http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"name": "updated-password-name", "value": "new-super-secret-456"}'

# Update only the name
curl -X PUT http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"name": "renamed-password"}'

# Update only the value
curl -X PUT http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"value": "rotated-password-123"}'
```

---

### Delete Password

**DELETE** `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`

Deletes a password entry from the organisation.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier
- `organisation_id` (string, required): Organisation identifier
- `password_id` (string, required): Password identifier

**Response:** `200 OK`

```json
{
  "message": "Password deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/instances/instance-2574af3733dd26f5/organisations/organisation-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0
```

---

## Health Endpoints

### Check VaultWarden Health

**GET** `/health/vaultwd/{instance_id}`

Checks if the VaultWarden instance for an instance is healthy and responding.

**Path Parameters:**
- `instance_id` (string, required): Instance identifier

**Response:** `200 OK` (Healthy)

```json
{
  "status": "healthy",
  "instance_id": "instance-2574af3733dd26f5",
  "message": null,
  "checked_at": 1761318200000
}
```

**Response:** `503 Service Unavailable` (Unhealthy)

```json
{
  "status": "unhealthy",
  "instance_id": "instance-2574af3733dd26f5",
  "message": "VaultWarden returned status 503",
  "checked_at": 1761318200000
}
```

**Example:**

```bash
curl http://localhost:3000/health/vaultwd/instance-2574af3733dd26f5
```

---

## Audit Logging

All authenticated API requests are automatically logged for compliance and security auditing. Audit logs are stored in the database and include:

### Audit Log Fields

- **timestamp** - When the request was made
- **endpoint** - API path that was called
- **method** - HTTP method (GET, POST, PUT, DELETE, etc.)
- **instance_id** - The instance associated with the request
- **request_id** - Unique identifier from JWT payload
- **metadata** - Custom metadata from JWT payload
- **response_status** - HTTP status code returned
- **event_type** - Categorization of the request

### Event Types

- **admin_operation** - Instance creation, deletion, key rotation
- **instance_access** - Reading instance data
- **data_modification** - Creating or updating organisations/passwords
- **auth_failure** - Failed authentication attempts
- **key_rotation** - Key management operations

### What is NOT Logged

- Request/response bodies
- Private keys or secrets
- Password values
- Personal Identifiable Information (PII)

### Database Storage

Audit logs are stored in the `audit_logs` table with indexes on:
- `instance_id` - Query logs by instance
- `timestamp` - Query logs by time range
- `event_type` - Query logs by event category

### Example Audit Log Entry

```json
{
  "id": "audit-abc123def456",
  "timestamp": "2025-01-15T10:30:45Z",
  "endpoint": "/organisations/instance-abc123/organisations/org-xyz789/passwords",
  "method": "POST",
  "instance_id": "instance-abc123",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "client": "my-automation-tool",
    "version": "2.1.0",
    "environment": "production"
  },
  "response_status": 201,
  "event_type": "data_modification",
  "created_at": "2025-01-15T10:30:45Z"
}
```

---

## Common Response Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created successfully |
| `202` | Accepted - Request accepted for async processing |
| `400` | Bad Request - Invalid input |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error - Server error |
| `503` | Service Unavailable - Dependency not ready |

---

## ID Patterns

All IDs follow specific patterns:

| Type | Pattern | Example |
|------|---------|---------|
| Instance ID | `instance-[a-f0-9]{16}` | `instance-2574af3733dd26f5` |
| Organisation ID | `organisation-[a-f0-9]{16}` | `organisation-e6557cc8e1656983` |
| Password ID | `pwd-[a-f0-9]{16}` | `pwd-657bbc9ee11296d0` |
| Event ID | `evt-[a-f0-9]{16}` | `evt-1a2b3c4d5e6f7890` |
| Log ID | `log-[a-f0-9]{16}` | `log-1a2b3c4d5e6f7890` |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Descriptive error message"
}
```

**Examples:**

```json
{
  "error": "Instance not found"
}
```

```json
{
  "error": "Instance is not ready yet. Current status: provisioning"
}
```

```json
{
  "error": "Name and value are required"
}
```

---

## OpenAPI Specification

The complete OpenAPI 3.1.0 specification is available at:

```
openapi.yaml
```

Use tools like [Swagger UI](https://swagger.io/tools/swagger-ui/) or [Redoc](https://github.com/Redocly/redoc) to generate interactive documentation.

---

## Related Documentation

- [Main README](README.md) - Project overview
- [Setup Guide](SETUP.md) - Installation and setup
- [Frontend README](frontend/README.md) - Frontend documentation
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
