# Postman Collection Setup

## Quick Start

### 1. Import Collection
- Open Postman
- Click **Import** → **File** → Select `postman-collection.json`
- Collection "Keyforge API" appears in left sidebar

### 2. Configure Variables
Edit collection variables (right-click collection → Edit → Variables tab):

| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:3000` |
| `instance_id` | Update after creating instance |
| `organisation_id` | Update after creating organisation |
| `password_id` | Update after creating password |

### 3. Start Testing

**Option A: Follow complete workflow**
```
1. Root → Get API Info
2. Admin Instances → Create Instance
3. Admin Instances → Get Instance Details (repeat until status="ready")
4. Health → Check VaultWarden Health
5. Organisations → Create Organisation
6. Passwords → Create Password
7. Continue with other operations...
```

**Option B: Run individual tests**
- Each endpoint is standalone and can be tested independently
- Required IDs must be set in variables

## Collection Structure

```
Keyforge API
├── Root
│   └── Get API Info
├── Admin - Instances
│   ├── Create Instance
│   ├── List All Instances
│   ├── Get Instance Details
│   └── Delete Instance
├── Admin - Deployments
│   ├── List All Deployments
│   ├── Get Deployment Details
│   ├── Get Deployment Events
│   └── Get Deployment Logs
├── Organisations
│   ├── Create Organisation
│   ├── List Organisations
│   └── Get Organisation Details
├── Passwords
│   ├── Create Password
│   ├── List Passwords
│   ├── Get Password Details
│   ├── Update Password
│   └── Delete Password
└── Health
    └── Check VaultWarden Health
```

## Key Features

✅ **17 pre-configured endpoints** - All API operations included
✅ **Variable placeholders** - Reusable across requests
✅ **Example request bodies** - Copy/modify for your use case
✅ **Organized by resource** - Easy to find and test by feature
✅ **Complete documentation** - See TESTING.md for workflows

## Common Tasks

### Test Instance Creation Flow
1. Create Instance → Copy instance_id
2. Update `{{instance_id}}` variable
3. Poll Get Instance Details until status="ready"
4. Check Health confirms VaultWarden is running

### Test Organisation & Passwords
1. Ensure instance is "ready"
2. Create Organisation → Copy organisation_id
3. Update `{{organisation_id}}` variable
4. Create Password → Copy password_id
5. Update `{{password_id}}` variable
6. Get Password Details to verify encryption
7. Update/Delete as needed

### Monitor Deployment
1. After creating instance, check Deployment Details
2. Get Deployment Events to see provisioning steps
3. Get Deployment Logs (filter by level if needed)

## Troubleshooting

**404 Not Found**
- Verify `base_url` is correct
- Confirm resource IDs are updated in variables
- Check instance/organisation/password exists

**503 Service Unavailable**
- Instance/organisation not ready yet
- For instances: wait for provisioning to complete
- Check Health endpoint for status

**400 Bad Request**
- Check JSON syntax in request body
- Verify all required fields are present
- Ensure field values are correct type

**Empty responses**
- Instance may still be provisioning
- Use Get Deployment Events to monitor progress
- Check server logs for errors

## Next Steps

1. **Automate tests** - Add tests to endpoints (Tests tab)
2. **Create environment** - Save different server URLs
3. **Generate reports** - Use Postman's runner feature
4. **API documentation** - Share with team via Postman documentation
5. **CI/CD integration** - Run tests via Newman (CLI)

## Reference

- **API Documentation:** See openapi.yaml
- **Testing Guide:** See TESTING.md
- **Server:** http://localhost:3000
