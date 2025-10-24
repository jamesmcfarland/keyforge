# Keyforge API Testing Guide

## Postman Collection Setup

A Postman collection is included for testing all Keyforge API endpoints. The collection contains 17 endpoints organized by functional area.

### Import Instructions

1. Open Postman
2. Click "Import" in the top-left
3. Select "File" tab
4. Choose `postman-collection.json`
5. The collection will be imported with all endpoints pre-configured

### Environment Variables

The collection uses the following variables (editable in the collection or environment):

| Variable | Default | Purpose |
|----------|---------|---------|
| `base_url` | `http://localhost:3000` | API server URL |
| `instance_id` | `instance-2574af3733dd26f5` | Test instance ID (update after creating an instance) |
| `organisation_id` | `organisation-e6557cc8e1656983` | Test organisation ID (update after creating an organisation) |
| `password_id` | `pwd-657bbc9ee11296d0` | Test password ID (update after creating a password) |
| `timestamp` | `1761318123092` | Unix timestamp for log filtering |

## Testing Workflow

### 1. Instance Management (Admin)

#### Create Instance
- **Endpoint:** POST `/admin/instances`
- **Status:** 202 (async operation)
- **Response:** Returns `instance_id` and `admin_token`
- **Action:** Copy the returned `instance_id` and update the `instance_id` variable

```bash
# Example response
{
  "instance_id": "instance-abc123def456",
  "vaultwd_url": "http://vaultwd-service.instance-abc123def456.svc.cluster.local",
  "admin_token": "2f420999e18a6ed446bbb4d109c383cc56a50a45ea04098d9fbd6ce7c859d640",
  "status": "provisioning"
}
```

#### List Instances
- **Endpoint:** GET `/admin/instances`
- **Status:** 200
- **Response:** Array of all instances with current status

#### Get Instance Details
- **Endpoint:** GET `/admin/instances/{instance_id}`
- **Status:** 200
- **Use:** Check instance status (provisioning → ready → ready or failed)
- **Retry until:** Status is `ready`

#### Delete Instance
- **Endpoint:** DELETE `/admin/instances/{instance_id}`
- **Status:** 200
- **Use:** Clean up after testing

### 2. Deployment Monitoring

#### List Deployments
- **Endpoint:** GET `/admin/deployments`
- **Status:** 200
- **Note:** Same as instances list

#### Get Deployment Details
- **Endpoint:** GET `/admin/deployments/{instance_id}`
- **Status:** 200
- **Response:** Includes instance, organisations, and events

#### Get Deployment Events
- **Endpoint:** GET `/admin/deployments/{instance_id}/events`
- **Status:** 200
- **Use:** Track provisioning steps

#### Get Deployment Logs
- **Endpoint:** GET `/admin/deployments/{instance_id}/logs`
- **Status:** 200
- **Query Parameters:**
  - `level`: Filter by log level (info, warn, error, debug)
  - `since`: Filter logs after timestamp (Unix ms)
  - `page`: Page number (default 1)
  - `limit`: Results per page (default 100, max 1000)

### 3. Organisation Management

#### Create Organisation
- **Endpoint:** POST `/instances/{instance_id}/organisations`
- **Status:** 201
- **Prerequisites:** Instance must be in `ready` status
- **Response:** Returns `organisation_id`
- **Action:** Copy the returned `organisation_id` and update the variable

```bash
# Request body
{
  "name": "engineering-team"
}

# Example response
{
  "organisation_id": "organisation-xyz789abc",
  "instance_id": "instance-abc123def456",
  "vaultwd_org_id": "42b2b981-ed49-48ce-9b3f-7ad6b53c2e46",
  "status": "created"
}
```

#### List Organisations
- **Endpoint:** GET `/instances/{instance_id}/organisations`
- **Status:** 200
- **Response:** Array of all organisations within an instance

#### Get Organisation Details
- **Endpoint:** GET `/instances/{instance_id}/organisations/{organisation_id}`
- **Status:** 200
- **Response:** Single organisation with token and status

### 4. Password Management

#### Create Password
- **Endpoint:** POST `/instances/{instance_id}/organisations/{organisation_id}/passwords`
- **Status:** 201
- **Prerequisites:** Organisation must be in `created` status
- **Response:** Returns `password_id`
- **Action:** Copy the returned `password_id` and update the variable

