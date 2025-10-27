# JWT Authentication Implementation Plan

## Overview
Implementation of ECC-based JWT authentication for Keyforge with comprehensive audit logging.

## Clarifications & Requirements

### Authentication Model
- **Clients sign JWTs**, server only verifies them
- **Root tokens**: Admin operations on instances (no direct instance access)
- **Instance tokens**: Full access to specific instance
- **Short-lived tokens**: 60 second expiration
- **ECC crypto**: ECDSA P-256 (ES256) for signing

### Key Management
1. **Root Key Pair**
   - Stored in environment variables (base64 encoded)
   - Manually rotated
   - Private key held by admin clients
   - Public key loaded on server startup

2. **Instance Key Pairs**
   - Generated on instance creation
   - **Private key**: Sent once to client, never stored
   - **Public key**: Stored in database for verification
   - Client responsible for securing private key

### JWT Payload Structure
```json
{
  "sub": "instance-{id}" | "root",
  "iat": 1234567890,
  "exp": 1234567950,
  "instanceId": "instance-xxx",
  "requestId": "uuid-v4",
  "metadata": {
    // Client-defined flexible schema
  },
  "isAdmin": true // Only for root tokens
}
```

### Audit Logging
- Log every authenticated request
- **Captured data**:
  - Timestamp
  - Endpoint path
  - HTTP method
  - Instance ID (from JWT)
  - Request ID (from JWT)
  - Metadata object (from JWT)
  - Response status code
  - Event type (categorization)
- **NOT captured**: Request/response bodies
- **Event Types**:
  - `admin_operation` - Instance CRUD, key rotation
  - `instance_access` - Reading instance data
  - `data_modification` - Creating/updating data
  - `auth_failure` - Failed JWT verification
  - `key_rotation` - Key management operations

---

## Database Schema Changes

### New Tables

#### `key_pairs`
```sql
CREATE TABLE key_pairs (
  id VARCHAR(255) PRIMARY KEY,
  instance_id VARCHAR(255) REFERENCES instances(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);
```
- `instance_id` is nullable (NULL for root key pair)
- Store public keys only for JWT verification

#### `audit_logs`
```sql
CREATE TABLE audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  instance_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  metadata JSONB,
  response_status SMALLINT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_instance_id ON audit_logs(instance_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
```

---

## Environment Variables

Add to `.env`:
```bash
# Root JWT key pair (base64 encoded PEM format)
ROOT_JWT_PRIVATE_KEY=<base64-private-key>
ROOT_JWT_PUBLIC_KEY=<base64-public-key>
```

---

## Implementation Phases

### Phase 1: Database Schema
**Files**: `drizzle/000X_add_jwt_auth.sql`, `src/db/schema.ts`

- Create migration for `key_pairs` and `audit_logs` tables
- Add Drizzle schema definitions
- Add indexes for audit log queries

### Phase 2: Type Definitions
**File**: `src/types.ts`

Add interfaces:
```typescript
export interface JWTPayload {
  sub: string
  iat: number
  exp: number
  instanceId: string
  requestId: string
  metadata: Record<string, any>
  isAdmin?: boolean
}

export interface KeyPair {
  id: string
  instanceId: string | null
  publicKey: string
  createdAt: Date
  revokedAt: Date | null
}

export interface AuditLog {
  id: string
  timestamp: Date
  endpoint: string
  method: string
  instanceId: string
  requestId: string
  metadata: Record<string, any>
  responseStatus: number
  eventType: AuditEventType
  createdAt: Date
}

export type AuditEventType = 
  | 'admin_operation' 
  | 'instance_access' 
  | 'data_modification'
  | 'auth_failure'
  | 'key_rotation'
```

Extend Hono context:
```typescript
declare module 'hono' {
  interface ContextVariableMap {
    jwt?: JWTPayload
    requestId: string
  }
}
```

### Phase 3: JWT Service
**File**: `src/services/jwt-service.ts`

Functions:
```typescript
// Generate ECC P-256 key pair (PEM format)
export async function generateECCKeyPair(): Promise<{
  privateKey: string
  publicKey: string
}>

// Verify JWT signature with public key
export async function verifyJWT(
  token: string, 
  publicKey: string
): Promise<JWTPayload | null>

// Decode JWT without verification (for debugging)
export function decodeJWT(token: string): JWTPayload | null
```

