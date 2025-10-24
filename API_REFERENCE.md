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
  - [Create Union](#create-union)
  - [List Unions](#list-unions)
  - [Get Union Details](#get-union-details)
  - [Delete Union](#delete-union)
  - [List Deployments](#list-deployments)
  - [Get Deployment Details](#get-deployment-details)
  - [Get Deployment Events](#get-deployment-events)
  - [Get Deployment Logs](#get-deployment-logs)
- [Society Endpoints](#society-endpoints)
  - [Create Society](#create-society)
  - [Get Society Details](#get-society-details)
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

**Current Version:** No authentication required (development mode).

**Future:** Authentication will be added before production deployment. Likely using API keys or JWT tokens.

---

## Key Concepts

- **Union**: A VaultWarden instance deployed to Kubernetes with isolated resources
- **Society**: An organization within a union that can manage shared passwords
- **Password**: An encrypted credential stored in a society's vault
- **Deployment**: Alias for a union, used in monitoring endpoints

---

## Admin Endpoints

### Create Union

**POST** `/admin/unions`

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
  "union_id": "union-2574af3733dd26f5",
  "vaultwd_url": "http://vaultwd-service.union-2574af3733dd26f5.svc.cluster.local",
  "admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
  "status": "provisioning"
}
```

**Notes:**
- Provisioning is asynchronous and takes 2-5 minutes
- Admin token is only returned once - store it securely
- Check status via [Get Union Details](#get-union-details)

**Example:**

```bash
curl -X POST http://localhost:3000/admin/unions \
  -H "Content-Type: application/json" \
  -d '{"name": "production-environment"}'
```

---

### List Unions

**GET** `/admin/unions`

Returns all unions.

**Response:** `200 OK`

```json
{
  "unions": [
    {
      "id": "union-2574af3733dd26f5",
      "name": "production-environment",
      "vaultwd_url": "http://vaultwd-service.union-2574af3733dd26f5.svc.cluster.local",
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
curl http://localhost:3000/admin/unions
```

---

### Get Union Details

**GET** `/admin/unions/{union_id}`

Returns details for a specific union.

**Path Parameters:**
- `union_id` (string, required): Union identifier (e.g., `union-2574af3733dd26f5`)

**Response:** `200 OK`

```json
{
  "id": "union-2574af3733dd26f5",
  "name": "production-environment",
  "vaultwd_url": "http://vaultwd-service.union-2574af3733dd26f5.svc.cluster.local",
  "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
  "status": "ready",
  "error": null,
  "created_at": 1761318123092
}
```

**Union Status Values:**
- `provisioning`: Kubernetes resources are being created
- `ready`: VaultWarden is running and accessible
- `failed`: Provisioning failed (see `error` field)

**Example:**

```bash
curl http://localhost:3000/admin/unions/union-2574af3733dd26f5
```

---

### Delete Union

**DELETE** `/admin/unions/{union_id}`

Deletes a union's Kubernetes namespace and all associated resources.

**Path Parameters:**
- `union_id` (string, required): Union identifier

**Response:** `200 OK`

```json
{
  "message": "Union deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/admin/unions/union-2574af3733dd26f5
```

---

### List Deployments

**GET** `/admin/deployments`

Returns all deployments (same as [List Unions](#list-unions)).

**Response:** `200 OK`

```json
{
  "deployments": [
    {
      "id": "union-2574af3733dd26f5",
      "name": "production-environment",
      "vaultwd_url": "http://vaultwd-service.union-2574af3733dd26f5.svc.cluster.local",
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

Returns detailed information about a deployment including societies and events.

**Path Parameters:**
- `deployment_id` (string, required): Deployment identifier (union ID)

**Response:** `200 OK`

```json
{
  "union": {
    "id": "union-2574af3733dd26f5",
    "name": "production-environment",
    "vaultwd_url": "http://vaultwd-service.union-2574af3733dd26f5.svc.cluster.local",
    "vaultwd_admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
    "status": "ready",
    "error": null,
    "created_at": 1761318123092
  },
  "societies": [
    {
      "id": "society-e6557cc8e1656983",
      "name": "engineering-team",
      "union_id": "union-2574af3733dd26f5",
      "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
      "vaultwd_user_email": "society-e6557cc8e1656983@keyforge.local",
      "status": "created",
      "created_at": 1761318156000
    }
  ],
  "events": [
    {
      "id": "evt-1a2b3c4d5e6f7890",
      "deployment_id": "union-2574af3733dd26f5",
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
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5
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
  "deployment_id": "union-2574af3733dd26f5",
  "events": [
    {
      "id": "evt-1a2b3c4d5e6f7890",
      "deployment_id": "union-2574af3733dd26f5",
      "step": "helm_install",
      "status": "success",
      "message": "Helm chart installed successfully",
      "created_at": 1761318123092
    },
    {
      "id": "evt-2b3c4d5e6f789012",
      "deployment_id": "union-2574af3733dd26f5",
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
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5/events
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
  "deployment_id": "union-2574af3733dd26f5",
  "logs": [
    {
      "id": "log-1a2b3c4d5e6f7890",
      "deployment_id": "union-2574af3733dd26f5",
      "level": "info",
      "message": "Installing helm chart for union union-2574af3733dd26f5",
      "created_at": 1761318123092
    },
    {
      "id": "log-2b3c4d5e6f789012",
      "deployment_id": "union-2574af3733dd26f5",
      "level": "debug",
      "message": "Helm install stdout: Release \"union-2574af3733dd26f5\" has been installed.",
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
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5/logs

# Get only error logs
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5/logs?level=error

# Get logs since timestamp
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5/logs?since=1761318120000

# Pagination
curl http://localhost:3000/admin/deployments/union-2574af3733dd26f5/logs?page=2&limit=50
```

---

## Society Endpoints

### Create Society

**POST** `/unions/{union_id}/societies`

Creates a new organization (society) within a union.

**Path Parameters:**
- `union_id` (string, required): Union identifier

**Request Body:**

```json
{
  "name": "engineering-team"
}
```

**Response:** `201 Created`

```json
{
  "society_id": "society-e6557cc8e1656983",
  "union_id": "union-2574af3733dd26f5",
  "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
  "status": "created"
}
```

**Error Responses:**
- `404`: Union not found
- `503`: Union not ready yet (still provisioning)

**Example:**

```bash
curl -X POST http://localhost:3000/unions/union-2574af3733dd26f5/societies \
  -H "Content-Type: application/json" \
  -d '{"name": "engineering-team"}'
```

---

### Get Society Details

**GET** `/unions/{union_id}/societies/{society_id}`

Returns details for a specific society.

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier

**Response:** `200 OK`

```json
{
  "id": "society-e6557cc8e1656983",
  "name": "engineering-team",
  "union_id": "union-2574af3733dd26f5",
  "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
  "vaultwd_user_email": "society-e6557cc8e1656983@keyforge.local",
  "vaultwd_user_token": "eyJhbGc...",
  "status": "created",
  "created_at": 1761318156000
}
```

**Example:**

```bash
curl http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983
```

---

### Create Password

**POST** `/unions/{union_id}/societies/{society_id}/passwords`

Creates a new password entry in the society's vault.

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier

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
  "society_id": "society-e6557cc8e1656983",
  "name": "database-password",
  "created_at": 1761318165804
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords \
  -H "Content-Type: application/json" \
  -d '{"name": "database-password", "value": "super-secret-123"}'
```

---

### List Passwords

**GET** `/unions/{union_id}/societies/{society_id}/passwords`

Returns all passwords for a society (without values).

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier

**Response:** `200 OK`

```json
{
  "society_id": "society-e6557cc8e1656983",
  "passwords": [
    {
      "id": "pwd-657bbc9ee11296d0",
      "society_id": "society-e6557cc8e1656983",
      "name": "database-password",
      "created_at": 1761318165804
    },
    {
      "id": "pwd-789abc0e11296d12",
      "society_id": "society-e6557cc8e1656983",
      "name": "api-key",
      "created_at": 1761318180000
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords
```

---

### Get Password Details

**GET** `/unions/{union_id}/societies/{society_id}/passwords/{password_id}`

Returns full password details including the **decrypted password value**.

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier
- `password_id` (string, required): Password identifier

**Response:** `200 OK`

```json
{
  "id": "pwd-657bbc9ee11296d0",
  "society_id": "society-e6557cc8e1656983",
  "name": "database-password",
  "value": "super-secret-123",
  "created_at": 1761318165804
}
```

**⚠️ Security Note:** This endpoint returns the plaintext password. Use with caution.

**Example:**

```bash
curl http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0
```

---

### Update Password

**PUT** `/unions/{union_id}/societies/{society_id}/passwords/{password_id}`

Updates the name and/or value of a password.

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier
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
  "society_id": "society-e6557cc8e1656983",
  "name": "updated-password-name",
  "value": "new-super-secret-456",
  "created_at": 1761318165804
}
```

**Examples:**

```bash
# Update both name and value
curl -X PUT http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"name": "updated-password-name", "value": "new-super-secret-456"}'

# Update only the name
curl -X PUT http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"name": "renamed-password"}'

# Update only the value
curl -X PUT http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0 \
  -H "Content-Type: application/json" \
  -d '{"value": "rotated-password-123"}'
```

---

### Delete Password

**DELETE** `/unions/{union_id}/societies/{society_id}/passwords/{password_id}`

Deletes a password entry from the society.

**Path Parameters:**
- `union_id` (string, required): Union identifier
- `society_id` (string, required): Society identifier
- `password_id` (string, required): Password identifier

**Response:** `200 OK`

```json
{
  "message": "Password deleted successfully"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/unions/union-2574af3733dd26f5/societies/society-e6557cc8e1656983/passwords/pwd-657bbc9ee11296d0
```

---

## Health Endpoints

### Check VaultWarden Health

**GET** `/health/vaultwd/{union_id}`

Checks if the VaultWarden instance for a union is healthy and responding.

**Path Parameters:**
- `union_id` (string, required): Union identifier

**Response:** `200 OK` (Healthy)

```json
{
  "status": "healthy",
  "union_id": "union-2574af3733dd26f5",
  "message": null,
  "checked_at": 1761318200000
}
```

**Response:** `503 Service Unavailable` (Unhealthy)

```json
{
  "status": "unhealthy",
  "union_id": "union-2574af3733dd26f5",
  "message": "VaultWarden returned status 503",
  "checked_at": 1761318200000
}
```

**Example:**

```bash
curl http://localhost:3000/health/vaultwd/union-2574af3733dd26f5
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
| Union ID | `union-[a-f0-9]{16}` | `union-2574af3733dd26f5` |
| Society ID | `society-[a-f0-9]{16}` | `society-e6557cc8e1656983` |
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
  "error": "Union not found"
}
```

```json
{
  "error": "Union is not ready yet. Current status: provisioning"
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