```bash
# Request body (optional fields can be omitted)
{
  "name": "database-password",
  "password": "super-secret-123",
  "username": "db_user",
  "totp": "",
  "uris": ["postgresql://localhost:5432"],
  "notes": "Production database credentials"
}

# Example response
{
  "password_id": "pwd-123abc456def",
  "organisation_id": "organisation-xyz789abc",
  "name": "database-password",
  "created_at": 1761318165804
}
```

#### List Passwords
- **Endpoint:** GET `/instances/{instance_id}/organisations/{organisation_id}/passwords`
- **Status:** 200
- **Response:** Array of passwords with basic info (no secrets)

#### Get Password Details
- **Endpoint:** GET `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`
- **Status:** 200
- **Response:** Full password details including decrypted value

```bash
# Example response
{
  "id": "pwd-123abc456def",
  "organisation_id": "organisation-xyz789abc",
  "name": "database-password",
  "username": "db_user",
  "password": "super-secret-123",
  "totp": "",
  "uris": ["postgresql://localhost:5432"],
  "notes": "Production database credentials",
  "created_at": 1761318165804
}
```

#### Update Password
- **Endpoint:** PUT `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`
- **Status:** 200
- **Note:** At least one field must be provided
- **Response:** Updated password details

#### Delete Password
- **Endpoint:** DELETE `/instances/{instance_id}/organisations/{organisation_id}/passwords/{password_id}`
- **Status:** 200

### 5. Health Checks

#### Check VaultWarden Health
- **Endpoint:** GET `/health/vaultwd/{instance_id}`
- **Status:** 200 (healthy) or 503 (unhealthy/not ready)
- **Use:** Verify instance is running before creating organisations

```bash
# Healthy response
{
  "status": "healthy",
  "instance_id": "instance-abc123def456",
  "message": "OK",
  "checked_at": 1761318200000
}

# Unhealthy response
{
  "status": "unhealthy",
  "instance_id": "instance-abc123def456",
  "message": "Instance status is provisioning",
  "checked_at": 1761318200000
}
```

## Complete Testing Workflow

### Scenario 1: Full End-to-End Test

```
1. Create Instance
   ↓
2. Wait for instance status to be "ready" (poll Get Instance Details)
   ↓
3. Check Health (verify status 200)
   ↓
4. Create Organisation
   ↓
5. Create Password(s)
   ↓
6. Get Password Details (verify encrypted value is decrypted)
   ↓
7. Update Password
   ↓
8. List Passwords
   ↓
9. Delete Password
   ↓
10. Check Deployment Events & Logs
   ↓
11. Delete Instance
```

### Scenario 2: Monitoring Deployment

```
1. Create Instance
   ↓
2. Get Deployment Details (check events and organisations)
   ↓
3. Get Deployment Logs (filter by level, check provisioning steps)
   ↓
4. Get Deployment Events (track each provisioning step)
```

### Scenario 3: Organisation Management

```
1. Ensure instance is in "ready" status
   ↓
2. Create multiple organisations
   ↓
3. List Organisations (verify all created)
   ↓
4. Get specific organisation details
   ↓
5. Manage passwords within each organisation
```

## Error Handling

### Common HTTP Responses

| Status | Scenario | Resolution |
|--------|----------|-----------|
| 202 | Instance creation initiated | Poll endpoint until status changes |
| 201 | Resource created successfully | Copy ID for subsequent operations |
| 400 | Invalid request body | Check JSON syntax and required fields |
| 404 | Resource not found | Verify IDs are correct and resources exist |
| 503 | Instance/organisation not ready | Wait for provisioning to complete |
| 500 | Server error | Check server logs, retry operation |

### Validation Rules

- **Instance name:** Required, non-empty string
- **Organisation name:** Required, non-empty string
- **Password name:** Required, non-empty string
- **Password value:** Required, non-empty string
- **Optional fields:** username, totp, uris (array), notes
- **URI format:** Any string (usually URL)
- **TOTP format:** Base64-encoded secret

## Tips for Testing

1. **Use timestamps in variable:** Update `{{timestamp}}` for fresh logs
2. **Monitor logs:** Use deployment logs endpoint to debug provisioning
3. **Check events:** Deployment events show each provisioning step
4. **Variable updates:** Manually update Postman variables after resource creation
5. **Parallel tests:** Create multiple instances for concurrent testing
6. **Error responses:** All errors follow `{ error: string }` format

## API Rate Limiting

Currently no rate limiting is enforced. Monitor server resources during testing.

## Next Steps

- Automate testing with Postman scripts (tests tab)
- Integrate with CI/CD pipeline
- Add performance testing (response times)
- Test concurrent requests