Implementation notes:
- Use Node.js `crypto.subtle` (Web Crypto API)
- Algorithm: ECDSA with P-256 curve (ES256)
- PEM format for key storage
- Return null on verification failure (don't throw)

### Phase 4: Key Pair Registry
**File**: `src/services/key-registry.ts`

Functions:
```typescript
// Store instance public key
export async function storeInstanceKey(
  instanceId: string,
  publicKey: string
): Promise<void>

// Get instance public key for verification
export async function getInstancePublicKey(
  instanceId: string
): Promise<string | null>

// Revoke a key pair
export async function revokeKey(keyId: string): Promise<void>

// Initialize root key from environment
export function loadRootPublicKey(): string
```

### Phase 5: Audit Logger Service
**File**: `src/services/audit-logger.ts`

Functions:
```typescript
export async function logRequest(
  endpoint: string,
  method: string,
  instanceId: string,
  requestId: string,
  metadata: Record<string, any>,
  responseStatus: number,
  eventType: AuditEventType
): Promise<void>

// Determine event type from endpoint + method
export function categorizeRequest(
  path: string,
  method: string
): AuditEventType
```

Implementation notes:
- Async insert to minimize request latency
- Auto-generate UUID for log entry
- Use `categorizeRequest()` to infer event type

### Phase 6: JWT Auth Middleware
**File**: `src/middleware/jwt-auth.ts`

```typescript
export function jwtAuth() {
  return async (c: Context, next: Next) => {
    // 1. Extract token from Authorization header
    // 2. Decode to get 'sub' and 'instanceId'
    // 3. Fetch public key (env for root, DB for instance)
    // 4. Verify signature and expiration
    // 5. Attach to c.set('jwt', payload)
    // 6. Return 401 if invalid
    // 7. Call next()
  }
}
```

Error responses:
- Missing token: `401 { error: 'No authorization token' }`
- Invalid signature: `401 { error: 'Invalid token signature' }`
- Expired: `401 { error: 'Token expired' }`
- Unknown instance: `401 { error: 'Unknown instance' }`

### Phase 7: Audit Middleware
**File**: `src/middleware/audit-middleware.ts`

```typescript
export function auditLogger() {
  return async (c: Context, next: Next) => {
    // 1. Generate requestId if not in JWT
    // 2. Attach to c.set('requestId', uuid)
    // 3. Call next()
    // 4. After response, extract status code
    // 5. Call audit service (async, don't await)
  }
}
```

Implementation notes:
- Run audit logging async (don't block response)
- Use `c.finalized` to get final status code
- Extract JWT data from context

### Phase 8: Update Instance Creation
**File**: `src/routes/admin.ts`

Modify `POST /admin/instances`:
```typescript
// 1. Generate ECC key pair
const { privateKey, publicKey } = await generateECCKeyPair()

// 2. Store public key in database
await storeInstanceKey(instanceId, publicKey)

// 3. Return private key ONCE in response
return c.json({
  instance_id: instanceId,
  private_key: privateKey, // ⚠️ One-time delivery
  vaultwd_url: vaultwd_url,
  status: 'provisioning'
}, 202)
```

Add warning in response documentation that private key is only sent once.

### Phase 9: Root Key Initialization
**File**: `src/index.ts`

On startup:
```typescript
// Validate root keys are present
if (!process.env.ROOT_JWT_PUBLIC_KEY) {
  throw new Error('ROOT_JWT_PUBLIC_KEY not configured')
}

// Load and validate format
loadRootPublicKey()
console.log('✓ Root JWT public key loaded')
```

### Phase 10: Apply Middleware
**File**: `src/index.ts`

```typescript
// Global audit logging (before auth)
app.use('*', auditLogger())

// Protect admin routes
app.use('/admin/*', jwtAuth())

// Protect instance routes (organisations, passwords)
app.use('/organisations/*', jwtAuth())
```

Authorization checks:
- Admin endpoints: Require `jwt.isAdmin === true`
- Instance endpoints: Require `jwt.instanceId` matches resource

---

## Implementation Order

1. ✅ Create git branch
2. ✅ Write this plan document
3. Database schema migration
4. Type definitions
5. JWT service (crypto operations)
6. Key registry service
7. Audit logger service
8. JWT auth middleware
9. Audit middleware
10. Update instance creation endpoint
11. Root key initialization
12. Apply middleware to routes
13. Test with real JWT tokens
14. Update API documentation

---

## Testing Approach

### Manual Testing
1. Generate test root key pair using JWT service
2. Create instance and receive private key
3. Sign JWTs with private keys (external tool or script)
4. Test authenticated requests
5. Verify audit logs in database

### JWT Test Script
Create `scripts/test-jwt.ts`:
- Load private key
- Sign JWT with metadata
- Make authenticated request
- Verify audit log entry

---

## Security Considerations

1. **Private Key Exposure**
   - Private keys sent once over HTTPS
   - Never logged or stored server-side
   - Client must secure in vault/secrets manager

2. **Token Expiration**
   - 60s lifetime limits replay window
   - No refresh tokens (issue new JWT client-side)

3. **Key Rotation**
   - Manual root key rotation via env vars
   - Instance keys can be rotated via new endpoint (future)

4. **Audit Log Retention**
   - Consider data retention policy
   - No PII in metadata (client responsibility)

---

## Future Enhancements

- [ ] Key rotation endpoint for instances
- [ ] JWKS endpoint for public key distribution
- [ ] Audit log query API
- [ ] Rate limiting per instance
- [ ] JWT revocation list (JTI tracking)

---

## Documentation Updates Needed

- API reference: Authentication header format
- Instance creation: Private key delivery warning
- Root token setup: Key generation instructions
- Client integration guide: JWT signing examples
- Audit log schema reference
